# Something Vibe - Development Roadmap

**Version:** 1.0  
**Last Updated:** February 14, 2026  
**Project Status:** Planning Phase

---

## Overview

This roadmap outlines the development phases for Something Vibe, a web-based VR RTS game. The project is structured in iterative phases, focusing on building a solid foundation before adding complexity.

**Estimated Total Development Time:** 12-16 weeks (3-4 months)

---

## Phase 0: Project Setup (Week 1)

### Goals
- Initialize project structure
- Setup development environment
- Establish build pipeline
- Create basic Three.js + WebXR template

### Tasks

#### Day 1-2: Environment Setup
- [ ] Initialize Git repository
- [ ] Setup Node.js project (`npm init`)
- [ ] Install core dependencies (Three.js, Vite)
- [ ] Configure Vite for HTTPS (required for WebXR)
- [ ] Create project directory structure
- [ ] Setup ESLint and Prettier

#### Day 3-4: Basic Three.js Scene
- [ ] Create basic Three.js renderer
- [ ] Setup scene with lighting
- [ ] Add ground plane/grid
- [ ] Implement basic camera controls (non-VR)
- [ ] Add Stats.js for performance monitoring

#### Day 5-7: WebXR Integration
- [ ] Initialize WebXR session handling
- [ ] Implement VR camera rig
- [ ] Setup controller tracking and visualization
- [ ] Add "Enter VR" button
- [ ] Test on VR headset
- [ ] Implement fallback for non-VR browsers

### Deliverables
✅ Working dev environment with hot reload  
✅ Basic 3D scene visible in VR  
✅ Controllers tracked and visible  
✅ Build system configured  

### Success Criteria
- Can enter VR mode successfully
- Controllers are tracked accurately
- Maintains 90 FPS with empty scene
- Can view scene on desktop (fallback)

---

## Phase 1: Core Mechanics Prototype (Weeks 2-4)

### Goals
- Implement basic unit spawning and movement
- Create VR interaction system (selection, commands)
- Build simple combat mechanics
- Establish performance baseline

### Week 2: Unit System Foundation

#### Tasks
- [ ] Create Unit class architecture
- [ ] Implement instanced rendering for units
- [ ] Add object pooling system
- [ ] Create unit spawning mechanism
- [ ] Implement basic movement (pathfinding can be simple line)
- [ ] Add unit state machine (Idle, Moving, Attacking)

#### Deliverables
- [ ] Spawn 50+ units without performance drop
- [ ] Units can move to target positions
- [ ] Instanced rendering working correctly

### Week 3: VR Interaction System

#### Tasks
- [ ] Implement raycast selection from controllers
- [ ] Create selection box (area select) mechanic
- [ ] Add visual feedback for selection (highlight)
- [ ] Implement move command (point and click)
- [ ] Add attack-move command
- [ ] Create unit formation system (basic)
- [ ] Build 3D UI menu for commands

#### Deliverables
- [ ] Can select individual units with controller
- [ ] Can select multiple units with area box
- [ ] Can issue move commands
- [ ] Selected units have visual indicators

### Week 4: Combat & Resources

#### Tasks
- [ ] Implement health system
- [ ] Create damage calculation system
- [ ] Add projectile spawning and movement
- [ ] Implement unit death and removal
- [ ] Create resource node entities
- [ ] Add resource collection mechanic
- [ ] Display resource counter in VR UI
- [ ] Implement unit production (spend resources to spawn)

#### Deliverables
- [ ] Units can attack and destroy each other
- [ ] Projectiles are visible and functional
- [ ] Resources can be collected
- [ ] Can spend resources to create units

### Phase 1 Milestone
🎯 **Playable Prototype**: Can spawn units, move them, fight enemies, and manage basic resources in VR

---

## Phase 2: Game Systems & Content (Weeks 5-8)

### Goals
- Implement all 5 unit types
- Add building system
- Create complete resource economy
- Implement AI opponent
- Add victory conditions

### Week 5: Unit Variety & Balance

#### Tasks
- [ ] Implement Scout unit (fast, low health)
- [ ] Implement Soldier unit (balanced)
- [ ] Implement Tank unit (slow, tanky)
- [ ] Implement Artillery unit (long range, splash damage)
- [ ] Implement Constructor unit (builds structures)
- [ ] Create unit stat balancing spreadsheet
- [ ] Add unit-specific visual effects
- [ ] Implement LOD system for distant units

