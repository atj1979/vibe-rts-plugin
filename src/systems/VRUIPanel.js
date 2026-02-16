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
    this.dpi = options.dpi || 512; // Canvas render DPI (higher = sharper in VR)
    this.renderCallback = options.render || null;

    // Position relative to camera/group
    this.position = options.position || { x: 0, y: 0, z: -2 };
    this.rotation = options.rotation || { x: 0, y: 0, z: 0 };

    // Head-locked behavior (default false; world-locked handled by group)
    this.headLocked = options.headLocked === true;

    // World-locked behavior (recenter after delay)
    this.worldLocked = options.worldLocked !== false;
    this.recenterSeconds = options.recenterSeconds || 3.5;
    this.viewAngleThresholdDeg = options.viewAngleThresholdDeg || 60;
    this.outOfViewSince = null;
    this.anchorPosition = null;
    this.anchorQuaternion = null;

    // Interactivity
    this.interactive = options.interactive !== false;
    this.onClickHandlers = options.onClickHandlers || {};

    // Create canvas for rendering (power-of-2 dimensions for GPU efficiency)
    this.canvasWidth = this.roundToPowerOfTwo(this.width * this.dpi);
    this.canvasHeight = this.roundToPowerOfTwo(this.height * this.dpi);
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.canvasWidth;
    this.canvas.height = this.canvasHeight;
    this.ctx = this.canvas.getContext("2d");
    // Improve text rendering quality
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";

    // Create texture from canvas
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = true;
    this.texture.anisotropy = 16;

    // Create mesh geometry (simple flat plane)
    this.geometry = new THREE.PlaneGeometry(this.width, this.height);
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);

    // Set initial position
    this.mesh.position.set(this.position.x, this.position.y, this.position.z);
    this.mesh.rotation.order = "YXZ";
    this.mesh.rotation.set(this.rotation.x, this.rotation.y, this.rotation.z);

    // Raycast target for interaction
    this.mesh.userData.uiPanel = this;

    // Track if needs update
    this.needsUpdate = true;

    console.log(`[VRUIPanel] Created: ${this.title}`);
  }

  /**
   * Round a number up to the nearest power of 2
   * @param {number} n - Number to round
   * @returns {number} Power of 2
   */
  roundToPowerOfTwo(n) {
    let p = 1;
    while (p < n) p *= 2;
    return p;
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
      if (!this.headLocked) return;

      // Follow camera (head-locked)
      const offset = new THREE.Vector3(
        this.position.x,
        this.position.y,
        this.position.z,
      );

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
   * Anchor the panel in world space based on the current camera
   * @param {THREE.Camera} camera - VR camera
   */
  setAnchorFromCamera(camera) {
    const offset = new THREE.Vector3(
      this.position.x,
      this.position.y,
      this.position.z,
    );
    offset.applyQuaternion(camera.quaternion);

    this.anchorPosition = camera.position.clone().add(offset);
    this.anchorQuaternion = camera.quaternion.clone();
    this.anchorQuaternion.multiply(
      new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        this.rotation.y,
      ),
    );
  }

  /**
   * Recenter panel into view after being out of view
   * @param {THREE.Camera} camera - VR camera
   */
  recenterToCamera(camera) {
    this.setAnchorFromCamera(camera);
  }

  /**
   * Apply local pose relative to its parent group
   */
  applyLocalPose() {
    this.mesh.position.set(this.position.x, this.position.y, this.position.z);
    this.mesh.rotation.order = "YXZ";
    this.mesh.rotation.set(this.rotation.x, this.rotation.y, this.rotation.z);
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

    // Draw title (scale font for high DPI)
    this.ctx.fillStyle = "#667eea";
    this.ctx.font = `bold ${Math.round(24 * (this.dpi / 256))}px Arial`;
    this.ctx.textBaseline = "top";
    this.ctx.antialias = "subpixel";
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
