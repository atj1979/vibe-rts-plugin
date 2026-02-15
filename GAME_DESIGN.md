# Something Vibe - VR RTS Game Design Document

**Version:** 1.0  
**Last Updated:** February 14, 2026  
**Platform:** Web Browser (WebXR Compatible)

---

## Executive Summary

Something Vibe is a web-based virtual reality real-time strategy game designed to bring the classic RTS experience into an immersive VR environment. The game emphasizes tactical unit control, resource management, and strategic positioning in a three-dimensional space that players can naturally interact with using VR controllers.

---

## Core Concept

### Vision Statement

Create an accessible, browser-based VR RTS experience that leverages the spatial awareness and natural interaction of VR to enhance traditional RTS gameplay mechanics.

### Target Audience

- VR enthusiasts looking for strategy games
- RTS players curious about VR adaptations
- Casual gamers who want accessible web-based VR experiences

### Unique Selling Points

1. **Zero Installation**: Runs entirely in the browser
2. **Natural Interaction**: Use VR controllers to "grab" and command units
3. **God View**: Overhead tactical perspective enhanced by VR depth perception
4. **Cross-Platform**: Works on Meta Quest, PC VR, and compatible headsets

---

## Game Mechanics

### 1. Unit Control System

#### Selection Mechanics

- **Point-and-Select**: Aim controller laser at units to select
- **Area Selection**: Draw a box in 3D space by holding trigger and moving controller
- **Group Selection**: Double-click trigger on unit type to select all nearby units of that type
- **Formation Assignment**: Physical gesture to arrange units (draw line for line formation, circle for defensive, etc.)

#### Command System

- **Move Command**: Point at ground location and press action button
- **Attack Command**: Point at enemy unit and press attack button
- **Rally Point**: Pinch and drag to set rally points with visual trail
- **Patrol**: Draw a path by holding trigger and moving controller

### 2. Unit Types (Initial Set)

#### Basic Combat Units

1. **Scout** (Light Cube - Blue)
   - Fast movement
   - Low health, low damage
   - Wide vision range
   - Cost: 50 resources

2. **Soldier** (Medium Cube - Green)
   - Balanced stats
   - Medium health, medium damage
   - Standard unit
   - Cost: 100 resources

3. **Tank** (Large Cube - Red)
   - Slow movement
   - High health, high damage
   - Heavy armor
   - Cost: 200 resources

4. **Artillery** (Tall Cube - Yellow)
   - Very slow movement
   - Medium health, very high damage
   - Long range, splash damage
   - Cost: 250 resources

#### Support Units

5. **Constructor** (Cube with Tool Icon - Orange)
   - Moderate movement
   - Low health, no attack
   - Builds structures
   - Cost: 150 resources

### 3. Resource System

#### Resource Types

- **Energy Crystals**: Primary resource for building units and structures
- Collection: Auto-generated from Control Nodes over time

#### Resource Collection

- **Control Nodes**: Scattered across the map
- Capture by moving Constructor near node (5-second capture time)
- Each node generates 10 energy/second
- Visual indicator: pulsing glow matching player color

### 4. Building System

#### Base Structures

1. **Command Center** (Large Platform)
   - Player's main base
   - Spawns Constructor units
   - Loses game if destroyed
   - Health: 5000

2. **Barracks** (Medium Platform)
   - Trains Scout and Soldier units
   - Build Cost: 300 energy
   - Health: 1500

3. **Factory** (Large Platform with Assembly)
   - Produces Tank and Artillery units
   - Build Cost: 500 energy
   - Health: 2000

4. **Shield Generator** (Tower with Dome)
   - Projects protective shield (500 HP) over nearby units
   - Radius: 15 units
   - Build Cost: 400 energy
   - Health: 1000

### 5. Combat Mechanics

#### Damage System

- Simple health/damage model
- Projectile-based attacks (visible tracers)
- Hit detection using raycasting
- Damage types:
  - Direct damage (Scout, Soldier, Tank)
  - Splash damage (Artillery) - 5 unit radius

