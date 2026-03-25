// ══════════════════════════════════════════════════════════
//  NEBULA PROTOCOL — Game State (Svelte store wrapper)
//  Host-authoritative. Clients receive deltas.
// ══════════════════════════════════════════════════════════

import { writable } from 'svelte/store'
import {
  ROOMS, CRISIS_TYPES, ROOM_CRISIS_MAP, DIFFICULTY,
  NPC_MOVE_TICKS, NPCS, FLATLINE_USES_PER_GAME, TRIAGE_BONUS_SECS,
  CONTROLLER_ACTIONS, TECH_SLOTS, INJURY_EVENTS,
} from './config.js'

// ── Reactive store ──────────────────────────────────────
// Subscribe to this in components to get reactive game state updates.
export const gameState = writable(null)

// Internal helper: push current state to the store
function _push() {
  gameState.set(State.current ? { ...State.current } : null)
}

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
  return 99
}

// ── State Object ───────────────────────────────────────────
export const State = {
  current: null,

  init({ mode, difficulty, players, localPlayerId }) {
    const rooms = {}
    for (const [id, def] of Object.entries(ROOMS)) {
      rooms[id] = {
        ...def,
        activeCrises: [],
        assignedCrew: [],
        status: 'nominal',
      }
    }

    // Tech slots: in solo mode all are player-controlled; in multiplayer they start AI-controlled
    // A player can "claim" a slot by sending MSG.TECH_SLOT_REQUEST
    const techSlots = TECH_SLOTS.map(def => ({
      ...def,
      currentRoomId: def.startRoom,
      state: 'idle',
      assignedCrisisId: null,
      claimedBy: null,   // peerId of player who controls this slot, null = AI
      injured: false,
      injuryCause: null,
    }))

    this.current = {
      phase: 'gameplay',
      mode,
      difficulty,
      tick: 0,
      rooms,
      crises: {},
      players: { ...players },
      npcs: {},            // kept for compatibility but unused
      techSlots,
      shipIntegrity: 100,
      oxygenLevel: 100,
      elapsed: 0,
      nextCrisisIn: randomInt(
        DIFFICULTY[difficulty].crisisInterval[0],
        DIFFICULTY[difficulty].crisisInterval[1]
      ),
      flatlineUsed: 0,
      outcome: null,
      // New fields
      anomalies: {},       // roomId → { crisisId, confirmed, spawnTick }
      controllerActions: Object.fromEntries(
        Object.keys(CONTROLLER_ACTIONS).map(id => [id, { cooldown: 0 }])
      ),
      distressSignals: [], // [{ fromId, fromName, roomId, tick }]
      oxygenBoost: 0,
      soloView: mode === 'solo' ? 'controller' : null,
    }

    if (localPlayerId && this.current.players[localPlayerId]) {
      this.current.players[localPlayerId].currentRoomId = 'bridge'
    }

    _push()
    return this.current
  },

  spawnCrisis() {
    const state = this.current
    state.nextCrisisIn--
    if (state.nextCrisisIn > 0) return null

    const diff = DIFFICULTY[state.difficulty]
    state.nextCrisisIn = randomInt(diff.crisisInterval[0], diff.crisisInterval[1])

    const eligibleRooms = Object.values(state.rooms).filter(r =>
      r.status !== 'destroyed' &&
      r.activeCrises.length < r.crisisSlots &&
      ROOM_CRISIS_MAP[r.id]?.length > 0
    )
    if (eligibleRooms.length === 0) return null

    const room = eligibleRooms[Math.floor(Math.random() * eligibleRooms.length)]
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

    // Add camera anomaly for controller to detect — confirming gives +15s bonus
    if (!state.anomalies[room.id]) {
      state.anomalies[room.id] = { crisisId: crisis.id, confirmed: false, spawnTick: state.tick }
    }

    return crisis
  },

  escalateCrisis(crisisId) {
    const crisis = this.current.crises[crisisId]
    if (!crisis || crisis.state !== 'active') return null

    crisis.severity = Math.min(3, crisis.severity + 1)

    if (crisis.severity >= 3) {
      this._handleCatastrophe(crisis)
      return crisis
    }

    crisis.timerMax    = Math.max(20, Math.floor(crisis.timerMax * 0.6))
    crisis.timerRemaining = crisis.timerMax
    crisis.assignedTo = null

    this._updateRoomStatus(crisis.roomId)
    return crisis
  },

  startResolving(crisisId, assigneeId) {
    const crisis = this.current.crises[crisisId]
    if (!crisis || crisis.state !== 'active') return false
    crisis.state = 'resolving'
    crisis.assignedTo = assigneeId
    return true
  },

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

  releaseCrisis(crisisId) {
    const crisis = this.current.crises[crisisId]
    if (!crisis || crisis.state !== 'resolving') return
    crisis.state = 'active'
    crisis.assignedTo = null
  },

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

    // Tick controller action cooldowns
    for (const action of Object.values(state.controllerActions)) {
      if (action.cooldown > 0) action.cooldown--
    }

    // Tick oxygen boost effect
    if (state.oxygenBoost > 0) {
      state.oxygenBoost--
      state.oxygenLevel = Math.min(100, state.oxygenLevel + 0.5)
    }

    // Tick room-level effects
    for (const room of Object.values(state.rooms)) {
      if (room.openAccess > 0) room.openAccess--
      if (room.powerBoosted > 0) room.powerBoosted--
    }

    for (const crisis of Object.values(state.crises)) {
      if (crisis.state !== 'active') continue

      if (crisis.severity === 1 && !crisis.triageApplied) {
        const hasTriage = this._playerWithSpecInRoom(crisis.roomId, 'triage')
        if (hasTriage) {
          crisis.timerRemaining += TRIAGE_BONUS_SECS
          crisis.timerMax += TRIAGE_BONUS_SECS
          crisis.triageApplied = true
        }
      }

      // Frozen crises (lockdown action) don't tick
      if (crisis.frozen > 0) {
        crisis.frozen--
        changedCrises.add(crisis.id)
        continue
      }

      crisis.timerRemaining -= 1
      changedCrises.add(crisis.id)

      if (crisis.timerRemaining <= 0) {
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

    // Clean up stale anomalies
    for (const [roomId, anomaly] of Object.entries(state.anomalies)) {
      const c = state.crises[anomaly.crisisId]
      if (!c || c.state === 'resolved' || c.state === 'escalated') {
        delete state.anomalies[roomId]
      }
    }

    let integrityLoss = 0
    for (const crisis of Object.values(state.crises)) {
      if (crisis.state === 'active') {
        integrityLoss += diff.integrityDecay[crisis.severity] ?? 0
      }
    }
    if (integrityLoss > 0) {
      state.shipIntegrity = Math.max(0, state.shipIntegrity - integrityLoss / 10)
    }

    const hasOxygenCrisis = Object.values(state.crises).some(
      c => c.state === 'active' && c.type === 'oxygen_leak'
    )
    if (hasOxygenCrisis) {
      state.oxygenLevel = Math.max(0, state.oxygenLevel - diff.oxygenDecay)
    } else {
      state.oxygenLevel = Math.min(100, state.oxygenLevel + 0.1)
    }

    const newCrisis = this.spawnCrisis()
    if (newCrisis) newCrises.push(newCrisis)

    // AI for unclaimed tech slots (both solo and multiplayer)
    this._tickUnclaimedSlots(changedCrises)

    if (state.shipIntegrity <= 0 || state.oxygenLevel <= 0) {
      state.phase = 'gameover'
      state.outcome = 'loss'
    }

    const delta = {
      tick: state.tick,
      elapsed: state.elapsed,
      shipIntegrity: state.shipIntegrity,
      oxygenLevel: state.oxygenLevel,
      phase: state.phase,
      outcome: state.outcome,
      anomalies: state.anomalies,
      controllerActions: state.controllerActions,
      techSlots: state.techSlots,
    }
    if (state.distressSignals.length) delta.distressSignals = state.distressSignals

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

    _push()
    return delta
  },

  applyDelta(delta) {
    // If no state yet, treat a full-snapshot delta as initialization
    if (!this.current) {
      if (delta.phase && delta.rooms && delta.players) {
        this.current = JSON.parse(JSON.stringify(delta))
        _push()
      }
      return
    }
    const state = this.current

    if (delta.tick !== undefined)          state.tick          = delta.tick
    if (delta.elapsed !== undefined)       state.elapsed       = delta.elapsed
    if (delta.shipIntegrity !== undefined) state.shipIntegrity = delta.shipIntegrity
    if (delta.oxygenLevel !== undefined)   state.oxygenLevel   = delta.oxygenLevel
    if (delta.phase !== undefined)         state.phase         = delta.phase
    if (delta.outcome !== undefined)       state.outcome       = delta.outcome

    if (delta.crises) {
      for (const [id, c] of Object.entries(delta.crises)) {
        state.crises[id] = c
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
    if (delta.techSlots)         state.techSlots        = delta.techSlots
    if (delta.anomalies)         state.anomalies        = delta.anomalies
    if (delta.controllerActions) state.controllerActions = delta.controllerActions
    if (delta.distressSignals)   state.distressSignals  = delta.distressSignals

    _push()
  },

  addPlayer(player) {
    this.current.players[player.peerId] = player
    _push()
  },

  removePlayer(peerId) {
    for (const crisis of Object.values(this.current.crises)) {
      if (crisis.assignedTo === peerId && crisis.state === 'resolving') {
        this.releaseCrisis(crisis.id)
      }
    }
    delete this.current.players[peerId]
    _push()
  },

  movePlayer(peerId, roomId) {
    const player = this.current.players[peerId]
    if (player && this.current.rooms[roomId]) {
      player.currentRoomId = roomId
      _push()
    }
  },

  dispatchNpc(npcId, targetRoomId) {
    const npc = this.current.npcs[npcId]
    const room = this.current.rooms[targetRoomId]
    if (!npc || !room || npc.state === 'incapacitated') return false

    npc.targetRoomId = targetRoomId
    npc.state = 'moving'
    const dist = roomDistance(npc.currentRoomId, targetRoomId)
    npc.movementTimer = Math.max(1, dist * NPC_MOVE_TICKS)
    _push()
    return true
  },

  getCrisesInRoom(roomId) {
    return Object.values(this.current.crises).filter(
      c => c.roomId === roomId && (c.state === 'active' || c.state === 'resolving')
    )
  },

  snapshot() {
    return JSON.parse(JSON.stringify(this.current))
  },

  computeDelta(prev, next) {
    return {
      tick:             next.tick,
      elapsed:          next.elapsed,
      shipIntegrity:    next.shipIntegrity,
      oxygenLevel:      next.oxygenLevel,
      phase:            next.phase,
      outcome:          next.outcome,
      crises:           next.crises,
      rooms:            next.rooms,
      players:          next.players,
      techSlots:        next.techSlots,
      anomalies:        next.anomalies,
      controllerActions: next.controllerActions,
      distressSignals:  next.distressSignals,
    }
  },

  // ── Controller Actions ────────────────────────────────
  confirmAnomaly(roomId) {
    const anomaly = this.current.anomalies[roomId]
    if (!anomaly || anomaly.confirmed) return false
    anomaly.confirmed = true
    const crisis = this.current.crises[anomaly.crisisId]
    if (crisis && crisis.state === 'active') {
      const bonus = 15
      crisis.timerRemaining = Math.min(crisis.timerMax + bonus, crisis.timerRemaining + bonus)
      crisis.timerMax += bonus
    }
    _push()
    return true
  },

  triggerControllerAction(actionId, targetRoomId = null) {
    const state = this.current
    const actionState = state.controllerActions[actionId]
    const actionDef = CONTROLLER_ACTIONS[actionId]
    if (!actionState || !actionDef || actionState.cooldown > 0) return false

    // Check if controlling system is impaired
    const sysRoom = state.rooms[actionDef.system]
    if (sysRoom) {
      const impaired = sysRoom.activeCrises.some(id => {
        const c = state.crises[id]
        return c && c.state === 'active' && actionDef.affectedBy.includes(c.type)
      })
      if (impaired) return false
    }

    actionState.cooldown = actionDef.cooldown

    // Apply effect
    if (actionId === 'boost_oxygen') {
      state.oxygenBoost = 15
    } else if (actionId === 'reroute_power' && targetRoomId) {
      const room = state.rooms[targetRoomId]
      if (room) room.powerBoosted = 20
    } else if (actionId === 'open_access' && targetRoomId) {
      const room = state.rooms[targetRoomId]
      if (room) room.openAccess = 20
    } else if (actionId === 'lockdown' && targetRoomId) {
      for (const crisis of Object.values(state.crises)) {
        if (crisis.roomId === targetRoomId && crisis.state === 'active') {
          crisis.frozen = (crisis.frozen ?? 0) + 10
        }
      }
    }

    _push()
    return true
  },

  sendDistress(fromId, fromName, roomId) {
    const state = this.current
    state.distressSignals.unshift({ fromId, fromName, roomId, tick: state.tick })
    if (state.distressSignals.length > 5) state.distressSignals.pop()
    _push()
  },

  // ── Tech Slot Management ──────────────────────────────
  claimTechSlot(slotId, peerId) {
    const slot = this.current.techSlots.find(t => t.id === slotId)
    if (!slot || slot.claimedBy) return false
    slot.claimedBy = peerId
    _push()
    return true
  },

  releaseTechSlot(peerId) {
    for (const slot of this.current.techSlots) {
      if (slot.claimedBy === peerId) {
        slot.claimedBy = null
        if (slot.assignedCrisisId) this.releaseCrisis(slot.assignedCrisisId)
        slot.assignedCrisisId = null
        slot.state = 'idle'
      }
    }
    _push()
  },

  moveTech(slotId, roomId) {
    const state = this.current
    const slot = state.techSlots.find(t => t.id === slotId)
    if (!slot || !state.rooms[roomId]) return false
    if (slot.state === 'resolving' || slot.state === 'carried' || slot.injured) return false
    slot.currentRoomId = roomId
    // Move any carried injured tech along
    if (slot.carrying) {
      const carried = state.techSlots.find(t => t.id === slot.carrying)
      if (carried) carried.currentRoomId = roomId
    }
    _push()
    return true
  },

  startCarrying(carrierId, injuredSlotId) {
    const state = this.current
    const carrier = state.techSlots.find(t => t.id === carrierId)
    const injured = state.techSlots.find(t => t.id === injuredSlotId)
    if (!carrier || !injured) return false
    if (!injured.injured || carrier.currentRoomId !== injured.currentRoomId) return false
    if (carrier.carrying || carrier.injured || carrier.state === 'resolving') return false
    carrier.carrying = injuredSlotId
    injured.state = 'carried'
    _push()
    return true
  },

  stopCarrying(carrierId) {
    const state = this.current
    const carrier = state.techSlots.find(t => t.id === carrierId)
    if (!carrier || !carrier.carrying) return
    const injured = state.techSlots.find(t => t.id === carrier.carrying)
    if (injured) injured.state = 'injured'
    carrier.carrying = null
    _push()
  },

  startTechCrisis(slotId, crisisId) {
    const state = this.current
    const slot = state.techSlots.find(t => t.id === slotId)
    const crisis = state.crises[crisisId]
    if (!slot || !crisis || crisis.state !== 'active') return false
    if (slot.currentRoomId !== crisis.roomId || slot.injured) return false

    // Cooperative crisis: phase 1
    const typeDef = CRISIS_TYPES[crisis.type]
    if (typeDef?.cooperative) {
      if (crisis.coopPhase1Done) return false   // phase 1 already done
      crisis.coopPhase1Done = true
      crisis.coopPhase1By = slotId
      slot.assignedCrisisId = crisisId
      slot.state = 'resolving'
      // Don't lock crisis to "resolving" — it stays "active" awaiting phase 2
      _push()
      return true
    }

    slot.assignedCrisisId = crisisId
    slot.state = 'resolving'
    this.startResolving(crisisId, slotId)
    _push()
    return true
  },

  // Phase 2 of a cooperative crisis — must be done by a different tech
  startCoopPhase2(slotId, crisisId) {
    const state = this.current
    const slot = state.techSlots.find(t => t.id === slotId)
    const crisis = state.crises[crisisId]
    if (!slot || !crisis) return false
    if (!crisis.coopPhase1Done) return false            // phase 1 not done yet
    if (crisis.coopPhase1By === slotId) return false    // can't do both phases
    if (slot.currentRoomId !== crisis.roomId || slot.injured) return false
    if (crisis.state === 'resolving') return false       // already locked

    slot.assignedCrisisId = crisisId
    slot.state = 'resolving'
    this.startResolving(crisisId, slotId)
    _push()
    return true
  },

  finishTechCrisis(slotId, success) {
    const state = this.current
    const slot = state.techSlots.find(t => t.id === slotId)
    if (!slot || !slot.assignedCrisisId) return
    const crisis = state.crises[slot.assignedCrisisId]
    const typeDef = crisis ? CRISIS_TYPES[crisis.type] : null

    if (typeDef?.cooperative && crisis.coopPhase1By === slotId) {
      // Finished phase 1 of cooperative crisis
      if (!success) {
        crisis.coopPhase1Done = false
        crisis.coopPhase1By = null
      }
      slot.assignedCrisisId = null
      slot.state = 'idle'
    } else {
      // Regular or coop phase 2
      if (success) {
        this.resolveCrisis(slot.assignedCrisisId)
      } else {
        this.releaseCrisis(slot.assignedCrisisId)
        if (crisis) {
          crisis.coopPhase1Done = false
          crisis.coopPhase1By = null
        }
      }
      slot.assignedCrisisId = null
      slot.state = 'idle'
    }
    _push()
  },

  healTech(slotId) {
    const slot = this.current.techSlots.find(t => t.id === slotId)
    if (!slot) return
    slot.injured = false
    slot.injuryCause = null
    slot.injuryType = null
    slot.state = 'idle'
    _push()
  },

  // ── Solo View Switching ───────────────────────────────
  setSoloView(view) {
    this.current.soloView = view
    _push()
  },

  // ── Private ───────────────────────────────────────────

  // AI movement and repair for tech slots not claimed by a human player
  _tickUnclaimedSlots(changedCrises) {
    const state = this.current

    for (const slot of state.techSlots) {
      if (slot.claimedBy) continue              // human player controls this slot
      if (state.mode === 'solo') continue       // in solo mode player controls all slots manually
      if (slot.injured || slot.state === 'carried') continue

      if (slot.state === 'moving') {
        slot.movementTimer = (slot.movementTimer ?? 0) - 1
        if (slot.movementTimer <= 0) {
          slot.currentRoomId = slot.targetRoomId ?? slot.currentRoomId
          slot.targetRoomId = null
          slot.state = 'idle'
          this._tryAssignSlotToCrisis(slot)
        }
      } else if (slot.state === 'repairing') {
        slot.repairTimer = (slot.repairTimer ?? 0) - 1
        if (slot.repairTimer <= 0) {
          if (slot.assignedCrisisId) {
            this.resolveCrisis(slot.assignedCrisisId)
            changedCrises.add(slot.assignedCrisisId)
          }
          slot.state = 'idle'
          slot.assignedCrisisId = null
        }
      } else if (slot.state === 'idle') {
        this._tryAssignSlotToCrisis(slot)
      }
    }

    if (state.mode === 'solo') return

    // Auto-dispatch idle AI slots toward unassigned crises
    const unassigned = Object.values(state.crises).filter(
      c => c.state === 'active' && !c.assignedTo && !c.coopPhase1Done
    )
    for (const crisis of unassigned) {
      crisis.autoDispatchTimer = (crisis.autoDispatchTimer ?? 0) + 1
      if (crisis.autoDispatchTimer < 8) continue
      const idleSlots = state.techSlots.filter(s => s.state === 'idle' && !s.claimedBy && !s.injured)
      if (!idleSlots.length) continue
      const best = idleSlots.sort(
        (a, b) => (b.skills[crisis.skillType] ?? 0) - (a.skills[crisis.skillType] ?? 0)
      )[0]
      if ((best.skills[crisis.skillType] ?? 0) > 0) {
        this._dispatchSlotTo(best, crisis.roomId)
        crisis.autoDispatchTimer = 0
      }
    }
  },

  _dispatchSlotTo(slot, targetRoomId) {
    if (!this.current.rooms[targetRoomId]) return
    slot.targetRoomId = targetRoomId
    slot.state = 'moving'
    const dist = roomDistance(slot.currentRoomId, targetRoomId)
    slot.movementTimer = Math.max(1, dist * NPC_MOVE_TICKS)
  },

  _tryAssignSlotToCrisis(slot) {
    const state = this.current
    const roomCrises = Object.values(state.crises).filter(
      c => c.roomId === slot.currentRoomId && c.state === 'active' && !c.assignedTo
    )
    if (!roomCrises.length) return

    const crisis = roomCrises.sort(
      (a, b) => (slot.skills[b.skillType] ?? 0) - (slot.skills[a.skillType] ?? 0)
    )[0]

    const skill = slot.skills[crisis.skillType] ?? 1
    const repairTime = Math.max(5, 30 - skill * 3)
    slot.state = 'repairing'
    slot.assignedCrisisId = crisis.id
    slot.repairTimer = repairTime
    crisis.assignedTo = slot.id
    crisis.state = 'resolving'
  },

  _tickNpcs(changedCrises) {
    const state = this.current
    for (const npc of Object.values(state.npcs)) {
      if (npc.state === 'moving') {
        npc.movementTimer--
        if (npc.movementTimer <= 0) {
          npc.currentRoomId = npc.targetRoomId
          npc.targetRoomId = null
          npc.state = 'idle'
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

    const crises = Object.values(state.crises).filter(c => c.state === 'active' && !c.assignedTo)
    for (const crisis of crises) {
      if (!crisis.autoDispatchTimer) crisis.autoDispatchTimer = 0
      crisis.autoDispatchTimer++
      if (crisis.autoDispatchTimer >= 10) {
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
      state.shipIntegrity = Math.max(0, state.shipIntegrity - 20)

      // Injure any technicians present in the room
      const injuryDef = INJURY_EVENTS[crisis.type]
      for (const tech of state.techSlots) {
        if (tech.currentRoomId === crisis.roomId && !tech.injured && tech.state !== 'carried') {
          tech.injured = true
          tech.injuryCause = injuryDef?.cause ?? 'Blessure'
          tech.injuryType = crisis.type     // for minigame lookup
          tech.assignedCrisisId = null
          tech.state = 'injured'
          tech.carrying = null
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
    return false
  },
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
