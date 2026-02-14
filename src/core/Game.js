/**
 * Core Game Class
 * 
 * This is the main game controller that manages:
 * - Three.js renderer and scene
 * - WebXR session lifecycle
 * - Game loop (fixed timestep for logic, variable for rendering)
 * - System coordination
 * 
 * AI WALKTHROUGH - INITIALIZATION FLOW:
 * 1. Constructor creates renderer and scene
 * 2. initialize() loads resources and sets up systems
 * 3. start() begins the game loop
 * 4. enterVR() switches to VR mode
 * 
 * PERFORMANCE ARCHITECTURE:
 * - Fixed timestep (60Hz) for game logic (deterministic)
 * - Variable timestep for rendering (VR demands 90/120Hz)
 * - This separation prevents physics bugs from frame rate variations
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createXRSession } from '../utils/WebXRUtils.js';
import { UnitSystem } from '../systems/UnitSystem.js';
import { SelectionSystem } from '../systems/SelectionSystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { HealthBarSystem } from '../systems/HealthBarSystem.js';
import { BuildingSystem } from '../systems/BuildingSystem.js';

export class Game {
  /**
   * Create game instance
   * @param {HTMLElement} container - DOM element to attach renderer
   * @param {PerformanceMonitor} performanceMonitor - Performance tracking
   */
  constructor(container, performanceMonitor) {
    this.container = container;
    this.performanceMonitor = performanceMonitor;
    
    // Game state
    this.isRunning = false;
    this.isPaused = false;
    this.isVRMode = false;
    
    // Building mode state
    this.buildingMode = false;
    this.selectedBuildingType = null;
    this.buildingGhost = null;
    this.buildingGhostValid = false;
    
    // Selected building for production
    this.selectedBuilding = null;
    
    // UI update throttling
    this.uiUpdateTimer = 0;
    this.uiUpdateInterval = 0.1; // Update UI 10 times per second
    
    // Timing for fixed timestep
    this.fixedTimeStep = 1000 / 60; // 60 Hz for game logic
    this.maxFrameTime = 250; // Cap delta to prevent spiral of death
    this.accumulator = 0;
    this.lastTime = performance.now();
    
    // Initialize Three.js
    this.initRenderer();
    this.initScene();
    this.initCamera();
    this.initLighting();
    
    // VR Controllers (initialized when entering VR)
    this.controllers = [];
    this.xrSession = null;
    
    console.log('[Game] Instance created');
  }
  
  /**
   * Initialize WebGL Renderer
   * 
   * PERFORMANCE SETTINGS:
   * - antialias: false (expensive in VR, use FXAA post-process instead)
   * - powerPreference: high-performance (use discrete GPU if available)
   * - alpha: false (we don't need transparency, saves bandwidth)
   */
  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: false, // Too expensive for VR, we'll use post-processing
      powerPreference: 'high-performance',
      alpha: false // Opaque background, more efficient
    });
    
    // Set size to full window
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    
    // Set pixel ratio (capped at 2 for performance)
    // IMPORTANT: Higher pixel ratio = exponentially more pixels to render
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    // Enable shadows (can be disabled for performance)
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // XR settings
    this.renderer.xr.enabled = true;
    
    // Add canvas to container
    this.container.appendChild(this.renderer.domElement);
    
    console.log('[Game] Renderer initialized');
  }
  
  /**
   * Initialize Three.js Scene
   */
  initScene() {
    this.scene = new THREE.Scene();
    
    // Set background color (nice gradient is expensive, solid color is fast)
    this.scene.background = new THREE.Color(0x222244);
    
    // Fog for depth perception and performance (far objects fade out)
    this.scene.fog = new THREE.Fog(0x222244, 50, 200);
    
    console.log('[Game] Scene initialized');
  }
  
  /**
   * Initialize Camera
   * 
   * PATTERN: Desktop camera vs VR camera
   * - Desktop: We control the camera
   * - VR: WebXR controls the camera, we just set reference space
   */
  initCamera() {
    // Desktop camera (not used in VR mode)
    this.camera = new THREE.PerspectiveCamera(
      75, // FOV
      window.innerWidth / window.innerHeight, // Aspect
      0.1, // Near plane
      1000 // Far plane
    );
    
    // Position camera above the battlefield
    this.camera.position.set(0, 20, 30);
    this.camera.lookAt(0, 0, 0);
    
    // VR camera will be created automatically by XR session
    
    // Add orbit controls for desktop mode
    this.initDesktopControls();
    
    console.log('[Game] Camera initialized');
  }
  
  /**
   * Initialize Lighting
   * 
   * PERFORMANCE: Use minimal lights for VR
   * - 1 directional light (sun)
   * - 1 ambient light (fill)
   * - NO point lights on moving objects (expensive)
   */
  initLighting() {
    // Ambient light (provides base illumination)
    const ambient = new THREE.AmbientLight(0x404060, 0.5);
    this.scene.add(ambient);
    
    // Directional light (sun)
    const sun = new THREE.DirectionalLight(0xffffee, 1.0);
    sun.position.set(50, 100, 30);
    sun.castShadow = true;
    
    // Shadow map settings (balance quality/performance)
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 500;
    sun.shadow.camera.left = -50;
    sun.shadow.camera.right = 50;
    sun.shadow.camera.top = 50;
    sun.shadow.camera.bottom = -50;
    
    this.scene.add(sun);
    
    // Store reference for later
    this.sunLight = sun;
    
    console.log('[Game] Lighting initialized');
  }
  
  /**
   * Initialize desktop camera controls
   * PATTERN: Only used in desktop mode, disabled in VR
   */
  initDesktopControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    
    // Configure controls for RTS-style view
    this.controls.enableDamping = true; // Smooth camera movement
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = false; // Pan in world space
    this.controls.minDistance = 5; // Minimum zoom
    this.controls.maxDistance = 100; // Maximum zoom
    this.controls.maxPolarAngle = Math.PI / 2; // Don't go below ground
    
    // Set target to center of battlefield
    this.controls.target.set(0, 0, 0);
    
    console.log('[Game] Desktop orbit controls initialized');
  }
  
  /**
   * Initialize game systems and load resources
   * 
   * AI NOTE: This is async because we might load models/textures
   */
  async initialize() {
    // Create ground plane
    this.createGroundPlane();
    
    // Add demo cube to verify rendering
    this.createDemoCube();
    
    // Initialize game systems
    this.unitSystem = new UnitSystem(this.scene);
    this.buildingSystem = new BuildingSystem(this.scene, this.unitSystem);
    this.combatSystem = new CombatSystem(this.scene, this.unitSystem);
    this.selectionSystem = new SelectionSystem(this.camera, this.renderer, this.unitSystem);
    this.selectionSystem.init(this.scene);
    this.healthBarSystem = new HealthBarSystem(this.scene, this.camera);
    
    // Spawn starting bases
    this.spawnStartingBases();
    
    // Spawn some demo units for testing
    this.spawnDemoUnits();
    
    // Setup right-click commanding
    this.setupCommandInput();
    
    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();
    
    // Setup building placement
    this.setupBuildingPlacement();
    
    // Future systems:
    // this.resourceSystem = new ResourceSystem();
    
    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize());
    
    console.log('[Game] Initialization complete');
  }
  
  /**
   * Spawn starting Command Centers for both teams
   */
  spawnStartingBases() {
    // Player Command Center (team 0, left side)
    const playerBase = this.buildingSystem.placeBuilding(
      'command_center',
      -50,
      0,
      0,
      true // Skip construction, instant
    );
    
    // Enemy Command Center (team 1, right side)
    const enemyBase = this.buildingSystem.placeBuilding(
      'command_center',
      50,
      0,
      1,
      true // Skip construction, instant
    );
    
    console.log('[Game] Spawned starting Command Centers for both teams');
  }
  
  /**
   * Spawn demo units for testing
   * PERFORMANCE TEST: Spawning 50 units with instanced rendering
   * COMBAT TEST: Player team (0) vs Enemy team (1)
   */
  spawnDemoUnits() {
    // Spawn 25 player units (team 0) on left side
    for (let i = 0; i < 25; i++) {
      const x = -40 + Math.random() * 20;
      const z = (Math.random() - 0.5) * 60;
      const types = ['scout', 'soldier', 'tank', 'artillery'];
      const type = types[Math.floor(Math.random() * types.length)];
      const unit = this.unitSystem.spawnUnit(type, x, z, 0);
      
      // Enable auto-attack for player units too
      if (unit) {
        unit.autoAttack = true;
      }
    }
    
    // Spawn 25 enemy units (team 1) on right side
    for (let i = 0; i < 25; i++) {
      const x = 40 + Math.random() * 20;
      const z = (Math.random() - 0.5) * 60;
      const types = ['scout', 'soldier', 'tank', 'artillery'];
      const type = types[Math.floor(Math.random() * types.length)];
      const unit = this.unitSystem.spawnUnit(type, x, z, 1);
      
      // Enable auto-attack for enemy units
      if (unit) {
        unit.autoAttack = true;
      }
    }
    
    console.log('[Game] Spawned 25 player units (team 0) and 25 enemy units (team 1) - COMBAT ENABLED');
  }
  
  /**
   * Setup command input (right-click to move)
   */
  setupCommandInput() {
    this.renderer.domElement.addEventListener('contextmenu', (event) => {
      event.preventDefault(); // Prevent context menu
      
      // Ignore if in building mode
      if (this.buildingMode) return;
      
      // Calculate world position from mouse
      const rect = this.renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      // Raycast to ground plane
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, this.camera);
      
      // Intersect with ground plane at y=0
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const target = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, target);
      
      if (target) {
        // Check if building is selected - set rally point
        if (this.selectedBuilding) {
          this.selectedBuilding.setRallyPoint(target.x, target.z);
          console.log(`[Game] Rally point set to (${target.x.toFixed(1)}, ${target.z.toFixed(1)})`);
          
          // Visual feedback for rally point
          this.showRallyPointMarker(target);
        }
        // Otherwise command units to move
        else if (this.selectionSystem.hasSelection()) {
          this.selectionSystem.commandMove(target.x, target.z);
          
          // Visual feedback (temporary marker)
          this.showMoveMarker(target);
        }
      }
    });
    
    console.log('[Game] Command input setup (right-click to move/rally)');
  }
  
  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    window.addEventListener('keydown', (event) => {
      // H key: Toggle health bars
      if (event.key === 'h' || event.key === 'H') {
        if (this.healthBarSystem) {
          this.healthBarSystem.toggleShowAll();
        }
      }
      
      // B key: Toggle building mode
      if (event.key === 'b' || event.key === 'B') {
        this.toggleBuildingMode();
      }
      
      // ESC: Cancel building mode
      if (event.key === 'Escape') {
        if (this.buildingMode) {
          this.toggleBuildingMode();
        }
      }
      
      // Q key: Select Barracks
      if (event.key === 'q' || event.key === 'Q') {
        this.selectBuilding('barracks');
      }
      
      // W key: Select Factory
      if (event.key === 'w' || event.key === 'W') {
        this.selectBuilding('factory');
      }
      
      // E key: Select Shield Generator
      if (event.key === 'e' || event.key === 'E') {
        this.selectBuilding('shield_generator');
      }
      
      // Production hotkeys (when building is selected)
      if (this.selectedBuilding && !this.buildingMode) {
        // 1-5 keys for unit production
        if (event.key >= '1' && event.key <= '5') {
          this.queueUnitProduction(event.key);
        }
        
        // R key: Set rally point mode
        if (event.key === 'r' || event.key === 'R') {
          console.log('[Game] Rally point mode not yet implemented');
        }
      }
      
      // Tab: Cycle through player buildings
      if (event.key === 'Tab') {
        event.preventDefault(); // Prevent default tab behavior
        this.cycleSelectedBuilding();
      }
    });
    
    console.log('[Game] Keyboard shortcuts: H = health bars, B = building mode, Q/W/E = buildings, 1-5 = produce units, Tab = cycle buildings');
  }
  
  /**
   * Cycle through player buildings
   */
  cycleSelectedBuilding() {
    const playerBuildings = this.buildingSystem.allBuildings.filter(b => b.team === 0 && b.isAlive);
    
    if (playerBuildings.length === 0) {
      console.log('[Game] No player buildings to select');
      return;
    }
    
    // Find current selected building index
    let currentIndex = -1;
    if (this.selectedBuilding) {
      currentIndex = playerBuildings.indexOf(this.selectedBuilding);
    }
    
    // Select next building (wrap around)
    const nextIndex = (currentIndex + 1) % playerBuildings.length;
    this.selectBuildingEntity(playerBuildings[nextIndex]);
    
    console.log(`[Game] Cycled to building ${nextIndex + 1}/${playerBuildings.length}`);
  }
  
  /**
   * Queue unit production from selected building
   * @param {string} key - Number key pressed (1-5)
   */
  queueUnitProduction(key) {
    if (!this.selectedBuilding || !this.selectedBuilding.isConstructed()) {
      console.log('[Game] Building not ready for production');
      return;
    }
    
    // Map keys to unit types based on building
    let unitType = null;
    const producible = this.selectedBuilding.producibleUnits;
    
    const keyNum = parseInt(key);
    if (keyNum > 0 && keyNum <= producible.length) {
      unitType = producible[keyNum - 1];
    }
    
    if (unitType) {
      const success = this.selectedBuilding.queueProduction(unitType);
      if (success) {
        console.log(`[Game] Queued ${unitType} for production`);
        this.updateProductionUI();
      } else {
        console.log(`[Game] Cannot queue ${unitType}`);
      }
    }
  }
  
  /**
   * Toggle building placement mode
   */
  toggleBuildingMode() {
    this.buildingMode = !this.buildingMode;
    
    if (this.buildingMode) {
      console.log('[Game] Building mode ENABLED');
      this.updateBuildingUI();
    } else {
      console.log('[Game] Building mode DISABLED');
      this.selectedBuildingType = null;
      this.removeBuildingGhost();
      this.updateBuildingUI();
    }
  }
  
  /**
   * Select a building type for placement
   */
  selectBuilding(buildingType) {
    if (!this.buildingMode) {
      this.buildingMode = true;
    }
    
    this.selectedBuildingType = buildingType;
    this.createBuildingGhost(buildingType);
    this.updateBuildingUI();
    
    console.log(`[Game] Selected building: ${buildingType}`);
  }
  
  /**
   * Create ghost preview of building
   */
  createBuildingGhost(buildingType) {
    this.removeBuildingGhost();
    
    // Create ghost geometry based on type
    let geometry;
    switch(buildingType) {
      case 'command_center':
        geometry = new THREE.BoxGeometry(6, 3, 6);
        break;
      case 'barracks':
        geometry = new THREE.BoxGeometry(4, 2, 4);
        break;
      case 'factory':
        geometry = new THREE.BoxGeometry(5, 2.5, 5);
        break;
      case 'shield_generator':
        geometry = new THREE.BoxGeometry(2, 4, 2);
        break;
    }
    
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.5,
      wireframe: false
    });
    
    this.buildingGhost = new THREE.Mesh(geometry, material);
    this.buildingGhost.position.y = 100; // Start offscreen
    this.scene.add(this.buildingGhost);
  }
  
  /**
   * Remove building ghost preview
   */
  removeBuildingGhost() {
    if (this.buildingGhost) {
      this.scene.remove(this.buildingGhost);
      this.buildingGhost.geometry.dispose();
      this.buildingGhost.material.dispose();
      this.buildingGhost = null;
    }
  }
  
  /**
   * Update building ghost position
   */
  updateBuildingGhost(event) {
    if (!this.buildingGhost) return;
    
    const rect = this.renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);
    
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const target = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, target);
    
    if (target) {
      this.buildingGhost.position.copy(target);
      this.buildingGhost.position.y = this.buildingGhost.geometry.parameters.height / 2;
      
      // Check if placement is valid (simplified - just check not too close to other buildings)
      this.buildingGhostValid = true; // TODO: Add collision check
      this.buildingGhost.material.color.setHex(this.buildingGhostValid ? 0x00ff00 : 0xff0000);
    }
  }
  
  /**
   * Setup building placement input
   */
  setupBuildingPlacement() {
    // Track mouse movement for ghost
    this.renderer.domElement.addEventListener('mousemove', (event) => {
      if (this.buildingMode && this.selectedBuildingType) {
        this.updateBuildingGhost(event);
      }
    });
    
    // Left click to place building
    this.renderer.domElement.addEventListener('click', (event) => {
      if (this.buildingMode && this.selectedBuildingType && this.buildingGhost) {
        const pos = this.buildingGhost.position;
        
        if (this.buildingGhostValid) {
          // Place the building
          this.buildingSystem.placeBuilding(
            this.selectedBuildingType,
            pos.x,
            pos.z,
            0, // Player team
            false // Don't skip construction
          );
          
          console.log(`[Game] Placed ${this.selectedBuildingType} at (${pos.x.toFixed(1)}, ${pos.z.toFixed(1)})`);
          
          // Exit building mode
          this.toggleBuildingMode();
        }
      } else if (!this.buildingMode) {
        // Try to select a building
        this.trySelectBuilding(event);
      }
    });
    
    // Setup building button UI
    if (typeof document !== 'undefined') {
      const buttons = document.querySelectorAll('.building-button');
      buttons.forEach(button => {
        button.addEventListener('click', () => {
          const buildingType = button.getAttribute('data-building');
          this.selectBuilding(buildingType);
        });
      });
    }
    
    console.log('[Game] Building placement setup complete');
  }
  
  /**
   * Update building UI
   */
  updateBuildingUI() {
    if (typeof document === 'undefined') return;
    
    const modeText = document.getElementById('building-mode-text');
    if (modeText) {
      if (this.buildingMode && this.selectedBuildingType) {
        modeText.innerHTML = `<strong style="color: #4ade80;">BUILDING MODE</strong><br>Click to place ${this.selectedBuildingType}`;
      } else if (this.buildingMode) {
        modeText.innerHTML = '<strong style="color: #4ade80;">BUILDING MODE</strong><br>Select a building type';
      } else {
        modeText.innerHTML = 'Press <strong>B</strong> to enter building mode';
      }
    }
    
    // Update button active states
    document.querySelectorAll('.building-button').forEach(button => {
      const buildingType = button.getAttribute('data-building');
      if (this.selectedBuildingType === buildingType) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
  }
  
  /**
   * Try to select a building
   */
  trySelectBuilding(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);
    
    // Check for building intersections
    const buildingMeshes = Object.values(this.buildingSystem.instancedMeshes);
    const intersects = raycaster.intersectObjects(buildingMeshes, false);
    
    if (intersects.length > 0) {
      const intersection = intersects[0];
      const instanceId = intersection.instanceId;
      const mesh = intersection.object;
      
      // Find which building type this mesh represents
      let buildingType = null;
      for (const [type, typeMesh] of Object.entries(this.buildingSystem.instancedMeshes)) {
        if (typeMesh === mesh) {
          buildingType = type;
          break;
        }
      }
      
      if (buildingType !== null) {
        // Get the actual building from the array
        const buildings = this.buildingSystem.buildingsByType[buildingType];
        const building = buildings[instanceId];
        
        if (building && building.team === 0) { // Only select player buildings
          this.selectBuildingEntity(building);
        }
      }
    } else {
      // Clicked empty space - deselect building
      this.deselectBuildingEntity();
    }
  }
  
  /**
   * Select a building entity
   */
  selectBuildingEntity(building) {
    // Deselect previous building
    if (this.selectedBuilding) {
      this.selectedBuilding.isSelected = false;
    }
    
    this.selectedBuilding = building;
    building.isSelected = true;
    
    console.log(`[Game] Selected ${building.type} (HP: ${building.health}/${building.maxHealth})`);
    
    // Update production UI
    this.updateProductionUI();
  }
  
  /**
   * Deselect building entity
   */
  deselectBuildingEntity() {
    if (this.selectedBuilding) {
      this.selectedBuilding.isSelected = false;
      this.selectedBuilding = null;
    }
    
    // Hide production UI
    this.updateProductionUI();
  }
  
  /**
   * Update production UI to show selected building's queue
   */
  updateProductionUI() {
    if (typeof document === 'undefined') return;
    
    const panel = document.getElementById('production-panel');
    const queueDiv = document.getElementById('production-queue');
    
    if (!panel || !queueDiv) return;
    
    if (this.selectedBuilding && this.selectedBuilding.isAlive) {
      panel.classList.add('active');
      
      // Update building info
      let html = `<div style="margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.2);">`;
      html += `<strong>${this.selectedBuilding.type.toUpperCase()}</strong><br>`;
      html += `<span style="font-size: 11px; opacity: 0.7;">HP: ${Math.floor(this.selectedBuilding.health)}/${this.selectedBuilding.maxHealth}</span>`;
      html += `</div>`;
      
      // Show producible units
      if (this.selectedBuilding.canProduce && this.selectedBuilding.isConstructed()) {
        html += `<div style="margin-bottom: 8px; font-size: 12px;">`;
        html += `<strong>Available Units:</strong><br>`;
        this.selectedBuilding.producibleUnits.forEach((unitType, index) => {
          html += `[${index + 1}] ${unitType}<br>`;
        });
        html += `</div>`;
      }
      
      // Show current production
      if (this.selectedBuilding.currentProduction) {
        html += `<div class="production-item">`;
        html += `<strong>Producing:</strong> ${this.selectedBuilding.currentProduction}<br>`;
        html += `<div class="progress-bar">`;
        html += `<div class="progress-fill" style="width: ${this.selectedBuilding.productionProgress * 100}%"></div>`;
        html += `</div>`;
        html += `</div>`;
      }
      
      // Show queue
      if (this.selectedBuilding.productionQueue.length > 0) {
        html += `<div style="margin-top: 8px; font-size: 12px; opacity: 0.8;">`;
        html += `<strong>Queue (${this.selectedBuilding.productionQueue.length}):</strong><br>`;
        this.selectedBuilding.productionQueue.forEach((unitType, index) => {
          html += `${index + 1}. ${unitType}<br>`;
        });
        html += `</div>`;
      }
      
      queueDiv.innerHTML = html;
    } else {
      panel.classList.remove('active');
      queueDiv.innerHTML = '<p style="opacity: 0.6; font-size: 12px;">No buildings selected</p>';
    }
  }
  
  /**
   * Show temporary move marker
   */
  showMoveMarker(position) {
    // Create a temporary ring at target position
    const geometry = new THREE.RingGeometry(0.5, 0.7, 16);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    
    const marker = new THREE.Mesh(geometry, material);
    marker.rotation.x = -Math.PI / 2;
    marker.position.copy(position);
    marker.position.y = 0.05;
    
    this.scene.add(marker);
    
    // Fade out and remove
    const startTime = Date.now();
    const fadeInterval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      marker.material.opacity = 0.8 - elapsed;
      
      if (elapsed >= 0.8) {
        clearInterval(fadeInterval);
        this.scene.remove(marker);
        marker.geometry.dispose();
        marker.material.dispose();
      }
    }, 16);
  }
  
  /**
   * Show rally point marker
   */
  showRallyPointMarker(position) {
    // Create a flag-like marker for rally points
    const geometry = new THREE.ConeGeometry(0.3, 1.2, 8);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.9
    });
    
    const marker = new THREE.Mesh(geometry, material);
    marker.position.copy(position);
    marker.position.y = 0.6; // Half the height above ground
    
    this.scene.add(marker);
    
    // Fade out and remove after a while
    const startTime = Date.now();
    const fadeInterval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      marker.material.opacity = 0.9 - elapsed * 0.5;
      marker.position.y = 0.6 + elapsed * 0.5; // Rise up while fading
      
      if (elapsed >= 1.8) {
        clearInterval(fadeInterval);
        this.scene.remove(marker);
        marker.geometry.dispose();
        marker.material.dispose();
      }
    }, 16);
  }
  
  /**
   * Create ground plane
   * PATTERN: Large flat plane for the battlefield
   */
  createGroundPlane() {
    const geometry = new THREE.PlaneGeometry(100, 100);
    const material = new THREE.MeshStandardMaterial({
      color: 0x335533,
      roughness: 0.8,
      metalness: 0.2
    });
    
    const ground = new THREE.Mesh(geometry, material);
    ground.rotation.x = -Math.PI / 2; // Rotate to horizontal
    ground.receiveShadow = true;
    
    this.scene.add(ground);
    console.log('[Game] Ground plane added to scene');
    
    // Add grid helper for spatial reference
    const gridHelper = new THREE.GridHelper(100, 50, 0x444466, 0x333344);
    this.scene.add(gridHelper);
    console.log('[Game] Grid helper added to scene');
    
    this.groundPlane = ground;
  }
  
  /**
   * Create a demo cube
   * PATTERN: Simple test object to verify rendering
   */
  createDemoCube() {
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const material = new THREE.MeshStandardMaterial({
      color: 0x6677ff,
      roughness: 0.5,
      metalness: 0.5
    });
    
    this.demoCube = new THREE.Mesh(geometry, material);
    this.demoCube.position.set(0, 1, 0);
    this.demoCube.castShadow = true;
    this.demoCube.receiveShadow = true;
    
    this.scene.add(this.demoCube);
    console.log('[Game] Demo cube added at position:', this.demoCube.position);
  }
  
  /**
   * Start the game loop
   */
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.lastTime = performance.now();
    
    // Start render loop
    // IMPORTANT: Don't use requestAnimationFrame directly in VR
    // Use renderer.setAnimationLoop which works for both desktop and VR
    this.renderer.setAnimationLoop((time) => this.gameLoop(time));
    
    console.log('[Game] Game loop started');
  }
  
  /**
   * Game Loop - THE HEART OF THE ENGINE
   * 
   * ARCHITECTURE: Fixed timestep for logic, variable for rendering
   * 
   * WHY THIS PATTERN:
   * - Game logic needs consistent timing (physics, collisions)
   * - Rendering needs to happen at display refresh rate (90/120Hz for VR)
   * - Interpolation makes rendering smooth even with fixed logic updates
   * 
   * AI WALKTHROUGH:
   * 1. Calculate time since last frame (delta)
   * 2. Add delta to accumulator
   * 3. While accumulator >= fixedTimeStep: update game logic
   * 4. Render with interpolation factor (alpha)
   * 
   * @param {number} time - Timestamp from requestAnimationFrame
   */
  gameLoop(time) {
    if (!this.isRunning || this.isPaused) return;
    
    // Performance monitoring begin
    this.performanceMonitor.begin();
    
    // Calculate delta time
    const currentTime = time || performance.now();
    let deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;
    
    // Cap delta time to prevent spiral of death
    if (deltaTime > this.maxFrameTime) {
      deltaTime = this.maxFrameTime;
    }
    
    // Accumulate time
    this.accumulator += deltaTime;
    
    // Fixed timestep updates (game logic)
    let updateCount = 0;
    while (this.accumulator >= this.fixedTimeStep) {
      this.update(this.fixedTimeStep / 1000); // Convert to seconds
      this.accumulator -= this.fixedTimeStep;
      
      // Safety: prevent too many updates in one frame
      updateCount++;
      if (updateCount > 5) {
        this.accumulator = 0;
        console.warn('[Game] Too many updates in one frame, resetting accumulator');
        break;
      }
    }
    
    // Calculate interpolation factor for smooth rendering
    const alpha = this.accumulator / this.fixedTimeStep;
    
    // Render (happens at display refresh rate)
    this.render(alpha);
    
    // Performance monitoring end
    this.performanceMonitor.end(this.renderer);
  }
  
  /**
   * Update game logic (called at fixed 60Hz)
   * 
   * @param {number} dt - Delta time in seconds (always 1/60)
   */
  update(dt) {
    // Demo: Rotate cube
    if (this.demoCube) {
      this.demoCube.rotation.y += dt * 0.5;
      this.demoCube.rotation.x += dt * 0.3;
    }
    
    // Update game systems
    if (this.unitSystem) {
      this.unitSystem.update(dt);
    }
    
    if (this.buildingSystem) {
      this.buildingSystem.update(dt);
    }
    
    if (this.combatSystem) {
      this.combatSystem.update(dt);
    }
    
    if (this.selectionSystem) {
      this.selectionSystem.update();
    }
    
    if (this.healthBarSystem) {
      this.healthBarSystem.update(dt, this.unitSystem.allUnits, this.buildingSystem.allBuildings);
    }
    
    // Update UI (throttled)
    this.uiUpdateTimer += dt;
    if (this.uiUpdateTimer >= this.uiUpdateInterval) {
      this.uiUpdateTimer = 0;
      if (this.selectedBuilding) {
        this.updateProductionUI();
      }
    }
    
    // Future: More systems
    // this.resourceSystem.update(dt);
  }
  
  /**
   * Render the scene
   * 
   * @param {number} alpha - Interpolation factor (0-1)
   */
  render(alpha) {
    // Update visual representations (instance matrices)
    if (this.unitSystem) {
      this.unitSystem.render();
    }
    
    if (this.buildingSystem) {
      this.buildingSystem.render();
    }
    
    if (this.combatSystem) {
      this.combatSystem.render();
    }
    
    // Update desktop camera controls
    if (!this.isVRMode && this.controls) {
      this.controls.update();
    }
    
    // In VR mode, renderer.render is called automatically per eye
    // In desktop mode, we call it manually
    if (!this.isVRMode) {
      this.renderer.render(this.scene, this.camera);
    }
    
    // Debug: Log first render
    if (!this._hasRendered) {
      this._hasRendered = true;
      console.log('[Game] First render complete');
      console.log('[Game] Camera:', this.camera.position, 'looking at:', this.controls?.target);
      console.log('[Game] Scene has', this.scene.children.length, 'children');
    }
    
    // Future: Interpolate object positions for smooth rendering
    // this.interpolatePositions(alpha);
  }
  
  /**
   * Enter VR mode
   */
  async enterVR() {
    try {
      console.log('[Game] Entering VR mode...');
      
      // Request XR session
      this.xrSession = await createXRSession();
      
      // Set up XR session
      await this.renderer.xr.setSession(this.xrSession);
      
      // Setup VR controllers
      this.setupVRControllers();
      
      // Update state
      this.isVRMode = true;
      
      // Disable desktop controls in VR
      if (this.controls) {
        this.controls.enabled = false;
      }
      
      // Handle session end
      this.xrSession.addEventListener('end', () => {
        this.onVRSessionEnd();
      });
      
      console.log('[Game] VR mode active');
      
    } catch (error) {
      console.error('[Game] Failed to enter VR:', error);
      throw error;
    }
  }
  
  /**
   * Setup VR controllers
   */
  setupVRControllers() {
    // Right controller
    const controller1 = this.renderer.xr.getController(0);
    this.scene.add(controller1);
    this.controllers.push(controller1);
    
    // Left controller  
    const controller2 = this.renderer.xr.getController(1);
    this.scene.add(controller2);
    this.controllers.push(controller2);
    
    // Add controller models (visual representation)
    // Future: Use proper controller models
    const controllerGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.5, 8);
    const controllerMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    
    const controllerMesh1 = new THREE.Mesh(controllerGeometry, controllerMaterial);
    controllerMesh1.rotation.x = -Math.PI / 2;
    controller1.add(controllerMesh1);
    
    const controllerMesh2 = new THREE.Mesh(controllerGeometry, controllerMaterial);
    controllerMesh2.rotation.x = -Math.PI / 2;
    controller2.add(controllerMesh2);
    
    console.log('[Game] VR controllers setup');
  }
  
  /**
   * Handle VR session end
   */
  onVRSessionEnd() {
    this.isVRMode = false;
    this.xrSession = null;
    
    // Re-enable desktop controls
    if (this.controls) {
      this.controls.enabled = true;
    }
    
    console.log('[Game] VR session ended');
  }
  
  /**
   * Handle window resize
   */
  onWindowResize() {
    // Update camera aspect ratio
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    
    // Update renderer size
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  /**
   * Pause the game
   */
  pause() {
    this.isPaused = true;
    console.log('[Game] Paused');
  }
  
  /**
   * Resume the game
   */
  resume() {
    this.isPaused = false;
    this.lastTime = performance.now(); // Reset time to avoid large delta
    console.log('[Game] Resumed');
  }
  
  /**
   * Dispose of all resources
   * PATTERN: Proper cleanup to prevent memory leaks
   */
  dispose() {
    this.isRunning = false;
    
    // Stop animation loop
    this.renderer.setAnimationLoop(null);
    
    // Dispose geometries and materials
    this.scene.traverse((object) => {
      if (object.geometry) {
        object.geometry.dispose();
      }
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(material => material.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
    
    // Dispose renderer
    this.renderer.dispose();
    
    console.log('[Game] Disposed');
  }
}
