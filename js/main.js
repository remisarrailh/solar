// ══════════════════════════════════════════════════════════
//  NEBULA PROTOCOL — Main Entry Point & Scene Router
// ══════════════════════════════════════════════════════════

import { Progression }         from './progression.js'
import { State }               from './state.js'
import { UI }                  from './ui.js'
import { Network, MSG }        from './network.js'
import { MinigameDispatcher }  from './minigames/index.js'
import { HOST_PROMOTE_DELAY_MS, CRISIS_TYPES } from './config.js'

// ══════════════════════════════════════════════════════════
//  AUDIO MANAGER
// ══════════════════════════════════════════════════════════
const Audio = {
  _el: null,
  _muted: false,
  _started: false,

  init() {
    this._el = document.getElementById('game-music')
    if (!this._el) return
    this._muted = localStorage.getItem('nebula_muted') === '1'
    this._el.volume = 0.45
    this._el.muted = this._muted
    // Start on first user interaction (browser autoplay policy)
    document.addEventListener('pointerdown', () => this._tryStart(), { once: true })
    document.addEventListener('keydown',     () => this._tryStart(), { once: true })
    // Wire mute buttons
    document.querySelectorAll('.btn--mute').forEach(btn => {
      btn.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.toggleMute() })
    })
    this._syncButtons()
  },

  _tryStart() {
    if (this._started || !this._el) return
    this._started = true
    this._el.play().catch(() => { /* autoplay blocked — will retry on next interaction */ this._started = false })
  },

  play() {
    this._tryStart()
    if (this._el && this._el.paused && this._started) {
      this._el.play().catch(() => {})
    }
  },

  pause() {
    this._el?.pause()
  },

  toggleMute() {
    this._muted = !this._muted
    if (this._el) this._el.muted = this._muted
    localStorage.setItem('nebula_muted', this._muted ? '1' : '0')
    this._syncButtons()
  },

  _syncButtons() {
    document.querySelectorAll('.btn--mute').forEach(btn => {
      btn.textContent = this._muted ? '♪̶' : '♪'
      btn.classList.toggle('btn--mute--off', this._muted)
      btn.title = this._muted ? 'Activer la musique' : 'Couper la musique'
    })
  },
}

// ── App State ──────────────────────────────────────────────
const App = {
  profile:          null,
  gameMode:         null,   // 'solo' | 'multiplayer'
  myRole:           null,   // 'controller' | 'technician' | 'commander'
  selectedRole:     'technician',
  isReady:          false,
  isHost:           false,
  myPeerId:         null,
  difficulty:       'normal',
  currentRoomId:    null,   // technician's current room
  selectedNpcId:    null,   // commander's selected NPC
  selectedRoomId:   null,   // commander's selected room on map
  gameLoopInterval: null,
  cctvInterval:     null,
  prevState:        null,
  xpAccumulator:   {},      // { skillType: { amount, count } }
  crisisesThisGame: 0,
}

// ══════════════════════════════════════════════════════════
//  BOOT
// ══════════════════════════════════════════════════════════
async function boot() {
  UI.showScreen('boot')
  App.profile = Progression.load()
  Audio.init()

  setTimeout(() => UI.bootProgress(1), 100)
  setTimeout(() => UI.bootProgress(2), 600)

  try {
    App.myPeerId = await Network.init()
    UI.bootProgress(3)
    setTimeout(goToMainMenu, 700)
  } catch (err) {
    UI.bootError('Impossible de se connecter au réseau. Vérifiez votre connexion.')
    document.getElementById('boot-retry-btn')?.addEventListener('click', boot)
  }
}

// ══════════════════════════════════════════════════════════
//  MAIN MENU
// ══════════════════════════════════════════════════════════
function goToMainMenu() {
  Audio.pause()
  Network.destroy()
  Network.init().then(id => {
    App.myPeerId = id
    UI.setMenuPlayerId(App.profile.callsign)
  }).catch(() => {
    UI.setMenuPlayerId(App.profile.callsign)
  })
  UI.showScreen('main-menu')
}

document.getElementById('btn-host')?.addEventListener('click', () => {
  ensureCallsign(() => startHost())
})

document.getElementById('btn-join')?.addEventListener('click', () => {
  ensureCallsign(() => UI.showJoinOverlay(true))
})

document.getElementById('btn-solo')?.addEventListener('click', () => {
  ensureCallsign(() => startSolo())
})

