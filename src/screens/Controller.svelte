<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte'
  import { gameState, State }        from '../lib/state.js'
  import { Network, MSG }            from '../lib/network.js'
  import { ROOMS, CONTROLLER_ACTIONS, CRISIS_TYPES, INJURY_EVENTS } from '../lib/config.js'
  import Chat                        from '../components/Chat.svelte'
  import CrisisList                  from '../components/CrisisList.svelte'

  export let appCtx

  const dispatch = createEventDispatcher()

  let gs           = null
  let messages     = []
  let selectedRoom = null       // roomId shown in the detail view
  let pendingAction = null      // actionId waiting for a target room click

  const unsubState = gameState.subscribe(s => {
    gs = s
    if (s?.phase === 'gameover') endGame()
  })

  // Rooms ordered by grid position (row-major)
  const roomList = Object.values(ROOMS).sort((a, b) =>
    a.gridRow !== b.gridRow ? a.gridRow - b.gridRow : a.gridCol - b.gridCol
  )

  onMount(() => {
    if (appCtx.isHost) {
      // Build initial players map from lobby
      const initPlayers = { [Network.myId]: {
        peerId: Network.myId,
        callsign: appCtx.profile.callsign,
        role: 'controller',
        currentRoomId: 'bridge',
      }}
      const lobby = appCtx.lobbyPlayers ?? {}
      for (const [peerId, p] of Object.entries(lobby)) {
        if (peerId === Network.myId) continue
        initPlayers[peerId] = {
          peerId,
          callsign: p.callsign,
          role: p.role,
          techSlotId: p.techSlotId ?? null,
          currentRoomId: p.role === 'controller' ? 'bridge' : null,
        }
      }

      State.init({
        mode: 'multiplayer',
        difficulty: appCtx.difficulty,
        players: initPlayers,
        localPlayerId: Network.myId,
      })

      // Claim tech slots for connected players
      for (const [peerId, p] of Object.entries(lobby)) {
        if (p.role === 'technician' && p.techSlotId) {
          State.claimTechSlot(p.techSlotId, peerId)
        }
      }

      // Send full initial state to all clients
      setTimeout(() => {
        if (State.current) {
          Network.broadcast(MSG.STATE_DELTA, State.computeDelta(null, State.current))
        }
      }, 300)

      gameInterval = setInterval(() => {
        const delta = State.tick()
        if (delta) Network.broadcast(MSG.STATE_DELTA, delta)
        if (gs?.phase === 'gameover') endGame()
      }, 1000)
    }

    Network.onMessage = handleMessage
  })

  onDestroy(() => {
    clearInterval(gameInterval)
    Network.onMessage = null
    unsubState()
  })

  let gameInterval

  function handleMessage({ type, payload, senderId }) {
    if (type === MSG.STATE_DELTA)       State.applyDelta(payload)
    if (type === MSG.CHAT)              messages = [...messages, payload]
    if (type === MSG.GAME_OVER)         endGame(payload)

    if (type === MSG.MINIGAME_RESULT && payload.isHeal) {
      // Healing minigame finished
      if (payload.success) {
        State.healTech(payload.injuredSlotId)
        State.stopCarrying(payload.carrierId)
      }
      Network.broadcast(MSG.STATE_DELTA, { techSlots: State.current.techSlots })
      return
    }
    if (type === MSG.MINIGAME_RESULT && !payload.isHeal) {
      const slotId = payload.slotId
      State.finishTechCrisis(slotId, payload.success)
      Network.broadcast(MSG.STATE_DELTA, State.computeDelta(null, State.current))
      return
    }

    if (type === MSG.MOVE_REQUEST) {
      // Move the player record (for crew dots) and tech slot
      State.movePlayer(senderId, payload.roomId)
      if (payload.slotId) State.moveTech(payload.slotId, payload.roomId)
      Network.broadcast(MSG.STATE_DELTA, { players: State.current.players, techSlots: State.current.techSlots })
    }
    if (type === MSG.DISTRESS_SIGNAL) {
      State.sendDistress(payload.fromId, payload.fromName, payload.roomId)
      Network.broadcast(MSG.STATE_DELTA, { distressSignals: State.current.distressSignals })
    }
    if (type === MSG.ANOMALY_CONFIRMED) {
      State.confirmAnomaly(payload.roomId)
      Network.broadcast(MSG.STATE_DELTA, { anomalies: State.current.anomalies, crises: State.current.crises })
    }
    if (type === MSG.CONTROLLER_ACTION) {
      const ok = State.triggerControllerAction(payload.actionId, payload.targetRoomId ?? null)
      if (ok) Network.broadcast(MSG.STATE_DELTA, State.computeDelta(null, State.current))
    }
    if (type === MSG.MINIGAME_REQUEST) {
      const { slotId, crisisId } = payload
      const ok = State.startTechCrisis(slotId, crisisId)
      if (ok) {
        const crisis = State.current.crises[crisisId]
        Network.send(senderId, MSG.MINIGAME_START, { crisis })
        Network.broadcast(MSG.STATE_DELTA, { techSlots: State.current.techSlots, crises: State.current.crises })
      }
    }
    if (type === MSG.TECH_SLOT_REQUEST) {
      const ok = State.claimTechSlot(payload.slotId, senderId)
      if (ok) Network.broadcast(MSG.STATE_DELTA, { techSlots: State.current.techSlots })
    }
    if (type === MSG.START_CARRYING) {
      const ok = State.startCarrying(payload.carrierId, payload.injuredSlotId)
      if (ok) Network.broadcast(MSG.STATE_DELTA, { techSlots: State.current.techSlots })
    }
    if (type === MSG.STOP_CARRYING) {
      State.stopCarrying(payload.carrierId)
      Network.broadcast(MSG.STATE_DELTA, { techSlots: State.current.techSlots })
    }
    if (type === MSG.HEAL_REQUEST) {
      // Minigame result for healing is handled via MINIGAME_RESULT — here just acknowledge
      Network.send(senderId, MSG.MINIGAME_START, { crisis: payload.healCrisis })
    }
    if (type === MSG.COOP_PHASE2_START) {
      const ok = State.startCoopPhase2(payload.slotId, payload.crisisId)
      if (ok) {
        Network.broadcast(MSG.STATE_DELTA, { crises: State.current.crises, techSlots: State.current.techSlots })
        // Send minigame start to the tech doing phase 2
        const crisis = State.current.crises[payload.crisisId]
        const typeDef = crisis ? CRISIS_TYPES[crisis.type] : null
        if (typeDef?.minigame2) {
          const crisisForP2 = { ...crisis, minigame: typeDef.minigame2 }
          Network.send(senderId, MSG.MINIGAME_START, { crisis: crisisForP2 })
        }
      }
    }
  }

  function endGame() {
    clearInterval(gameInterval)
    dispatch('gameover', { outcome: gs?.outcome, elapsed: gs?.elapsed })
  }

  // ── Camera grid interaction ───────────────────────────
  function handleCameraClick(roomId) {
    const anomaly = gs?.anomalies?.[roomId]
    const actionDef = pendingAction ? CONTROLLER_ACTIONS[pendingAction] : null

    // If waiting for a target room for an action
    if (pendingAction && actionDef?.requiresTarget) {
      doControllerAction(pendingAction, roomId)
      pendingAction = null
      return
    }

    // Confirm unconfirmed anomaly
    if (anomaly && !anomaly.confirmed) {
      if (appCtx.isHost) {
        State.confirmAnomaly(roomId)
        Network.broadcast(MSG.STATE_DELTA, { anomalies: State.current.anomalies, crises: State.current.crises })
      } else {
        Network.send(Network.hostId, MSG.ANOMALY_CONFIRMED, { roomId })
      }
      selectedRoom = roomId
      return
    }

    selectedRoom = selectedRoom === roomId ? null : roomId
  }

  // ── Controller actions ────────────────────────────────
  function handleActionClick(actionId) {
    if (!gs) return
    const def = CONTROLLER_ACTIONS[actionId]
    if (isActionDisabled(actionId)) return

    if (def.requiresTarget) {
      pendingAction = pendingAction === actionId ? null : actionId
    } else {
      doControllerAction(actionId, null)
    }
  }

  function doControllerAction(actionId, targetRoomId) {
    if (appCtx.isHost) {
      const ok = State.triggerControllerAction(actionId, targetRoomId)
      if (ok) Network.broadcast(MSG.STATE_DELTA, State.computeDelta(null, State.current))
    } else {
      Network.send(Network.hostId, MSG.CONTROLLER_ACTION, { actionId, targetRoomId })
    }
  }

  function isActionDisabled(actionId) {
    if (!gs) return true
    const actionState = gs.controllerActions?.[actionId]
    if (!actionState || actionState.cooldown > 0) return true
    const def = CONTROLLER_ACTIONS[actionId]
    const sysRoom = gs.rooms?.[def.system]
    if (!sysRoom) return false
    return sysRoom.activeCrises.some(id => {
      const c = gs.crises?.[id]
      return c && c.state === 'active' && def.affectedBy.includes(c.type)
    })
  }

  function isActionOffline(actionId) {
    if (!gs) return false
    const def = CONTROLLER_ACTIONS[actionId]
    const sysRoom = gs.rooms?.[def.system]
    if (!sysRoom) return false
    return sysRoom.activeCrises.some(id => {
      const c = gs.crises?.[id]
      return c && c.state === 'active' && def.affectedBy.includes(c.type)
    })
  }

  $: timer     = gs ? formatTime(gs.elapsed) : '00:00'
  $: integrity = gs?.shipIntegrity ?? 100
  $: oxygen    = gs?.oxygenLevel   ?? 100

  $: selectedRoomData  = selectedRoom && gs ? gs.rooms[selectedRoom] : null
  $: selectedRoomImage = selectedRoomData?.status === 'destroyed'
    ? selectedRoomData?.imageDamaged
    : selectedRoomData?.image

  function formatTime(s) {
    const m   = Math.floor(s / 60).toString().padStart(2, '0')
    const sec = (s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }

  function toggleMute() {
    const el = document.getElementById('game-music')
    if (!el) return
    el.muted = !el.muted
    localStorage.setItem('nebula_muted', el.muted ? '1' : '0')
  }
</script>

<div id="screen-controller" class="screen screen--active">
  <div class="controller-container">

    <header class="game-header">
      <div class="game-header__left">
        <span class="game-header__cam">PONT DE CONTRÔLE</span>
        <span class="game-header__role role-badge role-badge--controller">CONTRÔLEUR</span>
      </div>
      <div class="game-header__center">
        <div class="ship-stat">
          <span class="ship-stat__label">INTÉGRITÉ</span>
          <div class="ship-stat__bar"><div class="ship-stat__fill" style="width:{integrity}%"></div></div>
          <span class="ship-stat__val">{Math.round(integrity)}%</span>
        </div>
        <div class="ship-stat">
          <span class="ship-stat__label">OXYGÈNE</span>
          <div class="ship-stat__bar"><div class="ship-stat__fill ship-stat__fill--oxygen" style="width:{oxygen}%"></div></div>
          <span class="ship-stat__val">{Math.round(oxygen)}%</span>
        </div>
      </div>
      <div class="game-header__right">
        <button class="btn btn--ghost btn--sm btn--mute" on:pointerdown={toggleMute} title="Musique">♪</button>
        <div class="game-timer">{timer}</div>
      </div>
    </header>

    <div class="controller-body">

      <!-- Left: camera grid + selected room detail -->
      <div class="controller-main">

        {#if pendingAction}
          <div class="action-prompt">
            <span>Sélectionner une salle cible</span>
            <button class="btn btn--ghost btn--sm" on:pointerdown={() => pendingAction = null}>Annuler</button>
          </div>
        {/if}

        <div class="camera-grid">
          {#each roomList as room}
            {@const anomaly = gs?.anomalies?.[room.id]}
            {@const hasAnomaly = anomaly && !anomaly.confirmed}
            {@const roomState = gs?.rooms?.[room.id]}
            {@const isSelected = selectedRoom === room.id}
            {@const isPendingTarget = pendingAction !== null}
            <div
              class="camera-cell"
              class:camera-cell--anomaly={hasAnomaly}
              class:camera-cell--selected={isSelected}
              class:camera-cell--warning={roomState?.status === 'warning'}
              class:camera-cell--critical={roomState?.status === 'critical'}
              class:camera-cell--destroyed={roomState?.status === 'destroyed'}
              class:camera-cell--target={isPendingTarget}
              on:pointerdown={() => handleCameraClick(room.id)}
            >
              <div class="camera-cell__cctv">
                <span class="camera-cell__rec">● REC</span>
                {#if hasAnomaly}
                  <span class="camera-cell__anomaly-dot" title="Anomalie détectée">◈</span>
                {/if}
              </div>
              <div class="camera-cell__image" style="background-image:url('{roomState?.status === 'destroyed' ? room.imageDamaged : room.image}')">
                <div class="camera-cell__scanlines"></div>
              </div>
              <div class="camera-cell__label">{room.name}</div>
              {#if roomState?.activeCrises?.length}
                <div class="camera-cell__crisis-count">{roomState.activeCrises.length}</div>
              {/if}
            </div>
          {/each}
        </div>

        <!-- Selected room detail -->
        {#if selectedRoomData}
          <div class="room-view room-view--sm room-view--{selectedRoomData.status ?? 'nominal'}">
            <div class="room-view__cctv-frame">
              <span class="room-view__cctv-label">● REC — {selectedRoomData.name}</span>
            </div>
            <div class="room-view__image-wrap">
              <div class="room-view__image" style="background-image:url('{selectedRoomImage}')"></div>
              <div class="room-view__scanlines"></div>
              <div class="room-view__noise"></div>
            </div>
          </div>
        {/if}
      </div>

      <!-- Right sidebar -->
      <div class="controller-sidebar">

        <!-- Action panel -->
        <div class="panel action-panel">
          <div class="panel__label">ACTIONS VAISSEAU</div>
          {#each Object.entries(CONTROLLER_ACTIONS) as [actionId, def]}
            {@const actionState = gs?.controllerActions?.[actionId]}
            {@const offline = isActionOffline(actionId)}
            {@const disabled = isActionDisabled(actionId)}
            {@const isPending = pendingAction === actionId}
            <button
              class="action-btn"
              class:action-btn--disabled={disabled}
              class:action-btn--offline={offline}
              class:action-btn--pending={isPending}
              on:pointerdown={() => handleActionClick(actionId)}
              title={def.desc}
            >
              <span class="action-btn__icon">{def.icon}</span>
              <span class="action-btn__name">{def.name}</span>
              {#if offline}
                <span class="action-btn__status">HORS LIGNE</span>
              {:else if actionState?.cooldown > 0}
                <span class="action-btn__status action-btn__status--cd">{actionState.cooldown}s</span>
              {:else if def.requiresTarget}
                <span class="action-btn__status action-btn__status--ready">▸ CIBLER</span>
              {/if}
            </button>
          {/each}
        </div>

        <!-- Distress signals -->
        {#if gs?.distressSignals?.length}
          <div class="panel distress-feed">
            <div class="panel__label">🔴 DÉTRESSE</div>
            {#each gs.distressSignals.slice(0, 4) as sig}
              <div class="distress-entry">
                <span class="distress-entry__name">{sig.fromName}</span>
                <span class="distress-entry__room">{gs.rooms?.[sig.roomId]?.name ?? sig.roomId}</span>
              </div>
            {/each}
          </div>
        {/if}

        <!-- Active crises -->
        <div class="panel crisis-list-panel">
          <div class="panel__label">ALERTES ACTIVES</div>
          <CrisisList crises={gs?.crises ?? {}} />
        </div>

        <Chat {messages} />
      </div>

    </div>
  </div>
</div>
