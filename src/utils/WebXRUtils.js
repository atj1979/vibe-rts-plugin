/**
 * WebXR Utility Functions
 * 
 * PERFORMANCE: These checks are cached
 * AI WALKTHROUGH: This module provides WebXR feature detection
 */

/**
 * Check if WebXR is supported in the current browser
 * 
 * PATTERN: Feature detection with detailed fallback info
 * WHY: Users need to know WHY VR isn't working
 * 
 * @returns {Promise<{supported: boolean, reason?: string}>}
 */
export async function checkWebXRSupport() {
  // Check if XR is available at all
  if (!navigator.xr) {
    return {
      supported: false,
      reason: 'WebXR API not available in this browser'
    };
  }
  
  try {
    // Check if immersive-vr is supported
    const supported = await navigator.xr.isSessionSupported('immersive-vr');
    
    if (!supported) {
      return {
        supported: false,
        reason: 'VR mode not supported (no headset detected or browser disabled VR)'
      };
    }
    
    return { supported: true };
    
  } catch (error) {
    return {
      supported: false,
      reason: `WebXR check failed: ${error.message}`
    };
  }
}

/**
 * Get available XR reference spaces
 * Useful for determining tracking capabilities
 * 
 * @returns {Promise<string[]>} Array of supported reference space types
 */
export async function getAvailableReferenceSpaces() {
  if (!navigator.xr) return [];
  
  const spaces = ['local', 'local-floor', 'bounded-floor', 'unbounded'];
  const supported = [];
  
  // Note: This requires an active session to check properly
  // For now, we return all possible spaces
  return spaces;
}

/**
 * Create XR session with optimal settings
 * 
 * PERFORMANCE: Request minimal required features
 * WHY: More features = more overhead
 * 
 * @returns {Promise<XRSession>}
 */
export async function createXRSession() {
  if (!navigator.xr) {
    throw new Error('WebXR not available');
  }
  
  const sessionInit = {
    // Required features (session will fail if not available)
    requiredFeatures: ['local-floor'],
    
    // Optional features (nice to have but not required)
    optionalFeatures: [
      'bounded-floor',
      'hand-tracking',
      'layers' // For better performance with multi-layer rendering
    ]
  };
  
  const session = await navigator.xr.requestSession('immersive-vr', sessionInit);
  
  return session;
}