document.getElementById('btn-test-minigames')?.addEventListener('click', () => {
  ensureCallsign(() => startMinigameTest())
})

document.getElementById('btn-progression')?.addEventListener('click', () => {
  UI.renderProgressionScreen(App.profile)
  UI.showScreen('progression')
})

document.getElementById('btn-join-confirm')?.addEventListener('click', () => {
  const code = document.getElementById('join-code-input')?.value.trim().toUpperCase()
  if (!code) return
  joinGame(code)
})

document.getElementById('btn-join-cancel')?.addEventListener('click', () => {
  UI.showJoinOverlay(false)
  UI.setJoinError(null)
})

document.getElementById('join-code-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('btn-join-confirm')?.click()
})

// Name overlay
document.getElementById('btn-name-confirm')?.addEventListener('click', () => {
  const name = document.getElementById('name-input')?.value.trim()
  if (!name) return
  App.profile = Progression.setCallsign(App.profile, name)
  UI.showNameOverlay(false)
  // Resume pending action
  if (_pendingAction) { const fn = _pendingAction; _pendingAction = null; fn() }
})

let _pendingAction = null
function ensureCallsign(fn) {
  if (App.profile.callsign && App.profile.callsign !== 'Opérateur') { fn(); return }
  _pendingAction = fn
  document.getElementById('name-input').value = ''
  UI.showNameOverlay(true)
}

// ══════════════════════════════════════════════════════════
//  HOST
// ══════════════════════════════════════════════════════════
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'NP-'
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

async function startHost() {
  App.gameMode = 'multiplayer'
  App.isHost   = true

  const roomCode = generateRoomCode()
  try {
    App.myPeerId = await Network.init(roomCode)
    Network.host()
    Network.onMessage  = handleNetworkMessage
    Network.onPeerJoin = handlePeerJoin
    Network.onPeerLeave = handlePeerLeave
    console.log('[Host] Room created, code:', App.myPeerId)
  } catch (e) {
    alert('Erreur réseau: ' + e.message)
    return
  }

  goToLobby()
}

// ══════════════════════════════════════════════════════════
//  JOIN
// ══════════════════════════════════════════════════════════
async function joinGame(hostId) {
  UI.setJoinError(null)
  try {
    App.myPeerId = await Network.init()
    console.log('[Client] My peer ID:', App.myPeerId, '— connecting to host:', hostId)
    await Network.join(hostId)
    console.log('[Client] Connected to host')
    Network.onMessage   = handleNetworkMessage
    Network.onPeerJoin  = handlePeerJoin
    Network.onPeerLeave = handlePeerLeave
    App.isHost = false
    App.gameMode = 'multiplayer'

    // Send join message
    Network.send(hostId, MSG.JOIN, {
      name: App.profile.callsign,
      progression: Progression.buildSummary(App.profile),
    })
    console.log('[Client] MSG_JOIN sent to host')
    UI.showJoinOverlay(false)
    goToLobby()
  } catch (e) {
    console.error('[Client] Join failed:', e)
    UI.setJoinError('Connexion impossible. Vérifiez le code.')
  }
}

// ══════════════════════════════════════════════════════════
//  TEST MINI-JEUX
// ══════════════════════════════════════════════════════════
const _testScore = { success: 0, total: 0 }

function startMinigameTest() {
  App.gameMode   = 'solo'
  App.myRole     = 'technician'
  App.difficulty = document.getElementById('setting-difficulty')?.value ?? 'normal'
  App.xpAccumulator = {}
  _testScore.success = 0
  _testScore.total   = 0

  UI.showScreen('technician')
  UI.renderSkillHud('tech-skill-hud', App.profile)
  App.cctvInterval = UI.startCctvClock('tech-cctv-time')

  const hud = document.getElementById('test-mode-hud')
  if (hud) hud.style.display = 'flex'
  _updateTestHud()

  setTimeout(_triggerNextTestMinigame, 600)
}

