# Getting Started - Development Guide

**Quick start guide for starting development on Something Vibe**

---

## ⚡ Quick Start (5 minutes)

### 1. Install Dependencies

```bash
cd something-vibe
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

The server will start at `https://localhost:5173` (HTTPS required for WebXR)

### 3. Open in Browser

Navigate to `https://localhost:5173`

You may see a security warning (self-signed certificate) - this is expected. Click "Advanced" and proceed.

### 4. Test Desktop View

You should see:
- A spinning blue cube
- Performance stats (top right)
- "Enter VR" button (bottom)

### 5. Test VR (Optional)

If you have a VR headset:
1. Connect your headset to PC
2. Click "Enter VR" button
3. Put on headset
4. You should see the scene in 3D

---

## 🛠️ Development Workflow

### File Watching

Vite has hot module replacement (HMR). Changes to files automatically refresh the browser.

**Try it:**
1. Open `src/core/Game.js`
2. Find the `createDemoCube()` method
3. Change the cube color: `color: 0xff0000` (red)
4. Save the file
5. Browser automatically reloads with red cube

### Making Changes

Let's add a second cube to practice the workflow.

**Edit `src/core/Game.js`:**

```javascript
// In the initialize() method, after createDemoCube():
createDemoCube() {
  // ... existing code ...
  
  // Add a second cube
  const geometry2 = new THREE.BoxGeometry(1, 1, 1);
  const material2 = new THREE.MeshStandardMaterial({
    color: 0xff6677, // Pink
    roughness: 0.5,
    metalness: 0.5
  });
  
  const cube2 = new THREE.Mesh(geometry2, material2);
  cube2.position.set(3, 0.5, 0); // Position to the right
  cube2.castShadow = true;
  cube2.receiveShadow = true;
  
  this.scene.add(cube2);
  this.demoCube2 = cube2; // Store reference
}
```

**Update the update() method to animate it:**

```javascript
update(dt) {
  // Existing cube rotation
  if (this.demoCube) {
    this.demoCube.rotation.y += dt * 0.5;
    this.demoCube.rotation.x += dt * 0.3;
  }
  
  // New cube - bounce up and down
  if (this.demoCube2) {
    this.demoCube2.position.y = 0.5 + Math.sin(this.lastTime * 0.001) * 0.5;
  }
}
```

Save and see both cubes animated!

---

## 🎮 Adding a New Feature: Simple Unit Spawner

Let's create a basic unit spawner as an example.

### Step 1: Create Unit Class

Create `src/entities/Unit.js`:

```javascript
/**
 * Basic Unit Entity
 * 
 * PERFORMANCE: Units use instanced rendering
 * For now, this is just data - rendering handled separately
 */

export class Unit {
  constructor(type, position) {
    this.type = type;
    this.position = position.clone(); // Clone to avoid shared reference
    this.velocity = { x: 0, z: 0 };
    this.health = 100;
    this.maxHealth = 100;
    this.speed = 5;
    this.isAlive = true;
  }
  
  /**
   * Update unit logic
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    if (!this.isAlive) return;
    
    // Move based on velocity
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    
    // Simple bounds checking
    const maxDist = 50;
    if (Math.abs(this.position.x) > maxDist || Math.abs(this.position.z) > maxDist) {
      // Bounce off walls
      this.velocity.x *= -1;
      this.velocity.z *= -1;
    }
  }
  
  /**
   * Set target destination (simple direct movement)
   */
  moveTo(targetX, targetZ) {
    const dx = targetX - this.position.x;
    const dz = targetZ - this.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    
    if (dist > 0.1) {
      this.velocity.x = (dx / dist) * this.speed;
      this.velocity.z = (dz / dist) * this.speed;
    }
  }
  
  takeDamage(amount) {
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.isAlive = false;
    }
  }
}
```

### Step 2: Create Unit System

Create `src/systems/UnitSystem.js`:

