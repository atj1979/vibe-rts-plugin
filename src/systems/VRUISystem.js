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
import { ConsolePanel } from "./ConsolePanel.js";

export class VRUISystem {
  constructor(scene, camera, game = null) {
    this.scene = scene;
    this.camera = camera;
    this.game = game; // Reference to Game instance for data

    // Group all panels so they move together
    this.panelGroup = new THREE.Group();
    this.scene.add(this.panelGroup);

    // Group anchoring and easing
    this.groupAnchorPosition = null;
    this.groupAnchorQuaternion = null;
    this.groupTargetPosition = null;
    this.groupTargetQuaternion = null;
    this.groupOutOfViewSince = null;
    this.recenterSeconds = 3.5;
    this.viewAngleThresholdDeg = 60;
    this.recenterEase = 0.08;
    this.uiDistance = 1.6;

    // Collection of UI panels
    this.panels = new Map(); // name -> panel
    this.panelMeshes = [];

    // Debug console panel (head-locked to left hand)
    this.consolePanel = null;
    this.consolePanelVisible = false;

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
    panel.applyLocalPose();
    this.panelGroup.add(panel.getMesh());

    console.log(`[VRUISystem] Registered panel: ${name}`);
  }

  /**
   * Unregister a UI panel
   * @param {string} name - Panel identifier
   */
  unregisterPanel(name) {
    const panel = this.panels.get(name);
    if (!panel) return;

    this.panelGroup.remove(panel.getMesh());
    this.panelMeshes = this.panelMeshes.filter((m) => m !== panel.getMesh());
    panel.dispose();
    this.panels.delete(name);

    console.log(`[VRUISystem] Unregistered panel: ${name}`);
  }

  /**
   * Create and register the debug console panel
   * @param {THREE.Object3D} leftController - VR left controller
   */
  createConsolePanel(leftController) {
    if (this.consolePanel) return; // Already created

    this.consolePanel = new ConsolePanel();
    if (leftController) {
      this.consolePanel.setLeftController(leftController);
    }
    this.consolePanel.getMesh().visible = false; // Hidden by default
    this.scene.add(this.consolePanel.getMesh());
    this.panelMeshes.push(this.consolePanel.getMesh());
    this.consolePanelVisible = false;

    console.log("[VRUISystem] Debug console panel created");
  }

  /**
   * Toggle console panel visibility
   */
  toggleConsolePanel() {
    if (!this.consolePanel) return;

    this.consolePanelVisible = !this.consolePanelVisible;
    this.consolePanel.getMesh().visible = this.consolePanelVisible;

    console.log(
      `[VRUISystem] Console panel ${this.consolePanelVisible ? "shown" : "hidden"}`,
    );
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
    const activeCamera =
      this.scene.getObjectByProperty("isCamera", true) || this.camera;

    if (!activeCamera) {
      console.warn("[VRUISystem] No active camera - cannot update panels");
      return;
    }

    try {
      const nowSeconds = performance.now() / 1000;
      const cameraForward = new THREE.Vector3();
      activeCamera.getWorldDirection(cameraForward);

      // Initialize group anchor on first update
      if (!this.groupAnchorPosition || !this.groupAnchorQuaternion) {
        this.setGroupAnchorFromCamera(activeCamera);
        this.panelGroup.position.copy(this.groupAnchorPosition);
        this.panelGroup.quaternion.copy(this.groupAnchorQuaternion);
      }

      // Determine if group is out of view
      const toGroup = new THREE.Vector3()
        .subVectors(this.panelGroup.position, activeCamera.position)
        .normalize();
      const angleDeg = THREE.MathUtils.radToDeg(cameraForward.angleTo(toGroup));

      if (angleDeg > this.viewAngleThresholdDeg) {
        if (!this.groupOutOfViewSince) {
          this.groupOutOfViewSince = nowSeconds;
          console.log(
            `[VRUISystem] Panels out of view (angle: ${angleDeg.toFixed(1)}°)`,
          );
        } else {
          const timeOutOfView = nowSeconds - this.groupOutOfViewSince;
          if (timeOutOfView >= this.recenterSeconds) {
            console.log(
              `[VRUISystem] Recentering panels after ${timeOutOfView.toFixed(1)}s out of view`,
            );
            this.setGroupTargetFromCamera(activeCamera);
            this.groupOutOfViewSince = null;
          }
        }
      } else {
        if (this.groupOutOfViewSince) {
          console.log(
            `[VRUISystem] Panels back in view (angle: ${angleDeg.toFixed(1)}°)`,
          );
        }
        this.groupOutOfViewSince = null;
      }

      // Smoothly ease group toward target (if any)
      const targetPosition =
        this.groupTargetPosition || this.groupAnchorPosition;
      const targetQuaternion =
        this.groupTargetQuaternion || this.groupAnchorQuaternion;

      if (targetPosition && targetQuaternion) {
        this.panelGroup.position.lerp(targetPosition, this.recenterEase);
        this.panelGroup.quaternion.slerp(targetQuaternion, this.recenterEase);

        const posClose =
          this.panelGroup.position.distanceTo(targetPosition) < 0.01;
        const rotClose =
          1 - this.panelGroup.quaternion.dot(targetQuaternion) < 0.001;

        if (posClose && rotClose) {
          this.panelGroup.position.copy(targetPosition);
          this.panelGroup.quaternion.copy(targetQuaternion);
          if (this.groupTargetPosition) {
            this.groupAnchorPosition = this.groupTargetPosition.clone();
            this.groupAnchorQuaternion = this.groupTargetQuaternion.clone();
            this.groupTargetPosition = null;
            this.groupTargetQuaternion = null;
          }
        }
      }

      this.panels.forEach((panel) => {
        // Head-locked panels (rare) still update against camera
        if (panel.headLocked) {
          panel.updatePosition(activeCamera);
        }

        // Render content to canvas
        panel.render();
      });

      // Update console panel position if visible
      if (this.consolePanel && this.consolePanelVisible) {
        this.consolePanel.updateControllerPosition();
        this.consolePanel.render();
      }
    } catch (error) {
      console.error("[VRUISystem] Error updating panels:", error);
    }
  }

