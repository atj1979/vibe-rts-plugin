/**
 * Building System
 * 
 * Manages all buildings in the game with instanced rendering.
 * Handles building placement, construction, and unit production.
 * 
 * ARCHITECTURE:
 * - Instanced rendering (1 draw call per building type)
 * - Object pooling for buildings
 * - Integration with UnitSystem for unit production
 * - Construction progress visualization
 * 
 * PERFORMANCE:
 * - Buildings rendered with instanced meshes
 * - Production queue processed efficiently
 * - Updates only active buildings
 * 
 * AI WALKTHROUGH:
 * 1. placeBuilding() starts construction
 * 2. update() progresses construction and production
 * 3. When production complete, spawn unit via UnitSystem
 * 4. render() updates instance matrices and construction state
 */

import * as THREE from 'three';
import { Building, BuildingType, BuildingState } from '../entities/Building.js';
import { ObjectPool } from '../utils/ObjectPool.js';

export class BuildingSystem {
  constructor(scene, unitSystem) {
    this.scene = scene;
    this.unitSystem = unitSystem;
    
    // Buildings organized by type
    this.buildingsByType = {
      [BuildingType.COMMAND_CENTER]: [],
      [BuildingType.BARRACKS]: [],
      [BuildingType.FACTORY]: [],
      [BuildingType.SHIELD_GENERATOR]: []
    };
    
    // All buildings (for quick iteration)
    this.allBuildings = [];
    
    // Object pool for buildings
    this.buildingPool = new ObjectPool(() => new Building(), 20);
    
    // Instanced meshes for each building type
    this.instancedMeshes = {};
    
    // Temp matrix for transforms
    this.tempMatrix = new THREE.Matrix4();
    this.tempPosition = new THREE.Vector3();
    this.tempRotation = new THREE.Quaternion();
    this.tempScale = new THREE.Vector3(1, 1, 1);
    
    // Building colors by type
    this.buildingColors = {
      [BuildingType.COMMAND_CENTER]: 0x4444ff,  // Blue
      [BuildingType.BARRACKS]: 0x44ff44,        // Green
      [BuildingType.FACTORY]: 0xff4444,         // Red
      [BuildingType.SHIELD_GENERATOR]: 0xffff44 // Yellow
    };
    
    // Statistics
    this.stats = {
      totalBuildings: 0,
      buildingsByType: {},
      underConstruction: 0
    };
    
    this.createInstancedMeshes();
    
    console.log('[BuildingSystem] Initialized');
  }
  
  /**
   * Create instanced meshes for building types
   */
  createInstancedMeshes() {
    const maxBuildingsPerType = 10;
    
    // Base geometry for all buildings
    const baseGeometry = new THREE.BoxGeometry(1, 1, 1);
    
    Object.values(BuildingType).forEach(type => {
      // Material with type-specific color
      const material = new THREE.MeshStandardMaterial({
        color: this.buildingColors[type],
        roughness: 0.6,
        metalness: 0.4,
        flatShading: false
      });
      
      // Clone and scale geometry based on type
      const geometry = baseGeometry.clone();
      this.scaleGeometryForType(geometry, type);
      
      // Create instanced mesh
      const mesh = new THREE.InstancedMesh(
        geometry,
        material,
        maxBuildingsPerType
      );
      
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.count = 0;
      
      this.scene.add(mesh);
      this.instancedMeshes[type] = mesh;
      
      console.log(`[BuildingSystem] Created instanced mesh for ${type}`);
    });
  }
  
  /**
   * Scale geometry based on building type
   */
  scaleGeometryForType(geometry, type) {
    let scale;
    
    switch(type) {
      case BuildingType.COMMAND_CENTER:
        scale = { x: 6, y: 3, z: 6 }; // Large, flat
        break;
      case BuildingType.BARRACKS:
        scale = { x: 4, y: 2, z: 4 }; // Medium
        break;
      case BuildingType.FACTORY:
        scale = { x: 5, y: 2.5, z: 5 }; // Large, medium height
        break;
      case BuildingType.SHIELD_GENERATOR:
        scale = { x: 2, y: 4, z: 2 }; // Tall, thin
        break;
      default:
        scale = { x: 3, y: 2, z: 3 };
    }
    
    geometry.scale(scale.x, scale.y, scale.z);
  }
  
