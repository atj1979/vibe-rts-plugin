/**
 * Object Pool
 * 
 * CRITICAL PERFORMANCE PATTERN for VR
 * 
 * WHY WE NEED THIS:
 * Creating/destroying objects every frame causes:
 * - Garbage collection pauses (frame drops in VR = motion sickness)
 * - Memory allocation overhead
 * - Inconsistent frame times
 * 
 * SOLUTION:
 * Pre-allocate objects and reuse them
 * 
 * AI WALKTHROUGH:
 * 1. Pool is created with initial size
 * 2. acquire() gives you an object (creates if pool empty)
 * 3. release() returns object to pool for reuse
 * 4. Never call 'new' in hot paths
 * 
 * USAGE EXAMPLE:
 * const bulletPool = new ObjectPool(() => new Bullet(), 100);
 * const bullet = bulletPool.acquire();
 * bullet.init(position, velocity);
 * // Later when bullet is done:
 * bulletPool.release(bullet);
 */

export class ObjectPool {
  /**
   * Create an object pool
   * @param {Function} factory - Function that creates new objects
   * @param {number} initialSize - Number of objects to pre-allocate
   */
  constructor(factory, initialSize = 0) {
    this.factory = factory;
    this.pool = [];
    this.active = [];
    
    // Pre-allocate objects
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.factory());
    }
  }
  
  /**
   * Get an object from the pool
   * PERFORMANCE: O(1) operation (pop from array)
   * @returns {any} Object from pool (or newly created if pool empty)
   */
  acquire() {
    let obj;
    
    if (this.pool.length > 0) {
      // Reuse from pool
      obj = this.pool.pop();
    } else {
      // Pool exhausted, create new (and warn)
      obj = this.factory();
      console.warn('ObjectPool exhausted, creating new object');
    }
    
    this.active.push(obj);
    return obj;
  }
  
  /**
   * Return an object to the pool
   * PERFORMANCE: O(n) due to indexOf, but active list is typically small
   * @param {any} obj - Object to return to pool
   */
  release(obj) {
    const index = this.active.indexOf(obj);
    
    if (index === -1) {
      console.warn('Trying to release object not acquired from pool');
      return;
    }
    
    // Remove from active list
    this.active.splice(index, 1);
    
    // Return to pool
    this.pool.push(obj);
  }
  
  /**
   * Release all active objects back to pool
   * PATTERN: Useful for scene resets
   */
  releaseAll() {
    while (this.active.length > 0) {
      const obj = this.active.pop();
      this.pool.push(obj);
    }
  }
  
  /**
   * Get pool statistics
   * @returns {Object} Pool stats
   */
  getStats() {
    return {
      available: this.pool.length,
      active: this.active.length,
      total: this.pool.length + this.active.length
    };
  }
  
  /**
   * Dispose of all objects
   * PATTERN: Call dispose() on each object if it exists
   */
  dispose() {
    // Dispose active objects
    this.active.forEach(obj => {
      if (obj.dispose) obj.dispose();
    });
    
    // Dispose pooled objects
    this.pool.forEach(obj => {
      if (obj.dispose) obj.dispose();
    });
    
    this.active = [];
    this.pool = [];
  }
}
