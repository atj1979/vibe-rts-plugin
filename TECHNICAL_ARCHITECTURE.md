# Something Vibe - Technical Architecture Document

**Version:** 1.0  
**Last Updated:** February 14, 2026  
**Technology Stack:** Three.js + WebXR

---

## Technology Selection

### Core Framework: **Three.js with WebXR API**

#### Why Three.js?
Based on research and industry best practices for performance-critical VR applications:

**Advantages:**
1. **Performance Control**: Direct access to WebGL for optimization
2. **Mature Ecosystem**: Extensive documentation, examples, and community support
3. **VR-Optimized**: Built-in WebXR support with active development
4. **Flexibility**: Fine-grained control over rendering pipeline
5. **Lightweight**: Smaller bundle size than game engines
6. **Production-Ready**: Used in professional VR applications

**Why NOT A-Frame?**
- A-Frame is excellent for rapid prototyping but adds abstraction layers
- Entity-Component-System can introduce overhead for complex game logic
- Less control over render optimization critical for VR RTS with many units
- Three.js is the underlying renderer for A-Frame anyway

#### WebXR API
- Native browser support for VR (no plugins required)
- Standards-compliant and future-proof
- Direct hardware access for low-latency tracking
- Supported by all major VR headsets via browser

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Web Browser                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │              Application Layer                    │  │
│  │  ┌─────────────┐  ┌──────────────┐              │  │
│  │  │  Game Loop  │  │  State Mgmt  │              │  │
│  │  │  (60/90fps) │  │   (Redux)    │              │  │
│  │  └─────────────┘  └──────────────┘              │  │
│  │         │                  │                     │  │
│  │  ┌──────▼──────────────────▼─────────────────┐  │  │
│  │  │        Game Systems Layer                 │  │  │
│  │  │  ┌────────┐ ┌────────┐ ┌──────────────┐  │  │  │
│  │  │  │ Units  │ │Combat  │ │  Resources  │  │  │  │
│  │  │  │ System │ │ System │ │   System    │  │  │  │
│  │  │  └────────┘ └────────┘ └──────────────┘  │  │  │
│  │  └───────────────────┬───────────────────────┘  │  │
│  │                      │                           │  │
│  │  ┌───────────────────▼───────────────────────┐  │  │
│  │  │         Rendering Layer                   │  │  │
│  │  │    ┌──────────────────────────────┐       │  │  │
│  │  │    │       Three.js Scene         │       │  │  │
│  │  │    │   - Geometry Batching        │       │  │  │
│  │  │    │   - Material Sharing         │       │  │  │
│  │  │    │   - LOD Management           │       │  │  │
│  │  │    └──────────────┬───────────────┘       │  │  │
│  │  └────────────────────┼───────────────────────┘  │  │
│  └────────────────────────┼───────────────────────────┘  │
│                          ▼                             │
│  ┌──────────────────────────────────────────────────┐ │
│  │              WebXR API                           │ │
│  │  - Session Management                            │ │
│  │  - Controller Input                              │ │
│  │  - Pose Tracking                                 │ │
│  └──────────────────────┬───────────────────────────┘ │
└─────────────────────────┼─────────────────────────────┘
                          ▼
                    ┌───────────┐
                    │ VR Headset│
                    └───────────┘
```

---

## Performance Optimization Strategy

### Critical VR Performance Requirements
- **90 FPS minimum** (11.1ms per frame budget)
- **20ms or less** motion-to-photon latency
- **Consistent frame times** (no jitter/judder)

### Optimization Techniques

#### 1. Geometry Batching & Instancing
```javascript
// Use InstancedMesh for multiple units of same type
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({ color: 0x0000ff });
const units = new THREE.InstancedMesh(geometry, material, 100);
scene.add(units);

// Update positions via instance matrix instead of individual objects
```

**Benefits:**
- Reduces draw calls from 100 to 1
- GPU instancing for nearly free duplication
- Critical for 200+ unit limit

#### 2. Level of Detail (LOD)
```javascript
const lod = new THREE.LOD();