function _triggerNextTestMinigame() {
  if (MinigameDispatcher.active) return

  const types    = Object.values(CRISIS_TYPES)
  const template = types[Math.floor(Math.random() * types.length)]
  const severity = Math.ceil(Math.random() * 3)
  const timerMax = Math.max(30, template.timerBase - (severity - 1) * 15)

  const crisis = {
    id:             'test_' + Date.now(),
    name:           template.name,
    minigame:       template.minigame,
    skillType:      template.skillType,
    severity,
    timerRemaining: timerMax,
    timerMax,
    xpBase:         template.xpBase,
  }

  const overlayId   = 'minigame-overlay'
  const containerId = 'minigame-container'
  UI.showMinigameOverlay(overlayId, crisis.name)

  const container = document.getElementById(containerId)
  if (!container) return

  let timerVal = crisis.timerRemaining
  const timerInterval = setInterval(() => {
    timerVal -= 1
    UI.updateMinigameTimer(overlayId, timerVal, crisis.timerMax)
    if (timerVal <= 0) clearInterval(timerInterval)
  }, 1000)

  MinigameDispatcher.trigger(
    crisis.id, crisis.minigame, App.difficulty,
    crisis.skillType, crisis.severity, App.profile, container,
    ({ success, xp, skillType }) => {
      clearInterval(timerInterval)
      _testScore.total++
      if (success) {
        _testScore.success++
        if (xp > 0) {
          accumulateXP(skillType, xp)
          const result = Progression.awardXP(skillType, xp, App.profile)
          App.profile = result.profile
          Progression.save(App.profile)
          Progression.applyLevelVisuals(App.profile, document.getElementById('tech-skill-hud'))
        }
      }
      _updateTestHud()
      UI.showMinigameResult(overlayId, success, xp)
      setTimeout(() => {
        UI.hideMinigameOverlay(overlayId)
        MinigameDispatcher.abort()
        setTimeout(_triggerNextTestMinigame, 800)
      }, 2000)
    }
  )
}

function _updateTestHud() {
  const el = document.getElementById('test-mode-score')
  if (el) el.textContent = `TEST MODE — ${_testScore.success}✓ / ${_testScore.total}`
}

document.getElementById('btn-test-quit')?.addEventListener('click', () => {
  MinigameDispatcher.abort()
  if (App.cctvInterval) { clearInterval(App.cctvInterval); App.cctvInterval = null }
  document.getElementById('test-mode-hud').style.display = 'none'
  goToMainMenu()
})

// ══════════════════════════════════════════════════════════
//  SOLO
// ══════════════════════════════════════════════════════════
function startSolo() {
  App.gameMode = 'solo'
  App.isHost   = true
  App.myRole   = 'commander'
  App.difficulty = document.getElementById('setting-difficulty')?.value ?? 'normal'
  App.xpAccumulator = {}
  App.crisisesThisGame = 0

  // Init solo state
  const myPlayer = {
    peerId: App.myPeerId ?? 'local',
    name: App.profile.callsign,
    role: 'commander',
    currentRoomId: 'bridge',
    isHost: true,
    ready: true,
    connected: true,
    progression: Progression.buildSummary(App.profile),
  }

  State.init({
    mode: 'solo',
    difficulty: App.difficulty,
    players: { [myPlayer.peerId]: myPlayer },
    localPlayerId: myPlayer.peerId,
  })

  // Hook flatline_rev check
  State._hasSpec = (specId) => {
    for (const data of Object.values(App.profile?.skills ?? {})) {
      if (data.specialization === specId) return true
    }
    return false
  }

  App.currentRoomId = 'bridge'
  App.selectedNpcId = null
  App.selectedRoomId = 'bridge'

  startGameLoop()
  Audio.play()
  UI.showScreen('commander')
  renderCommanderView()
  App.cctvInterval = UI.startCctvClock('tech-cctv-time')
}

// ══════════════════════════════════════════════════════════
//  LOBBY
// ══════════════════════════════════════════════════════════
function goToLobby() {
  UI.showScreen('lobby')
  UI.setRoomCode(App.myPeerId ?? '—')
  App.isReady = false
  UI.setReadyState(false)
  App.selectedRole = 'technician'
  UI.setRoleSelected('technician')

  // Initial player list
  if (App.isHost) {
    const self = buildSelfPlayer('controller')
    State.init({
      mode: 'multiplayer',
      difficulty: 'normal',
      players: { [App.myPeerId]: self },
      localPlayerId: App.myPeerId,
    })
    UI.renderPlayerList(State.current.players, App.myPeerId)
  }
}

document.querySelectorAll('.role-card').forEach(card => {
  card.addEventListener('pointerdown', () => {
    App.selectedRole = card.dataset.role
    UI.setRoleSelected(App.selectedRole)
    if (App.isHost && State.current?.players?.[App.myPeerId]) {
      State.current.players[App.myPeerId].role = App.selectedRole
      UI.renderPlayerList(State.current.players, App.myPeerId)
    }
  })
})

