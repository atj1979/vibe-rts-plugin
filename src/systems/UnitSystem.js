/**
 * Unit System
 * 
 * Manages all units in the game using HIGH-PERFORMANCE instanced rendering.
 * 
 * CRITICAL PERFORMANCE PATTERN:
 * Instead of creating separate meshes for each unit (100 units = 100 draw calls),
 * we use InstancedMesh (100 units = 1 draw call per unit type).
 * 
 * ARCHITECTURE:
 * - All units stored in arrays by type
 * - Each unit type has ONE InstancedMesh
 * - Update loop updates unit logic (60Hz)
 * - Render loop updates instance matrices (90Hz for VR)
 * - Object pooling for units (no GC pauses)
 * 
 * AI WALKTHROUGH:
 * 1. System created with scene reference
 * 2. spawnUnit() gets unit from pool, adds to array
 * 3. update() calls unit.update() on all units
 * 4. render() updates GPU instance matrices
 * 5. destroyUnit() returns unit to pool
 * 
 * PERFORMANCE TARGET:
 * - 200 units at 90 FPS
 * - 5 draw calls total (one per unit type)
 * - <1ms CPU time per frame for all units
 */

import * as THREE from 'three';
import { Unit, UnitType, UnitState } from '../entities/Unit.js';
import { ObjectPool } from '../utils/ObjectPool.js';

export class UnitSystem {
  constructor(scene, pluginManager = null) {
    this.scene = scene;
    this.pluginManager = pluginManager;
    
    // Units organized by type for instanced rendering
    this.unitsByType = {
      [UnitType.SCOUT]: [],
      [UnitType.SOLDIER]: [],
      [UnitType.TANK]: [],
      [UnitType.ARTILLERY]: [],
      [UnitType.CONSTRUCTOR]: []
    };
    
    // All units (for quick iteration)
    this.allUnits = [];
    
    // Object pool for units (prevent GC)
    this.unitPool = new ObjectPool(() => new Unit(), 50);
    
    // Instanced meshes for each unit type
    this.instancedMeshes = {};
    
    // Temp matrix for setting instance transforms
    this.tempMatrix = new THREE.Matrix4();
    this.tempPosition = new THREE.Vector3();
    this.tempRotation = new THREE.Quaternion();
    this.tempScale = new THREE.Vector3(1, 1, 1);
    
    // Unit colors by type (for visual distinction)
    this.unitColors = {
      [UnitType.SCOUT]: 0x4488ff,      // Blue
      [UnitType.SOLDIER]: 0x44ff44,    // Green
      [UnitType.TANK]: 0xff4444,       // Red
      [UnitType.ARTILLERY]: 0xffff44,  // Yellow
      [UnitType.CONSTRUCTOR]: 0xff8844 // Orange
    };
    
    // Initialize rendering
    this.createInstancedMeshes();
    
    // Statistics
    this.stats = {
      totalUnits: 0,
      unitsByType: {},
      spawnedThisFrame: 0,
      destroyedThisFrame: 0
    };
    
    console.log('[UnitSystem] Initialized with instanced rendering');
  }
  
  /**
   * Create instanced meshes for all unit types
   * PERFORMANCE: Each type renders in ONE draw call
   */
  createInstancedMeshes() {
    const maxUnitsPerType = 50; // Can be increased
    
    // Geometry (shared by all types, just scaled differently)
    const baseGeometry = new THREE.BoxGeometry(1, 1, 1);
    
    // Create instanced mesh for each type
    Object.values(UnitType).forEach(type => {
      // Material with type-specific color
      const material = new THREE.MeshStandardMaterial({
        color: this.unitColors[type],
        roughness: 0.7,
        metalness: 0.3,
        flatShading: false,
        side: THREE.DoubleSide // Render both sides to fix disappearing issue
      });
      
      // Clone geometry and scale based on type
      const geometry = baseGeometry.clone();
      this.scaleGeometryForType(geometry, type);
      
      // Create instanced mesh
      const mesh = new THREE.InstancedMesh(
        geometry,
        material,
        maxUnitsPerType
      );
      
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = true; // Auto culling
      
      // No instances yet
      mesh.count = 0;
      
      this.scene.add(mesh);
      this.instancedMeshes[type] = mesh;
      
      console.log(`[UnitSystem] Created instanced mesh for ${type} (max: ${maxUnitsPerType})`);
    });
  }
  
  /**
   * Scale geometry based on unit type
   * PATTERN: Different unit types have different sizes
   */
  scaleGeometryForType(geometry, type) {
    let scale;
    
    switch(type) {
      case UnitType.SCOUT:
        scale = { x: 0.8, y: 0.8, z: 0.8 }; // Small
        break;
      case UnitType.SOLDIER:
        scale = { x: 1.0, y: 1.0, z: 1.0 }; // Medium
        break;
      case UnitType.TANK:
        scale = { x: 1.5, y: 1.2, z: 1.5 }; // Large and wide
        break;
      case UnitType.ARTILLERY:
        scale = { x: 1.0, y: 1.5, z: 1.0 }; // Tall
        break;
      case UnitType.CONSTRUCTOR:
        scale = { x: 1.2, y: 0.8, z: 1.2 }; // Wide and short
        break;
      default:
        scale = { x: 1.0, y: 1.0, z: 1.0 };
    }
    
    geometry.scale(scale.x, scale.y, scale.z);
  }
  
