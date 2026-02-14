/**
 * Math Utilities
 * 
 * PERFORMANCE: Common math operations optimized for VR use
 * AI NOTE: These are helpers to avoid repeated calculations
 */

/**
 * Linear interpolation
 * USAGE: Smooth transitions between values
 * @param {number} a - Start value
 * @param {number} b - End value
 * @param {number} t - Interpolation factor (0-1)
 * @returns {number} Interpolated value
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Clamp value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Distance between two 2D points
 * PERFORMANCE: Avoids Math.sqrt when comparing distances
 * @param {number} x1 
 * @param {number} y1 
 * @param {number} x2 
 * @param {number} y2 
 * @returns {number}
 */
export function distance2D(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Squared distance (faster, no sqrt)
 * PATTERN: Use for distance comparisons (avoids sqrt)
 * WHY: sqrt is expensive, comparing squared distances is faster
 * @param {number} x1 
 * @param {number} y1 
 * @param {number} x2 
 * @param {number} y2 
 * @returns {number}
 */
export function distanceSq2D(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

/**
 * Convert degrees to radians
 * @param {number} degrees 
 * @returns {number}
 */
export function degToRad(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 * @param {number} radians 
 * @returns {number}
 */
export function radToDeg(radians) {
  return radians * (180 / Math.PI);
}

/**
 * Random integer between min and max (inclusive)
 * @param {number} min 
 * @param {number} max 
 * @returns {number}
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Random float between min and max
 * @param {number} min 
 * @param {number} max 
 * @returns {number}
 */
export function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * Snap value to grid
 * USAGE: Align units/buildings to grid positions
 * @param {number} value 
 * @param {number} gridSize 
 * @returns {number}
 */
export function snapToGrid(value, gridSize) {
  return Math.round(value / gridSize) * gridSize;
}
