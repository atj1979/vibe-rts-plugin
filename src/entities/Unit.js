/**
 * Unit Entity
 * 
 * Represents a single game unit (Scout, Soldier, Tank, etc.)
 * 
 * ARCHITECTURE PATTERN:
 * - This is pure data + logic (no rendering code)
 * - Rendering handled separately by UnitSystem (instanced)
 * - Uses composition pattern for behaviors
 * 
 * PERFORMANCE NOTES:
 * - Instances created from ObjectPool (no direct 'new Unit()')
 * - Position is Vector3 reference (not copied every frame)
 * - State machine prevents unnecessary calculations
 * 
 * AI WALKTHROUGH:
 * 1. Unit created by UnitSystem from pool
 * 2. init() called to set initial state
 * 3. update() called every frame (60Hz) by UnitSystem
 * 4. Unit updates position, checks state, handles AI
 * 5. When destroyed, returned to pool via release()
 */

import * as THREE from 'three';

// Unit types (matches game design document)
export const UnitType = {
  SCOUT: 'scout',
  SOLDIER: 'soldier',
  TANK: 'tank',
  ARTILLERY: 'artillery',
  CONSTRUCTOR: 'constructor'
};

// Unit states for state machine
export const UnitState = {
  IDLE: 'idle',
  MOVING: 'moving',
  ATTACKING: 'attacking',
  DEAD: 'dead'
};

export class Unit {
  constructor() {
    // Identity
    this.id = 0;
    this.type = UnitType.SOLDIER;
    this.team = 0; // 0 = player, 1 = enemy
    
    // Transform (reuse same Vector3 - no allocation)
    this.position = new THREE.Vector3();
    this.rotation = 0; // Y-axis rotation in radians
    
    // Movement
    this.velocity = new THREE.Vector3();
    this.targetPosition = new THREE.Vector3();
    this.speed = 5.0;
    this.hasTarget = false;
    this.stoppingDistance = 0.5; // Units closer than this = arrived
    
    // Combat
    this.health = 100;
    this.maxHealth = 100;
    this.damage = 10;
    this.attackRange = 5.0;
    this.attackCooldown = 1.0; // Seconds between attacks
    this.timeSinceAttack = 0;
    this.target = null; // Target unit to attack
    
    // State
    this.state = UnitState.IDLE;
    this.isAlive = true;
    this.isSelected = false;
    
    // Behavior flags
    this.autoAttack = true; // Automatically attack nearby enemies
    
    // Temp vectors (reused to avoid allocations)
    this._tempVector = new THREE.Vector3();
  }
  
  /**
   * Initialize unit with type and position
   * PATTERN: Called when acquiring from pool
   * 
   * @param {string} type - Unit type from UnitType enum
   * @param {THREE.Vector3} position - Starting position
   * @param {number} team - Team ID (0 = player, 1 = enemy)
   */
  init(type, position, team = 0) {
    this.type = type;
    this.position.copy(position);
    this.team = team;
    this.rotation = 0;
    
    // Reset state
    this.velocity.set(0, 0, 0);
    this.targetPosition.copy(position);
    this.hasTarget = false;
    this.state = UnitState.IDLE;
    this.isAlive = true;
    this.isSelected = false;
    this.target = null;
    this.timeSinceAttack = 0;
    
    // Set stats based on type (from game design)
    this.setStatsForType(type);
    
    return this;
  }
  
  /**
   * Set unit stats based on type
   * REFERENCE: See GAME_DESIGN.md for unit stats
   */
  setStatsForType(type) {
    switch(type) {
      case UnitType.SCOUT:
        this.maxHealth = 50;
        this.health = 50;
        this.speed = 8.0;
        this.damage = 5;
        this.attackRange = 4.0;
        this.attackCooldown = 0.5;
        break;
        
      case UnitType.SOLDIER:
        this.maxHealth = 100;
        this.health = 100;
        this.speed = 5.0;
        this.damage = 10;
        this.attackRange = 5.0;
        this.attackCooldown = 1.0;
        break;
        
      case UnitType.TANK:
        this.maxHealth = 200;
        this.health = 200;
        this.speed = 2.5;
        this.damage = 25;
        this.attackRange = 6.0;
        this.attackCooldown = 2.0;
        break;
        
      case UnitType.ARTILLERY:
        this.maxHealth = 75;
        this.health = 75;
        this.speed = 1.5;
        this.damage = 40;
        this.attackRange = 15.0;
        this.attackCooldown = 3.0;
        break;
        
      case UnitType.CONSTRUCTOR:
        this.maxHealth = 80;
        this.health = 80;
        this.speed = 4.0;
        this.damage = 0;
        this.attackRange = 0;
        this.attackCooldown = 0;
        break;
        
      default:
        console.warn(`Unknown unit type: ${type}`);
    }
  }

  /**
   * Apply stats override from plugins
   * @param {object} stats - Stats override
   */
  applyStats(stats) {
    if (!stats || typeof stats !== 'object') return;

    if (Number.isFinite(stats.maxHealth)) {
      this.maxHealth = stats.maxHealth;
      this.health = stats.maxHealth;
    }

    if (Number.isFinite(stats.speed)) {
      this.speed = stats.speed;
    }

    if (Number.isFinite(stats.damage)) {
      this.damage = stats.damage;
    }

    if (Number.isFinite(stats.attackRange)) {
      this.attackRange = stats.attackRange;
    }

    if (Number.isFinite(stats.attackCooldown)) {
      this.attackCooldown = stats.attackCooldown;
    }
  }
  