#### Unit Behaviors

- **Aggressive**: Automatically attack nearby enemies
- **Defensive**: Only attack when attacked
- **Hold Position**: Stay in place regardless of enemies
- **Behavior Toggle**: Quick menu on selected units

### 6. Victory Conditions

#### Standard Match

1. **Annihilation**: Destroy all enemy Command Centers
2. **Domination**: Control 75% of Control Nodes for 3 minutes
3. **Time Limit**: Hold most Control Nodes when timer expires (optional)

---

## VR-Specific Design

### Player Perspective

- **Default View**: Overhead (20-30 units high) looking down at battlefield
- **Height Adjustment**: Smooth vertical movement with thumbstick
- **Rotation**: Snap-turn or smooth rotation based on comfort settings
- **Scale**: Battlefield feels like a tabletop with miniatures

### Comfort Features

- **Teleport Movement**: Option to jump to different areas
- **Vignette**: Reduce field of view during movement to prevent motion sickness
- **Snap Grid**: Units and buildings snap to grid for clarity
- **Comfort Mode**: All camera movement includes fade transition

### Hand Interactions

- **Left Hand**:
  - Menu access (wrist-mounted holographic display)
  - Quick commands wheel
  - Minimap
- **Right Hand**:
  - Primary selection tool (laser pointer)
  - Command placement
  - Building placement

---

## Progression System (Future Enhancement)

### Campaign Mode Ideas

- Tutorial missions teaching mechanics
- Story-driven scenarios with objectives
- Increasing difficulty and unit unlocks
- Boss battles against AI mega-units

### Multiplayer Considerations

- 1v1, 2v2 match options
- Synchronized game state via WebRTC
- Spectator mode with free-cam

---

## Visual & Audio Design

### Art Style

- **Minimalist/Geometric**: Clean shapes for performance
- **Neon Accents**: Bright edges and trails
- **Holographic UI**: Sci-fi themed menus and indicators
- **Color Coding**: Clear team colors (Blue vs Red for 2-player)

### Effects

- **Particle Systems**:
  - Weapon fire trails
  - Explosion effects (lightweight)
  - Building construction sparkles
- **Lighting**:
  - Point lights on active units
  - Ambient battlefield lighting
  - Spotlight on selected units

### Audio

- **Spatial Audio**: 3D positioned sound effects
- **Unit Sounds**: Distinct audio for each unit type
- **Ambient**: Sci-fi background soundtrack
- **Feedback**: Audio confirmation for commands

---

## Map Design

### Starter Map: "Training Grounds"

- Size: 100x100 units
- 6 Control Nodes (symmetrically placed)
- 2 Command Centers (opposite corners)
- Open terrain with scattered obstacles
- Clear sight lines for tactical positioning

### Environmental Elements

- **Obstacles**: Non-destructible blocks that block movement/line of sight
- **Elevated Platforms**: Height advantage for ranged units
- **Choke Points**: Narrow passages for strategic defense

---

## Technical Requirements

### Performance Targets

- **Frame Rate**: Consistent 90 FPS (minimum for VR)
- **Latency**: < 20ms input response time
- **Draw Calls**: Optimize through batching (<100 per frame)
- **Unit Limit**: 200 units per player maximum

### Platform Support

- Meta Quest 2/3 (standalone and PCVR)
- Valve Index
- HTC Vive
- Windows Mixed Reality
- Any WebXR-compatible browser

---

## Monetization (Future Consideration)

- Free to play core game
- Optional cosmetic skins for units
- Map packs
- No pay-to-win elements

---

## VR-Specific Mechanics & Features

### Core VR Mechanics

#### 1. **Spatial UI Panels**

- Immersive UI elements positioned in 3D space around the player's head
- Info, Stats, Building, Production panels positioned at cardinal directions
- No flat-screen overlay; everything integrated into the 3D world
- Supports plugin-defined custom panels for extended functionality

#### 2. **Hand Gesture Controls**