#### Deliverables
- [ ] All 5 unit types playable and distinct
- [ ] Balance feels reasonable
- [ ] Performance maintained at 200 units

### Week 6: Building System

#### Tasks
- [ ] Create Building base class
- [ ] Implement Command Center
- [ ] Implement Barracks (trains Scout/Soldier)
- [ ] Implement Factory (builds Tank/Artillery)
- [ ] Implement Shield Generator
- [ ] Add construction visualization (progress bar)
- [ ] Create building placement system
- [ ] Add build menu in VR UI
- [ ] Implement fog of war (basic vision system)

#### Deliverables
- [ ] Can place and construct buildings
- [ ] Buildings produce units
- [ ] Shield generator provides protection
- [ ] Build queue system working

### Week 7: AI Opponent

#### Tasks
- [ ] Create AI decision-making system (Behavior Tree or FSM)
- [ ] Implement resource gathering AI
- [ ] Add unit production AI
- [ ] Create attack decision logic
- [ ] Implement basic strategy (rush, economy, etc.)
- [ ] Add difficulty levels (Easy, Medium, Hard)
- [ ] Balance AI to be challenging but fair

#### Deliverables
- [ ] AI can play a full match
- [ ] AI builds units and attacks intelligently
- [ ] AI difficulty is adjustable
- [ ] AI provides good practice opponent

### Week 8: Game Flow & Victory

#### Tasks
- [ ] Implement victory condition checking
- [ ] Add game over screen (3D UI in VR)
- [ ] Create main menu in VR
- [ ] Add match settings (time limit, victory type)
- [ ] Implement pause menu
- [ ] Add match timer display
- [ ] Create post-game statistics screen
- [ ] Add restart/new game functionality

#### Deliverables
- [ ] Complete game loop from menu to victory
- [ ] All victory conditions functional
- [ ] Can start new matches easily

### Phase 2 Milestone
🎯 **Feature Complete Core Game**: Full single-player experience with AI opponent

---

## Phase 3: Polish & Optimization (Weeks 9-10)

### Goals
- Optimize performance for target hardware
- Add visual and audio polish
- Improve VR comfort and UX
- Bug fixing and stability

### Week 9: Performance Optimization

#### Tasks
- [ ] Profile performance on Meta Quest 2
- [ ] Optimize draw calls (target: <50 per frame)
- [ ] Implement aggressive frustum culling
- [ ] Optimize shader complexity
- [ ] Add texture atlasing
- [ ] Implement dynamic quality settings
- [ ] Optimize memory usage
- [ ] Add performance monitoring tools

#### Performance Targets
- [ ] 90 FPS sustained on Quest 2
- [ ] < 11ms frame time
- [ ] < 500MB memory usage
- [ ] No frame drops during intense battles

### Week 10: Polish & Juice

#### Tasks
- [ ] Add particle effects for all weapons
- [ ] Implement screen shake on explosions
- [ ] Add sound effects for all actions
- [ ] Implement spatial 3D audio
- [ ] Create ambient background music
- [ ] Add haptic feedback for controller actions
- [ ] Improve unit death animations
- [ ] Add victory/defeat cinematic moments
- [ ] Polish UI visual design
- [ ] Add loading screen with tips

#### Audio List
- Unit selection click
- Move command confirmation
- Attack sounds (per unit type)
- Building construction sounds
- Explosion effects
- Resource collection
- Victory/defeat stingers
- Ambient music track

### Phase 3 Milestone
🎯 **Polished Experience**: Game feels good to play with professional quality

---

## Phase 4: Content & Tutorial (Week 11)

### Goals
- Create tutorial/onboarding
- Design and build starter map
- Add quality of life features
- Prepare for testing

### Week 11: Tutorial & Content

#### Tasks
- [ ] Design tutorial flow (5-7 steps)
- [ ] Implement tutorial system with step tracking
- [ ] Create tutorial voiceover script (or text)
- [ ] Build "Training Grounds" map
- [ ] Add 2 additional maps with different layouts
- [ ] Implement map selection screen
- [ ] Add control hints/tooltips for first-time users
- [ ] Create quick reference card (accessible in-game)

#### Tutorial Steps
1. VR controls introduction
2. Unit selection practice
3. Movement commands
4. Combat basics
5. Resource collection
6. Building construction
7. First victory (guided match)

### Phase 4 Milestone
🎯 **Player-Ready**: New players can learn and enjoy the game

---

