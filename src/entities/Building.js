/**
 * Building Entity
 * 
 * Represents structures that can be placed on the battlefield.
 * Buildings produce units, provide shields, or serve as strategic points.
 * 
 * ARCHITECTURE:
 * - Similar to Unit but stationary
 * - Production queue for units
 * - Can be damaged and destroyed
 * - Uses object pooling
 * 
 * PERFORMANCE:
 * - Stationary (no movement updates)
 * - Simple state machine
 * - Pooled for efficiency
 * 
 * AI WALKTHROUGH:
 * 1. Building placed by constructor or initially spawned
 * 2. Update handles production queue
 * 3. Can take damage from enemy attacks
 * 4. Destroyed when health reaches 0
 */

import * as THREE from 'three';

// Building types (from game design document)
export const BuildingType = {
  COMMAND_CENTER: 'command_center',
  BARRACKS: 'barracks',
  FACTORY: 'factory',
  SHIELD_GENERATOR: 'shield_generator'
};

// Building states
export const BuildingState = {
  CONSTRUCTING: 'constructing',  // Being built
  IDLE: 'idle',                  // Ready, no production
  PRODUCING: 'producing',        // Building a unit
  DAMAGED: 'damaged',            // Health below 50%
  DESTROYED: 'destroyed'         // Health at 0
};

export class Building {
  constructor() {
    // Identity
    this.id = 0;
    this.type = BuildingType.COMMAND_CENTER;
    this.team = 0; // 0 = player, 1 = enemy
    
    // Transform (buildings don't rotate/move)
    this.position = new THREE.Vector3();
    this.rotation = 0; // Fixed rotation for visual variety
    
    // Health
    this.health = 1000;
    this.maxHealth = 1000;
    this.isAlive = true;
    
    // State
    this.state = BuildingState.CONSTRUCTING;
    this.isSelected = false;
    
    // Construction
    this.constructionProgress = 0; // 0-1, used during CONSTRUCTING state
    this.constructionTime = 5.0; // Seconds to build
    
    // Production (for unit-producing buildings)
    this.productionQueue = []; // Array of unit types to produce
    this.currentProduction = null; // Currently producing unit type
    this.productionProgress = 0; // 0-1
    this.productionTime = 10.0; // Seconds per unit
    this.canProduce = false; // Set based on building type
    this.producibleUnits = []; // Which units this building can make
    
    // Rally point (where produced units go)
    this.rallyPoint = new THREE.Vector3();
    this.hasRallyPoint = false;
    
    // Special abilities (e.g., shield generator)
    this.hasShield = false;
    this.shieldRadius = 0;
    this.shieldStrength = 0;
  }
  
  /**
   * Initialize building
   * Called when acquiring from pool or spawning
   * 
   * @param {string} type - Building type
   * @param {THREE.Vector3} position - Position on map
   * @param {number} team - Team ID
   * @param {boolean} skipConstruction - If true, building is instant
   */
  init(type, position, team = 0, skipConstruction = false) {
    this.type = type;
    this.position.copy(position);
    this.team = team;
    this.rotation = 0;
    
    // Reset state
    this.isAlive = true;
    this.isSelected = false;
    this.productionQueue = [];
    this.currentProduction = null;
    this.productionProgress = 0;
    this.constructionProgress = skipConstruction ? 1.0 : 0;
    this.state = skipConstruction ? BuildingState.IDLE : BuildingState.CONSTRUCTING;
    
    // Set stats based on type
    this.setStatsForType(type);
    
    // Set default rally point (in front of building)
    this.rallyPoint.copy(position);
    this.rallyPoint.x += 5;
    this.hasRallyPoint = true;
    
    return this;
  }
  
  /**
   * Set building stats based on type
   * Reference: GAME_DESIGN.md
   */
  setStatsForType(type) {
    switch(type) {
      case BuildingType.COMMAND_CENTER:
        this.maxHealth = 5000;
        this.health = 5000;
        this.constructionTime = 0; // Instant (starts with it)
        this.canProduce = true;
        this.producibleUnits = ['constructor'];
        this.productionTime = 15.0; // Constructors take longer
        break;
      
      case BuildingType.BARRACKS:
        this.maxHealth = 1500;
        this.health = 1500;
        this.constructionTime = 10.0;
        this.canProduce = true;
        this.producibleUnits = ['scout', 'soldier'];
        this.productionTime = 8.0;
        break;
      
      case BuildingType.FACTORY:
        this.maxHealth = 2000;
        this.health = 2000;
        this.constructionTime = 15.0;
        this.canProduce = true;
        this.producibleUnits = ['tank', 'artillery'];
        this.productionTime = 12.0;
        break;
      
      case BuildingType.SHIELD_GENERATOR:
        this.maxHealth = 1000;
        this.health = 1000;
        this.constructionTime = 12.0;
        this.canProduce = false;
        this.hasShield = true;
        this.shieldRadius = 15.0;
        this.shieldStrength = 500;
        break;
      
      default:
        this.maxHealth = 1000;
        this.health = 1000;
    }
  }
  
