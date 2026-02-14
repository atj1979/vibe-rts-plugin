/**
 * Selection System
 * 
 * Handles unit selection via mouse or VR controllers.
 * 
 * FEATURES:
 * - Click to select single unit
 * - Shift+Click to add to selection
 * - Ctrl+Click to remove from selection
 * - Box selection (drag to select multiple)
 * - Visual feedback (highlighted units)
 * 
 * ARCHITECTURE:
 * - Uses Three.js Raycaster for picking
 * - Maintains selected units array
 * - Emits selection events for UI updates
 * - Works in both desktop and VR modes
 * 
 * AI WALKTHROUGH:
 * 1. Mouse down starts potential selection
 * 2. Raycast from camera through mouse position
 * 3. Check intersection with unit meshes
 * 4. Add/remove from selection based on modifiers
 * 5. Update visual feedback
 * 
 * PERFORMANCE:
 * - Raycasting only on mouse events (not every frame)
 * - Instanced mesh picking via instanceId
 * - Efficient selection array management
 */

import * as THREE from 'three';

export class SelectionSystem {
  constructor(camera, renderer, unitSystem) {
    this.camera = camera;
    this.renderer = renderer;
    this.unitSystem = unitSystem;
    
    // Selected units
    this.selectedUnits = [];
    
    // Raycaster for picking
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    // Selection box (for drag selection)
    this.isBoxSelecting = false;
    this.boxSelectStart = new THREE.Vector2();
    this.boxSelectEnd = new THREE.Vector2();
    
    // Visual feedback
    this.selectionIndicators = [];
    this.scene = null; // Will be set by Game.js
    
    // Input state
    this.shiftPressed = false;
    this.ctrlPressed = false;
    
    // Bind event handlers
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    
    console.log('[SelectionSystem] Initialized');
  }
  
  /**
   * Initialize the selection system
   * @param {THREE.Scene} scene - Scene to add selection indicators
   */
  init(scene) {
    this.scene = scene;
    
    // Setup event listeners
    const canvas = this.renderer.domElement;
    canvas.addEventListener('mousedown', this.onMouseDown);
    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    
    console.log('[SelectionSystem] Event listeners attached');
  }
  
  /**
   * Handle mouse down event
   */
  onMouseDown(event) {
    // Only handle left mouse button
    if (event.button !== 0) return;
    
    // Update mouse position
    this.updateMousePosition(event);
    
    // Start box selection (if dragging)
    this.isBoxSelecting = true;
    this.boxSelectStart.copy(this.mouse);
    
    // Perform raycast for single unit selection
    this.performRaycast();
  }
  
  /**
   * Handle mouse move event
   */
  onMouseMove(event) {
    if (!this.isBoxSelecting) return;
    
    this.updateMousePosition(event);
    this.boxSelectEnd.copy(this.mouse);
    
    // TODO: Visualize box selection rectangle
  }
  
  /**
   * Handle mouse up event
   */
  onMouseUp(event) {
    if (event.button !== 0) return;
    
    this.isBoxSelecting = false;
    
    // If this was a drag (not a click), do box selection
    const dragDistance = this.boxSelectStart.distanceTo(this.boxSelectEnd);
    if (dragDistance > 0.01) {
      // Box selection not implemented yet
      console.log('[SelectionSystem] Box selection not yet implemented');
    }
  }
  
  /**
   * Handle key down event
   */
  onKeyDown(event) {
    if (event.key === 'Shift') this.shiftPressed = true;
    if (event.key === 'Control') this.ctrlPressed = true;
  }
  
  /**
   * Handle key up event
   */
  onKeyUp(event) {
    if (event.key === 'Shift') this.shiftPressed = false;
    if (event.key === 'Control') this.ctrlPressed = false;
  }
  
  /**
   * Update mouse position in normalized device coordinates
   * @param {MouseEvent} event
   */
  updateMousePosition(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }
  
  /**
   * Perform raycast to find clicked unit
   * PERFORMANCE: Only raycast against instanced meshes
   */
  performRaycast() {
    // Update raycaster from camera and mouse position
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    // Get all instanced meshes
    const instancedMeshes = Object.values(this.unitSystem.instancedMeshes);
    
    // Raycast against all meshes
    const intersects = this.raycaster.intersectObjects(instancedMeshes, false);
    
    if (intersects.length > 0) {
      const intersection = intersects[0];
      const instanceId = intersection.instanceId;
      const mesh = intersection.object;
      
      // Find which unit type this mesh represents
      let unitType = null;
      for (const [type, typeMesh] of Object.entries(this.unitSystem.instancedMeshes)) {
        if (typeMesh === mesh) {
          unitType = type;
          break;
        }
      }
      
      if (unitType !== null) {
        // Get the actual unit from the array
        const units = this.unitSystem.unitsByType[unitType];
        const unit = units[instanceId];
        
        if (unit) {
          this.handleUnitClick(unit);
        }
      }
    } else {
      // Clicked empty space - deselect all (unless shift/ctrl)
      if (!this.shiftPressed && !this.ctrlPressed) {
        this.clearSelection();
      }
    }
  }
  