  /**
   * Place a new building
   * @param {string} type - Building type
   * @param {number} x - X position
   * @param {number} z - Z position
   * @param {number} team - Team ID
   * @param {boolean} skipConstruction - Build instantly (for initial bases)
   * @returns {Building|null}
   */
  placeBuilding(type, x, z, team = 0, skipConstruction = false) {
    // Get building from pool
    const building = this.buildingPool.acquire();
    
    // Initialize
    const position = new THREE.Vector3(x, 0, z);
    building.init(type, position, team, skipConstruction);
    
    // Generate unique ID
    building.id = this.generateBuildingId();
    
    // Add to arrays
    this.buildingsByType[type].push(building);
    this.allBuildings.push(building);
    
    // Update stats
    this.stats.totalBuildings++;
    if (!skipConstruction) {
      this.stats.underConstruction++;
    }
    
    console.log(`[BuildingSystem] Placed ${type} at (${x}, ${z}) for team ${team}`);
    
    return building;
  }
  
  /**
   * Destroy a building
   * @param {Building} building
   */
  destroyBuilding(building) {
    if (!building) return;
    
    // Mark as destroyed
    building.release();
    
    // Remove from type array
    const typeArray = this.buildingsByType[building.type];
    const typeIndex = typeArray.indexOf(building);
    if (typeIndex !== -1) {
      typeArray.splice(typeIndex, 1);
    }
    
    // Remove from all buildings
    const allIndex = this.allBuildings.indexOf(building);
    if (allIndex !== -1) {
      this.allBuildings.splice(allIndex, 1);
    }
    
    // Return to pool
    this.buildingPool.release(building);
    
    // Update stats
    this.stats.totalBuildings--;
    
    console.log(`[BuildingSystem] Destroyed ${building.type}`);
  }
  
  /**
   * Update all buildings
   * @param {number} dt - Delta time
   */
  update(dt) {
    // Reset stats
    this.stats.underConstruction = 0;
    
    // Update all buildings
    for (let i = 0; i < this.allBuildings.length; i++) {
      const building = this.allBuildings[i];
      building.update(dt);
      
      // Track construction
      if (building.state === BuildingState.CONSTRUCTING) {
        this.stats.underConstruction++;
      }
      
      // Check if production complete
      if (building.state === BuildingState.PRODUCING && 
          building.productionProgress >= 1.0 &&
          building.currentProduction) {
        this.completeProduction(building);
      }
    }
    
    // Remove destroyed buildings
    this.removeDestroyedBuildings();
  }
  
  /**
   * Complete unit production and spawn unit
   * @param {Building} building
   */
  completeProduction(building) {
    const unitType = building.currentProduction;
    
    // Spawn unit at rally point
    const spawnPos = building.hasRallyPoint ? 
      building.rallyPoint : 
      new THREE.Vector3(building.position.x + 3, 0.5, building.position.z);
    
    const unit = this.unitSystem.spawnUnit(
      unitType,
      spawnPos.x,
      spawnPos.z,
      building.team
    );
    
    if (unit) {
      console.log(`[BuildingSystem] ${building.type} produced ${unitType}`);
    }
    
    // Reset production
    building.currentProduction = null;
    building.productionProgress = 0;
    building.state = BuildingState.IDLE;
    
    // Check queue for next production
    if (building.productionQueue.length > 0) {
      building.startNextProduction();
    }
  }
  
  /**
   * Remove destroyed buildings
   */
  removeDestroyedBuildings() {
    for (let i = this.allBuildings.length - 1; i >= 0; i--) {
      const building = this.allBuildings[i];
      if (!building.isAlive) {
        this.destroyBuilding(building);
      }
    }
  }
  