document.getElementById('btn-lobby-ready')?.addEventListener('click', () => {
  App.isReady = !App.isReady
  UI.setReadyState(App.isReady)
  if (!App.isHost && Network.hostId) {
    Network.send(Network.hostId, 'MSG_READY', { ready: App.isReady, role: App.selectedRole })
  }
  if (App.isHost && State.current?.players?.[App.myPeerId]) {
    State.current.players[App.myPeerId].ready = App.isReady
    State.current.players[App.myPeerId].role = App.selectedRole
    checkLobbyReady()
  }
})

document.getElementById('btn-lobby-start')?.addEventListener('click', () => {
  if (!App.isHost) return
  launchMultiplayerGame()
})

document.getElementById('btn-lobby-back')?.addEventListener('click', () => {
  Network.destroy()
  goToMainMenu()
})

document.getElementById('btn-copy-code')?.addEventListener('click', () => {
  if (App.myPeerId) navigator.clipboard?.writeText(App.myPeerId).catch(() => {})
})

document.getElementById('setting-difficulty')?.addEventListener('change', (e) => {
  App.difficulty = e.target.value
})

function checkLobbyReady() {
  const players = Object.values(State.current?.players ?? {})
  const allReady = players.length > 0 && players.every(p => p.ready)
  UI.setLobbyReady(allReady, App.isHost)
}

// ══════════════════════════════════════════════════════════
//  MULTIPLAYER GAME LAUNCH (host)
// ══════════════════════════════════════════════════════════
function launchMultiplayerGame() {
  App.difficulty = document.getElementById('setting-difficulty')?.value ?? 'normal'
  App.xpAccumulator = {}
  App.crisisesThisGame = 0

  // Re-init state with assigned rooms
  const players = State.current.players

  // Assign starting rooms
  let techIdx = 0
  const techRooms = ['engine_bay', 'med_bay', 'reactor_core', 'cargo_hold']
  for (const player of Object.values(players)) {
    if (player.role === 'technician') {
      player.currentRoomId = techRooms[techIdx++ % techRooms.length]
    } else if (player.role === 'controller') {
      player.currentRoomId = 'bridge'
    }
  }

  State.init({
    mode: 'multiplayer',
    difficulty: App.difficulty,
    players,
    localPlayerId: App.myPeerId,
  })

  // Broadcast game start with full state
  Network.broadcast(MSG.GAME_START, {
    gameState: State.snapshot(),
  })

  // Route self
  const myPlayer = State.current.players[App.myPeerId]
  App.myRole = myPlayer?.role ?? 'technician'
  startGameLoop()
  routeToGameScreen()
}


// ══════════════════════════════════════════════════════════
//  GAME LOOP (host only)
// ══════════════════════════════════════════════════════════
function startGameLoop() {
  if (App.gameLoopInterval) clearInterval(App.gameLoopInterval)
  App.gameLoopInterval = setInterval(() => {
    if (!State.current || State.current.phase !== 'gameplay') return

    const delta = State.tick()
    if (!delta) return

    // Track new crises
    if (delta.newCrises?.length) App.crisisesThisGame += delta.newCrises.length

    // Sync resolved crises for XP
    if (delta.resolved?.length) {
      for (const crisisId of delta.resolved) {
        const crisis = State.current.crises[crisisId]
        if (crisis) App.crisisesThisGame++
      }
    }

    // Broadcast delta to peers
    if (App.gameMode === 'multiplayer') {
      Network.broadcast(MSG.STATE_DELTA, delta)
    }

    // Check game over
    if (delta.phase === 'gameover' || delta.outcome) {
      endGame(delta.outcome ?? 'loss')
      return
    }

    // Update UI
    updateGameUI()

    // Minigame triggers (host only, covers both local and remote technicians)
    if (App.isHost && App.gameMode === 'multiplayer') {
      checkAndTriggerMinigames()
    }
    // Solo commander: update camera view
    if (App.gameMode === 'solo') {
      updateCommanderRoomView()
    }

  }, 1000)
}

function stopGameLoop() {
  if (App.gameLoopInterval) {
    clearInterval(App.gameLoopInterval)
    App.gameLoopInterval = null
  }
}