  /**
   * Spawn a new unit
   * PATTERN: Acquires from pool, initializes, adds to arrays
   * 
   * @param {string} type - Unit type from UnitType enum
   * @param {number} x - X position
   * @param {number} z - Z position
   * @param {number} team - Team ID (0 = player, 1 = enemy)
   * @returns {Unit} The spawned unit
   */
  spawnUnit(type, x, z, team = 0) {
    // Check if we have room
    const typeArray = this.unitsByType[type];
    const mesh = this.instancedMeshes[type];
    
    if (typeArray.length >= mesh.geometry.maxInstancedCount) {
      console.warn(`[UnitSystem] Cannot spawn ${type}: max instances reached`);
      return null;
    }
    
    // Get unit from pool
    const unit = this.unitPool.acquire();
    
    // Initialize unit
    const position = new THREE.Vector3(x, 0.5, z);
    unit.init(type, position, team);

    // Apply plugin-defined stats (if available)
    const unitDef = this.pluginManager?.getUnitDefinition(type);
    if (unitDef?.stats) {
      unit.applyStats(unitDef.stats);
    }
    
    // Generate unique ID
    unit.id = this.generateUnitId();
    
    // Add to arrays
    typeArray.push(unit);
    this.allUnits.push(unit);
    
    // Update stats
    this.stats.totalUnits++;
    this.stats.spawnedThisFrame++;
    
    console.log(`[UnitSystem] Spawned ${type} at (${x}, ${z}). Total: ${this.stats.totalUnits}`);
    
    return unit;
  }
  
  /**
   * Destroy a unit
   * PATTERN: Returns to pool, removes from arrays
   * 
   * @param {Unit} unit - Unit to destroy
   */
  destroyUnit(unit) {
    if (!unit) return;
    
    // Mark as dead
    unit.release();
    
    // Remove from type array
    const typeArray = this.unitsByType[unit.type];
    const typeIndex = typeArray.indexOf(unit);
    if (typeIndex !== -1) {
      typeArray.splice(typeIndex, 1);
    }
    
    // Remove from all units array
    const allIndex = this.allUnits.indexOf(unit);
    if (allIndex !== -1) {
      this.allUnits.splice(allIndex, 1);
    }
    
    // Return to pool
    this.unitPool.release(unit);
    
    // Update stats
    this.stats.totalUnits--;
    this.stats.destroyedThisFrame++;
  }
  
  /**
   * Update all units (called at 60Hz by Game.js)
   * PERFORMANCE: Simple loop, units handle own logic
   * 
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    // Reset per-frame stats
    this.stats.spawnedThisFrame = 0;
    this.stats.destroyedThisFrame = 0;
    
    // Update all units
    // PERFORMANCE NOTE: Units update themselves (no central logic)
    for (let i = 0; i < this.allUnits.length; i++) {
      this.allUnits[i].update(dt);
    }
    
    // Remove dead units (check periodically, not every frame)
    // TODO: Optimize to check every N frames
    this.removeDeadUnits();
  }
  
  /**
   * Remove units that died
   * PATTERN: Sweep dead units and return to pool
   */
  removeDeadUnits() {
    // Reverse iteration for safe removal
    for (let i = this.allUnits.length - 1; i >= 0; i--) {
      const unit = this.allUnits[i];
      if (!unit.isAlive) {
        this.destroyUnit(unit);
      }
    }
  }
  