// High detail (close to camera)
lod.addLevel(detailedMesh, 0);

// Medium detail
lod.addLevel(mediumMesh, 20);

// Low detail (far from camera)
lod.addLevel(simpleMesh, 50);
```

**Strategy:**
- Close units: Full geometry
- Medium distance: Simplified shapes
- Far distance: Billboard sprites or simple cubes

#### 3. Frustum Culling
- Only render objects visible to camera
- Three.js handles automatically
- Additional manual culling for off-screen game logic updates

#### 4. Texture Management
```javascript
// Use texture atlasing to reduce texture switches
// Compress textures using Basis Universal
// Enable mipmapping for distant objects
texture.generateMipmaps = true;
texture.minFilter = THREE.LinearMipMapLinearFilter;
```

#### 5. Shader Optimization
- Minimize fragment shader complexity
- Move calculations to vertex shader when possible
- Use `lowp`/`mediump` precision in shaders for mobile
- Avoid conditional branches in shaders

#### 6. Object Pooling
```javascript
class UnitPool {
  constructor(maxSize) {
    this.pool = [];
    this.active = [];
    // Pre-create units to avoid runtime allocation
    for (let i = 0; i < maxSize; i++) {
      this.pool.push(this.createUnit());
    }
  }
  
  acquire() {
    const unit = this.pool.pop() || this.createUnit();
    this.active.push(unit);
    return unit;
  }
  
