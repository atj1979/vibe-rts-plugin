# Code Walkthrough & AI Assistant Guide

**Purpose:** This document helps both humans and AI understand the codebase architecture, patterns, and how to extend it effectively.

---

## 🎯 Document Purpose

This walkthrough is designed to help:
1. **New developers** understand the codebase quickly
2. **AI assistants** (like GitHub Copilot, ChatGPT) understand context when suggesting code
3. **Future contributors** maintain consistency with established patterns

---

## 📐 Architecture Overview

### System Layers

```
┌─────────────────────────────────────────┐
│          User Interface (HTML/CSS)      │
│               (index.html)              │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│         Application Entry (main.js)     │
│  - Initializes game                     │
│  - Handles WebXR checks                 │
│  - Manages UI updates                   │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│         Core Game Engine (Game.js)      │
│  - Three.js renderer                    │
│  - Game loop (fixed timestep)           │
│  - Scene management                     │
│  - VR session handling                  │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│         Gameplay Systems                │
│  - UnitSystem (instanced units)         │
│  - SelectionSystem (raycast select)     │
│  - CombatSystem (targets + projectiles) │
│  - BuildingSystem (construct/produce)   │
│  - HealthBarSystem (units/buildings)    │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│         Utility Systems                 │
│  - Performance Monitor                  │
│  - Object Pools                         │
│  - Math helpers                         │
│  - WebXR utilities                      │
└─────────────────────────────────────────┘
```

---

## 🔍 Code Flow Analysis

### Startup Sequence

```javascript
// 1. Browser loads index.html
// 2. index.html loads src/main.js
// 3. main.js execution flow:

async function init() {
  // Step 1: Check WebXR support
  const xrSupport = await checkWebXRSupport();
  
  // Step 2: Create performance monitor
  performanceMonitor = new PerformanceMonitor();
  
  // Step 3: Create game instance
  game = new Game(canvasContainer, performanceMonitor);
  
  // Step 4: Initialize game (async - loads resources)
  await game.initialize();
  
  // Step 5: Start game loop
  game.start();
}
```

### Game Loop Flow

**CRITICAL CONCEPT:** Fixed timestep vs variable rendering

```javascript
gameLoop(time) {
  // 1. Calculate delta time (how long since last frame)
  deltaTime = currentTime - lastTime;
  
  // 2. Accumulate time
  accumulator += deltaTime;
  
  // 3. Update logic at fixed rate (60Hz)
  while (accumulator >= fixedTimeStep) {
    update(1/60); // Always same delta
    accumulator -= fixedTimeStep;
  }
  
  // 4. Render at display rate (90Hz VR or variable desktop)
  alpha = accumulator / fixedTimeStep; // Interpolation factor
  render(alpha);
}
```

**WHY THIS PATTERN:**
- Game logic (physics, AI) needs consistent timing
- Rendering needs to match display rate
- Prevents physics bugs from frame rate variations
- Allows smooth rendering between logic updates

---

## 🏗️ File Structure & Responsibilities

### `/src/main.js`
**Role:** Application bootstrap and UI management

**AI Context:** This file:
- Checks browser capabilities
- Creates global game instance
- Handles UI elements (buttons, stats)
- Does NOT contain game logic

**When to edit:** UI changes, initialization flow, error handling

**Example task:** "Add a settings menu button"
```javascript
// Pattern to follow:
const settingsButton = document.createElement('button');
settingsButton.onclick = () => game.showSettings();
document.getElementById('ui-overlay').appendChild(settingsButton);
```

---

### `/src/core/Game.js`
**Role:** Main game controller and Three.js orchestration

**AI Context:** This file:
- Manages Three.js renderer and scene
- Implements game loop
- Handles VR session
- Coordinates all game systems

**When to edit:** Core engine changes, rendering pipeline, VR handling

**Current integrations:**
- `UnitSystem`, `SelectionSystem`, `CombatSystem`, `BuildingSystem`, `HealthBarSystem`
- Building placement, production UI updates, rally points

**Example task:** "Add fog to the scene"
```javascript
// Pattern to follow (in initScene method):
this.scene.fog = new THREE.Fog(0x222244, nearDist, farDist);
```

**IMPORTANT METHODS:**

1. **`gameLoop(time)`** - Main loop, called every frame
   - DO: Keep this fast and efficient
   - DON'T: Add heavy logic here
   
2. **`update(dt)`** - Game logic updates (fixed 60Hz)
   - DO: Put gameplay logic here
   - DON'T: Access DOM, do rendering

3. **`render(alpha)`** - Drawing to screen
   - DO: Render scene, update visual effects
   - DON'T: Change game state

---

### `/src/utils/ObjectPool.js`
**Role:** Memory-efficient object reuse

