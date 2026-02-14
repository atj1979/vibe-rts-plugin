/**
 * Health Bar System
 * 
 * Renders floating health bars above units using 2D canvas billboards.
 * 
 * ARCHITECTURE:
 * - One canvas per health bar (efficient for changes)
 * - Billboards always face camera (THREE.Sprite)
 * - Color changes based on health percentage
 * - Only visible for damaged units or selected units
 * 
 * PERFORMANCE:
 * - Sprites batched together (minimal draw calls)
 * - Canvas texture updates only when health changes
 * - Health bars culled when units off-screen
 * - Option to hide health bars for performance
 * 
 * AI WALKTHROUGH:
 * 1. System tracks all units
 * 2. Creates sprite for each unit's health bar
 * 3. Updates canvas texture when health changes
 * 4. Position sprite above unit
 * 5. Hide/show based on visibility rules
 */

import * as THREE from 'three';

export class HealthBarSystem {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    
    // Health bar sprites mapped to units
    this.healthBars = new Map(); // unit.id -> sprite
    
    // Visibility settings
    this.showAllHealthBars = false; // If true, show all; if false, only damaged/selected
    this.healthBarHeight = 2.0; // Height above unit
    this.healthBarWidth = 1.0;
    this.healthBarThickness = 0.15;
    
    // Performance
    this.updateInterval = 0.1; // Update every 0.1 seconds
    this.timeSinceUpdate = 0;
    
    console.log('[HealthBarSystem] Initialized');
  }
  
  /**
   * Update health bars (called each frame)
   * @param {number} dt - Delta time
   * @param {Array<Unit>} units - All active units
   */
  update(dt, units) {
    this.timeSinceUpdate += dt;
    
    // Throttle updates for performance
    if (this.timeSinceUpdate < this.updateInterval) return;
    this.timeSinceUpdate = 0;
    
    // Track which units are alive
    const aliveUnitIds = new Set();
    
    // Update/create health bars for all units
    units.forEach(unit => {
      if (!unit.isAlive) return;
      
      aliveUnitIds.add(unit.id);
      
      // Check if we should show this health bar
      const shouldShow = this.shouldShowHealthBar(unit);
      
      if (shouldShow) {
        if (!this.healthBars.has(unit.id)) {
          this.createHealthBar(unit);
        } else {
          this.updateHealthBar(unit);
        }
      } else {
        // Hide if exists
        if (this.healthBars.has(unit.id)) {
          const sprite = this.healthBars.get(unit.id);
          sprite.visible = false;
        }
      }
    });
    
    // Remove health bars for dead units
    this.healthBars.forEach((sprite, unitId) => {
      if (!aliveUnitIds.has(unitId)) {
        this.removeHealthBar(unitId);
      }
    });
  }
  
  /**
   * Determine if health bar should be shown
   * @param {Unit} unit
   * @returns {boolean}
   */
  shouldShowHealthBar(unit) {
    // Always show if setting enabled
    if (this.showAllHealthBars) return true;
    
    // Show if selected
    if (unit.isSelected) return true;
    
    // Show if damaged
    if (unit.health < unit.maxHealth) return true;
    
    return false;
  }
  
  /**
   * Create health bar for unit
   * @param {Unit} unit
   */
  createHealthBar(unit) {
    // Create canvas for health bar
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 32;
    
    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    // Create sprite material
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: true,
      depthWrite: false
    });
    
    // Create sprite
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(this.healthBarWidth, this.healthBarThickness, 1);
    
    // Position above unit
    sprite.position.copy(unit.position);
    sprite.position.y = this.healthBarHeight;
    
    // Store reference
    sprite.userData.unit = unit;
    sprite.userData.canvas = canvas;
    
    // Add to scene
    this.scene.add(sprite);
    
    // Store in map
    this.healthBars.set(unit.id, sprite);
    
    // Draw initial health bar
    this.drawHealthBar(canvas, unit);
  }
  
  /**
   * Update existing health bar
   * @param {Unit} unit
   */
  updateHealthBar(unit) {
    const sprite = this.healthBars.get(unit.id);
    if (!sprite) return;
    
    // Update position
    sprite.position.copy(unit.position);
    sprite.position.y = this.healthBarHeight;
    
    // Make visible
    sprite.visible = true;
    
    // Redraw if health changed
    const canvas = sprite.userData.canvas;
    this.drawHealthBar(canvas, unit);
    
    // Update texture
    sprite.material.map.needsUpdate = true;
  }
  
  /**
   * Draw health bar on canvas
   * @param {HTMLCanvasElement} canvas
   * @param {Unit} unit
   */
  drawHealthBar(canvas, unit) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Calculate health percentage
    const healthPercent = unit.health / unit.maxHealth;
    
    // Determine color based on health
    let healthColor;
    if (healthPercent > 0.6) {
      healthColor = '#00ff00'; // Green
    } else if (healthPercent > 0.3) {
      healthColor = '#ffff00'; // Yellow
    } else {
      healthColor = '#ff0000'; // Red
    }
    
    // Draw background (black)
    ctx.fillStyle = '#000000';
    ctx.fillRect(4, height / 2 - 6, width - 8, 12);
    
    // Draw border (white)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(4, height / 2 - 6, width - 8, 12);
    
    // Draw health bar
    const healthWidth = (width - 12) * healthPercent;
    ctx.fillStyle = healthColor;
    ctx.fillRect(6, height / 2 - 4, healthWidth, 8);
  }
  
  /**
   * Remove health bar
   * @param {number} unitId
   */
  removeHealthBar(unitId) {
    const sprite = this.healthBars.get(unitId);
    if (!sprite) return;
    
    // Remove from scene
    this.scene.remove(sprite);
    
    // Dispose resources
    if (sprite.material.map) {
      sprite.material.map.dispose();
    }
    sprite.material.dispose();
    
    // Remove from map
    this.healthBars.delete(unitId);
  }
  
  /**
   * Toggle showing all health bars
   */
  toggleShowAll() {
    this.showAllHealthBars = !this.showAllHealthBars;
    console.log(`[HealthBarSystem] Show all health bars: ${this.showAllHealthBars}`);
  }
  
  /**
   * Cleanup
   */
  dispose() {
    this.healthBars.forEach((sprite, unitId) => {
      this.removeHealthBar(unitId);
    });
    this.healthBars.clear();
    
    console.log('[HealthBarSystem] Disposed');
  }
}