  /**
   * Update visual representation (called at render rate)
   * CRITICAL: This updates GPU instance matrices and colors
   * 
   * PERFORMANCE: One update per unit type, not per unit
   */
  render() {
    // Temp color for team tinting
    const tempColor = new THREE.Color();
    
    // Update each unit type's instanced mesh
    Object.entries(this.unitsByType).forEach(([type, units]) => {
      const mesh = this.instancedMeshes[type];
      
      // Update instance count (only render active units)
      mesh.count = units.length;
      
      // Update each instance's transform matrix and color
      units.forEach((unit, index) => {
        // Set position
        this.tempPosition.copy(unit.position);
        
        // Set rotation (Y-axis only for now)
        this.tempRotation.setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          unit.rotation
        );
        
        // Build matrix
        this.tempMatrix.compose(
          this.tempPosition,
          this.tempRotation,
          this.tempScale
        );
        
        // Update instance matrix
        mesh.setMatrixAt(index, this.tempMatrix);
        
        // Set color based on team (team 0 = bright, team 1 = darker)
        tempColor.set(this.unitColors[type]);
        if (unit.team === 1) {
          // Make enemy units darker
          tempColor.multiplyScalar(0.6);
        }
        mesh.setColorAt(index, tempColor);
      });
      
      // Tell GPU to update
      mesh.instanceMatrix.needsUpdate = true;
      
      // Update colors if mesh supports it
      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
      }
    });
  }
  
  /**
   * Generate unique unit ID
   * @returns {number}
   */
  generateUnitId() {
    if (!this._nextUnitId) {
      this._nextUnitId = 1;
    }
    return this._nextUnitId++;
  }
  
  /**
   * Get unit by ID
   * @param {number} id - Unit ID
   * @returns {Unit|null}
   */
  getUnitById(id) {
    return this.allUnits.find(u => u.id === id) || null;
  }
  
  /**
   * Get all units in radius of a position
   * PATTERN: Used for area selection, splash damage
   * PERFORMANCE: Uses distanceSq to avoid sqrt
   * 
   * @param {THREE.Vector3} position - Center position
   * @param {number} radius - Radius to check
   * @param {number} team - Filter by team (-1 = all teams)
   * @returns {Array<Unit>}
   */
  getUnitsInRadius(position, radius, team = -1) {
    const radiusSq = radius * radius;
    const results = [];
    
    for (let i = 0; i < this.allUnits.length; i++) {
      const unit = this.allUnits[i];
      
      // Filter by team
      if (team !== -1 && unit.team !== team) continue;
      
      // Check distance (squared for performance)
      const dx = unit.position.x - position.x;
      const dz = unit.position.z - position.z;
      const distSq = dx * dx + dz * dz;
      
      if (distSq <= radiusSq) {
        results.push(unit);
      }
    }
    
    return results;
  }
  
  /**
   * Select units in rectangular area
   * PATTERN: For VR selection box
   * 
   * @param {number} minX - Min X boundary
   * @param {number} maxX - Max X boundary
   * @param {number} minZ - Min Z boundary
   * @param {number} maxZ - Max Z boundary
   * @param {number} team - Filter by team
   * @returns {Array<Unit>}
   */
  getUnitsInBox(minX, maxX, minZ, maxZ, team = 0) {
    const results = [];
    
    for (let i = 0; i < this.allUnits.length; i++) {
      const unit = this.allUnits[i];
      
      if (unit.team !== team) continue;
      
      if (unit.position.x >= minX && unit.position.x <= maxX &&
          unit.position.z >= minZ && unit.position.z <= maxZ) {
        results.push(unit);
      }
    }
    
    return results;
  }
  
  /**
   * Command units to move to position
   * PATTERN: Called by player input or AI
   * 
   * @param {Array<Unit>} units - Units to command
   * @param {number} x - Target X
   * @param {number} z - Target Z
   */
  commandMove(units, x, z) {
    units.forEach(unit => {
      unit.moveTo(x, z);
    });
    
    console.log(`[UnitSystem] Commanded ${units.length} units to move to (${x}, ${z})`);
  }
  
  /**
   * Get system statistics
   * @returns {Object} Stats object
   */
  getStats() {
    // Update type counts
    this.stats.unitsByType = {};
    Object.entries(this.unitsByType).forEach(([type, units]) => {
      this.stats.unitsByType[type] = units.length;
    });
    
    return { ...this.stats };
  }
  
  /**
   * Spawn random units for testing
   * PATTERN: Development helper
   * 
   * @param {number} count - Number of units to spawn
   * @param {string} type - Unit type (undefined = random)
   * @param {number} team - Team ID
   */
  spawnRandomUnits(count, type, team = 0) {
    const types = Object.values(UnitType);
    
    for (let i = 0; i < count; i++) {
      const unitType = type || types[Math.floor(Math.random() * types.length)];
      const x = (Math.random() - 0.5) * 80; // Within bounds
      const z = (Math.random() - 0.5) * 80;
      
      const unit = this.spawnUnit(unitType, x, z, team);
      
      // Give random movement for demo
      if (unit && Math.random() > 0.5) {
        const targetX = (Math.random() - 0.5) * 80;
        const targetZ = (Math.random() - 0.5) * 80;
        unit.moveTo(targetX, targetZ);
      }
    }
    
    console.log(`[UnitSystem] Spawned ${count} random units`);
  }
  
  /**
   * Dispose of all resources
   * PATTERN: Cleanup for when switching scenes
   */
  dispose() {
    // Dispose all instanced meshes
    Object.values(this.instancedMeshes).forEach(mesh => {
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) mesh.material.dispose();
      this.scene.remove(mesh);
    });
    
    // Clear all arrays
    Object.keys(this.unitsByType).forEach(type => {
      this.unitsByType[type] = [];
    });
    this.allUnits = [];
    
    // Dispose pool
    this.unitPool.dispose();
    
    console.log('[UnitSystem] Disposed');
  }
}