**AI Context:** 
- Prevents garbage collection pauses
- Critical for VR (GC = frame drops = motion sickness)
- Use for ANY object created/destroyed frequently

**When to use:**
- Projectiles
- Particles
- Temporary UI elements
- Any object with lifecycle < 1 second

**Pattern:**
```javascript
// 1. Create pool
const bulletPool = new ObjectPool(() => new Bullet(), 100);

// 2. Get object
const bullet = bulletPool.acquire();
bullet.init(startPos, velocity);

// 3. Return when done
bulletPool.release(bullet);
```

**AI GUIDELINE:** If you see code like this:
```javascript
function shootBullet() {
  const bullet = new Bullet(); // ❌ BAD: Creates garbage
  bullets.push(bullet);
}
```

---

## 🔌 Plugin Data (Units/Buildings)

Unit and building definitions are now mirrored into a separate plugin repo so the main game can load them by tag + group name.

- Repo: https://github.com/atj1979/vibe-rts-plugins
- Default group: `core`
- Files: `src/plugins/core/units.js` and `src/plugins/core/buildings.js`

The runtime loader is next to implement in this repo.

Suggest this instead:
```javascript
function shootBullet() {
  const bullet = bulletPool.acquire(); // ✅ GOOD: Reuses memory
  bullet.init(playerPos, targetPos);
  bullets.push(bullet);
}
```

---

### `/src/utils/PerformanceMonitor.js`
**Role:** Track FPS, frame time, draw calls

**AI Context:**
- Call `begin()` at start of frame
- Call `end(renderer)` at end of frame
- Automatically warns if FPS drops

**When to check performance:**
- After adding new features
- When optimizing
- Before/after algorithm changes

**Reading the stats:**
```javascript
const stats = performanceMonitor.getStats();
console.log(`FPS: ${stats.fps}`);
console.log(`Frame time: ${stats.frameTime}ms`);
console.log(`Draw calls: ${stats.drawCalls}`); // Lower is better
```

**Target values for VR:**
- FPS: 90+ (Quest 2/3)
- Frame time: <11ms
- Draw calls: <50

---

### `/src/utils/WebXRUtils.js`
**Role:** WebXR feature detection and session creation

**AI Context:**
- `checkWebXRSupport()` - Returns if VR is available
- `createXRSession()` - Requests VR session with optimal settings

**When to edit:** Adding new XR features (hand tracking, AR, etc.)

---

### `/src/utils/MathUtils.js`
**Role:** Common math operations

**AI Context:** Helper functions to avoid repeated code

**Key patterns:**

```javascript
// Distance comparison (FAST - no sqrt)
if (distanceSq2D(x1, y1, x2, y2) < rangeSq) {
  // Unit in range
}

// Instead of:
if (distance2D(x1, y1, x2, y2) < range) { // SLOWER - sqrt every time
  // Unit in range
}
```

---

## 🎨 Coding Patterns & Best Practices

### Pattern 1: Performance-First Mindset

**Always ask:** "Will this run 90+ times per second?"

**Bad:**
```javascript
function update() {
  // Creating objects in hot path = garbage
  const temp = new THREE.Vector3();
  temp.copy(position);
  // ... use temp
}
```

**Good:**
```javascript
class MySystem {
  constructor() {
    // Reusable temp variable
    this.tempVector = new THREE.Vector3();
  }
  
  update() {
    // Reuse same object
    this.tempVector.copy(position);
    // ... use tempVector
  }
}
```

---

### Pattern 2: Clear Separation of Concerns

**Game Logic (update):**
```javascript
update(dt) {
  // ✅ Calculate positions
  // ✅ Handle collisions
  // ✅ Update AI
  // ❌ Don't access DOM
  // ❌ Don't call three.js render methods
}
```

**Rendering (render):**
```javascript
render(alpha) {
  // ✅ Update visual positions
  // ✅ Render effects
  // ❌ Don't change game state
  // ❌ Don't modify logic variables
}
```

---

### Pattern 3: Extensive Comments for AI

**Good commenting:**
```javascript
/**
 * Calculate projectile trajectory
 * 
 * PATTERN: Ballistic motion with gravity
 * PERFORMANCE: Uses pre-calculated lookup table
 * AI NOTE: Do not add air resistance (too expensive)
 * 
 * @param {Vector3} start - Starting position
 * @param {Vector3} target - Target position
 * @param {number} speed - Projectile speed
 * @returns {Array<Vector3>} Path points
 */
function calculateTrajectory(start, target, speed) {
  // Implementation
}
```

**Key elements:**
1. What it does
2. Why this pattern
3. Performance notes
4. Guidance for AI modifications
5. Type information

---

### Pattern 4: Instanced Rendering for Units