## Phase 5: Testing & Launch Prep (Week 12)

### Goals
- Comprehensive bug testing
- Cross-platform compatibility testing
- Performance validation
- Prepare for launch

### Week 12: Testing & QA

#### Testing Matrix
- [ ] Test on Meta Quest 2
- [ ] Test on Meta Quest 3
- [ ] Test on Valve Index
- [ ] Test on HTC Vive
- [ ] Test in Chrome browser
- [ ] Test in Edge browser
- [ ] Test Oculus Browser (native)
- [ ] Test on various PC specs

#### QA Checklist
- [ ] All unit types function correctly
- [ ] All buildings work as designed
- [ ] AI behaves intelligently
- [ ] Victory conditions trigger properly
- [ ] No game-breaking bugs
- [ ] Performance meets targets on all devices
- [ ] UI is readable and accessible
- [ ] Controls are intuitive
- [ ] Tutorial is clear and helpful

#### Launch Preparation
- [ ] Write README.md with instructions
- [ ] Create gameplay video/trailer
- [ ] Setup deployment pipeline
- [ ] Configure production hosting
- [ ] Prepare press kit/screenshots
- [ ] Write patch notes for version 1.0

### Phase 5 Milestone
🎯 **Launch Ready**: Stable, tested, and ready for public release

---

## Phase 6 (Optional): Multiplayer Foundation (Weeks 13-16)

### Goals
- Add online multiplayer capability
- Implement matchmaking
- Add chat/communication
- Scale for competitive play

### Week 13: Network Architecture

#### Tasks
- [ ] Setup Node.js game server
- [ ] Implement WebSocket communication
- [ ] Create room/lobby system
- [ ] Add player authentication (simple)
- [ ] Implement game state synchronization
- [ ] Add lag compensation
- [ ] Create client-side prediction

### Week 14: Multiplayer Features

#### Tasks
- [ ] Implement 1v1 matchmaking
- [ ] Add 2v2 team mode
- [ ] Create waiting room/lobby UI
- [ ] Add in-game chat (text)
- [ ] Implement reconnection handling
- [ ] Add surrender option
- [ ] Create spectator mode (basic)

### Week 15: Balance & Testing

#### Tasks
- [ ] Balance units for PvP
- [ ] Test netcode with various latencies
- [ ] Add anti-cheat measures
- [ ] Implement rating/ranking system
- [ ] Add match history
- [ ] Create leaderboards
- [ ] Test with external playtesters

### Week 16: Competitive Features

#### Tasks
- [ ] Add ranked mode
- [ ] Implement seasonal leaderboards
- [ ] Create replay system
- [ ] Add tournament mode support
- [ ] Implement reporting system
- [ ] Add cosmetic rewards for wins
- [ ] Polish multiplayer UX

### Phase 6 Milestone
🎯 **Multiplayer Launch**: Competitive online play available

---

## Post-Launch: Live Service (Ongoing)

### Monthly Content Updates

#### Month 1-2 Post-Launch
- Fix critical bugs reported by community
- Balance adjustments based on data
- Add 2 new maps
- Quality of life improvements

