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

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { XRControllerModelFactory } from "three/examples/jsm/webxr/XRControllerModelFactory.js";
import { XRHandModelFactory } from "three/examples/jsm/webxr/XRHandModelFactory.js";
import { createXRSession } from "../utils/WebXRUtils.js";
import { UnitSystem } from "../systems/UnitSystem.js";
import { SelectionSystem } from "../systems/SelectionSystem.js";
import { CombatSystem } from "../systems/CombatSystem.js";
import { HealthBarSystem } from "../systems/HealthBarSystem.js";
import { BuildingSystem } from "../systems/BuildingSystem.js";
import { VRUISystem } from "../systems/VRUISystem.js";

export class Game {
  /**
   * Create game instance
   * @param {HTMLElement} container - DOM element to attach renderer
   * @param {PerformanceMonitor} performanceMonitor - Performance tracking
   * @param {PluginManager|null} pluginManager - Plugin data manager
   */
  constructor(container, performanceMonitor, pluginManager = null) {
    this.container = container;
    this.performanceMonitor = performanceMonitor;
    this.pluginManager = pluginManager;

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
    this.lastRenderTime = this.lastTime;
    this.maxFPS = 120; // Cap rendering at 120 FPS
    this.minFrameInterval = 1000 / this.maxFPS; // Minimum time between renders (8.33ms)

    // Initialize Three.js
    this.initRenderer();
    this.initScene();
    this.initCamera();
    this.initLighting();

    // VR Controllers (initialized when entering VR)
    this.controllers = [];
    this.xrSession = null;
    this.xrReferenceSpace = null; // Reference space for tracking
    this.vrUISystem = null; // Initialized when entering VR
    this.lastControllerLogTime = 0; // For logging controller positions every 3 seconds

    // Hand tracking (XRHand API - Quest 3+)
    this.hands = [null, null]; // Left and right hand tracking
    this.handModels = [null, null]; // XRHandModel groups for rendering
    this.handJoints = [[], []]; // Store joint positions
    this.showHandDebug = false; // Debug visualization flag

    console.log("[Game] Instance created");
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
      powerPreference: "high-performance",
      alpha: false, // Opaque background, more efficient
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

    console.log("[Game] Renderer initialized");
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

    console.log("[Game] Scene initialized");
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
      1000, // Far plane
    );

    // Position camera above the battlefield
    this.camera.position.set(0, 20, 30);
    this.camera.lookAt(0, 0, 0);

    // VR camera will be created automatically by XR session

    // Add orbit controls for desktop mode
    this.initDesktopControls();

    console.log("[Game] Camera initialized");
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

    console.log("[Game] Lighting initialized");
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