// ══════════════════════════════════════════════════════════
//  GAME UI UPDATE (runs each second)
// ══════════════════════════════════════════════════════════
function updateGameUI() {
  const state = State.current
  if (!state) return

  if (App.myRole === 'controller' || App.myRole === 'commander') {
    UI.renderPlayerList(state.players, App.myPeerId)
    UI.updateShipStats(
      state.shipIntegrity, state.oxygenLevel,
      'ctrl-integrity-fill', 'ctrl-oxygen-fill',
      'ctrl-integrity-val', 'ctrl-oxygen-val'
    )
    UI.updateShipStats(
      state.shipIntegrity, state.oxygenLevel,
      'cmd-integrity-fill', 'cmd-oxygen-fill',
      'cmd-integrity-val', null
    )
    UI.renderCrisisList('ctrl-crisis-list', state.crises)
    UI.renderCrisisList('cmd-crisis-list', state.crises)
    UI.renderShipMap('ship-map', state.rooms, state.players, App.selectedRoomId, onMapRoomClick)
    UI.renderShipMap('cmd-ship-map', state.rooms, state.players, App.selectedRoomId, onCmdMapRoomClick)
    UI.updateGameTimer('ctrl-timer', state.elapsed)
    UI.updateGameTimer('cmd-timer', state.elapsed)

    if (App.myRole === 'commander') {
      UI.renderNpcPortraits(state.npcs, App.selectedNpcId, onNpcSelect)
    }
  }

  if (App.myRole === 'technician') {
    UI.updateShipStats(state.shipIntegrity, 100, 'tech-integrity-fill', null, null, null)
    UI.updateGameTimer('tech-timer', state.elapsed)

    const room = state.rooms[App.currentRoomId]
    if (room) {
      UI.updateRoomView('tech-room-image', 'tech-room-view', room)
      UI.updateCrisisIndicators('tech-crisis-indicators', filterCrisesForRoom(App.currentRoomId))
      UI.renderCrisisList('tech-crisis-list', filterCrisesForRoom(App.currentRoomId))
    }
  }

  // Crisis timers update on all screens
  UI.updateCrisisTimers(state.crises)
}

function filterCrisesForRoom(roomId) {
  const crises = {}
  for (const [id, c] of Object.entries(State.current.crises)) {
    if (c.roomId === roomId) crises[id] = c
  }
  return crises
}

// ══════════════════════════════════════════════════════════
//  COMMANDER (Solo) view
// ══════════════════════════════════════════════════════════
function renderCommanderView() {
  const state = State.current
  if (!state) return

  // Initial render
  UI.renderShipMap('cmd-ship-map', state.rooms, state.players, App.selectedRoomId, onCmdMapRoomClick)
  UI.renderNpcPortraits(state.npcs, App.selectedNpcId, onNpcSelect)
  updateCommanderRoomView()
  UI.renderSkillHud('tech-skill-hud', App.profile)
  updateGameUI()

  // Chat
  setupChat('cmd')
}

function onNpcSelect(npcId) {
  App.selectedNpcId = npcId
  UI.renderNpcPortraits(State.current.npcs, App.selectedNpcId, onNpcSelect)
}

function onCmdMapRoomClick(roomId) {
  if (App.selectedNpcId) {
    // Dispatch NPC to room
    const success = State.dispatchNpc(App.selectedNpcId, roomId)
    if (success) {
      App.selectedNpcId = null
      UI.addChatMessage('ctrl-chat-log', 'SYSTÈME',
        `Déploiement vers ${State.current.rooms[roomId]?.name}`, true)
    }
  } else {
    // Just view the room
    App.selectedRoomId = roomId
    updateCommanderRoomView()
  }
}

function updateCommanderRoomView() {
  const room = State.current?.rooms[App.selectedRoomId]
  if (!room) return
  UI.updateRoomView('cmd-room-image', 'cmd-room-view', room)
  const nameEl = document.getElementById('cmd-room-name')
  if (nameEl) nameEl.textContent = room.name.toUpperCase()
}

// ══════════════════════════════════════════════════════════
//  CONTROLLER view
// ══════════════════════════════════════════════════════════
function onMapRoomClick(roomId) {
  if (App.myRole !== 'controller') return
  App.selectedRoomId = roomId
  UI.renderShipMap('ship-map', State.current.rooms, State.current.players, roomId, onMapRoomClick)
}