```javascript
/**
 * Unit System
 * 
 * Manages all units in the game
 * PERFORMANCE: Uses instanced rendering for all units of same type
 */

import * as THREE from 'three';
import { Unit } from '../entities/Unit.js';

export class UnitSystem {
  constructor(scene) {
    this.scene = scene;
    this.units = [];
    
    // Instanced mesh for rendering units
    this.createInstancedMesh();
  }
  
  createInstancedMesh() {
    // Geometry for all units (simple cube for now)
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({
      color: 0x6677ff,
      roughness: 0.7,
      metalness: 0.3
    });
    
    // Create instanced mesh (max 100 units for demo)
    this.instancedMesh = new THREE.InstancedMesh(geometry, material, 100);
    this.instancedMesh.castShadow = true;
    this.instancedMesh.receiveShadow = true;
    this.scene.add(this.instancedMesh);
    
    // Temp matrix for setting instance transforms
    this.tempMatrix = new THREE.Matrix4();
    
    console.log('[UnitSystem] Initialized with instanced rendering');
  }
  
  /**
   * Spawn a new unit
   */
  spawnUnit(x, z) {
    if (this.units.length >= 100) {
      console.warn('Max units reached');
      return null;
    }
    
    const position = new THREE.Vector3(x, 0.5, z);
    const unit = new Unit('soldier', position);
    
    // Give it some random velocity
    unit.velocity.x = (Math.random() - 0.5) * 3;
    unit.velocity.z = (Math.random() - 0.5) * 3;
    
    this.units.push(unit);
    
    console.log(`[UnitSystem] Spawned unit at (${x}, ${z}). Total: ${this.units.length}`);
    return unit;
  }
  
  /**
   * Update all units
   */
  update(dt) {
    // Update unit logic
    this.units.forEach(unit => {
      unit.update(dt);
    });
    
    // Remove dead units
    this.units = this.units.filter(u => u.isAlive);
  }
  
  /**
   * Update visual representation
   */
  render() {
    // Update instance matrices
    this.units.forEach((unit, i) => {
      this.tempMatrix.setPosition(unit.position);
      this.instancedMesh.setMatrixAt(i, this.tempMatrix);
    });
    
    // Mark for GPU update
    this.instancedMesh.instanceMatrix.needsUpdate = true;
    
    // Hide unused instances
    this.instancedMesh.count = this.units.length;
  }
  
  getUnitCount() {
    return this.units.length;
  }
}
```

### Step 3: Integrate into Game

**Edit `src/core/Game.js`:**

Import the system:
```javascript
import { UnitSystem } from '../systems/UnitSystem.js';
```

Initialize in the `initialize()` method:
```javascript
async initialize() {
  // ... existing code ...
  
  // Initialize unit system
  this.unitSystem = new UnitSystem(this.scene);
  
  // Spawn some demo units
  for (let i = 0; i < 10; i++) {
    const x = (Math.random() - 0.5) * 40;
    const z = (Math.random() - 0.5) * 40;
    this.unitSystem.spawnUnit(x, z);
  }
  
  console.log('[Game] Initialization complete');
}
```

Update in the `update()` method:
```javascript
update(dt) {
  // ... existing code ...
  
  // Update unit system
  if (this.unitSystem) {
    this.unitSystem.update(dt);
  }
}
```

Render in the `render()` method:
```javascript
render(alpha) {
  // Update visual positions
  if (this.unitSystem) {
    this.unitSystem.render();
  }
  
  // ... existing code ...
}
```

**Save and test!** You should now see 10 moving cubes bouncing around.

---

## 🎯 Performance Testing

### Check Current Performance

Open the browser console (F12) and check:

1. **FPS Counter** (top right of screen)
   - Should be 60+ FPS
   
2. **Draw Calls** (top right)
   - Should be low (<10 for current demo)
   
3. **Console Warnings**
   - Check for performance warnings

### Stress Test: Add More Units

In `Game.js`, change the spawn count:

```javascript
// Spawn many units
for (let i = 0; i < 50; i++) {
  const x = (Math.random() - 0.5) * 40;
  const z = (Math.random() - 0.5) * 40;
  this.unitSystem.spawnUnit(x, z);
}
```

**What to observe:**
- FPS should stay high (instanced rendering = 1 draw call)
- Frame time should stay low
- No stuttering or frame drops

### Performance Best Practice

Notice how we're using **instanced rendering**:
- 50 units = 1 draw call
- Without instancing = 50 draw calls
- 50x better performance!

---

## 🐛 Debugging Tips

### Issue: Black Screen

**Check:**
1. Browser console for errors (F12)
2. Is HTTPS working? (Required for WebXR)
3. Three.js loaded? Check Network tab
4. Camera position correct?

### Issue: VR Button Disabled

**Check:**
1. Is WebXR supported? Check console
2. VR headset connected?
3. Browser supports WebXR? (Chrome 90+)

### Issue: Low FPS

**Check:**
1. PerformanceMonitor stats (top right)
2. Draw calls count (should be <20)
3. Triangle count (should be <100k)
4. Console warnings

### Issue: Changes Not Showing

**Check:**
1. Did you save the file?
2. Is dev server running?
3. Check browser console for errors
4. Try hard refresh (Ctrl+Shift+R)

---

## 📝 Next Steps

Now that you have the basics working:

1. **Experiment** - Modify colors, positions, add more objects
2. **Read** - Check `docs/WALKTHROUGH.md` for patterns
3. **Add Features** - Try building selection, combat, etc.
4. **Test VR** - Try your changes in a headset

---

## 🎓 Learning Resources

### Three.js
- Official docs: https://threejs.org/docs/
- Examples: https://threejs.org/examples/
- Three.js Journey: https://threejs-journey.com/

### WebXR
- WebXR Device API: https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API
- Samples: https://immersive-web.github.io/webxr-samples/

### Performance
- Three.js Performance: https://discoverthreejs.com/tips-and-tricks/
- WebGL Best Practices: https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices

---

## 🚀 Ready to Build!

You now have:
- ✅ Working VR-ready engine
- ✅ Performance monitoring
- ✅ Example unit system
- ✅ Hot module replacement
- ✅ Development workflow

**Start building your VR RTS game!**