#### Month 3-4
- New unit type (#6): "Medic" (heals friendly units)
- New building: "Radar Tower" (extends vision)
- New game mode: "King of the Hill"
- Community map contest

#### Month 5-6
- Campaign mode (5 missions)
- New faction with different units
- Clan/guild system
- Custom game settings

#### Month 7+
- Regular balance patches
- Seasonal events
- Cosmetic skins
- Esports support (if community grows)

---

## Risk Management

### Technical Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| VR performance issues | High | Early optimization, target Quest 2 from start |
| WebXR browser compatibility | Medium | Test early and often, provide fallbacks |
| Multiplayer lag issues | High | Client prediction, lag compensation, regional servers |
| Memory leaks | Medium | Object pooling, regular profiling |

### Scope Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Feature creep | High | Stick to roadmap, defer nice-to-haves |
| Timeline slippage | Medium | Buffer time built in, MVP approach |
| Complexity underestimated | Medium | Break tasks into smaller chunks, re-estimate weekly |

### Market Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Low VR adoption | Medium | Make accessible, market heavily |
| Competitive alternatives | Low | Free web-based USP, unique VR RTS niche |
| Browser changes breaking game | Low | Stay updated on WebXR spec changes |

---

## Resource Requirements

### Team Composition (Ideal)
- 1 Core Developer (Full-stack, Three.js expert)
- 1 Game Designer (Part-time, 50%)
- 1 3D Artist (Part-time, 25% for models/textures)
- 1 Sound Designer (Contract, as needed)
- QA Testers (3-5 volunteers/beta testers)

### Solo Developer Considerations
If developing alone, expect:
- Timeline extended by 50% (18-24 weeks)
- Use asset stores for art/audio
- Focus on programmer art initially
- Community feedback for playtesting

### Budget Estimate (If Outsourcing)
- 3D Art Assets: $500-1000
- Sound Effects & Music: $300-500
- Server Hosting (Multiplayer): $20-50/month
- Domain & Services: $100/year
- **Total First Year**: ~$2,000-2,500

---

## Success Metrics

### Phase-by-Phase KPIs

**Phase 1 (Prototype)**
- [ ] Can complete a 5-minute match
- [ ] Performance: 90+ FPS
- [ ] 0 critical bugs

**Phase 2 (Core Game)**
- [ ] Can defeat AI opponent
- [ ] Match length: 10-15 minutes
- [ ] Tutorial completion rate: >80%

**Phase 3 (Polish)**
- [ ] Player retention: 30%+ return after 1 week
- [ ] Average session: 15-20 minutes
- [ ] Motion sickness reports: <5%

**Launch**
- 100 unique players in first week
- 4.0+ average rating
- <1% critical bug rate

**Post-Launch (3 months)**
- 1,000+ total players
- 20% monthly active users
- 10+ positive reviews/testimonials

---

## Development Principles

### Core Values
1. **Performance First**: Target 90 FPS before adding features
2. **Comfort Matters**: VR comfort is non-negotiable
3. **Iterate Quickly**: Playtest weekly, adjust rapidly
4. **Ship Often**: Regular updates, even if small
5. **Community Driven**: Listen to player feedback

### Best Practices
- **Daily commits**: Keep momentum
- **Weekly playtest**: Test actual gameplay
- **Document decisions**: Keep notes on design choices
- **Celebrate milestones**: Acknowledge progress
- **Stay healthy**: Avoid crunch, sustainable pace

---

## Communication & Collaboration

### Documentation
- Update this roadmap monthly
- Maintain CHANGELOG.md
- Document technical decisions in docs/
- Keep design rationale visible

### Community Engagement
- Dev blog/DevLog video series
- Discord server for testers
- GitHub Discussions for feedback
- Weekly progress updates

### Version Control
- Use semantic versioning (v1.0.0)
- Tag releases properly
- Maintain stable/dev branches
- Write descriptive commit messages

---

## Timeline Visualization

```
Week:  1    2    3    4    5    6    7    8    9    10   11   12
Phase: [0] [------ 1 ------] [-------- 2 --------] [3--] [4] [5]
       Setup  Prototype        Game Systems         Polish  Launch
              └─> Playable     └─> Feature Complete  └─> 1.0
```

**Optional Multiplayer:**
```
Week:  13   14   15   16   17+
Phase: [-------- 6 --------] [Live Service]
       Multiplayer Dev        Updates & Events
       └─> MP Launch
```

---

## Getting Started Checklist

Ready to begin development? Complete these steps:

### Week 1 - Day 1
- [ ] Clone this repository structure
- [ ] Install Node.js (v18+)
- [ ] Run `npm install`
- [ ] Setup HTTPS certificates for local dev
- [ ] Test VR headset connection
- [ ] Star Three.js repo for updates
- [ ] Join Three.js Discord

### First Milestone Goal
**Create a cube in VR that you can look at from different angles.**

Simple, achievable, and proves the entire pipeline works!

---

## Appendix: Quick Reference

### Key Technologies
- **Three.js**: 3D rendering engine
- **WebXR**: VR API standard
- **Vite**: Build tool
- **Node.js**: Multiplayer server (future)

### Essential Links
- Three.js Docs: https://threejs.org/docs/
- WebXR Samples: https://immersive-web.github.io/webxr-samples/
- Meta Quest Developer Hub: https://developer.oculus.com/
- WebGL Best Practices: https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices

### Support & Help
- Three.js Discord: https://discord.gg/56GBJwAnUS
- Stack Overflow: Tag `three.js` + `webxr`
- Reddit: r/webVR, r/threejs, r/gamedev

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Feb 14, 2026 | Initial roadmap created |

---

**Let's build this game step by step! Start with Week 1 and let's create something amazing! 🎮🥽**