- **Pinch Grip**: Select and grab units/buildings for dragging
- **Point & Trigger**: Aim controller laser to select and command units
- **Swipe Motions**: Quick commands (swipe up = attack, down = defend, etc.)
- **Two-Hand Gestures**: Combined controller actions for complex commands (scale battlefield, rotate view)

#### 3. **Haptic Feedback**

- **Selection Vibration**: Controller pulses when unit/building is selected
- **Attack Confirmation**: Rhythmic pulse when units engage enemies
- **Building Completion**: Distinctive haptic pattern when structures finish constructing
- **Damage Feedback**: Intensity correlates with amount of damage taken by selected units

#### 4. **Scale & Perspective Freedom**

- **Godmode Toggle**: Instantly zoom out to overhead view or zoom in for tactical view
- **Teleport Navigation**: Point and press button to instantly move to that location on the battlefield
- **Height Adjustment**: Move head vertically to scout different elevations without moving physically
- **Perspective Shifting**: Experience the battlefield from unit eye-level or strategic overview

#### 5. **Spatial Audio Design**

- **3D Positional Audio**: Unit sounds (footsteps, gunfire, engines) come from their actual location in the battlefield
- **Spatial Warnings**: Audio cue indicates direction of enemy approach or base under attack
- **Voice Feedback**: Units confirm orders with spatial 3D voice ("Moving out!", "Building complete!")
- **Environmental Ambience**: Battle sounds enhance immersion based on proximity to combat

#### 6. **Immersive Minimap**

- **3D Tactical Map**: Floating holographic minimap that can be interacted with
- **Gesture Control**: Draw attack routes directly on the map with controller motion
- **Depth Indicator**: Visual representation of unit positions in 3D space on the map
- **Fog of War Visualization**: Semi-transparent areas show unexplored regions

#### 7. **Direct Manipulation**

- **Physical Dragging**: Grab and drag units/formations by pinching and moving controller
- **Inertia-Based Movement**: Flick units to send them in a direction with momentum
- **Building Placement**: Grab building templates and place them directly in world space with visual preview
- **Object Rotation**: Rotate buildings/formations with two-hand gestures before confirming placement

#### 8. **Immersive Command Center**

- **Holographic Table**: Interact with a tactical command table at arm's reach
- **Resource Display**: Real-time resource visualization as particles or floating numbers
- **Status Indicators**: Floating health/status bars above units visible in peripheral vision
- **Alert System**: Priority notifications via visual and haptic cues, not intrusive overlays

#### 9. **Environmental Presence**

- **Body Presence**: Your position and head orientation affect what units can see/where you're "standing"
- **Cast Shadows**: Your avatar casts shadows on the battlefield
- **Movement Restriction Zones**: Certain areas may require you to navigate around them physically
- **Depth Perception**: Natural VR depth makes unit positioning and spacing more intuitive

#### 10. **Persistent VR Sessions**

- **Save Spatial State**: Remember player position, camera angle, and UI layout preferences
- **Cross-Session Continuity**: Return to your exact battlefield position and state next session
- **VR-Specific Settings**: FOV sensitivity, UI brightness, haptic intensity stored per headset
- **Motion Profiles**: Different control schemes for standing, sitting, or mobility-limited players

---

## Development Priorities

### Phase 1: Prototype (Core Loop)

1. Basic unit movement and selection
2. Simple combat system
3. Resource generation from Control Nodes
4. VR camera and controls

### Phase 2: Polish & Features

1. All unit types implemented
2. Building system complete
3. AI opponent
4. Visual effects and audio

### Phase 3: Multiplayer & Content

1. Online multiplayer
2. Additional maps
3. Campaign mode
4. Leaderboards

---

## Success Metrics

- Player retention: 30% return rate after first session
- Average session length: 15-20 minutes
- Tutorial completion rate: >70%
- Performance: Maintain 90 FPS on Meta Quest 2

---

## Notes & Ideas for Iteration

- Consider unit abilities (special powers with cooldowns)
- Weather effects that impact gameplay
- Destructible terrain
- Co-op vs AI mode
- Replay system for reviewing matches
- Clan/guild system for competitive play