  /**
   * Render buildings (update instance matrices)
   */
  render() {
    const tempColor = new THREE.Color();
    
    Object.entries(this.buildingsByType).forEach(([type, buildings]) => {
      const mesh = this.instancedMeshes[type];
      mesh.count = buildings.length;
      
      buildings.forEach((building, index) => {
        // Position
        this.tempPosition.copy(building.position);
        
        // Adjust Y based on construction progress
        if (building.state === BuildingState.CONSTRUCTING) {
          // Rise from ground as constructed
          const baseHeight = mesh.geometry.boundingBox ? 
            (mesh.geometry.boundingBox.max.y - mesh.geometry.boundingBox.min.y) / 2 : 1;
          this.tempPosition.y = baseHeight * building.constructionProgress;
        } else {
          const baseHeight = mesh.geometry.boundingBox ? 
            (mesh.geometry.boundingBox.max.y - mesh.geometry.boundingBox.min.y) / 2 : 1;
          this.tempPosition.y = baseHeight;
        }
        
        // Rotation
        this.tempRotation.setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          building.rotation
        );
        
        // Scale (can animate during construction)
        const scale = building.state === BuildingState.CONSTRUCTING ?
          building.constructionProgress : 1.0;
        this.tempScale.set(1, scale, 1);
        
        // Build matrix
        this.tempMatrix.compose(
          this.tempPosition,
          this.tempRotation,
          this.tempScale
        );
        
        mesh.setMatrixAt(index, this.tempMatrix);
        
        // Set color (team-based + construction tint)
        tempColor.set(this.buildingColors[type]);
        if (building.team === 1) {
          tempColor.multiplyScalar(0.6); // Darker for enemy
        }
        if (building.state === BuildingState.CONSTRUCTING) {
          tempColor.lerp(new THREE.Color(0x888888), 1 - building.constructionProgress);
        }
        mesh.setColorAt(index, tempColor);
      });
      
      // Update GPU
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
      }
    });
  }
  
  /**
   * Generate unique building ID
   * @returns {number}
   */
  generateBuildingId() {
    if (!this._nextBuildingId) {
      this._nextBuildingId = 1;
    }
    return this._nextBuildingId++;
  }
  
  /**
   * Get building by ID
   * @param {number} id
   * @returns {Building|null}
   */
  getBuildingById(id) {
    return this.allBuildings.find(b => b.id === id) || null;
  }
  
  /**
   * Get buildings in radius
   * @param {THREE.Vector3} position
   * @param {number} radius
   * @param {number} team - Filter by team (-1 = all)
   * @returns {Array<Building>}
   */
  getBuildingsInRadius(position, radius, team = -1) {
    const radiusSq = radius * radius;
    const results = [];
    
    for (let i = 0; i < this.allBuildings.length; i++) {
      const building = this.allBuildings[i];
      
      if (team !== -1 && building.team !== team) continue;
      
      const distSq = building.position.distanceToSquared(position);
      if (distSq <= radiusSq) {
        results.push(building);
      }
    }
    
    return results;
  }
  
  /**
   * Get stats
   * @returns {Object}
   */
  getStats() {
    this.stats.buildingsByType = {};
    Object.entries(this.buildingsByType).forEach(([type, buildings]) => {
      this.stats.buildingsByType[type] = buildings.length;
    });
    return { ...this.stats };
  }
  
  /**
   * Cleanup
   */
  dispose() {
    // Dispose meshes
    Object.values(this.instancedMeshes).forEach(mesh => {
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) mesh.material.dispose();
      this.scene.remove(mesh);
    });
    
    // Clear arrays
    Object.keys(this.buildingsByType).forEach(type => {
      this.buildingsByType[type] = [];
    });
    this.allBuildings = [];
    
    this.buildingPool.dispose();
    
    console.log('[BuildingSystem] Disposed');
  }
}
