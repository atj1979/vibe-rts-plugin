/**
 * VR UI System
 *
 * Manages all UI panels in VR mode, positioning them around the camera.
 * Handles rendering, updating, and interaction with panels.
 *
 * ARCHITECTURE:
 * - Maintains collection of UI panels
 * - Positions panels around camera in spherical layout
 * - Updates panel textures each frame
 * - Handles controller raycasting for interaction
 *
 * PANEL LAYOUT (around camera):
 * - Top-left: Info/Status panel
 * - Top-right: Performance stats panel
 * - Bottom-left: Building/Construction panel
 * - Bottom-right: Production queue panel
 *
 * EXTENSIBILITY:
 * - Plugins can register custom UI panels via PluginManager
 * - Custom render callbacks for panel content
 */

import * as THREE from "three";
import { VRUIPanel } from "./VRUIPanel.js";

export class VRUISystem {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;

    // Collection of UI panels
    this.panels = new Map(); // name -> panel
    this.panelMeshes = [];

    // Raycaster for controller interactions
    this.raycaster = new THREE.Raycaster();

    console.log("[VRUISystem] Initialized");
  }

  /**
   * Register a UI panel
   * @param {string} name - Unique panel identifier
   * @param {VRUIPanel} panel - Panel instance
   */
  registerPanel(name, panel) {
    if (!panel || !(panel instanceof VRUIPanel)) {
      console.error("[VRUISystem] Invalid panel:", name);
      return;
    }

    this.panels.set(name, panel);
    this.panelMeshes.push(panel.getMesh());
    this.scene.add(panel.getMesh());

    console.log(`[VRUISystem] Registered panel: ${name}`);
  }

  /**
   * Unregister a UI panel
   * @param {string} name - Panel identifier
   */
  unregisterPanel(name) {
    const panel = this.panels.get(name);
    if (!panel) return;

    this.scene.remove(panel.getMesh());
    this.panelMeshes = this.panelMeshes.filter((m) => m !== panel.getMesh());
    panel.dispose();
    this.panels.delete(name);

    console.log(`[VRUISystem] Unregistered panel: ${name}`);
  }

  /**
   * Get a panel by name
   * @param {string} name - Panel identifier
   * @returns {VRUIPanel|null}
   */
  getPanel(name) {
    return this.panels.get(name) || null;
  }

  /**
   * Update all panels (position, render)
   * Uses the scene's camera which is updated by WebXR each frame
   */
  update() {
    // Get camera from scene (WebXR updates this each frame)
    const activeCamera = this.scene.getObjectByProperty("isCamera", true) || this.camera;
    
    if (!activeCamera) {
      console.warn("[VRUISystem] No active camera - cannot update panels");
      return;
    }

    try {
      this.panels.forEach((panel) => {
        // Update position relative to active camera
        panel.updatePosition(activeCamera);

        // Render content to canvas
        panel.render();
      });
    } catch (error) {
      console.error("[VRUISystem] Error updating panels:", error);
    }
  }

  /**
   * Handle controller raycast interaction
   * @param {THREE.Object3D} controller - VR controller
   * @param {Function} clickCallback - Called with (panelName, x, y) on hit
   */
  handleControllerRaycast(controller, clickCallback) {
    if (!this.panelMeshes.length) return;

    // Create raycaster from controller
    this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    this.raycaster.ray.direction
      .set(0, 0, -1)
      .applyQuaternion(controller.quaternion);

    // Check intersections
    const intersects = this.raycaster.intersectObjects(this.panelMeshes);

    if (intersects.length > 0) {
      const intersection = intersects[0];
      const panelMesh = intersection.object;
      const panel = panelMesh.userData.uiPanel;

      if (panel && clickCallback) {
        // Convert 3D intersection to 2D panel coordinates
        const uv = intersection.uv;
        const x = uv.x * panel.canvasWidth;
        const y = (1 - uv.y) * panel.canvasHeight;

        clickCallback(panel, x, y);
      }
    }
  }

  /**
   * Create default UI panels for game
   * (Can be overridden or extended)
   */
  createDefaultPanels() {
    // Info Panel (top-left)
    const infoPanel = new VRUIPanel({
      title: "Status",
      width: 1.5,
      height: 1.5,
      position: { x: -1.2, y: 0.8, z: -2 },
      render: (ctx, w, h) => {
        ctx.fillStyle = "#aaaaaa";
        ctx.font = "16px Arial";
        let y = 80;
        ctx.fillText("VR Mode: Active", 20, y);
        y += 30;
        ctx.fillText("FPS: --", 20, y);
        y += 30;
        ctx.fillText("Units: 0", 20, y);
        y += 30;
        ctx.fillText("Buildings: 0", 20, y);
      },
    });
    this.registerPanel("info", infoPanel);

    // Stats Panel (top-right)
    const statsPanel = new VRUIPanel({
      title: "Stats",
      width: 1.5,
      height: 1.5,
      position: { x: 1.2, y: 0.8, z: -2 },
      render: (ctx, w, h) => {
        ctx.fillStyle = "#00ff00";
        ctx.font = "14px monospace";
        let y = 80;
        ctx.fillText("Frame: -- ms", 20, y);
        y += 25;
        ctx.fillText("Draw: --", 20, y);
        y += 25;
        ctx.fillText("Tris: -- k", 20, y);
      },
    });
    this.registerPanel("stats", statsPanel);

    // Building Panel (bottom-left)
    const buildingPanel = new VRUIPanel({
      title: "Buildings",
      width: 2,
      height: 1.5,
      position: { x: -1.2, y: -0.8, z: -2 },
      render: (ctx, w, h) => {
        ctx.fillStyle = "#ffffff";
        ctx.font = "14px Arial";
        let y = 80;
        ctx.fillText("Barracks", 20, y);
        y += 30;
        ctx.fillText("Factory", 20, y);
        y += 30;
        ctx.fillText("Shield Gen", 20, y);
      },
    });
    this.registerPanel("buildings", buildingPanel);

    // Production Panel (bottom-right)
    const productionPanel = new VRUIPanel({
      title: "Production",
      width: 1.5,
      height: 1.5,
      position: { x: 1.2, y: -0.8, z: -2 },
      render: (ctx, w, h) => {
        ctx.fillStyle = "#4ade80";
        ctx.font = "14px Arial";
        ctx.fillText("Queue: Empty", 20, 80);
      },
    });
    this.registerPanel("production", productionPanel);
  }

  /**
   * Load custom UI panels from plugins
   * @param {PluginManager} pluginManager - Plugin manager instance
   */
  loadPluginPanels(pluginManager) {
    if (!pluginManager) return;

    const panelDefs = pluginManager.getVRUIPanels();
    if (!panelDefs || panelDefs.length === 0) return;

    panelDefs.forEach((panelDef) => {
      if (!panelDef.id || !panelDef.render) {
        console.warn("[VRUISystem] Invalid plugin panel definition:", panelDef);
        return;
      }

      const panel = new VRUIPanel({
        title: panelDef.title || "Plugin Panel",
        width: panelDef.width || 1.5,
        height: panelDef.height || 1.5,
        position: panelDef.position || { x: 0, y: 0, z: -2 },
        rotation: panelDef.rotation || { x: 0, y: 0, z: 0 },
        render: panelDef.render, // Callback from plugin
      });

      this.registerPanel(`plugin-${panelDef.id}`, panel);
      console.log(`[VRUISystem] Loaded plugin panel: ${panelDef.id}`);
    });
  }

  /**
   * Dispose all resources
   */
  dispose() {
    this.panels.forEach((panel) => {
      this.scene.remove(panel.getMesh());
      panel.dispose();
    });
    this.panels.clear();
    this.panelMeshes = [];
  }
}