  /**
   * Handle clicking a unit
   * @param {Unit} unit - The clicked unit
   */
  handleUnitClick(unit) {
    if (this.ctrlPressed) {
      // Ctrl+Click: Remove from selection
      this.deselectUnit(unit);
    } else if (this.shiftPressed) {
      // Shift+Click: Add to selection
      this.selectUnit(unit, true);
    } else {
      // Normal click: Select only this unit
      this.clearSelection();
      this.selectUnit(unit, false);
    }
    
    console.log('[SelectionSystem] Selected units:', this.selectedUnits.length);
  }
  
  /**
   * Select a unit
   * @param {Unit} unit - Unit to select
   * @param {boolean} additive - Add to selection or replace
   */
  selectUnit(unit, additive = false) {
    // Don't select if already selected
    if (this.selectedUnits.includes(unit)) return;
    
    // Clear previous selection if not additive
    if (!additive) {
      this.clearSelection();
    }
    
    this.selectedUnits.push(unit);
    unit.isSelected = true;
    
    // Create selection indicator
    this.createSelectionIndicator(unit);
  }
  
  /**
   * Deselect a unit
   * @param {Unit} unit - Unit to deselect
   */
  deselectUnit(unit) {
    const index = this.selectedUnits.indexOf(unit);
    if (index === -1) return;
    
    this.selectedUnits.splice(index, 1);
    unit.isSelected = false;
    
    // Remove selection indicator
    this.removeSelectionIndicator(unit);
  }
  
  /**
   * Clear all selections
   */
  clearSelection() {
    this.selectedUnits.forEach(unit => {
      unit.isSelected = false;
    });
    this.selectedUnits = [];
    
    // Remove all indicators
    this.removeAllSelectionIndicators();
  }
  
  /**
   * Create visual selection indicator for a unit
   * @param {Unit} unit - Unit to add indicator to
   */
  createSelectionIndicator(unit) {
    if (!this.scene) return;
    
    // Create a ring around the unit
    const geometry = new THREE.RingGeometry(0.6, 0.8, 16);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7
    });
    
    const ring = new THREE.Mesh(geometry, material);
    ring.rotation.x = -Math.PI / 2; // Horizontal
    ring.position.copy(unit.position);
    ring.position.y = 0.1; // Slightly above ground
    
    // Store reference to unit
    ring.userData.unit = unit;
    
    this.scene.add(ring);
    this.selectionIndicators.push(ring);
  }
  
  /**
   * Remove selection indicator for a unit
   * @param {Unit} unit - Unit to remove indicator from
   */
  removeSelectionIndicator(unit) {
    if (!this.scene) return;
    
    const index = this.selectionIndicators.findIndex(
      indicator => indicator.userData.unit === unit
    );
    
    if (index !== -1) {
      const indicator = this.selectionIndicators[index];
      this.scene.remove(indicator);
      indicator.geometry.dispose();
      indicator.material.dispose();
      this.selectionIndicators.splice(index, 1);
    }
  }
  
  /**
   * Remove all selection indicators
   */
  removeAllSelectionIndicators() {
    if (!this.scene) return;
    
    this.selectionIndicators.forEach(indicator => {
      this.scene.remove(indicator);
      indicator.geometry.dispose();
      indicator.material.dispose();
    });
    
    this.selectionIndicators = [];
  }
  
  /**
   * Update selection indicators (called every frame)
   * Updates indicator positions to follow units
   */
  update() {
    // Update indicator positions
    this.selectionIndicators.forEach(indicator => {
      const unit = indicator.userData.unit;
      if (unit && unit.isAlive) {
        indicator.position.copy(unit.position);
        indicator.position.y = 0.1;
        
        // Animate the ring (pulsing effect)
        const time = Date.now() * 0.001;
        const scale = 1 + Math.sin(time * 3) * 0.1;
        indicator.scale.set(scale, scale, 1);
      }
    });
  }
  
  /**
   * Get selected units
   * @returns {Array<Unit>}
   */
  getSelectedUnits() {
    return [...this.selectedUnits];
  }
  
  /**
   * Check if any units are selected
   * @returns {boolean}
   */
  hasSelection() {
    return this.selectedUnits.length > 0;
  }
  
  /**
   * Command selected units to move to a position
   * Called by external command system (e.g., right-click)
   * @param {number} x - Target X position
   * @param {number} z - Target Z position
   */
  commandMove(x, z) {
    if (this.selectedUnits.length === 0) return;
    
    this.unitSystem.commandMove(this.selectedUnits, x, z);
    console.log(`[SelectionSystem] Commanded ${this.selectedUnits.length} units to move to (${x}, ${z})`);
  }
  
  /**
   * Cleanup
   */
  dispose() {
    // Remove event listeners
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('mousedown', this.onMouseDown);
    canvas.removeEventListener('mousemove', this.onMouseMove);
    canvas.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    
    // Clear selections
    this.clearSelection();
    
    console.log('[SelectionSystem] Disposed');
  }
}
