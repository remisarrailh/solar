// ══════════════════════════════════════════════════════════
//  NEBULA PROTOCOL — Game State
//  Host-authoritative. Clients receive deltas.
// ══════════════════════════════════════════════════════════

import {
  ROOMS, CRISIS_TYPES, ROOM_CRISIS_MAP, DIFFICULTY,
  NPC_MOVE_TICKS, NPCS, FLATLINE_USES_PER_GAME, TRIAGE_BONUS_SECS,
} from './config.js'

// ── ID Generator ───────────────────────────────────────────
let _idCounter = 0
function uid() {
  return 'c' + Date.now() + '_' + (++_idCounter)
}

// ── BFS for room distance ─────────────────────────────────
function roomDistance(fromId, toId) {
  if (fromId === toId) return 0
  const visited = new Set([fromId])
  const queue = [[fromId, 0]]
  while (queue.length) {
    const [current, dist] = queue.shift()
    const room = ROOMS[current]
    if (!room) continue
    for (const neighbor of room.connections) {
      if (neighbor === toId) return dist + 1
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        queue.push([neighbor, dist + 1])
      }
    }
  }
  return 99 // unreachable
}

// ── State Object ───────────────────────────────────────────
export const State = {
  current: null,

  /** Initialize a new game */
  init({ mode, difficulty, players, localPlayerId }) {
    // Deep-clone room definitions
    const rooms = {}
    for (const [id, def] of Object.entries(ROOMS)) {
      rooms[id] = {
        ...def,
        activeCrises: [],
        assignedCrew: [],
        status: 'nominal',
      }
    }

    // Init NPCs for solo
    const npcs = {}
    if (mode === 'solo') {
      for (const [id, def] of Object.entries(NPCS)) {
        npcs[id] = {
          ...def,
          state: 'idle',
          currentRoomId: def.startRoom,
          targetRoomId: null,
          movementTimer: 0,
          repairTimer: 0,
          repairTimerMax: 0,
          assignedCrisisId: null,
        }
      }
    }

    this.current = {
      phase: 'gameplay',
      mode,               // 'multiplayer' | 'solo'
      difficulty,
      tick: 0,
      rooms,
      crises: {},
      players: { ...players },
      npcs,
      shipIntegrity: 100,
      oxygenLevel: 100,
      elapsed: 0,
      nextCrisisIn: randomInt(
        DIFFICULTY[difficulty].crisisInterval[0],
        DIFFICULTY[difficulty].crisisInterval[1]
      ),
      flatlineUsed: 0,
      outcome: null,      // null | 'win' | 'loss'
    }

    // Assign solo player to bridge by default
    if (mode === 'solo' && localPlayerId) {
      if (this.current.players[localPlayerId]) {
        this.current.players[localPlayerId].currentRoomId = 'bridge'
      }
    }

    return this.current
  },

  // ── Crisis Management ─────────────────────────────────
  /** Try to spawn a new crisis. Returns the new crisis or null. */
  spawnCrisis() {
    const state = this.current
    state.nextCrisisIn--
    if (state.nextCrisisIn > 0) return null

    // Reset timer
    const diff = DIFFICULTY[state.difficulty]
    state.nextCrisisIn = randomInt(diff.crisisInterval[0], diff.crisisInterval[1])

    // Pick a room that has capacity
    const eligibleRooms = Object.values(state.rooms).filter(r =>
      r.status !== 'destroyed' &&
      r.activeCrises.length < r.crisisSlots &&
      ROOM_CRISIS_MAP[r.id]?.length > 0
    )
    if (eligibleRooms.length === 0) return null

    const room = eligibleRooms[Math.floor(Math.random() * eligibleRooms.length)]

    // Pick a crisis type valid for this room
    const validTypes = ROOM_CRISIS_MAP[room.id]
    const typeId = validTypes[Math.floor(Math.random() * validTypes.length)]
    const typeDef = CRISIS_TYPES[typeId]
    if (!typeDef) return null

    const crisis = {
      id: uid(),
      type: typeId,
      name: typeDef.name,
      roomId: room.id,
      severity: 1,
      timerMax: typeDef.timerBase,
      timerRemaining: typeDef.timerBase,
      minigame: typeDef.minigame,
      skillType: typeDef.skillType,
      xpBase: typeDef.xpBase,
      state: 'active',
      assignedTo: null,
    }

    state.crises[crisis.id] = crisis
    room.activeCrises.push(crisis.id)
    this._updateRoomStatus(room.id)

    return crisis
  },

  /** Escalate crisis to next severity level */
  escalateCrisis(crisisId) {
    const crisis = this.current.crises[crisisId]
    if (!crisis || crisis.state !== 'active') return null

    crisis.severity = Math.min(3, crisis.severity + 1)

    if (crisis.severity >= 3) {
      // Catastrophic — deal with it
      this._handleCatastrophe(crisis)
      return crisis
    }

    // Reset timer with shorter duration for higher severity
    crisis.timerMax    = Math.max(20, Math.floor(crisis.timerMax * 0.6))
    crisis.timerRemaining = crisis.timerMax
    crisis.assignedTo = null

    this._updateRoomStatus(crisis.roomId)
    return crisis
  },

  /** Mark crisis as being resolved by a player/NPC */
  startResolving(crisisId, assigneeId) {
    const crisis = this.current.crises[crisisId]
    if (!crisis || crisis.state !== 'active') return false
    crisis.state = 'resolving'
    crisis.assignedTo = assigneeId
    return true
  },

  /** Resolve a crisis successfully */
  resolveCrisis(crisisId) {
    const crisis = this.current.crises[crisisId]
    if (!crisis) return null

    crisis.state = 'resolved'
    crisis.timerRemaining = 0

    const room = this.current.rooms[crisis.roomId]
    if (room) {
      room.activeCrises = room.activeCrises.filter(id => id !== crisisId)
      this._updateRoomStatus(room.id)
    }

    return crisis
  },

  /** Release crisis back to 'active' (e.g. player disconnected mid-minigame) */
  releaseCrisis(crisisId) {
    const crisis = this.current.crises[crisisId]
    if (!crisis || crisis.state !== 'resolving') return
    crisis.state = 'active'
    crisis.assignedTo = null
  },

  // ── Game Loop Tick (host only) ─────────────────────────
  /**
   * Called every second by the host game loop.
   * Returns a delta object (only changed fields) for broadcast.
   */
  tick() {
    const state = this.current
    if (state.phase !== 'gameplay') return null

    state.tick++
    state.elapsed++

    const diff = DIFFICULTY[state.difficulty]
    const changedRooms  = new Set()
    const changedCrises = new Set()
    const newCrises     = []
    const escalated     = []
    const resolved      = []

    // 1. Tick crisis timers
    for (const crisis of Object.values(state.crises)) {
      if (crisis.state !== 'active') continue

      // Triage specialization: +15s if a medical-specialized player is in the room
      // (applied once per severity level — tracked via crisis.triageApplied)
      if (crisis.severity === 1 && !crisis.triageApplied) {
        const hasTriage = this._playerWithSpecInRoom(crisis.roomId, 'triage')
        if (hasTriage) {
          crisis.timerRemaining += TRIAGE_BONUS_SECS
          crisis.timerMax += TRIAGE_BONUS_SECS
          crisis.triageApplied = true
        }
      }

      crisis.timerRemaining -= 1
      changedCrises.add(crisis.id)

      if (crisis.timerRemaining <= 0) {
        // Flatline Rev. specialization: auto-resolve once per game
        if (this._hasSpec('flatline_rev') && state.flatlineUsed < FLATLINE_USES_PER_GAME) {
          state.flatlineUsed++
          resolved.push(crisis.id)
          this.resolveCrisis(crisis.id)
        } else {
          escalated.push(crisis.id)
          this.escalateCrisis(crisis.id)
        }
      }
    }

    // 2. Decay ship resources
    let integrityLoss = 0
    for (const crisis of Object.values(state.crises)) {
      if (crisis.state === 'active') {
        integrityLoss += diff.integrityDecay[crisis.severity] ?? 0
      }
    }
    if (integrityLoss > 0) {
      state.shipIntegrity = Math.max(0, state.shipIntegrity - integrityLoss / 10)
    }

    // Oxygen leak decay
    const hasOxygenCrisis = Object.values(state.crises).some(
      c => c.state === 'active' && c.type === 'oxygen_leak'
    )
    if (hasOxygenCrisis) {
      state.oxygenLevel = Math.max(0, state.oxygenLevel - diff.oxygenDecay)
    } else {
      // Slow regeneration
      state.oxygenLevel = Math.min(100, state.oxygenLevel + 0.1)
    }

    // 3. Spawn new crisis
    const newCrisis = this.spawnCrisis()
    if (newCrisis) newCrises.push(newCrisis)

    // 4. NPC ticks (solo mode)
    if (state.mode === 'solo') {
      this._tickNpcs(changedCrises)
    }

    // 5. Check win/loss conditions
    if (state.shipIntegrity <= 0 || state.oxygenLevel <= 0) {
      state.phase = 'gameover'
      state.outcome = 'loss'
    }

    // Build delta
    const delta = {
      tick: state.tick,
      elapsed: state.elapsed,
      shipIntegrity: state.shipIntegrity,
      oxygenLevel: state.oxygenLevel,
      phase: state.phase,
      outcome: state.outcome,
    }

    if (changedCrises.size) {
      delta.crises = {}
      for (const id of changedCrises) {
        if (state.crises[id]) delta.crises[id] = state.crises[id]
      }
    }
    if (newCrises.length)  delta.newCrises = newCrises
    if (escalated.length)  delta.escalated = escalated
    if (resolved.length)   delta.resolved  = resolved
    if (changedRooms.size) {
      delta.rooms = {}
      for (const id of changedRooms) delta.rooms[id] = state.rooms[id]
    }

    return delta
  },

  // ── Delta Application (clients) ───────────────────────
  applyDelta(delta) {
    const state = this.current
    if (!state) return

    if (delta.tick !== undefined)         state.tick          = delta.tick
    if (delta.elapsed !== undefined)      state.elapsed       = delta.elapsed
    if (delta.shipIntegrity !== undefined) state.shipIntegrity = delta.shipIntegrity
    if (delta.oxygenLevel !== undefined)  state.oxygenLevel   = delta.oxygenLevel
    if (delta.phase !== undefined)        state.phase         = delta.phase
    if (delta.outcome !== undefined)      state.outcome       = delta.outcome

    if (delta.crises) {
      for (const [id, c] of Object.entries(delta.crises)) {
        state.crises[id] = c
        // Update room references
        const room = state.rooms[c.roomId]
        if (room && !room.activeCrises.includes(id)) room.activeCrises.push(id)
      }
    }
    if (delta.newCrises) {
      for (const c of delta.newCrises) {
        state.crises[c.id] = c
        const room = state.rooms[c.roomId]
        if (room && !room.activeCrises.includes(c.id)) room.activeCrises.push(c.id)
        this._updateRoomStatus(c.roomId)
      }
    }
    if (delta.resolved) {
      for (const id of delta.resolved) {
        if (state.crises[id]) state.crises[id].state = 'resolved'
        this._cleanupResolvedCrisis(id)
      }
    }
    if (delta.rooms) {
      for (const [id, r] of Object.entries(delta.rooms)) state.rooms[id] = r
    }
    if (delta.players) {
      for (const [id, p] of Object.entries(delta.players)) state.players[id] = p
    }
  },

  // ── Player Management ─────────────────────────────────
  addPlayer(player) {
    this.current.players[player.peerId] = player
  },

  removePlayer(peerId) {
    // Release any crises they were resolving
    for (const crisis of Object.values(this.current.crises)) {
      if (crisis.assignedTo === peerId && crisis.state === 'resolving') {
        this.releaseCrisis(crisis.id)
      }
    }
    delete this.current.players[peerId]
  },

  movePlayer(peerId, roomId) {
    const player = this.current.players[peerId]
    if (player && this.current.rooms[roomId]) {
      player.currentRoomId = roomId
    }
  },

  // ── NPC Management (Solo) ─────────────────────────────
  dispatchNpc(npcId, targetRoomId) {
    const npc = this.current.npcs[npcId]
    const room = this.current.rooms[targetRoomId]
    if (!npc || !room || npc.state === 'incapacitated') return false

    npc.targetRoomId = targetRoomId
    npc.state = 'moving'
    const dist = roomDistance(npc.currentRoomId, targetRoomId)
    npc.movementTimer = Math.max(1, dist * NPC_MOVE_TICKS)
    return true
  },

  // ── Private Helpers ───────────────────────────────────
  _tickNpcs(changedCrises) {
    const state = this.current
    for (const npc of Object.values(state.npcs)) {
      if (npc.state === 'moving') {
        npc.movementTimer--
        if (npc.movementTimer <= 0) {
          npc.currentRoomId = npc.targetRoomId
          npc.targetRoomId = null
          npc.state = 'idle'
          // Check if there's a crisis to auto-assign
          this._tryAssignNpcToCrisis(npc)
        }
      } else if (npc.state === 'repairing') {
        npc.repairTimer--
        if (npc.repairTimer <= 0) {
          const crisisId = npc.assignedCrisisId
          if (crisisId) {
            this.resolveCrisis(crisisId)
            changedCrises.add(crisisId)
          }
          npc.state = 'idle'
          npc.assignedCrisisId = null
          npc.repairTimer = 0
          npc.repairTimerMax = 0
        }
      } else if (npc.state === 'idle') {
        this._tryAssignNpcToCrisis(npc)
      }
    }

    // Auto-dispatch idle NPCs if Commander hasn't acted recently
    const crises = Object.values(state.crises).filter(c => c.state === 'active' && !c.assignedTo)
    for (const crisis of crises) {
      if (!crisis.autoDispatchTimer) crisis.autoDispatchTimer = 0
      crisis.autoDispatchTimer++
      if (crisis.autoDispatchTimer >= 10) {
        // Find best idle NPC
        const idleNpcs = Object.values(state.npcs).filter(n => n.state === 'idle')
        if (idleNpcs.length) {
          const best = idleNpcs.sort(
            (a, b) => (b.skills[crisis.skillType] ?? 0) - (a.skills[crisis.skillType] ?? 0)
          )[0]
          if ((best.skills[crisis.skillType] ?? 0) > 0) {
            this.dispatchNpc(best.id, crisis.roomId)
            crisis.autoDispatchTimer = 0
          }
        }
      }
    }
  },

  _tryAssignNpcToCrisis(npc) {
    const state = this.current
    const roomCrises = Object.values(state.crises).filter(
      c => c.roomId === npc.currentRoomId && c.state === 'active' && !c.assignedTo
    )
    if (roomCrises.length === 0) return

    // Best match by skill
    const crisis = roomCrises.sort(
      (a, b) => (npc.skills[b.skillType] ?? 0) - (npc.skills[a.skillType] ?? 0)
    )[0]

    const skill = npc.skills[crisis.skillType] ?? 1
    const repairTime = Math.max(5, 30 - (skill * 3))
    npc.state = 'repairing'
    npc.assignedCrisisId = crisis.id
    npc.repairTimer = repairTime
    npc.repairTimerMax = repairTime
    crisis.assignedTo = npc.id
    crisis.state = 'resolving'
  },

  _handleCatastrophe(crisis) {
    const state = this.current
    crisis.state = 'escalated'
    const room = state.rooms[crisis.roomId]
    if (room) {
      room.status = 'destroyed'
      room.activeCrises = room.activeCrises.filter(id => id !== crisis.id)
      // Damage ship
      state.shipIntegrity = Math.max(0, state.shipIntegrity - 20)
      // Incapacitate NPCs in room
      for (const npc of Object.values(state.npcs)) {
        if (npc.currentRoomId === crisis.roomId) {
          npc.state = 'incapacitated'
          npc.assignedCrisisId = null
        }
      }
    }
  },

  _updateRoomStatus(roomId) {
    const room = this.current.rooms[roomId]
    if (!room || room.status === 'destroyed') return

    const activeCrises = room.activeCrises
      .map(id => this.current.crises[id])
      .filter(c => c && (c.state === 'active' || c.state === 'resolving'))

    if (activeCrises.length === 0) {
      room.status = 'nominal'
    } else if (activeCrises.some(c => c.severity >= 2)) {
      room.status = 'critical'
    } else {
      room.status = 'warning'
    }
  },

  _cleanupResolvedCrisis(crisisId) {
    const crisis = this.current.crises[crisisId]
    if (!crisis) return
    const room = this.current.rooms[crisis.roomId]
    if (room) {
      room.activeCrises = room.activeCrises.filter(id => id !== crisisId)
      this._updateRoomStatus(room.id)
    }
  },

  _playerWithSpecInRoom(roomId, specId) {
    return Object.values(this.current.players).some(p => {
      if (p.currentRoomId !== roomId) return false
      for (const skill of Object.values(p.progression?.skills ?? {})) {
        if (skill.spec === specId) return true
      }
      return false
    })
  },

  _hasSpec(specId) {
    // Solo mode: check local profile via caller (main.js passes it)
    // This method is overridden by main.js after init
    return false
  },

  /** Get all active crises in a specific room */
  getCrisesInRoom(roomId) {
    return Object.values(this.current.crises).filter(
      c => c.roomId === roomId && (c.state === 'active' || c.state === 'resolving')
    )
  },

  /** Snapshot of current state for network broadcast */
  snapshot() {
    return JSON.parse(JSON.stringify(this.current))
  },

  /** Compute a delta between two full states */
  computeDelta(prev, next) {
    // Simplified: send full crises + key stats each tick
    return {
      tick:          next.tick,
      elapsed:       next.elapsed,
      shipIntegrity: next.shipIntegrity,
      oxygenLevel:   next.oxygenLevel,
      phase:         next.phase,
      outcome:       next.outcome,
      crises:        next.crises,
      rooms:         next.rooms,
      players:       next.players,
    }
  },
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