// ══════════════════════════════════════════════════════════
//  TECHNICIAN: Minigame trigger
// ══════════════════════════════════════════════════════════
function checkAndTriggerMinigamesLocal() {
  if (App.myRole !== 'technician') return
  if (MinigameDispatcher.active) return

  // Find an unassigned crisis in my room
  const room = State.current.rooms[App.currentRoomId]
  if (!room) return

  for (const crisisId of room.activeCrises) {
    const crisis = State.current.crises[crisisId]
    if (!crisis || crisis.state !== 'active' || crisis.assignedTo) continue

    // Assign and trigger
    State.startResolving(crisisId, App.myPeerId)
    triggerMinigameUI(crisis)
    break
  }
}

function triggerMinigameUI(crisis) {
  const overlayId = App.myRole === 'commander' ? 'cmd-minigame-overlay' : 'minigame-overlay'
  const containerId = App.myRole === 'commander' ? 'cmd-minigame-container' : 'minigame-container'

  UI.showMinigameOverlay(overlayId, crisis.name)

  const container = document.getElementById(containerId)
  if (!container) return

  // Start timer display
  let timerVal = crisis.timerRemaining
  const timerInterval = setInterval(() => {
    timerVal -= 1
    UI.updateMinigameTimer(overlayId, timerVal, crisis.timerMax)
    if (timerVal <= 0) clearInterval(timerInterval)
  }, 1000)

  MinigameDispatcher.trigger(
    crisis.id,
    crisis.minigame,
    App.difficulty,
    crisis.skillType,
    crisis.severity,
    App.profile,
    container,
    ({ success, completionTime, xp, skillType }) => {
      clearInterval(timerInterval)

      // Award XP
      if (success && xp > 0) {
        accumulateXP(skillType, xp)
        const result = Progression.awardXP(skillType, xp, App.profile)
        App.profile = result.profile
        Progression.save(App.profile)
        Progression.applyLevelVisuals(App.profile, document.getElementById('tech-skill-hud'))
      }

      // Show result
      UI.showMinigameResult(overlayId, success, xp)

      // Update state
      if (success) {
        State.resolveCrisis(crisis.id)
        App.crisisesThisGame++
      } else {
        State.releaseCrisis(crisis.id)
      }

      // Send result to host (multiplayer)
      if (App.gameMode === 'multiplayer' && !App.isHost) {
        Network.send(Network.hostId, MSG.MINIGAME_RESULT, {
          crisisId: crisis.id,
          success,
          completionTime,
        })
      }

      // Auto-close overlay after 2s
      setTimeout(() => {
        UI.hideMinigameOverlay(overlayId)
        MinigameDispatcher.abort()
      }, 2000)
    }
  )
}

// Click on crisis entry in tech screen triggers minigame
function setupCrisisListClick(listId) {
  document.getElementById(listId)?.addEventListener('pointerdown', (e) => {
    const entry = e.target.closest('.crisis-entry')
    if (!entry || MinigameDispatcher.active) return
    const crisisId = entry.dataset.crisisId
    const crisis = State.current?.crises[crisisId]
    if (!crisis || crisis.state !== 'active') return
    State.startResolving(crisisId, App.myPeerId ?? 'local')
    triggerMinigameUI(crisis)
  })
}
setupCrisisListClick('tech-crisis-list')
setupCrisisListClick('cmd-crisis-list')

