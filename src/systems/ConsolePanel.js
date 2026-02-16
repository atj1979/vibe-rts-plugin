/**
 * Console Panel
 *
 * Displays console logs/warnings/errors on a head-locked VR panel
 * attached to the left controller. Useful for VR debugging.
 */

import * as THREE from "three";
import { VRUIPanel } from "./VRUIPanel.js";

export class ConsolePanel extends VRUIPanel {
  constructor(leftController = null) {
    super({
      title: "Console",
      width: 0.6,
      height: 1.2,
      dpi: 512,
      position: { x: -0.4, y: 0.15, z: -0.3 }, // Float above left hand
      headLocked: true, // Attach to controller
      render: (ctx, w, h) => {
        this.renderConsoleContent(ctx, w, h);
      },
    });

    this.leftController = leftController; // Will be set later
    this.messages = []; // Array of { type, text, time }
    this.maxMessages = 20;
    this.fontSize = 12;
    this.lineHeight = 16;

    // Override console methods
    this.originalLog = console.log;
    this.originalWarn = console.warn;
    this.originalError = console.error;

    this.captureConsole();
  }

  /**
   * Set the left controller reference for positioning
   */
  setLeftController(controller) {
    this.leftController = controller;
    if (controller) {
      console.log("[ConsolePanel] Left controller attached");
    } else {
      console.log("[ConsolePanel] WARNING: No left controller provided!");
    }
  }

  /**
   * Update position to follow left controller
   */
  updateControllerPosition() {
    if (!this.leftController) return;

    // Position relative to controller
    const offset = new THREE.Vector3(
      this.position.x,
      this.position.y,
      this.position.z,
    );

    offset.applyQuaternion(this.leftController.quaternion);

    this.mesh.position.copy(this.leftController.position).add(offset);
    this.mesh.quaternion.copy(this.leftController.quaternion);
  }

  /**
   * Intercept console methods to capture output
   */
  captureConsole() {
    console.log = (...args) => {
      this.addMessage("log", args.join(" "));
      this.originalLog.apply(console, args);
    };

    console.warn = (...args) => {
      this.addMessage("warn", args.join(" "));
      this.originalWarn.apply(console, args);
    };

    console.error = (...args) => {
      this.addMessage("error", args.join(" "));
      this.originalError.apply(console, args);
    };
  }

  /**
   * Add a console message
   */
  addMessage(type, text) {
    const now = new Date().toLocaleTimeString();
    this.messages.push({ type, text, time: now });

    // Keep only recent messages
    if (this.messages.length > this.maxMessages) {
      this.messages.shift();
    }

    this.markDirty();
  }

  /**
   * Render console content to canvas
   */
  renderConsoleContent(ctx, w, h) {
    // Dark background
    ctx.fillStyle = "rgba(10, 10, 15, 0.98)";
    ctx.fillRect(0, 0, w, h);

    // Border
    ctx.strokeStyle = "rgba(100, 200, 100, 0.6)";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, w, h);

    // Title bar
    ctx.fillStyle = "#00ff00";
    ctx.font = `bold ${Math.round(14 * (this.dpi / 512))}px monospace`;
    ctx.textBaseline = "top";
    ctx.fillText("DEBUG CONSOLE", 10, 8);

    // Draw messages
    ctx.font = `${Math.round(this.fontSize * (this.dpi / 512))}px monospace`;
    ctx.textBaseline = "top";

    let y = 40;
    for (const msg of this.messages) {
      // Color by type
      if (msg.type === "error") {
        ctx.fillStyle = "#ff6666";
      } else if (msg.type === "warn") {
        ctx.fillStyle = "#ffcc66";
      } else {
        ctx.fillStyle = "#aaaaaa";
      }

      // Time prefix
      ctx.fillStyle = "#666666";
      ctx.fillText(`[${msg.time}]`, 10, y);

      // Message text
      if (msg.type === "error") {
        ctx.fillStyle = "#ff6666";
      } else if (msg.type === "warn") {
        ctx.fillStyle = "#ffcc66";
      } else {
        ctx.fillStyle = "#aaaaaa";
      }

      // Wrap text if too long
      const maxChars = Math.floor((w - 20) / 6);
      const text = msg.text.substring(0, maxChars);
      ctx.fillText(text, 80, y);

      y += Math.round(this.lineHeight * (this.dpi / 512));
      if (y > h - 20) break;
    }

    // Footer hint
    ctx.fillStyle = "#666666";
    ctx.font = `${Math.round(10 * (this.dpi / 512))}px monospace`;
    ctx.fillText("Toggle: (squeeze both)", 10, h - 30);
  }

  /**
   * Restore original console methods
   */
  restoreConsole() {
    console.log = this.originalLog;
    console.warn = this.originalWarn;
    console.error = this.originalError;
  }

  /**
   * Dispose and clean up
   */
  dispose() {
    this.restoreConsole();
    super.dispose();
  }
}
