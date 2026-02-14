/**
 * Projectile Entity
 * 
 * Represents a projectile fired by a unit (bullets, arrows, shells, etc.)
 * 
 * ARCHITECTURE:
 * - Pooled objects (no 'new' during gameplay)
 * - Simple physics (linear motion, no gravity for now)
 * - Collision detection vs units
 * - Visual effects on impact
 * 
 * PERFORMANCE:
 * - Move update logic runs at 60Hz
 * - Instanced rendering (one mesh per projectile type)
 * - Auto-cleanup when reaching target or max distance
 * 
 * AI WALKTHROUGH:
 * 1. Unit fires projectile via CombatSystem
 * 2. Projectile initialized with source, target, damage
 * 3. Each frame: move toward target
 * 4. On reaching target: deal damage, show effect, return to pool
 * 5. If target dies mid-flight: continue to last known position
 */

import * as THREE from 'three';

// Projectile types
export const ProjectileType = {
  BULLET: 'bullet',        // Scouts, Soldiers (fast, small)
  SHELL: 'shell',          // Tanks (medium speed, larger)
  ARTILLERY: 'artillery',  // Artillery (slow, arc, splash)
  LASER: 'laser'           // Future: instant hit laser
};

export class Projectile {
  constructor() {
    // Identity
    this.id = 0;
    this.type = ProjectileType.BULLET;
    
    // Transform
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.rotation = 0;
    
    // Physics
    this.speed = 20.0; // Units per second
    this.maxDistance = 100.0; // Max travel distance before cleanup
    this.distanceTraveled = 0;
    
    // Combat
    this.damage = 10;
    this.sourceUnit = null; // Unit that fired this
    this.targetUnit = null; // Intended target (may die mid-flight)
    this.targetPosition = new THREE.Vector3();
    
    // State
    this.isActive = false;
    this.hasHit = false;
    
    // Temp vectors (reused)
    this._tempVector = new THREE.Vector3();
  }
  
  /**
   * Initialize projectile
   * Called when acquiring from pool
   * 
   * @param {string} type - Projectile type
   * @param {THREE.Vector3} startPos - Starting position
   * @param {Unit} source - Unit that fired
   * @param {Unit} target - Target unit
   * @param {number} damage - Damage to deal
   */
  init(type, startPos, source, target, damage) {
    this.type = type;
    this.position.copy(startPos);
    this.sourceUnit = source;
    this.targetUnit = target;
    this.damage = damage;
    
    // Set target position (snapshot in case target dies)
    if (target) {
      this.targetPosition.copy(target.position);
      this.targetPosition.y = 0.5; // Aim at center
    }
    
    // Calculate velocity
    this._tempVector.copy(this.targetPosition).sub(this.position);
    const distance = this._tempVector.length();
    
    if (distance > 0) {
      this.velocity.copy(this._tempVector).normalize().multiplyScalar(this.speed);
    } else {
      this.velocity.set(0, 0, 0);
    }
    
    // Calculate rotation to face target
    this.rotation = Math.atan2(
      this.targetPosition.x - this.position.x,
      this.targetPosition.z - this.position.z
    );
    
    // Set speed based on type
    this.setStatsForType(type);
    
    // Reset state
    this.isActive = true;
    this.hasHit = false;
    this.distanceTraveled = 0;
    
    return this;
  }
  
  /**
   * Set projectile stats based on type
   */
  setStatsForType(type) {
    switch(type) {
      case ProjectileType.BULLET:
        this.speed = 30.0; // Fast
        this.maxDistance = 50.0;
        break;
      
      case ProjectileType.SHELL:
        this.speed = 20.0; // Medium
        this.maxDistance = 60.0;
        break;
      
      case ProjectileType.ARTILLERY:
        this.speed = 15.0; // Slow
        this.maxDistance = 80.0;
        break;
      
      case ProjectileType.LASER:
        this.speed = 100.0; // Very fast (near instant)
        this.maxDistance = 100.0;
        break;
      
      default:
        this.speed = 20.0;
        this.maxDistance = 50.0;
    }
    
    // Update velocity with new speed
    if (this.velocity.length() > 0) {
      this.velocity.normalize().multiplyScalar(this.speed);
    }
  }
  
  /**
   * Update projectile position
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    if (!this.isActive) return;
    
    // If target is still alive, update target position (basic homing)
    if (this.targetUnit && this.targetUnit.isAlive) {
      this.targetPosition.copy(this.targetUnit.position);
      this.targetPosition.y = 0.5;
      
      // Recalculate velocity (basic homing missile)
      this._tempVector.copy(this.targetPosition).sub(this.position);
      if (this._tempVector.length() > 0) {
        this.velocity.copy(this._tempVector).normalize().multiplyScalar(this.speed);
      }
    }
    
    // Move projectile
    const movement = this._tempVector.copy(this.velocity).multiplyScalar(dt);
    this.position.add(movement);
    
    // Track distance traveled
    this.distanceTraveled += movement.length();
    
    // Check if reached target
    const distanceToTarget = this.position.distanceTo(this.targetPosition);
    if (distanceToTarget < 0.5) {
      this.onReachTarget();
      return;
    }
    
    // Check max distance
    if (this.distanceTraveled > this.maxDistance) {
      this.deactivate();
    }
  }
  
  /**
   * Called when projectile reaches target
   */
  onReachTarget() {
    if (this.hasHit) return; // Already hit
    
    this.hasHit = true;
    
    // Deal damage if target still alive
    if (this.targetUnit && this.targetUnit.isAlive) {
      this.targetUnit.takeDamage(this.damage, this.sourceUnit);
    }
    
    // TODO: Spawn impact effect
    
    // Deactivate
    this.deactivate();
  }
  
  /**
   * Deactivate projectile (return to pool)
   */
  deactivate() {
    this.isActive = false;
  }
  
  /**
   * Release projectile back to pool
   */
  release() {
    this.isActive = false;
    this.hasHit = false;
    this.sourceUnit = null;
    this.targetUnit = null;
    this.velocity.set(0, 0, 0);
  }
}