// ══════════════════════════════════════════════════════════
//  NETWORK MESSAGE HANDLER
// ══════════════════════════════════════════════════════════
function handleNetworkMessage(msg, fromPeerId) {
  const { type, payload } = msg
  console.log('[Network] MSG received:', type, 'from:', fromPeerId)

  switch (type) {
    case MSG.JOIN:
      if (App.isHost) handlePlayerJoin(fromPeerId, payload)
      break

    case 'MSG_READY':
      if (App.isHost) {
        const p = State.current.players[fromPeerId]
        if (p) { p.ready = payload.ready; p.role = payload.role }
        UI.renderPlayerList(State.current.players, App.myPeerId)
        checkLobbyReady()
        Network.broadcast(MSG.PLAYER_JOINED, { players: State.current.players })
      }
      break

    case MSG.WELCOME:
      if (!App.isHost) {
        // Initialize client state from host's snapshot
        State.current = payload.gameState
        UI.renderPlayerList(State.current.players, App.myPeerId)
        console.log('[Lobby] WELCOME received, players:', Object.keys(State.current.players))
      }
      break

    case MSG.GAME_START:
      if (!App.isHost) {
        State.current = payload.gameState
        App.myRole = State.current.players[App.myPeerId]?.role ?? 'technician'
        App.currentRoomId = State.current.players[App.myPeerId]?.currentRoomId ?? 'engine_bay'
        routeToGameScreen()
      }
      break

    case MSG.STATE_DELTA:
      if (!App.isHost) {
        State.applyDelta(payload)
        updateGameUI()
        if (payload.phase === 'gameover') endGame(payload.outcome ?? 'loss')
      }
      break

    case MSG.MINIGAME_START:
      if (!App.isHost) {
        const crisis = { ...payload, id: payload.crisisId }
        triggerMinigameUI(crisis)
      }
      break

    case MSG.MINIGAME_RESULT:
      if (App.isHost) {
        const { crisisId, success } = payload
        const crisis = State.current.crises[crisisId]
        if (crisis) {
          if (success) {
            State.resolveCrisis(crisisId)
            Network.broadcast(MSG.CRISIS_RESOLVED, { crisisId, resolvedBy: fromPeerId })
          } else {
            State.releaseCrisis(crisisId)
          }
        }
      }
      break

    case MSG.CHAT: {
      const logId = App.myRole === 'controller' ? 'ctrl-chat-log' : 'tech-chat-log'
      UI.addChatMessage(logId, payload.sender, payload.text)
      // Host re-broadcasts to all other clients
      if (App.isHost) Network.broadcast(MSG.CHAT, payload, fromPeerId)
      break
    }

    case MSG.PLAYER_JOINED:
      if (!App.isHost && payload.players) {
        State.current.players = payload.players
        UI.renderPlayerList(State.current.players, App.myPeerId)
      }
      break

    case MSG.GAME_OVER:
      endGame(payload.outcome)
      break
  }
}

function handlePlayerJoin(peerId, payload) {
  const player = {
    peerId,
    name: payload.name ?? 'Inconnu',
    role: 'technician',
    currentRoomId: 'engine_bay',
    isHost: false,
    ready: false,
    connected: true,
    progression: payload.progression ?? {},
  }
  State.addPlayer(player)
  UI.renderPlayerList(State.current.players, App.myPeerId)

  // Send welcome
  Network.send(peerId, MSG.WELCOME, {
    gameState: State.snapshot(),
    assignedRole: player.role,
    assignedRoom: player.currentRoomId,
  })
  Network.broadcast(MSG.PLAYER_JOINED, { players: State.current.players }, peerId)
}

function checkAndTriggerMinigames() {
  for (const player of Object.values(State.current.players)) {
    if (player.role !== 'technician' || !player.connected) continue
    if (!player.currentRoomId) continue

    const room = State.current.rooms[player.currentRoomId]
    if (!room) continue

    for (const crisisId of room.activeCrises) {
      const crisis = State.current.crises[crisisId]
      if (!crisis || crisis.state !== 'active' || crisis.assignedTo) continue

      State.startResolving(crisisId, player.peerId)

      // If this player is the host themselves, trigger locally
      if (player.peerId === App.myPeerId) {
        triggerMinigameUI(crisis)
      } else {
        Network.send(player.peerId, MSG.MINIGAME_START, {
          crisisId,
          minigameType: crisis.minigame,
          skillType: crisis.skillType,
          severity: crisis.severity,
          timerRemaining: crisis.timerRemaining,
          timerMax: crisis.timerMax,
          name: crisis.name,
        })
      }
      break
    }
  }
}

// ══════════════════════════════════════════════════════════
//  PEER EVENTS
// ══════════════════════════════════════════════════════════
function handlePeerJoin(peerId) {
  console.log('[Network] Peer joined:', peerId)
}

function handlePeerLeave(peerId, reason) {
  if (!State.current) return

  // Release their crises
  for (const crisis of Object.values(State.current.crises)) {
    if (crisis.assignedTo === peerId) State.releaseCrisis(crisis.id)
  }

  if (App.isHost) {
    State.removePlayer(peerId)
    Network.broadcast(MSG.PLAYER_LEFT, { peerId, reason })
    UI.renderPlayerList(State.current.players, App.myPeerId)
    UI.addChatMessage('ctrl-chat-log', 'SYSTÈME', `Un joueur a quitté la partie.`, true)
  } else if (peerId === Network.hostId) {
    // Host left — attempt promotion
    const peers = [App.myPeerId, ...Network.getPeerIds()].sort()
    if (peers[0] === App.myPeerId) {
      setTimeout(() => {
        Network.promoteToHost(Network.getPeerIds())
        App.isHost = true
        startGameLoop()
        UI.addChatMessage('ctrl-chat-log', 'SYSTÈME', 'Vous êtes maintenant le serveur.', true)
      }, HOST_PROMOTE_DELAY_MS)
    }
  }
}