  release(unit) {
    unit.visible = false;
    const index = this.active.indexOf(unit);
    this.active.splice(index, 1);
    this.pool.push(unit);
  }
}
```

#### 7. Update Loop Optimization
- Fixed timestep for physics/game logic (60 Hz)
- Interpolated rendering (90 Hz for VR)
- Spatial partitioning (Quadtree) for efficient collision detection
- Lazy updates for distant units

---

## Project Structure

```
something-vibe/
├── public/
│   ├── index.html
│   ├── assets/
│   │   ├── models/
│   │   ├── textures/
│   │   └── audio/
│   └── manifest.json
├── src/
│   ├── main.js                 # Entry point
│   ├── game/
│   │   ├── Game.js             # Main game class
│   │   ├── GameState.js        # State management
│   │   └── systems/
│   │       ├── UnitSystem.js   # Unit management
│   │       ├── CombatSystem.js
│   │       ├── ResourceSystem.js
│   │       ├── BuildingSystem.js
│   │       └── AISystem.js
│   ├── rendering/
│   │   ├── Renderer.js         # Three.js setup
│   │   ├── SceneManager.js
│   │   ├── UnitRenderer.js     # Instanced rendering
│   │   └── EffectsManager.js   # Particles, lighting
│   ├── vr/
│   │   ├── VRManager.js        # WebXR session handling
│   │   ├── VRController.js     # Input handling
│   │   └── VRComfort.js        # Comfort settings
│   ├── ui/
│   │   ├── VRMenu.js           # 3D UI menus
│   │   ├── HUD.js              # Heads-up display
│   │   └── SelectionBox.js     # Unit selection visuals
│   ├── entities/
│   │   ├── Unit.js
│   │   ├── Building.js
│   │   └── Projectile.js
│   ├── utils/
│   │   ├── ObjectPool.js
│   │   ├── Quadtree.js         # Spatial partitioning
│   │   └── MathUtils.js
│   └── networking/             # Future multiplayer
│       ├── NetworkManager.js
│       └── SyncSystem.js
├── tests/
├── package.json
├── vite.config.js              # Build tool
├── GAME_DESIGN.md
├── TECHNICAL_ARCHITECTURE.md
└── README.md
```

---

## Key Dependencies

```json
{
  "dependencies": {
    "three": "^0.163.0",
    "troika-three-text": "^0.49.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "@vitejs/plugin-legacy": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

**Rationale:**
- **Three.js**: Core 3D rendering engine
- **troika-three-text**: High-performance 3D text rendering for UI
- **Vite**: Fast build tool with hot module replacement
- **Vitest**: Unit testing framework

---

## Core Systems Design

### 1. Game Loop Architecture

```javascript
class Game {
  constructor() {
    this.fixedTimeStep = 1000 / 60; // 60 Hz for game logic
    this.maxFrameTime = 250; // Prevent spiral of death
    this.accumulator = 0;
    this.lastTime = performance.now();
  }
  
  start() {
    this.vrManager.startSession(() => {
      this.loop();
    });
  }
  
  loop() {
    const currentTime = performance.now();
    let deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;
    
    // Cap delta time
    if (deltaTime > this.maxFrameTime) {
      deltaTime = this.maxFrameTime;
    }
    
    this.accumulator += deltaTime;
    
    // Fixed timestep updates
    while (this.accumulator >= this.fixedTimeStep) {
      this.update(this.fixedTimeStep / 1000);
      this.accumulator -= this.fixedTimeStep;
    }
    
    // Render at VR refresh rate (90/120 Hz)
    const alpha = this.accumulator / this.fixedTimeStep;
    this.render(alpha);
  }
  
  update(dt) {
    // Game logic updates
    this.unitSystem.update(dt);
    this.combatSystem.update(dt);
    this.resourceSystem.update(dt);
    this.aiSystem.update(dt);
  }
  
  render(alpha) {
    // Interpolate positions for smooth rendering
    this.renderer.render(alpha);
  }
}
```

### 2. Entity Component System (Simplified)

```javascript
class Unit {
  constructor(type) {
    this.id = generateId();
    this.type = type;
    
    // Components
    this.transform = { position: vec3, rotation: quat };
    this.movement = { speed, target, path };
    this.combat = { damage, range, attackSpeed, health };
    this.selection = { isSelected: false };
    
    // Rendering reference
    this.instanceId = null;
  }
}
```

### 3. Spatial Partitioning (Quadtree)

```javascript
class Quadtree {
  constructor(bounds, maxObjects = 10, maxLevels = 4, level = 0) {
    this.bounds = bounds; // { x, y, width, height }
    this.maxObjects = maxObjects;
    this.maxLevels = maxLevels;
    this.level = level;
    this.objects = [];
    this.nodes = [];
  }
  
  // Efficient spatial queries for:
  // - Combat range checks
  // - Selection area queries
  // - Collision detection
  queryRange(range) {
    let found = [];
    // Implementation...
    return found;
  }
}
```

**Benefits:**
- O(log n) spatial queries instead of O(n²)
- Critical for 200+ units checking combat range
- Efficient area selection

### 4. Input System (VR Controllers)

```javascript
class VRController {
  constructor(xrController, handedness) {
    this.controller = xrController;
    this.hand = handedness; // 'left' or 'right'
    this.raycaster = new THREE.Raycaster();
    
    // Button state
    this.buttons = {
      trigger: { pressed: false, justPressed: false },
      grip: { pressed: false, justPressed: false },
      thumbstick: { x: 0, y: 0 },
      aButton: { pressed: false, justPressed: false }
    };
  }
  
  update() {
    // Update raycaster from controller position
    const tempMatrix = new THREE.Matrix4();
    tempMatrix.identity().extractRotation(this.controller.matrixWorld);
    
    this.raycaster.ray.origin.setFromMatrixPosition(this.controller.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
  }
  
  getIntersections(objects) {
    return this.raycaster.intersectObjects(objects);
  }
}
```

---

## Rendering Pipeline

### Frame Rendering Order

1. **Update Phase** (Game Logic)
   - Process input
   - Update unit positions
   - Check combat
   - Update resources

2. **Pre-Render Phase**
   - Update instance matrices for all unit types
   - Frustum culling
   - LOD selection
   - Update particle systems

3. **Render Phase** (Per Eye in VR)
   - Clear buffers
   - Render terrain/ground plane
   - Render buildings (batched)
   - Render units (instanced)
   - Render effects (particles, projectiles)
   - Render UI (3D overlays)
   - Render selection indicators

4. **Post-Processing** (Minimal for VR)
   - Bloom on selected units (optional)
   - FXAA anti-aliasing (lightweight)

---

## WebXR Integration

### Session Setup

```javascript
class VRManager {
  async startSession() {
    // Check WebXR support
    if (!navigator.xr) {
      throw new Error('WebXR not supported');
    }
    
    // Request VR session
    const session = await navigator.xr.requestSession('immersive-vr', {
      requiredFeatures: ['local-floor'],
      optionalFeatures: ['hand-tracking', 'layers']
    });
    
    // Setup XR-compatible renderer
    await renderer.xr.setSession(session);
    
    // Setup controllers
    this.setupControllers(session);
    
    // Start render loop (session handles frame callbacks)
    renderer.xr.setAnimationLoop(this.render.bind(this));
  }
  
  setupControllers(session) {
    const inputSources = session.inputSources;
    
    for (let source of inputSources) {
      if (source.handedness === 'right') {
        this.rightController = new VRController(source, 'right');
      } else if (source.handedness === 'left') {
        this.leftController = new VRController(source, 'left');
      }
    }
  }
}
```

### Comfort Settings

```javascript
class VRComfort {
  constructor() {
    this.vignette = true;        // Reduce FOV during movement
    this.snapTurn = true;         // 30° increments vs smooth
    this.snapTurnAngle = 30;
    this.teleport = true;         // Teleport vs smooth locomotion
    this.movementSpeed = 5.0;     // Units per second
  }
  
  applyVignette(intensity) {
    // Shader-based vignette for comfort
    // Reduces FOV during fast movement
  }
}
```

---

## State Management

### Redux-like State Pattern

```javascript
const initialState = {
  player: {
    id: 'player1',
    resources: 1000,
    controlledNodes: [],
    units: [],
    buildings: []
  },
  opponent: {
    // Same structure
  },
  match: {
    timeElapsed: 0,
    victoryCondition: 'annihilation',
    isPaused: false
  }
};

class GameState {
  constructor() {
    this.state = { ...initialState };
    this.listeners = [];
  }
  
  dispatch(action) {
    this.state = this.reducer(this.state, action);
    this.notifyListeners();
  }
  
  reducer(state, action) {
    switch(action.type) {
      case 'SPAWN_UNIT':
        return { ...state, /* new state */ };
      case 'UNIT_DESTROYED':
        return { ...state, /* new state */ };
      // ... other actions
    }
  }
}
```

---

## Performance Monitoring

### Built-in Profiling

```javascript
class PerformanceMonitor {
  constructor() {
    this.frameTimes = [];
    this.maxSamples = 60;
    this.stats = {
      fps: 0,
      frameTime: 0,
      drawCalls: 0,
      triangles: 0,
      units: 0
    };
  }
  
  update(renderer) {
    const info = renderer.info;
    this.stats.drawCalls = info.render.calls;
    this.stats.triangles = info.render.triangles;
    
    // Show warning if falling below target
    if (this.stats.fps < 85) {
      console.warn('FPS drop detected:', this.stats.fps);
    }
  }
}
```

### Debug Mode

- Show FPS counter in VR
- Display draw call count
- Visualize quadtree boundaries
- Show LOD levels with color coding

---

## Network Architecture (Future)

### Client-Server Model with Authoritative Server

```
Client A (VR Browser)  ←→  Server (Node.js)  ←→  Client B (VR Browser)
   - Render                  - Game state           - Render
   - Predict                 - Validation            - Predict
   - Send input              - Broadcast             - Send input
```

**Technologies:**
- **WebRTC**: Peer-to-peer data channels (low latency)
- **WebSocket**: Fallback for signaling
- **Server**: Node.js with authoritative game state
- **Client-side prediction**: Reduce perceived latency

---

## Testing Strategy

### Unit Tests
- Game logic systems (combat calculations, pathfinding)
- State management reducers
- Utility functions

### Integration Tests
- VR controller input simulation
- Full game loop execution
- Network synchronization

### Performance Tests
- Stress test with 200+ units
- Frame time monitoring
- Memory leak detection

### VR-Specific Testing
- Test on multiple headsets
- Comfort testing (motion sickness)
- Controller ergonomics
- UI readability at various distances

---

## Build & Deployment

### Development Build
```bash
npm run dev
# Vite dev server with HMR
# Access via https://localhost:5173 (HTTPS required for WebXR)
```

### Production Build
```bash
npm run build
# Optimized bundle with:
# - Tree shaking
# - Minification
# - Asset compression
# - Source maps (separate)
```

### Deployment Options
1. **Static Hosting**: Vercel, Netlify, GitHub Pages
2. **CDN**: CloudFlare for global distribution
3. **Self-Hosted**: Nginx/Apache with HTTPS

**Requirements:**
- HTTPS (required for WebXR)
- CORS headers for assets
- Compression (gzip/brotli)

---

## Security Considerations

- Content Security Policy (CSP) headers
- Input sanitization (future multiplayer chat)
- Rate limiting on network endpoints
- No sensitive data in client code

---

## Browser Compatibility

### Minimum Requirements
- WebXR Device API support
- WebGL 2.0 support
- ES6 modules support

### Tested Browsers
- Chrome 90+ (recommended)
- Edge 90+
- Firefox 78+ (experimental WebXR)
- Oculus Browser (Quest native)

### Fallback Strategy
- Detect WebXR support on load
- Show error message with instructions if not supported
- Provide link to compatible browser download

---

## Future Technology Considerations

### WebGPU
- Next-gen graphics API (successor to WebGL)
- Better performance and lower-level control
- Monitor adoption before migration
- Three.js will eventually support WebGPU renderer

### WebAssembly
- Compile performance-critical systems to WASM
- Pathfinding, AI calculations
- Physics simulations
- 2-10x performance improvement possible

### Progressive Web App (PWA)
- Installable web app
- Offline capability
- Push notifications for match invites

---

## Development Tools

### Recommended IDE Setup
- VS Code with extensions:
  - ESLint
  - Prettier
  - Three.js Snippets
  - GLSL Syntax Highlighting

### Debugging
- Chrome DevTools
- WebXR Emulator Extension
- Three.js Inspector
- Stats.js for performance overlay

### Version Control
- Git with conventional commits
- Branch strategy: main, develop, feature/*
- CI/CD with GitHub Actions

---

## Resources & References

### Documentation
- Three.js Docs: https://threejs.org/docs/
- WebXR API: https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API
- WebGL Best Practices: https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices

### Learning Resources
- Three.js Journey: https://threejs-journey.com/
- WebXR Samples: https://immersive-web.github.io/webxr-samples/

### Community
- Three.js Discord
- WebXR Community Group
- r/WebVR subreddit

---

## Success Criteria

### Performance Metrics
✅ Must maintain 90 FPS on Meta Quest 2  
✅ Maximum 11ms frame time  
✅ < 50 draw calls per frame  
✅ < 500MB memory usage  

### Technical Achievements
✅ Support 200 units simultaneously  
✅ < 20ms input latency  
✅ No motion sickness reports (>90% comfort rating)  
✅ Load time < 3 seconds  

---

## Next Steps

1. Setup development environment
2. Create basic Three.js + WebXR template
3. Implement unit rendering with instancing
4. Build VR controller input system
5. Create simple combat prototype
6. Performance profiling and optimization

**Let's build something amazing in VR! 🚀**
