/**
 * Performance Monitor
 * 
 * CRITICAL FOR VR: This tracks frame performance
 * AI WALKTHROUGH: Monitors FPS, frame time, and rendering stats
 * 
 * USAGE:
 * const monitor = new PerformanceMonitor();
 * // In game loop:
 * monitor.begin();
 * // ... render code ...
 * monitor.end(renderer);
 * const stats = monitor.getStats();
 */

export class PerformanceMonitor {
  constructor() {
    // Frame timing
    this.frameTimes = [];
    this.maxSamples = 60; // Track last 60 frames
    this.lastTime = performance.now();
    
    // Stats
    this.stats = {
      fps: 60,
      frameTime: 16.67,
      drawCalls: 0,
      triangles: 0,
      geometries: 0,
      textures: 0
    };
    
    // Performance thresholds for VR
    this.targetFPS = 90; // Quest 2/3 target
    this.warningFPS = 75; // Show warning below this
    this.criticalFPS = 60; // Critical performance issues
  }
  
  /**
   * Call at the start of each frame
   * PATTERN: Begin/End pair for accurate timing
   */
  begin() {
    this.frameStartTime = performance.now();
  }
  
  /**
   * Call at the end of each frame
   * @param {THREE.WebGLRenderer} renderer - Three.js renderer for stats
   */
  end(renderer) {
    const now = performance.now();
    const deltaTime = now - this.frameStartTime;
    
    // Track frame times
    this.frameTimes.push(deltaTime);
    if (this.frameTimes.length > this.maxSamples) {
      this.frameTimes.shift();
    }
    
    // Calculate average frame time and FPS
    const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.stats.frameTime = avgFrameTime;
    this.stats.fps = 1000 / avgFrameTime;
    
    // Get renderer stats
    if (renderer && renderer.info) {
      const info = renderer.info;
      this.stats.drawCalls = info.render.calls;
      this.stats.triangles = info.render.triangles;
      this.stats.geometries = info.memory.geometries;
      this.stats.textures = info.memory.textures;
    }
    
    // Check for performance issues
    this.checkPerformance();
  }
  
  /**
   * Get current performance statistics
   * @returns {Object} Performance stats object
   */
  getStats() {
    return { ...this.stats };
  }
  
  /**
   * Check for performance issues and warn
   * PATTERN: Early warning system for performance problems
   */
  checkPerformance() {
    if (this.stats.fps < this.criticalFPS && this.stats.fps > 0) {
      console.warn(`CRITICAL: FPS dropped to ${this.stats.fps.toFixed(1)}`);
    } else if (this.stats.fps < this.warningFPS && this.stats.fps > 0) {
      console.warn(`WARNING: FPS below target: ${this.stats.fps.toFixed(1)}`);
    }
    
    // Warn about excessive draw calls (VR target: <50)
    if (this.stats.drawCalls > 100) {
      console.warn(`WARNING: High draw calls: ${this.stats.drawCalls}`);
    }
  }
  
  /**
   * Reset all stats
   */
  reset() {
    this.frameTimes = [];
    this.stats = {
      fps: 60,
      frameTime: 16.67,
      drawCalls: 0,
      triangles: 0,
      geometries: 0,
      textures: 0
    };
  }
}
