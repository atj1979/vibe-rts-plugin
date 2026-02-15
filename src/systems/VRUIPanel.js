/**
 * VR UI Panel
 *
 * Renders 2D UI content to a canvas texture applied to a 3D plane.
 * Positioned relative to the camera in VR space.
 *
 * ARCHITECTURE:
 * - Canvas2D rendered to texture each frame
 * - Texture applied to flat plane mesh in 3D
 * - Position calculated relative to camera
 * - Content via callback function for flexibility
 *
 * USAGE:
 * const panel = new VRUIPanel({
 *   title: "My Panel",
 *   width: 2, height: 1.5,
 *   position: { x: -2, y: 1, z: -3 },
 *   render: (ctx, width, height) => { ... draw to canvas ... }
 * });
 */

import * as THREE from "three";

export class VRUIPanel {
  constructor(options = {}) {
    this.title = options.title || "Panel";
    this.width = options.width || 2;
    this.height = options.height || 1.5;
    this.dpi = options.dpi || 96; // Canvas render DPI
    this.renderCallback = options.render || null;

    // Position relative to camera
    this.position = options.position || { x: 0, y: 0, z: -2 };
    this.rotation = options.rotation || { x: 0, y: 0, z: 0 };

    // Interactivity
    this.interactive = options.interactive !== false;
    this.onClickHandlers = options.onClickHandlers || {};

    // Create canvas for rendering
    this.canvasWidth = this.width * this.dpi;
    this.canvasHeight = this.height * this.dpi;
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.canvasWidth;
    this.canvas.height = this.canvasHeight;
    this.ctx = this.canvas.getContext("2d");

    // Create texture from canvas
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.anisotropy = 16;

    // Create plane mesh
    this.geometry = new THREE.PlaneGeometry(this.width, this.height);
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);

    // Set initial position
    this.mesh.position.set(-this.position.x, this.position.y, this.position.z);
    this.mesh.rotation.order = "YXZ";
    this.mesh.rotation.set(this.rotation.x, this.rotation.y, this.rotation.z);

    // Raycast target for interaction
    this.mesh.userData.uiPanel = this;

    // Track if needs update
    this.needsUpdate = true;

    console.log(`[VRUIPanel] Created: ${this.title}`);
  }

  /**
   * Update panel position relative to camera
   * @param {THREE.Camera} camera - VR camera
   */
  updatePosition(camera) {
    if (!camera) {
      console.warn("[VRUIPanel] No camera provided");
      return;
    }

    try {
      // Calculate panel position in world space
      const offset = new THREE.Vector3(
        -this.position.x,
        this.position.y,
        this.position.z,
      );

      // Rotate offset to face away from camera (always visible)
      offset.applyQuaternion(camera.quaternion);

      this.mesh.position.copy(camera.position).add(offset);
      this.mesh.quaternion.copy(camera.quaternion);
      this.mesh.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), this.rotation.y);
    } catch (error) {
      console.error(
        `[VRUIPanel] Error updating position for ${this.title}:`,
        error,
      );
    }
  }

  /**
   * Render content to canvas
   */
  render() {
    if (!this.needsUpdate && !this.renderCallback) return;

    // Clear canvas
    this.ctx.fillStyle = "rgba(20, 20, 30, 0.95)";
    this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Draw border
    this.ctx.strokeStyle = "rgba(102, 126, 234, 0.8)";
    this.ctx.lineWidth = 3;
    this.ctx.strokeRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Draw title
    this.ctx.fillStyle = "#667eea";
    this.ctx.font = `bold ${24}px Arial`;
    this.ctx.fillText(this.title, 20, 40);

    // Call custom render function
    if (this.renderCallback) {
      this.renderCallback(this.ctx, this.canvasWidth, this.canvasHeight);
    }

    // Update texture
    this.texture.needsUpdate = true;
    this.needsUpdate = false;
  }

  /**
   * Mark panel as needing update next frame
   */
  markDirty() {
    this.needsUpdate = true;
  }

  /**
   * Get the Three.js mesh
   * @returns {THREE.Mesh}
   */
  getMesh() {
    return this.mesh;
  }

  /**
   * Dispose resources
   */
  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