  /**
   * Update unit logic (called at 60Hz)
   * 
   * PERFORMANCE: Keep this fast - runs 60x per second per unit
   * 
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    if (!this.isAlive) return;
    
    // Update timers
    this.timeSinceAttack += dt;
    
    // State machine
    switch(this.state) {
      case UnitState.IDLE:
        this.updateIdle(dt);
        break;
        
      case UnitState.MOVING:
        this.updateMoving(dt);
        break;
        
      case UnitState.ATTACKING:
        this.updateAttacking(dt);
        break;
    }
    
    // Enforce world bounds (simple bounce)
    this.enforceBounds();
  }
  
  /**
   * Idle state: Look for targets if auto-attack enabled
   */
  updateIdle(dt) {
    // If we have a movement target, switch to moving
    if (this.hasTarget) {
      this.state = UnitState.MOVING;
    }
  }
  
  /**
   * Moving state: Move toward target position
   * PERFORMANCE: Uses distanceSq to avoid sqrt
   */
  updateMoving(dt) {
    if (!this.hasTarget) {
      this.state = UnitState.IDLE;
      this.velocity.set(0, 0, 0);
      return;
    }
    
    // Calculate direction to target (reuse temp vector)
    this._tempVector.copy(this.targetPosition);
    this._tempVector.sub(this.position);
    this._tempVector.y = 0; // Keep movement on ground plane
    
    const distSq = this._tempVector.lengthSq();
    const stopDistSq = this.stoppingDistance * this.stoppingDistance;
    
    // Check if arrived
    if (distSq < stopDistSq) {
      this.hasTarget = false;
      this.state = UnitState.IDLE;
      this.velocity.set(0, 0, 0);
      return;
    }
    
    // Move toward target
    this._tempVector.normalize();
    this.velocity.copy(this._tempVector);
    this.velocity.multiplyScalar(this.speed);
    
    // Update position
    this._tempVector.copy(this.velocity);
    this._tempVector.multiplyScalar(dt);
    this.position.add(this._tempVector);
    
    // Update rotation to face movement direction
    if (this.velocity.lengthSq() > 0.01) {
      this.rotation = Math.atan2(this.velocity.x, this.velocity.z);
    }
  }
  
  /**
   * Attacking state: Attack target if in range
   */
  updateAttacking(dt) {
    // TODO: Implement in combat system
    // For now, just transition back to idle
    this.state = UnitState.IDLE;
  }
  
  /**
   * Command unit to move to position
   * PATTERN: This is how player/AI commands units
   * 
   * @param {number} x - Target X coordinate
   * @param {number} z - Target Z coordinate
   */
  moveTo(x, z) {
    this.targetPosition.set(x, 0, z);
    this.hasTarget = true;
    this.state = UnitState.MOVING;
    this.target = null; // Clear attack target
  }
  
  /**
   * Command unit to attack another unit
   * 
   * @param {Unit} targetUnit - Unit to attack
   */
  attackUnit(targetUnit) {
    if (!targetUnit || !targetUnit.isAlive) return;
    
    this.target = targetUnit;
    this.state = UnitState.ATTACKING;
  }
  
  /**
   * Take damage from attack
   * 
   * @param {number} amount - Damage amount
   * @returns {boolean} True if unit died from this damage
   */
  takeDamage(amount) {
    if (!this.isAlive) return false;
    
    this.health -= amount;
    
    if (this.health <= 0) {
      this.health = 0;
      this.isAlive = false;
      this.state = UnitState.DEAD;
      return true;
    }
    
    return false;
  }
  
  /**
   * Heal unit
   * 
   * @param {number} amount - Heal amount
   */
  heal(amount) {
    if (!this.isAlive) return;
    
    this.health += amount;
    if (this.health > this.maxHealth) {
      this.health = this.maxHealth;
    }
  }
  
  /**
   * Keep units within world bounds
   * PATTERN: Simple bounce off walls
   */
  enforceBounds() {
    const maxDist = 50; // Match ground plane size
    
    if (Math.abs(this.position.x) > maxDist) {
      this.position.x = Math.sign(this.position.x) * maxDist;
      this.velocity.x *= -0.5; // Bounce with damping
      this.hasTarget = false;
    }
    
    if (Math.abs(this.position.z) > maxDist) {
      this.position.z = Math.sign(this.position.z) * maxDist;
      this.velocity.z *= -0.5;
      this.hasTarget = false;
    }
    
    // Keep units on ground
    this.position.y = 0.5; // Half the unit height
  }
  
  /**
   * Get health percentage (for UI)
   * @returns {number} Health percentage 0-1
   */
  getHealthPercent() {
    return this.health / this.maxHealth;
  }
  
  /**
   * Check if unit is in range of a position
   * PERFORMANCE: Uses distanceSq to avoid sqrt
   * 
   * @param {THREE.Vector3} position - Position to check
   * @param {number} range - Range to check
   * @returns {boolean}
   */
  isInRangeOf(position, range) {
    const dx = position.x - this.position.x;
    const dz = position.z - this.position.z;
    const distSq = dx * dx + dz * dz;
    return distSq <= (range * range);
  }
  
  /**
   * Release unit (return to pool)
   * PATTERN: Called by UnitSystem when unit is destroyed
   */
  release() {
    this.isAlive = false;
    this.state = UnitState.DEAD;
    this.target = null;
    this.isSelected = false;
  }
  
  /**
   * Get unit info for debugging
   * @returns {string}
   */
  toString() {
    return `Unit[${this.type}] HP:${this.health}/${this.maxHealth} State:${this.state} Pos:(${this.position.x.toFixed(1)},${this.position.z.toFixed(1)})`;
  }
}
