/**
 * Something Vibe - Main Entry Point
 * 
 * This is the application entry point that initializes the game.
 * 
 * PERFORMANCE NOTES:
 * - All imports use ES6 modules for tree-shaking
 * - Heavy initialization is deferred until after initial render
 * - Error handling prevents crashes in production
 * 
 * AI WALKTHROUGH:
 * This file orchestrates the application startup:
 * 1. Check WebXR support
 * 2. Initialize Three.js renderer
 * 3. Setup VR session handling
 * 4. Start game loop
 */

import { Game } from './core/Game.js';
import { PerformanceMonitor } from './utils/PerformanceMonitor.js';
import { checkWebXRSupport } from './utils/WebXRUtils.js';

// DOM Elements
const loadingScreen = document.getElementById('loading-screen');
const vrButton = document.getElementById('vr-button');
const statusText = document.getElementById('status-text');
const canvasContainer = document.getElementById('canvas-container');

// Global game instance
let game = null;
let performanceMonitor = null;

/**
 * Initialize the application
 * 
 * PATTERN: Async initialization with error handling
 * WHY: Prevents blocking UI and handles failures gracefully
 */
async function init() {
  try {
    updateStatus('Checking WebXR support...');
    
    // Check if WebXR is supported
    const xrSupport = await checkWebXRSupport();
    
    if (!xrSupport.supported) {
      handleWebXRNotSupported(xrSupport.reason);
      return;
    }
    
    updateStatus('Initializing game engine...');
    
    // Initialize performance monitoring
    performanceMonitor = new PerformanceMonitor();
    
    // Create game instance
    game = new Game(canvasContainer, performanceMonitor);
    
    // Initialize game (loads resources, sets up scene)
    await game.initialize();
    
    updateStatus('Ready!');
    
    // Enable VR button
    vrButton.disabled = false;
    vrButton.textContent = 'Enter VR';
    vrButton.onclick = () => startVRSession();
    
    // Hide loading screen
    setTimeout(() => {
      loadingScreen.classList.add('hidden');
    }, 500);
    
    // Start the game loop (renders to desktop view)
    game.start();
    
    // Update UI with performance stats
    startPerformanceUI();
    
  } catch (error) {
    console.error('Failed to initialize:', error);
    handleInitializationError(error);
  }
}

/**
 * Start a WebXR VR session
 * 
 * PATTERN: Button triggers VR mode
 * WHY: User activation required for XR session (browser security)
 */
async function startVRSession() {
  try {
    vrButton.disabled = true;
    vrButton.textContent = 'Starting VR...';
    
    await game.enterVR();
    
    vrButton.textContent = 'In VR Session';
    
  } catch (error) {
    console.error('Failed to start VR session:', error);
    vrButton.disabled = false;
    vrButton.textContent = 'Enter VR (Failed - Try Again)';
    alert('Failed to start VR session. Make sure your headset is connected.');
  }
}

/**
 * Update status text in UI
 * @param {string} message - Status message to display
 */
function updateStatus(message) {
  statusText.textContent = message;
  console.log(`[Status] ${message}`);
}

/**
 * Handle case where WebXR is not supported
 * @param {string} reason - Why WebXR is not supported
 */
function handleWebXRNotSupported(reason) {
  updateStatus('WebXR not supported');
  vrButton.textContent = 'WebXR Not Available';
  vrButton.disabled = true;
  vrButton.title = reason;
  
  loadingScreen.classList.add('hidden');
  
  alert(`WebXR is not supported on this browser/device.\n\nReason: ${reason}\n\nPlease use a WebXR-compatible browser (Chrome 90+, Edge 90+) with a VR headset connected.`);
}

/**
 * Handle initialization errors
 * @param {Error} error - The error that occurred
 */
function handleInitializationError(error) {
  updateStatus('Initialization failed');
  loadingScreen.querySelector('.loading-text').textContent = 'Failed to load. Please refresh.';
  console.error('Initialization error:', error);
}

/**
 * Update performance stats in UI
 * 
 * PERFORMANCE: Updates at 2Hz instead of every frame
 * WHY: Updating DOM every frame is expensive and unnecessary for stats
 */
function startPerformanceUI() {
  const fpsElement = document.getElementById('fps');
  const frametimeElement = document.getElementById('frametime');
  const drawcallsElement = document.getElementById('drawcalls');
  const trianglesElement = document.getElementById('triangles');
  
  // Update UI at 2Hz (every 500ms)
  setInterval(() => {
    if (!performanceMonitor) return;
    
    const stats = performanceMonitor.getStats();
    
    fpsElement.textContent = stats.fps.toFixed(0);
    frametimeElement.textContent = stats.frameTime.toFixed(1);
    drawcallsElement.textContent = stats.drawCalls;
    trianglesElement.textContent = (stats.triangles / 1000).toFixed(1) + 'k';
    
    // Visual warning if performance is poor
    const statsContainer = document.getElementById('stats');
    if (stats.fps < 60) {
      statsContainer.style.color = '#ff0';
    } else if (stats.fps < 45) {
      statsContainer.style.color = '#f00';
    } else {
      statsContainer.style.color = '#0f0';
    }
  }, 500);
}

/**
 * Handle page visibility changes
 * 
 * PERFORMANCE: Pause game loop when page is hidden
 * WHY: Saves battery and CPU when user tabs away
 */
document.addEventListener('visibilitychange', () => {
  if (!game) return;
  
  if (document.hidden) {
    game.pause();
  } else {
    game.resume();
  }
});

/**
 * Handle window unload
 * 
 * PATTERN: Cleanup resources on exit
 * WHY: Prevents memory leaks and proper resource disposal
 */
window.addEventListener('beforeunload', () => {
  if (game) {
    game.dispose();
  }
});

// Start the application
init();
