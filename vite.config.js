import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import viteCompression from 'vite-plugin-compression';

/**
 * Vite Configuration for Something Vibe
 * 
 * Performance-focused configuration:
 * - HTTPS enabled (required for WebXR)
 * - Asset optimization
 * - Code splitting for better loading
 * - Compression for production
 */
export default defineConfig({
  base: '/vibe-rts-plugin/',
  plugins: [
    // HTTPS is required for WebXR API
    basicSsl(),
    // Gzip compression for production builds
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz'
    })
  ],
  
  // Optimize dependencies
  optimizeDeps: {
    include: ['three']
  },
  
  build: {
    // Target modern browsers that support WebXR
    target: 'es2020',
    
    // Enable minification for performance
    minify: 'terser',
    
    terserOptions: {
      compress: {
        // Remove console logs in production for performance
        drop_console: true,
        drop_debugger: true
      }
    },
    
    // Code splitting strategy
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate Three.js into its own chunk
          'three-core': ['three'],
          // Game logic can be split further as needed
        }
      }
    },
    
    // Asset optimization
    assetsInlineLimit: 4096, // Inline assets smaller than 4kb
    
    // Source maps for debugging (disable in production if needed)
    sourcemap: true
  },
  
  // Development server configuration
  server: {
    host: true, // Listen on all addresses (for VR headset access)
    port: 5173,
    https: true, // Required for WebXR
    open: false // Don't auto-open browser
  }
});
