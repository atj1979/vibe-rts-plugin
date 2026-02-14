/**
 * Combat System
 * 
 * Manages all combat interactions:
 * - Target acquisition
 * - Projectile spawning and lifecycle
 * - Damage dealing
 * - Attack cooldowns
 * 
 * ARCHITECTURE:
 * - Works with UnitSystem to find targets
 * - Manages projectile pool and rendering
 * - Uses instanced rendering for projectiles
 * - Handles both ranged and melee combat
 * 
 * PERFORMANCE:
 * - Projectiles use object pooling
 * - Instanced rendering (one draw call per projectile type)
 * - Spatial optimization: only check nearby units for targets
 * - Attack cooldowns prevent spam
 * 
 * AI WALKTHROUGH:
 * 1. Each frame, check units with autoAttack enabled
 * 2. Find nearest enemy in range
 * 3. If cooldown ready, spawn projectile
 * 4. Update all active projectiles
 * 5. Render projectiles with instanced meshes
 */

import * as THREE from 'three';
import { Projectile, ProjectileType } from '../entities/Projectile.js';
import { ObjectPool } from '../utils/ObjectPool.js';

export class CombatSystem {
  constructor(scene, unitSystem) {
    this.scene = scene;
    this.unitSystem = unitSystem;
    
    // Projectile management
    this.projectiles = [];
    this.projectilePool = new ObjectPool(() => new Projectile(), 100);
    
    // Instanced meshes for projectiles
    this.projectileInstancedMeshes = {};
    
    // Temp vectors (reused)
    this.tempVector = new THREE.Vector3();
    this.tempMatrix = new THREE.Matrix4();
    this.tempPosition = new THREE.Vector3();
    this.tempRotation = new THREE.Quaternion();
    this.tempScale = new THREE.Vector3(1, 1, 1);
    
    // Stats
    this.stats = {
      activeProjectiles: 0,
      projectilesFiredThisFrame: 0,
      damageDealtThisFrame: 0
    };
    
    this.createProjectileInstancedMeshes();
    
    console.log('[CombatSystem] Initialized');
  }
  
  /**
   * Create instanced meshes for projectiles
   */
  createProjectileInstancedMeshes() {
    const maxProjectiles = 100;
    
    // Bullet (small sphere)
    const bulletGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    this.projectileInstancedMeshes[ProjectileType.BULLET] = new THREE.InstancedMesh(
      bulletGeometry,
      bulletMaterial,
      maxProjectiles
    );
    this.projectileInstancedMeshes[ProjectileType.BULLET].count = 0;
    this.scene.add(this.projectileInstancedMeshes[ProjectileType.BULLET]);
    
    // Shell (larger sphere)
    const shellGeometry = new THREE.SphereGeometry(0.15, 8, 8);
    const shellMaterial = new THREE.MeshBasicMaterial({ color: 0xff8800 });
    this.projectileInstancedMeshes[ProjectileType.SHELL] = new THREE.InstancedMesh(
      shellGeometry,
      shellMaterial,
      maxProjectiles
    );
    this.projectileInstancedMeshes[ProjectileType.SHELL].count = 0;
    this.scene.add(this.projectileInstancedMeshes[ProjectileType.SHELL]);
    
    // Artillery (large, red)
    const artilleryGeometry = new THREE.SphereGeometry(0.2, 8, 8);
    const artilleryMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    this.projectileInstancedMeshes[ProjectileType.ARTILLERY] = new THREE.InstancedMesh(
      artilleryGeometry,
      artilleryMaterial,
      maxProjectiles
    );
    this.projectileInstancedMeshes[ProjectileType.ARTILLERY].count = 0;
    this.scene.add(this.projectileInstancedMeshes[ProjectileType.ARTILLERY]);
    
    console.log('[CombatSystem] Created projectile instanced meshes');
  }
  
  /**
   * Update combat logic (called at 60Hz)
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    // Reset per-frame stats
    this.stats.projectilesFiredThisFrame = 0;
    this.stats.damageDealtThisFrame = 0;
    
    // Process all units for combat
    this.processUnitCombat(dt);
    
    // Update all projectiles
    this.updateProjectiles(dt);
    
    // Update stats
    this.stats.activeProjectiles = this.projectiles.length;
  }
  
  /**
   * Process combat for all units
   * @param {number} dt - Delta time
   */
  processUnitCombat(dt) {
    const allUnits = this.unitSystem.allUnits;
    
    for (let i = 0; i < allUnits.length; i++) {
      const unit = allUnits[i];
      
      if (!unit.isAlive) continue;
      if (!unit.autoAttack) continue;
      
      // Update attack cooldown
      unit.timeSinceAttack += dt;
      
      // If already has target, try to attack
      if (unit.target && unit.target.isAlive) {
        this.tryAttackTarget(unit);
        continue;
      }
      
      // Otherwise, find new target
      const target = this.findNearestEnemy(unit);
      if (target) {
        unit.target = target;
        this.tryAttackTarget(unit);
      }
    }
  }
  