// ══════════════════════════════════════════════════════════
//  SCREEN ROUTING
// ══════════════════════════════════════════════════════════
function routeToGameScreen() {
  Audio.play()
  const role = App.myRole
  if (role === 'controller') {
    UI.showScreen('controller')
    setupChat('ctrl')
    UI.renderShipMap('ship-map', State.current.rooms, State.current.players, null, onMapRoomClick)
  } else if (role === 'technician') {
    UI.showScreen('technician')
    setupChat('tech')
    App.currentRoomId = State.current.players[App.myPeerId]?.currentRoomId ?? 'engine_bay'
    document.getElementById('tech-room-name').textContent =
      State.current.rooms[App.currentRoomId]?.name ?? '—'
    UI.renderSkillHud('tech-skill-hud', App.profile)
    App.cctvInterval = UI.startCctvClock('tech-cctv-time')
  } else if (role === 'commander') {
    UI.showScreen('commander')
    renderCommanderView()
    App.cctvInterval = UI.startCctvClock('tech-cctv-time')
  }
  updateGameUI()
}

// ══════════════════════════════════════════════════════════
//  CHAT
// ══════════════════════════════════════════════════════════
function setupChat(prefix) {
  const input  = document.getElementById(`${prefix}-chat-input`)
  const sendBtn = document.getElementById(`${prefix}-chat-send`)
  const logId  = `${prefix}-chat-log`

  function sendMsg() {
    const text = input?.value.trim()
    if (!text) return
    input.value = ''
    UI.addChatMessage(logId, App.profile.callsign, text)
    if (App.gameMode === 'multiplayer') {
      if (App.isHost) {
        Network.broadcast(MSG.CHAT, { sender: App.profile.callsign, text })
      } else {
        Network.send(Network.hostId, MSG.CHAT, { sender: App.profile.callsign, text })
      }
    }
  }

  sendBtn?.addEventListener('pointerdown', sendMsg)
  input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMsg() })
}

// ══════════════════════════════════════════════════════════
//  GAME OVER / DEBRIEF
// ══════════════════════════════════════════════════════════
function endGame(outcome) {
  stopGameLoop()
  if (App.cctvInterval) { clearInterval(App.cctvInterval); App.cctvInterval = null }
  MinigameDispatcher.abort()

  // Update progression
  App.profile = Progression.recordGameEnd(App.profile, App.crisisesThisGame)

  const results = {
    outcome,
    elapsed:          State.current?.elapsed ?? 0,
    crisisesResolved: App.crisisesThisGame,
    shipIntegrity:    State.current?.shipIntegrity ?? 0,
    oxygenLevel:      State.current?.oxygenLevel ?? 0,
  }

  UI.renderDebrief(results, formatXpAwards())
  UI.showScreen('debrief')
}

function accumulateXP(skillType, amount) {
  if (!App.xpAccumulator[skillType]) App.xpAccumulator[skillType] = { amount: 0, count: 0 }
  App.xpAccumulator[skillType].amount += amount
  App.xpAccumulator[skillType].count++
}

function formatXpAwards() {
  const awards = {}
  for (const [skill, acc] of Object.entries(App.xpAccumulator)) {
    awards[skill] = { amount: acc.amount }
  }
  return awards
}

document.getElementById('btn-debrief-menu')?.addEventListener('click', () => {
  Network.destroy()
  goToMainMenu()
})

// ══════════════════════════════════════════════════════════
//  PROGRESSION SCREEN
// ══════════════════════════════════════════════════════════
document.getElementById('btn-prog-back')?.addEventListener('click', () => {
  UI.showScreen('main-menu')
})

document.getElementById('btn-prog-reset')?.addEventListener('click', () => {
  if (confirm('Réinitialiser toute la progression ? Cette action est irréversible.')) {
    App.profile = Progression.reset()
    UI.renderProgressionScreen(App.profile)
  }
})

// ══════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════
function buildSelfPlayer(role) {
  return {
    peerId: App.myPeerId,
    name: App.profile.callsign,
    role,
    currentRoomId: 'bridge',
    isHost: true,
    ready: false,
    connected: true,
    progression: Progression.buildSummary(App.profile),
  }
}

// ══════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════
boot()