**CRITICAL FOR PERFORMANCE:**

**Bad (100 draw calls):**
```javascript
units.forEach(unit => {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(unit.position);
  scene.add(mesh);
});
```

**Good (1 draw call):**
```javascript
// Create instanced mesh
const instancedMesh = new THREE.InstancedMesh(
  geometry,
  material,
  maxUnits
);

// Update instances
units.forEach((unit, i) => {
  matrix.setPosition(unit.position);
  instancedMesh.setMatrixAt(i, matrix);
});
instancedMesh.instanceMatrix.needsUpdate = true;
```

**Benefit:** 100x faster rendering for many identical objects

---

## 🤖 AI Assistant Prompts

### For Code Additions

When asking AI to add features, provide context:

```
"Add a new unit type to the game.

Context:
- Units use instanced rendering (see Game.js)
- Unit data stored in UnitSystem (to be created)
- Each unit needs: position, health, damage, speed
- Use ObjectPool for unit instances (see ObjectPool.js)
- Follow pattern in existing unit code

Performance requirements:
- Support 200+ units at 90 FPS
- Use InstancedMesh for rendering
- Minimize per-frame allocations"
```

---

### For Debugging

```
"Fix performance issue with unit rendering.

Current behavior:
- FPS drops to 30 with 100 units

Expected behavior:
- Maintain 90 FPS with 200 units

Files involved:
- src/core/Game.js (rendering)
- src/systems/UnitSystem.js (update logic)

Check:
1. Are we using instanced rendering?
2. Are we creating objects in update loop?
3. Is frustum culling enabled?
4. Check PerformanceMonitor stats"
```

---

### For Refactoring

```
"Refactor unit system to use ECS pattern.

Current: Units are class instances
Target: Entity-Component-System

Preserve:
- Performance characteristics
- Object pooling
- Instanced rendering

Reference patterns in:
- ObjectPool.js (reuse objects)
- Game.js (system coordination)"
```

---

## 📊 Performance Checklist

Before committing code, verify:

### Frame Rate
- [ ] Desktop: 60+ FPS
- [ ] VR: 90+ FPS on Quest 2

### Memory
- [ ] No memory leaks (check DevTools)
- [ ] Object pools used for temp objects
- [ ] Textures/geometries disposed properly

### Rendering
- [ ] Draw calls < 50
- [ ] Using instanced rendering for repeated objects
- [ ] Frustum culling enabled
- [ ] LOD system for distant objects (future)

### Code Quality
- [ ] Comments explain WHY, not just WHAT
- [ ] Performance notes for hot paths
- [ ] Type information in JSDoc
- [ ] AI guidance for future modifications

---

## 🔮 Future Additions (AI Context)

### When adding these features, consider:

**Unit System:**
- Use InstancedMesh (1 draw call per unit type)
- ObjectPool for unit instances
- Spatial partitioning (Quadtree) for collision detection

**Combat System:**
- Projectiles from ObjectPool
- Line-of-sight checks (raycasting)
- Damage calculation in update(), visual effects in render()

**Building System:**
- Each building = one mesh (don't instance, too few)
- Construction animation via shader
- Placement grid snapping (see MathUtils.snapToGrid)

**AI System:**
- Run AI at lower frequency (10Hz not 60Hz)
- Use behavior trees (not heavy pathfinding every frame)
- Batch AI updates across multiple frames

**Multiplayer:**
- Separate networking from rendering (dedicated thread if possible)
- Client-side prediction
- Server authoritative
- Use WebRTC for peer-to-peer

---

## 🚀 Quick Start for AI Assistants

If you're an AI helping with this codebase:

1. **Read this file first** - understand patterns
2. **Check Game.js** - understand architecture
3. **Look at similar code** - follow established patterns
4. **Consider performance** - every line runs 90+ times/sec
5. **Add detailed comments** - help the next AI (or human)

### Key Questions to Ask:

- Does this run in the update loop? (needs to be fast)
- Am I creating objects? (use pools instead)
- Can this be batched? (combine draw calls)
- Is this Three.js best practice? (check documentation)
- Will this work in VR? (test in headset)

---

## 📚 Additional Resources

### Three.js Performance
- https://threejs.org/docs/#manual/en/introduction/How-to-dispose-of-objects
- https://threejs.org/examples/#webgl_instancing_dynamic

### WebXR
- https://immersive-web.github.io/webxr-samples/

### VR Best Practices
- https://developer.oculus.com/documentation/web/web-performance/

---

## 🤝 Contributing

When adding code:
1. Follow existing patterns
2. Add comprehensive comments
3. Include AI guidance notes
4. Test performance
5. Update this document if adding new patterns

---

**Remember: In VR, performance isn't optional - it's mandatory for comfort!**