  /**
   * Find nearest enemy for a unit
   * @param {Unit} unit - Unit looking for target
   * @returns {Unit|null}
   */
  findNearestEnemy(unit) {
    const allUnits = this.unitSystem.allUnits;
    let nearestEnemy = null;
    let nearestDistSq = unit.attackRange * unit.attackRange;
    
    for (let i = 0; i < allUnits.length; i++) {
      const other = allUnits[i];
      
      // Skip same team, dead units, or self
      if (other.team === unit.team) continue;
      if (!other.isAlive) continue;
      if (other === unit) continue;
      
      // Check distance (squared for performance)
      const dx = other.position.x - unit.position.x;
      const dz = other.position.z - unit.position.z;
      const distSq = dx * dx + dz * dz;
      
      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearestEnemy = other;
      }
    }
    
    return nearestEnemy;
  }
  
  /**
   * Try to attack current target
   * @param {Unit} unit - Attacking unit
   */
  tryAttackTarget(unit) {
    if (!unit.target || !unit.target.isAlive) {
      unit.target = null;
      return;
    }
    
    // Check if target in range
    const distSq = unit.position.distanceToSquared(unit.target.position);
    const rangeSq = unit.attackRange * unit.attackRange;
    
    if (distSq > rangeSq) {
      // Target out of range
      return;
    }
    
    // Check cooldown
    if (unit.timeSinceAttack < unit.attackCooldown) {
      return;
    }
    
    // Attack!
    this.fireProjectile(unit, unit.target);
    
    // Reset cooldown
    unit.timeSinceAttack = 0;
  }
  
  /**
   * Fire projectile from unit to target
   * @param {Unit} source - Unit firing
   * @param {Unit} target - Target unit
   */
  fireProjectile(source, target) {
    // Get projectile from pool
    const projectile = this.projectilePool.acquire();
    
    // Determine projectile type from unit type
    let projectileType = ProjectileType.BULLET;
    switch(source.type) {
      case 'scout':
      case 'soldier':
        projectileType = ProjectileType.BULLET;
        break;
      case 'tank':
        projectileType = ProjectileType.SHELL;
        break;
      case 'artillery':
        projectileType = ProjectileType.ARTILLERY;
        break;
    }
    
    // Start position (slightly elevated from unit)
    const startPos = this.tempVector.copy(source.position);
    startPos.y = 1.0;
    
    // Initialize projectile
    projectile.init(projectileType, startPos, source, target, source.damage);
    
    // Add to active list
    this.projectiles.push(projectile);
    
    // Stats
    this.stats.projectilesFiredThisFrame++;
    
    //console.log(`[CombatSystem] ${source.type} fired at ${target.type}`);
  }
  
  /**
   * Update all projectiles
   * @param {number} dt - Delta time
   */
  updateProjectiles(dt) {
    // Reverse iteration for safe removal
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];
      
      projectile.update(dt);
      
      // Remove if inactive
      if (!projectile.isActive) {
        this.projectilePool.release(projectile);
        this.projectiles.splice(i, 1);
      }
    }
  }
  
  /**
   * Render projectiles (update instance matrices)
   */
  render() {
    // Group projectiles by type
    const projectilesByType = {
      [ProjectileType.BULLET]: [],
      [ProjectileType.SHELL]: [],
      [ProjectileType.ARTILLERY]: []
    };
    
    this.projectiles.forEach(proj => {
      if (projectilesByType[proj.type]) {
        projectilesByType[proj.type].push(proj);
      }
    });
    
    // Update each type's instanced mesh
    Object.entries(projectilesByType).forEach(([type, projectiles]) => {
      const mesh = this.projectileInstancedMeshes[type];
      mesh.count = projectiles.length;
      
      projectiles.forEach((projectile, index) => {
        // Set position
        this.tempPosition.copy(projectile.position);
        
        // Set rotation (face direction of travel)
        this.tempRotation.setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          projectile.rotation
        );
        
        // Build matrix
        this.tempMatrix.compose(
          this.tempPosition,
          this.tempRotation,
          this.tempScale
        );
        
        // Update instance
        mesh.setMatrixAt(index, this.tempMatrix);
      });
      
      // Tell GPU to update
      if (projectiles.length > 0) {
        mesh.instanceMatrix.needsUpdate = true;
      }
    });
  }
  
  /**
   * Get combat stats
   * @returns {Object}
   */
  getStats() {
    return { ...this.stats };
  }
  
  /**
   * Cleanup
   */
  dispose() {
    // Dispose projectile meshes
    Object.values(this.projectileInstancedMeshes).forEach(mesh => {
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) mesh.material.dispose();
      this.scene.remove(mesh);
    });
    
    // Clear projectiles
    this.projectiles = [];
    this.projectilePool.dispose();
    
    console.log('[CombatSystem] Disposed');
  }
}