  /**
   * Anchor group in world space based on current camera pose
   * Ignores roll to keep text level with ground
   * @param {THREE.Camera} camera - VR camera
   */
  setGroupAnchorFromCamera(camera) {
    this.groupAnchorPosition = camera.position.clone();
    this.groupAnchorQuaternion = this.getYawPitchQuaternion(camera.quaternion);
  }

  /**
   * Set a recenter target based on current camera pose
   * Ignores roll to keep text level with ground
   * @param {THREE.Camera} camera - VR camera
   */
  setGroupTargetFromCamera(camera) {
    this.groupTargetPosition = camera.position.clone();
    this.groupTargetQuaternion = this.getYawPitchQuaternion(camera.quaternion);
  }

  /**
   * Extract yaw and pitch from quaternion, ignoring roll
   * This keeps text perpendicular to ground plane
   * @param {THREE.Quaternion} quat - Source quaternion
   * @returns {THREE.Quaternion} Quaternion with roll = 0
   */
  getYawPitchQuaternion(quat) {
    const euler = new THREE.Euler().setFromQuaternion(quat, "YXZ");
    euler.z = 0; // Ignore roll
    return new THREE.Quaternion().setFromEuler(euler);
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
      width: 1.0,
      height: 0.9,
      dpi: 512,
      position: { x: -0.7, y: 0.45, z: -this.uiDistance },
      render: (ctx, w, h) => {
        ctx.fillStyle = "#aaaaaa";
        ctx.font = "bold 20px Arial";
        let y = 50;
        ctx.fillText("Status", 20, y);
        y += 50;
        ctx.fillStyle = "#ffffff";
        ctx.font = "16px Arial";

        const units = this.game?.unitSystem?.allUnits?.length ?? 0;
        const buildings = this.game?.buildingSystem?.allBuildings?.length ?? 0;
        const resources = this.game?.buildingSystem?.resources ?? {};

        ctx.fillText(`Units: ${units}`, 20, y);
        y += 35;
        ctx.fillText(`Buildings: ${buildings}`, 20, y);
        y += 40;
        ctx.fillText(`Resources:`, 20, y);
        y += 35;
        ctx.fillStyle = "#ffff00";
        ctx.font = "14px Arial";
        ctx.fillText(`Credits: ${resources.credits ?? 0}`, 20, y);
        y += 28;
        ctx.fillText(`Metal: ${resources.metal ?? 0}`, 20, y);
        y += 28;
        ctx.fillText(`Energy: ${resources.energy ?? 0}`, 20, y);
      },
    });
    this.registerPanel("info", infoPanel);

    // Stats Panel (top-right)
    const statsPanel = new VRUIPanel({
      title: "Stats",
      width: 1.0,
      height: 0.9,
      dpi: 512,
      position: { x: 0.7, y: 0.45, z: -this.uiDistance },
      render: (ctx, w, h) => {
        ctx.fillStyle = "#00ff00";
        ctx.font = "bold 20px Arial";
        let y = 50;
        ctx.fillText("Performance", 20, y);
        y += 50;
        ctx.fillStyle = "#ffffff";
        ctx.font = "16px monospace";

        const fps = this.game?.performanceMonitor?.stats?.fps ?? 0;
        const frameTime = this.game?.performanceMonitor?.stats?.frameTime ?? 0;

        ctx.fillText(`FPS: ${Math.round(fps)}`, 20, y);
        y += 35;
        ctx.fillText(`Frame: ${frameTime.toFixed(2)}ms`, 20, y);
        y += 35;
        ctx.fillText(`VR Mode: Active`, 20, y);
        y += 40;
        ctx.fillStyle = "#cccccc";
        ctx.font = "12px monospace";
        ctx.fillText(
          `Memory: ${((performance.memory?.usedJSHeapSize ?? 0) / 1048576) | 0}MB`,
          20,
          y,
        );
      },
    });
    this.registerPanel("stats", statsPanel);

    // Building Panel (bottom-left)
    const buildingPanel = new VRUIPanel({
      title: "Buildings",
      width: 1.1,
      height: 0.9,
      dpi: 512,
      position: { x: -0.7, y: -0.45, z: -this.uiDistance },
      render: (ctx, w, h) => {
        ctx.fillStyle = "#6699ff";
        ctx.font = "bold 18px Arial";
        let y = 50;
        ctx.fillText("Buildings", 20, y);
        y += 50;
        ctx.fillStyle = "#ffffff";
        ctx.font = "14px Arial";

        const buildings = this.game?.buildingSystem?.allBuildings ?? [];
        const typeCount = {};

        for (const building of buildings) {
          const type = building.type || "unknown";
          typeCount[type] = (typeCount[type] || 0) + 1;
        }

        for (const [type, count] of Object.entries(typeCount)) {
          ctx.fillText(`${type}: ${count}`, 20, y);
          y += 30;
          if (y > h - 40) break;
        }

        if (buildings.length === 0) {
          ctx.fillStyle = "#888888";
          ctx.fillText("No buildings", 20, y);
        }
      },
    });
    this.registerPanel("buildings", buildingPanel);

    // Production Panel (bottom-right)
    const productionPanel = new VRUIPanel({
      title: "Production",
      width: 1.1,
      height: 0.9,
      dpi: 512,
      position: { x: 0.7, y: -0.45, z: -this.uiDistance },
      render: (ctx, w, h) => {
        ctx.fillStyle = "#ff9900";
        ctx.font = "bold 18px Arial";
        let y = 50;
        ctx.fillText("Production", 20, y);
        y += 50;
        ctx.fillStyle = "#ffffff";
        ctx.font = "14px Arial";

        const selectedBuilding = this.game?.selectedBuilding;
        if (selectedBuilding && selectedBuilding.productionQueue) {
          const queue = selectedBuilding.productionQueue;
          ctx.fillText(`Queue (${queue.length}):`, 20, y);
          y += 30;

          for (let i = 0; i < Math.min(queue.length, 4); i++) {
            const item = queue[i];
            ctx.fillStyle = i === 0 ? "#ffff00" : "#aaaaaa";
            if (typeof item === "string") {
              ctx.fillText(`${i + 1}. ${item}`, 20, y);
            } else if (item.type) {
              ctx.fillText(`${i + 1}. ${item.type}`, 20, y);
            }
            y += 28;
          }
        } else {
          ctx.fillStyle = "#888888";
          ctx.fillText("No building selected", 20, y);
          y += 30;
          ctx.fillText("Click building in game", 20, y);
        }
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
        width: panelDef.width || 0.9,
        height: panelDef.height || 0.8,
        dpi: panelDef.dpi || 256,
        curveRadius: panelDef.curveRadius || 2.4,
        position: panelDef.position || { x: 0, y: 0, z: -this.uiDistance },
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
      this.panelGroup.remove(panel.getMesh());
      panel.dispose();
    });
    this.panels.clear();
    this.panelMeshes = [];

    if (this.panelGroup) {
      this.scene.remove(this.panelGroup);
      this.panelGroup = null;
    }
  }
}