    console.log("[Game] Desktop orbit controls initialized");
  }

  /**
   * Initialize game systems and load resources
   *
   * AI NOTE: This is async because we might load models/textures
   */
  async initialize() {
    // Create ground plane
    this.createGroundPlane();

    // Initialize game systems
    this.unitSystem = new UnitSystem(this.scene, this.pluginManager);
    this.buildingSystem = new BuildingSystem(
      this.scene,
      this.unitSystem,
      this.pluginManager,
    );
    this.combatSystem = new CombatSystem(this.scene, this.unitSystem);
    this.selectionSystem = new SelectionSystem(
      this.camera,
      this.renderer,
      this.unitSystem,
    );
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
    window.addEventListener("resize", () => this.onWindowResize());

    console.log("[Game] Initialization complete");
  }

  /**
   * Spawn starting Command Centers for both teams
   */
  spawnStartingBases() {
    // Player Command Center (team 0, left side)
    const playerBase = this.buildingSystem.placeBuilding(
      "command_center",
      -50,
      0,
      0,
      true, // Skip construction, instant
    );

    // Enemy Command Center (team 1, right side)
    const enemyBase = this.buildingSystem.placeBuilding(
      "command_center",
      50,
      0,
      1,
      true, // Skip construction, instant
    );

    console.log("[Game] Spawned starting Command Centers for both teams");
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
      const types = ["scout", "soldier", "tank", "artillery"];
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
      const types = ["scout", "soldier", "tank", "artillery"];
      const type = types[Math.floor(Math.random() * types.length)];
      const unit = this.unitSystem.spawnUnit(type, x, z, 1);

      // Enable auto-attack for enemy units
      if (unit) {
        unit.autoAttack = true;
      }
    }

    console.log(
      "[Game] Spawned 25 player units (team 0) and 25 enemy units (team 1) - COMBAT ENABLED",
    );
  }

  /**
   * Setup command input (right-click to move)
   */
  setupCommandInput() {
    this.renderer.domElement.addEventListener("contextmenu", (event) => {
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
          console.log(
            `[Game] Rally point set to (${target.x.toFixed(1)}, ${target.z.toFixed(1)})`,
          );

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

    console.log("[Game] Command input setup (right-click to move/rally)");
  }

  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    window.addEventListener("keydown", (event) => {
      // H key: Toggle health bars
      if (event.key === "h" || event.key === "H") {
        if (this.healthBarSystem) {
          this.healthBarSystem.toggleShowAll();
        }
      }

      // B key: Toggle building mode
      if (event.key === "b" || event.key === "B") {
        this.toggleBuildingMode();
      }

      // ESC: Cancel building mode or exit VR
      if (event.key === "Escape") {
        if (this.isVRMode) {
          this.exitVR();
        } else if (this.buildingMode) {
          this.toggleBuildingMode();
        }
      }

      // Q key: Select Barracks
      if (event.key === "q" || event.key === "Q") {
        this.selectBuilding("barracks");
      }

      // W key: Select Factory
      if (event.key === "w" || event.key === "W") {
        this.selectBuilding("factory");
      }

      // E key: Select Shield Generator
      if (event.key === "e" || event.key === "E") {
        this.selectBuilding("shield_generator");
      }

      // Production hotkeys (when building is selected)
      if (this.selectedBuilding && !this.buildingMode) {
        // 1-5 keys for unit production
        if (event.key >= "1" && event.key <= "5") {
          this.queueUnitProduction(event.key);
        }

        // R key: Set rally point mode
        if (event.key === "r" || event.key === "R") {
          console.log("[Game] Rally point mode not yet implemented");
        }
      }

      // Tab: Cycle through player buildings
      if (event.key === "Tab") {
        event.preventDefault(); // Prevent default tab behavior
        this.cycleSelectedBuilding();
      }

      // T key: Toggle hand tracking debug visualization (VR only)
      if (event.key === "t" || event.key === "T") {
        if (this.isVRMode) {
          this.showHandDebug = !this.showHandDebug;
          console.log(
            `[Game] Hand tracking debug: ${this.showHandDebug ? "ON" : "OFF"}`,
          );
          if (this.showHandDebug) {
            // Create debug visuals if not already present
            for (let i = 0; i < 2; i++) {
              if (this.hands[i]) {
                this.createHandDebugVisuals(i, i === 0 ? "right" : "left");
                // Hide 3D hand models when showing debug spheres
                if (this.handModels[i]) {
                  this.handModels[i].visible = false;
                }
              }
            }
          } else {
            // Show 3D hand models when hiding debug spheres
            for (let i = 0; i < 2; i++) {
              if (this.handModels[i]) {
                this.handModels[i].visible = true;
              }
              // Hide debug spheres
              const handedness = i === 0 ? "right" : "left";
              const keyJoints = [
                "wrist",
                "thumb-tip",
                "index-finger-tip",
                "middle-finger-tip",
                "ring-finger-tip",
                "pinky-finger-tip",
              ];
              keyJoints.forEach((jointName) => {
                const sphereName = `hand-${handedness}-${jointName}`;
                const sphere = this.scene.getObjectByName(sphereName);
                if (sphere) {
                  sphere.visible = false;
                }
              });
            }
          }
        }
      }
    });

    console.log(
      "[Game] Keyboard shortcuts: H = health bars, B = building mode, Q/W/E = buildings, 1-5 = produce units, Tab = cycle buildings, T = hand tracking debug (VR)",
    );
  }

  /**
   * Cycle through player buildings
   */
  cycleSelectedBuilding() {
    const playerBuildings = this.buildingSystem.allBuildings.filter(
      (b) => b.team === 0 && b.isAlive,
    );

    if (playerBuildings.length === 0) {
      console.log("[Game] No player buildings to select");
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

    console.log(
      `[Game] Cycled to building ${nextIndex + 1}/${playerBuildings.length}`,
    );
  }

  /**
   * Queue unit production from selected building
   * @param {string} key - Number key pressed (1-5)
   */
  queueUnitProduction(key) {
    if (!this.selectedBuilding || !this.selectedBuilding.isConstructed()) {
      console.log("[Game] Building not ready for production");
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
      console.log("[Game] Building mode ENABLED");
      this.updateBuildingUI();
    } else {
      console.log("[Game] Building mode DISABLED");
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
    switch (buildingType) {
      case "command_center":
        geometry = new THREE.BoxGeometry(6, 3, 6);
        break;
      case "barracks":
        geometry = new THREE.BoxGeometry(4, 2, 4);
        break;
      case "factory":
        geometry = new THREE.BoxGeometry(5, 2.5, 5);
        break;
      case "shield_generator":
        geometry = new THREE.BoxGeometry(2, 4, 2);
        break;
    }

    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.5,
      wireframe: false,
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
      this.buildingGhost.position.y =
        this.buildingGhost.geometry.parameters.height / 2;

      // Check if placement is valid (simplified - just check not too close to other buildings)
      this.buildingGhostValid = true; // TODO: Add collision check
      this.buildingGhost.material.color.setHex(
        this.buildingGhostValid ? 0x00ff00 : 0xff0000,
      );
    }
  }

  /**
   * Setup building placement input
   */
  setupBuildingPlacement() {
    // Track mouse movement for ghost
    this.renderer.domElement.addEventListener("mousemove", (event) => {
      if (this.buildingMode && this.selectedBuildingType) {
        this.updateBuildingGhost(event);
      }
    });

    // Left click to place building
    this.renderer.domElement.addEventListener("click", (event) => {
      if (
        this.buildingMode &&
        this.selectedBuildingType &&
        this.buildingGhost
      ) {
        const pos = this.buildingGhost.position;

        if (this.buildingGhostValid) {
          // Place the building
          this.buildingSystem.placeBuilding(
            this.selectedBuildingType,
            pos.x,
            pos.z,
            0, // Player team
            false, // Don't skip construction
          );

          console.log(
            `[Game] Placed ${this.selectedBuildingType} at (${pos.x.toFixed(1)}, ${pos.z.toFixed(1)})`,
          );

          // Exit building mode
          this.toggleBuildingMode();
        }
      } else if (!this.buildingMode) {
        // Try to select a building
        this.trySelectBuilding(event);
      }
    });

    // Setup building button UI
    if (typeof document !== "undefined") {
      const buttons = document.querySelectorAll(".building-button");
      buttons.forEach((button) => {
        button.addEventListener("click", () => {
          const buildingType = button.getAttribute("data-building");
          this.selectBuilding(buildingType);
        });
      });
    }

    console.log("[Game] Building placement setup complete");
  }

  /**
   * Update building UI
   */
  updateBuildingUI() {
    if (typeof document === "undefined") return;

    const modeText = document.getElementById("building-mode-text");
    if (modeText) {
      if (this.buildingMode && this.selectedBuildingType) {
        modeText.innerHTML = `<strong style="color: #4ade80;">BUILDING MODE</strong><br>Click to place ${this.selectedBuildingType}`;
      } else if (this.buildingMode) {
        modeText.innerHTML =
          '<strong style="color: #4ade80;">BUILDING MODE</strong><br>Select a building type';
      } else {
        modeText.innerHTML = "Press <strong>B</strong> to enter building mode";
      }
    }

    // Update button active states
    document.querySelectorAll(".building-button").forEach((button) => {
      const buildingType = button.getAttribute("data-building");
      if (this.selectedBuildingType === buildingType) {
        button.classList.add("active");
      } else {
        button.classList.remove("active");
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
      for (const [type, typeMesh] of Object.entries(
        this.buildingSystem.instancedMeshes,
      )) {
        if (typeMesh === mesh) {
          buildingType = type;
          break;
        }
      }

      if (buildingType !== null) {
        // Get the actual building from the array
        const buildings = this.buildingSystem.buildingsByType[buildingType];
        const building = buildings[instanceId];

        if (building && building.team === 0) {
          // Only select player buildings
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

    console.log(
      `[Game] Selected ${building.type} (HP: ${building.health}/${building.maxHealth})`,
    );

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
    if (typeof document === "undefined") return;

    const panel = document.getElementById("production-panel");
    const queueDiv = document.getElementById("production-queue");

    if (!panel || !queueDiv) return;

    if (this.selectedBuilding && this.selectedBuilding.isAlive) {
      panel.classList.add("active");

      // Update building info
      let html = `<div style="margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.2);">`;
      html += `<strong>${this.selectedBuilding.type.toUpperCase()}</strong><br>`;
      html += `<span style="font-size: 11px; opacity: 0.7;">HP: ${Math.floor(this.selectedBuilding.health)}/${this.selectedBuilding.maxHealth}</span>`;
      html += `</div>`;

      // Show producible units
      if (
        this.selectedBuilding.canProduce &&
        this.selectedBuilding.isConstructed()
      ) {
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
      panel.classList.remove("active");
      queueDiv.innerHTML =
        '<p style="opacity: 0.6; font-size: 12px;">No buildings selected</p>';
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
      opacity: 0.8,
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
      opacity: 0.9,
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
      metalness: 0.2,
    });

    const ground = new THREE.Mesh(geometry, material);
    ground.rotation.x = -Math.PI / 2; // Rotate to horizontal
    ground.receiveShadow = true;

    this.scene.add(ground);
    console.log("[Game] Ground plane added to scene");

    // Add grid helper for spatial reference
    const gridHelper = new THREE.GridHelper(100, 50, 0x444466, 0x333344);
    this.scene.add(gridHelper);
    console.log("[Game] Grid helper added to scene");

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
      metalness: 0.5,
    });

    this.demoCube = new THREE.Mesh(geometry, material);
    this.demoCube.position.set(0, 1, 0);
    this.demoCube.castShadow = true;
    this.demoCube.receiveShadow = true;

    this.scene.add(this.demoCube);
    console.log("[Game] Demo cube added at position:", this.demoCube.position);
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

    console.log("[Game] Game loop started");
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

    try {
      // Calculate delta time
      const currentTime = time || performance.now();
      let deltaTime = currentTime - this.lastTime;
      this.lastTime = currentTime;

      // Frame rate limiting (120 FPS cap)
      // Skip rendering if not enough time has passed since last render
      const timeSinceLastRender = currentTime - this.lastRenderTime;
      if (timeSinceLastRender < this.minFrameInterval) {
        return; // Skip this frame, not enough time has passed
      }
      this.lastRenderTime = currentTime;

      // Performance monitoring begin (ONLY for frames we actually render)
      // Now measures wall-clock time between rendered frames, not execution time
      this.performanceMonitor.begin();

      // Cap delta time to prevent spiral of death
      if (deltaTime > this.maxFrameTime) {
        console.warn(
          `[Game] Large delta time: ${deltaTime.toFixed(1)}ms (capped to ${this.maxFrameTime}ms)`,
        );
        deltaTime = this.maxFrameTime;
      }

      // Accumulate time
      this.accumulator += deltaTime;

      // Prevent accumulator from growing unbounded (safety check for VR stalls)
      if (this.accumulator > this.fixedTimeStep * 3) {
        console.warn(
          `[Game] Accumulator overflow: ${this.accumulator.toFixed(1)}ms, resetting`,
        );
        this.accumulator = this.fixedTimeStep;
      }

      // Fixed timestep updates (game logic)
      let updateCount = 0;
      const maxUpdatesPerFrame = this.isVRMode ? 2 : 5;
      while (this.accumulator >= this.fixedTimeStep) {
        this.update(this.fixedTimeStep / 1000); // Convert to seconds
        this.accumulator -= this.fixedTimeStep;

        // Safety: prevent too many updates in one frame
        updateCount++;
        if (updateCount > maxUpdatesPerFrame) {
          this.accumulator = 0;
          console.warn(
            `[Game] Skipping frames to catch up (VR=${this.isVRMode}, updates=${updateCount})`,
          );
          break;
        }
      }

      // Calculate interpolation factor for smooth rendering
      const alpha = this.accumulator / this.fixedTimeStep;

      // Render (happens at display refresh rate)
      this.render(alpha);

      // Log controller positions every 3 seconds in VR
      if (this.isVRMode && this.controllers && this.controllers.length >= 2) {
        const now = currentTime;
        if (now - this.lastControllerLogTime >= 3000) {
          this.lastControllerLogTime = now;
          const right = this.controllers[0];
          const left = this.controllers[1];
          console.log(
            `[Controllers] RIGHT: (${right.position.x.toFixed(3)}, ${right.position.y.toFixed(3)}, ${right.position.z.toFixed(3)})`,
          );
          console.log(
            `[Controllers] LEFT:  (${left.position.x.toFixed(3)}, ${left.position.y.toFixed(3)}, ${left.position.z.toFixed(3)})`,
          );
        }
      }

      // Performance monitoring end (ONLY for frames we actually render)
      this.performanceMonitor.end(this.renderer);
    } catch (error) {
      console.error("[Game] Game loop error:", error);
    }
  }

  /**
   * Update game logic (called at fixed 60Hz)
   *
   * @param {number} dt - Delta time in seconds (always 1/60)
   */
  update(dt) {
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
      this.healthBarSystem.update(
        dt,
        this.unitSystem.allUnits,
        this.buildingSystem.allBuildings,
      );
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
   * CRITICAL: ALWAYS call renderer.render(), even in VR mode.
   * WebXRManager handles stereo splitting automatically when setSession is active.
   * Failing to call renderer.render() results in "no visible output to baseLayer".
   *
   * @param {number} alpha - Interpolation factor (0-1)
   */
  render(alpha) {
    try {
      // Update controller and hand input in VR mode
      if (this.isVRMode) {
        this.updateControllerInput();

        // Update hand tracking if available
        // Note: We need to get the current XR frame from the render loop
        // This requires accessing the frame from the renderer's XR session
        if (
          this.hands.some((h) => h !== null) &&
          this.renderer.xr.isPresenting
        ) {
          const frame = this.renderer.xr.getFrame();
          if (frame) {
            this.updateHandTracking(frame);

            // Update debug visualization if enabled
            if (this.showHandDebug) {
              this.updateHandDebugVisuals();
            }
          }
        }
      }

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

      // Update VR UI panels
      if (this.isVRMode && this.vrUISystem) {
        this.vrUISystem.update();
      }

      // Update desktop camera controls (VR uses WebXR for camera)
      if (!this.isVRMode && this.controls) {
        this.controls.update();
      }

      // CRITICAL: Always render, regardless of mode
      // WebXRManager automatically handles stereo splitting when XR session is active
      // In desktop mode, renders normally to single framebuffer
      // In VR mode, renders to both eye framebuffers
      this.renderer.render(this.scene, this.camera);
    } catch (error) {
      console.error("[Game] Render error:", error);
    }

    // Debug: Log first render
    if (!this._hasRendered) {
      this._hasRendered = true;
      console.log("[Game] First render complete");
      console.log(
        "[Game] Camera:",
        this.camera.position,
        "looking at:",
        this.controls?.target,
      );
      console.log("[Game] Scene has", this.scene.children.length, "children");
    }

    // Future: Interpolate object positions for smooth rendering
    // this.interpolatePositions(alpha);
  }

  /**
   * Enter VR mode
   */
  async enterVR() {
    try {
      console.log("[Game] Entering VR mode...");

      // Request XR session
      this.xrSession = await createXRSession();

      // Get the reference space (needed for hand tracking)
      this.xrReferenceSpace =
        await this.xrSession.requestReferenceSpace("local-floor");

      // Set up XR session
      await this.renderer.xr.setSession(this.xrSession);

      // Setup VR controllers
      this.setupVRControllers();

      // Setup VR UI system (uses scene's camera which WebXR will update)
      this.vrUISystem = new VRUISystem(this.scene, this.camera, this);
      this.vrUISystem.createDefaultPanels();

      // Create debug console panel (head-locked to left hand)
      // Pass left controller (index 1)
      const leftController = this.controllers[1] || null;
      this.vrUISystem.createConsolePanel(leftController);

      // Load custom UI panels from plugins
      if (this.pluginManager) {
        this.vrUISystem.loadPluginPanels(this.pluginManager);
      }

      // Hide desktop UI overlay in VR
      const uiOverlay = document.getElementById("ui-overlay");
      if (uiOverlay) {
        uiOverlay.style.display = "none";
      }

      // Update state
      this.isVRMode = true;

      // Disable desktop controls in VR
      if (this.controls) {
        this.controls.enabled = false;
      }

      // Handle session end
      this.xrSession.addEventListener("end", () => {
        this.onVRSessionEnd();
      });

      console.log("[Game] VR mode active");
    } catch (error) {
      console.error("[Game] Failed to enter VR:", error);
      throw error;
    }
  }

  /**
   * Exit VR mode
   */
  exitVR() {
    if (!this.isVRMode || !this.xrSession) {
      return;
    }

    try {
      console.log("[Game] Exiting VR mode...");
      this.xrSession.end();
    } catch (error) {
      console.error("[Game] Failed to exit VR:", error);
    }
  }

  /**
   * Setup hand tracking using XRHand API (Quest 3+)
   * Provides per-joint position and rotation data for both hands
   * Creates realistic 3D hand models using XRHandModelFactory
   */
  setupHandTracking() {
    try {
      const handModelFactory = new XRHandModelFactory();

      // Request hand tracking data from XR session
      const inputSources = this.xrSession.inputSources;

      for (const inputSource of inputSources) {
        if (inputSource.hand) {
          const handedness = inputSource.handedness; // 'left' or 'right'
          const handIndex = handedness === "right" ? 0 : 1;

          // Store the hand object for later tracking
          this.hands[handIndex] = inputSource.hand;

          // Create hand model using XRHandModelFactory
          const handModelGroup = this.renderer.xr.getHand(handIndex);
          const handModel = handModelFactory.createHandModel(handModelGroup);
          handModelGroup.add(handModel);
          this.scene.add(handModelGroup);
          this.handModels[handIndex] = handModelGroup;

          console.log(
            `[Game] Hand tracking available for ${handedness} hand (index ${handIndex}) - 3D model created`,
          );

          // Create debug visualization spheres for key joints if debug mode is on
          if (this.showHandDebug) {
            this.createHandDebugVisuals(handIndex, handedness);
            // Hide hand models when showing debug spheres
            handModelGroup.visible = false;
          }
        }
      }

      console.log(
        `[Game] Hand tracking setup complete (${this.hands.filter((h) => h).length} hands detected with 3D models)`,
      );
    } catch (error) {
      console.warn("[Game] Hand tracking not available:", error.message);
    }
  }

  /**
   * Update hand tracking positions each frame
   * @param {XRFrame} frame - Current XR frame
   */
  updateHandTracking(frame) {
    if (!this.xrSession || !this.xrReferenceSpace) return;

    try {
      const inputSources = this.xrSession.inputSources;

      for (const inputSource of inputSources) {
        if (inputSource.hand) {
          const handedness = inputSource.handedness;
          const handIndex = handedness === "right" ? 0 : 1;
          const hand = inputSource.hand;

          // Update joint positions
          this.handJoints[handIndex] = [];

          // Get all joint names (23 joints per hand)
          const jointNames = [
            "wrist",
            "thumb-metacarpal",
            "thumb-phalanx-proximal",
            "thumb-phalanx-distal",
            "thumb-tip",
            "index-finger-metacarpal",
            "index-finger-phalanx-proximal",
            "index-finger-phalanx-intermediate",
            "index-finger-phalanx-distal",
            "index-finger-tip",
            "middle-finger-metacarpal",
            "middle-finger-phalanx-proximal",
            "middle-finger-phalanx-intermediate",
            "middle-finger-phalanx-distal",
            "middle-finger-tip",
            "ring-finger-metacarpal",
            "ring-finger-phalanx-proximal",
            "ring-finger-phalanx-intermediate",
            "ring-finger-phalanx-distal",
            "ring-finger-tip",
            "pinky-finger-metacarpal",
            "pinky-finger-phalanx-proximal",
            "pinky-finger-phalanx-intermediate",
            "pinky-finger-phalanx-distal",
            "pinky-finger-tip",
          ];

          let validJointCount = 0;

          for (const jointName of jointNames) {
            try {
              const jointSpace = hand.get(jointName);

              // Use the stored reference space from renderer setup
              const pose = frame.getPose(jointSpace, this.xrReferenceSpace);

              if (pose) {
                const position = pose.transform.position;
                const rotation = pose.transform.orientation;

                this.handJoints[handIndex].push({
                  name: jointName,
                  position: { x: position.x, y: position.y, z: position.z },
                  rotation: {
                    x: rotation.x,
                    y: rotation.y,
                    z: rotation.z,
                    w: rotation.w,
                  },
                });

                validJointCount++;
              }
            } catch (e) {
              // Joint not available or tracking lost
            }
          }

          // Log hand position periodically
          if (validJointCount > 0) {
            const now = performance.now();
            if (now - this.lastControllerLogTime >= 3000) {
              this.lastControllerLogTime = now;
              const wrist = this.handJoints[handIndex].find(
                (j) => j.name === "wrist",
              );
              if (wrist) {
                console.log(
                  `[Hand ${handedness}] Wrist: (${wrist.position.x.toFixed(3)}, ${wrist.position.y.toFixed(3)}, ${wrist.position.z.toFixed(3)}) - ${validJointCount} joints tracked`,
                );
              }
            }
          }
        }
      }
    } catch (error) {
      // Hand tracking frame data might not be available
    }
  }

  /**
   * Create debug visualization for hand joints
   */
  createHandDebugVisuals(handIndex, handedness) {
    // Create spheres at key joint locations for visualization
    const keyJoints = [
      "wrist",
      "thumb-tip",
      "index-finger-tip",
      "middle-finger-tip",
      "ring-finger-tip",
      "pinky-finger-tip",
    ];

    const colors = [0xffff00, 0xff0000, 0x00ff00, 0x00ffff, 0xff00ff, 0xffffff];

    keyJoints.forEach((jointName, idx) => {
      const geometry = new THREE.SphereGeometry(0.01, 8, 8);
      const material = new THREE.MeshBasicMaterial({
        color: colors[idx],
        fog: false,
      });
      const sphere = new THREE.Mesh(geometry, material);
      sphere.userData.jointName = jointName;
      sphere.userData.handIndex = handIndex;
      sphere.name = `hand-${handedness}-${jointName}`;
      this.scene.add(sphere);
    });

    console.log(
      `[Game] Created debug visuals for ${handedness} hand (${keyJoints.length} joints)`,
    );
  }

  /**
   * Update hand debug visualization spheres to match joint positions
   */
  updateHandDebugVisuals() {
    for (let handIndex = 0; handIndex < 2; handIndex++) {
      const joints = this.handJoints[handIndex];
      if (!joints || joints.length === 0) continue;

      const handedness = handIndex === 0 ? "right" : "left";

      // Update each debug sphere to match joint position
      joints.forEach((joint) => {
        const sphereName = `hand-${handedness}-${joint.name}`;
        const sphere = this.scene.getObjectByName(sphereName);

        if (sphere && joint.position) {
          sphere.position.set(
            joint.position.x,
            joint.position.y,
            joint.position.z,
          );
          sphere.visible = true;
        }
      });
    }
  }

  /**
   * Setup VR controllers for Quest 3
   *
   * Shows actual Quest controller models with button/trigger/joystick visualization.
   * Uses both XR controller tracking AND gamepad input for complete state.
   *
   * NOTE: Controllers and hand tracking are mutually exclusive in WebXR.
   * When using hand tracking, controller grips will not have pose data.
   */
  setupVRControllers() {
    const controllerModelFactory = new XRControllerModelFactory();

    // Log all input sources to understand what's available
    console.log(
      `[Game] XR Input Sources: ${this.xrSession.inputSources.length}`,
    );
    this.xrSession.inputSources.forEach((source, idx) => {
      console.log(
        `[Game] Input Source ${idx}: handedness=${source.handedness}, ` +
          `hasHand=${!!source.hand}, hasGamepad=${!!source.gamepad}, ` +
          `targetRayMode=${source.targetRayMode}`,
      );
    });

    for (let i = 0; i < 2; i++) {
      // Controller grip (hand position)
      const controllerGrip = this.renderer.xr.getControllerGrip(i);
      const gripIndex = i === 0 ? "(RIGHT)" : "(LEFT)";

      // Add visual indicator so we definitely see where the grips are
      this.addControllerVisuals(
        controllerGrip,
        i === 0 ? 0xff0000 : 0x0000ff,
        gripIndex,
      );

      // Try to load the actual controller model on top
      try {
        const controllerModel =
          controllerModelFactory.createControllerModel(controllerGrip);
        if (
          controllerModel &&
          controllerModel.children &&
          controllerModel.children.length > 0
        ) {
          controllerGrip.add(controllerModel);
          console.log(
            `[Game] Loaded Quest controller model for hand ${i} ${gripIndex}`,
          );
        } else {
          console.log(
            `[Game] Controller factory model empty for hand ${i}, using visuals only`,
          );
        }
      } catch (e) {
        console.warn(`[Game] Failed to load controller model ${i}:`, e.message);
      }

      this.scene.add(controllerGrip);

      // Controller ray (pointing direction)
      const controller = this.renderer.xr.getController(i);
      const rayColor = i === 0 ? 0xff0000 : 0x0000ff; // Red=right, Blue=left
      controller.add(this.createPointerRay(rayColor));

      // Button listeners for visual feedback
      controller.addEventListener("selectstart", () =>
        this.onControllerButton(i, "selectstart"),
      );
      controller.addEventListener("selectend", () =>
        this.onControllerButton(i, "selectend"),
      );
      controller.addEventListener("squeezestart", () =>
        this.onControllerButton(i, "squeezestart"),
      );
      controller.addEventListener("squeezeend", () =>
        this.onControllerButton(i, "squeezeend"),
      );

      this.scene.add(controller);
    }

    this.controllers = [
      this.renderer.xr.getControllerGrip(0),
      this.renderer.xr.getControllerGrip(1),
    ];

    // Try to setup hand tracking after controllers
    this.setupHandTracking();

    console.log(
      "[Game] VR controllers setup complete - visible indicators added",
    );
    console.log(
      "[Game] NOTE: If hand tracking is active, controllers will not have pose data (mutually exclusive)",
    );
  }

  /**
   * Add guaranteed visible geometry to controller grip
   * This ensures we can see the controller position even if factory models fail
   */
  addControllerVisuals(controllerGrip, color, label) {
    // Main hand indicator - a sphere (use MeshStandardMaterial for emissive support)
    const sphereGeometry = new THREE.SphereGeometry(0.04, 16, 16);
    const sphereMaterial = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.8,
      fog: false,
      metalness: 0.3,
      roughness: 0.4,
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    controllerGrip.add(sphere);

    // Pointer (cylinder pointing forward)
    const cylinderGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.08, 8);
    const cylinderMaterial = new THREE.MeshBasicMaterial({
      color,
      fog: false,
    });
    const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
    cylinder.rotation.z = Math.PI / 2;
    cylinder.position.z = -0.06;
    controllerGrip.add(cylinder);

    console.log(`[Game] Added visual indicators to controller ${label}`);
  }

  /**
   * Create a pointer ray for a controller
   * @param {number} color - Ray color
   * @returns {THREE.Line}
   */
  createPointerRay(color) {
    const rayGeometry = new THREE.BufferGeometry();
    const rayPositions = new Float32Array([0, 0, 0, 0, 0, -10]); // 10m forward
    rayGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(rayPositions, 3),
    );
    const rayMaterial = new THREE.LineBasicMaterial({
      color,
      linewidth: 4,
      fog: false,
    });
    const ray = new THREE.Line(rayGeometry, rayMaterial);
    return ray;
  }

  /**
   * Handle VR controller button press/release
   * @param {number} controllerIndex - 0=right, 1=left
   * @param {string} buttonType - 'selectstart', 'selectend', 'squeezestart', 'squeezeend'
   */
  onControllerButton(controllerIndex, buttonType) {
    const controllerName = controllerIndex === 0 ? "RIGHT" : "LEFT";
    console.log(
      `[Game] Controller: ${controllerName} ${buttonType.toUpperCase()}`,
    );

    // Toggle console on right select press
    if (
      buttonType === "selectstart" &&
      controllerIndex === 0 &&
      this.vrUISystem
    ) {
      this.vrUISystem.toggleConsolePanel();
    }
  }

  /**
   * Update controller input states (gamepad button/axis positions)
   * Reads actual input from gamepads to track triggers, sticks, buttons
   */
  updateControllerInput() {
    if (!this.isVRMode) return;

    const gamepads = navigator.getGamepads();

    for (let i = 0; i < 2 && i < gamepads.length; i++) {
      const gamepad = gamepads[i];
      if (!gamepad) continue;

      const controllerName = i === 0 ? "RIGHT" : "LEFT";

      // Analog stick (axes 0, 1 = X, Y)
      if (gamepad.axes.length >= 2) {
        const stickX = gamepad.axes[0];
        const stickY = gamepad.axes[1];
        const magnitude = Math.sqrt(stickX * stickX + stickY * stickY);

        if (magnitude > 0.15) {
          // Movement detected
          // TODO: Use this for camera panning/unit selection movement
        }
      }

      // Trigger values (axes 4=right trigger, 5=left trigger on Quest)
      if (gamepad.axes.length >= 5) {
        const rightTrigger = gamepad.axes[4];
        const leftTrigger = gamepad.axes[5];

        // These map to grip/squeeze in addition to button events
        if (rightTrigger > 0.75) {
          // Right trigger deep press (could be alternate action)
        }
        if (leftTrigger > 0.75) {
          // Left trigger deep press
        }
      }

      // Button states
      for (let j = 0; j < gamepad.buttons.length; j++) {
        const button = gamepad.buttons[j];
        // Available for other interactions
        // Button 0 = trigger (primary action)
        // Button 1 = grip (secondary action)
        // Button 2, 3 = menu buttons
        // Button 4, 5 = touchpad
      }
    }
  }

  /**
   * Handle VR session end
   */
  onVRSessionEnd() {
    this.isVRMode = false;
    this.xrSession = null;
    this.xrReferenceSpace = null;

    // Cleanup hand tracking
    this.hands = [null, null];
    this.handJoints = [[], []];

    // Remove hand models
    for (let i = 0; i < 2; i++) {
      if (this.handModels[i]) {
        this.scene.remove(this.handModels[i]);
        this.handModels[i] = null;
      }
    }

    // Remove hand debug visualization spheres
    if (this.showHandDebug) {
      for (let i = 0; i < 2; i++) {
        const handedness = i === 0 ? "right" : "left";
        const keyJoints = [
          "wrist",
          "thumb-tip",
          "index-finger-tip",
          "middle-finger-tip",
          "ring-finger-tip",
          "pinky-finger-tip",
        ];

        keyJoints.forEach((jointName) => {
          const sphereName = `hand-${handedness}-${jointName}`;
          const sphere = this.scene.getObjectByName(sphereName);
          if (sphere) {
            this.scene.remove(sphere);
            sphere.geometry.dispose();
            sphere.material.dispose();
          }
        });
      }
    }

    // Cleanup VR UI system
    if (this.vrUISystem) {
      this.vrUISystem.dispose();
      this.vrUISystem = null;
    }

    // Show desktop UI overlay again
    const uiOverlay = document.getElementById("ui-overlay");
    if (uiOverlay) {
      uiOverlay.style.display = "";
    }

    // Re-enable desktop controls
    if (this.controls) {
      this.controls.enabled = true;
    }

    console.log("[Game] VR session ended");
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
    console.log("[Game] Paused");
  }

  /**
   * Resume the game
   */
  resume() {
    this.isPaused = false;
    this.lastTime = performance.now(); // Reset time to avoid large delta
    console.log("[Game] Resumed");
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
          object.material.forEach((material) => material.dispose());
        } else {
          object.material.dispose();
        }
      }
    });

    // Dispose renderer
    this.renderer.dispose();

    console.log("[Game] Disposed");
  }
}