  /**
   * Update building logic
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    if (!this.isAlive) return;
    
    switch(this.state) {
      case BuildingState.CONSTRUCTING:
        this.updateConstructing(dt);
        break;
      
      case BuildingState.PRODUCING:
        this.updateProducing(dt);
        break;
      
      case BuildingState.IDLE:
        this.updateIdle(dt);
        break;
    }
    
    // Check if damaged
    if (this.health < this.maxHealth * 0.5 && this.state !== BuildingState.DAMAGED) {
      this.state = BuildingState.DAMAGED;
    }
  }
  
  /**
   * Update construction progress
   */
  updateConstructing(dt) {
    this.constructionProgress += dt / this.constructionTime;
    
    if (this.constructionProgress >= 1.0) {
      this.constructionProgress = 1.0;
      this.state = BuildingState.IDLE;
      console.log(`[Building] ${this.type} construction complete`);
    }
  }
  
  /**
   * Update production progress
   */
  updateProducing(dt) {
    if (!this.currentProduction) {
      this.state = BuildingState.IDLE;
      return;
    }
    
    this.productionProgress += dt / this.productionTime;
    
    if (this.productionProgress >= 1.0) {
      // Production complete - will be handled by BuildingSystem
      this.productionProgress = 1.0;
    }
  }
  
  /**
   * Update idle state
   */
  updateIdle(dt) {
    // Check if there's anything in production queue
    if (this.productionQueue.length > 0 && this.canProduce) {
      this.startNextProduction();
    }
  }
  
  /**
   * Start producing next unit in queue
   */
  startNextProduction() {
    if (this.productionQueue.length === 0) return;
    
    this.currentProduction = this.productionQueue.shift();
    this.productionProgress = 0;
    this.state = BuildingState.PRODUCING;
    
    console.log(`[Building] Started producing ${this.currentProduction}`);
  }
  
  /**
   * Queue a unit for production
   * @param {string} unitType - Type of unit to produce
   * @returns {boolean} Success
   */
  queueProduction(unitType) {
    if (!this.canProduce) return false;
    if (!this.producibleUnits.includes(unitType)) return false;
    if (this.state === BuildingState.CONSTRUCTING) return false;
    
    this.productionQueue.push(unitType);
    
    // If idle, start production immediately
    if (this.state === BuildingState.IDLE) {
      this.startNextProduction();
    }
    
    return true;
  }
  
  /**
   * Set rally point for produced units
   * @param {number} x - X coordinate
   * @param {number} z - Z coordinate
   */
  setRallyPoint(x, z) {
    this.rallyPoint.set(x, 0.5, z);
    this.hasRallyPoint = true;
  }
  
  /**
   * Take damage
   * @param {number} amount - Damage amount
   * @param {Unit} attacker - Unit that dealt damage (optional)
   */
  takeDamage(amount, attacker = null) {
    if (!this.isAlive) return;
    
    this.health -= amount;
    
    if (this.health <= 0) {
      this.health = 0;
      this.isAlive = false;
      this.state = BuildingState.DESTROYED;
      console.log(`[Building] ${this.type} destroyed`);
    }
  }
  
  /**
   * Repair building
   * @param {number} amount - Heal amount
   */
  repair(amount) {
    if (!this.isAlive) return;
    
    this.health = Math.min(this.health + amount, this.maxHealth);
    
    // Update state if no longer damaged
    if (this.health >= this.maxHealth * 0.5 && this.state === BuildingState.DAMAGED) {
      this.state = this.currentProduction ? BuildingState.PRODUCING : BuildingState.IDLE;
    }
  }
  
  /**
   * Check if building is fully constructed
   * @returns {boolean}
   */
  isConstructed() {
    return this.constructionProgress >= 1.0 && this.state !== BuildingState.CONSTRUCTING;
  }
  
  /**
   * Release building back to pool
   */
  release() {
    this.isAlive = false;
    this.state = BuildingState.DESTROYED;
    this.productionQueue = [];
    this.currentProduction = null;
  }
}
