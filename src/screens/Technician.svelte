<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte'
  import { gameState, State }          from '../lib/state.js'
  import { Network, MSG }              from '../lib/network.js'
  import { ROOMS, CRISIS_TYPES, INJURY_EVENTS } from '../lib/config.js'
  import CrisisList                    from '../components/CrisisList.svelte'
  import Chat                          from '../components/Chat.svelte'
  import MinigameOverlay               from '../components/MinigameOverlay.svelte'

  export let appCtx

  const dispatch = createEventDispatcher()

  let gs           = null
  let messages     = []
  let activeCrisis = null      // crisis object for active minigame
  let isHealMinigame = false   // true when the active minigame is a healing session
  let injuredSlotForHeal = null
  let moveCooldown = false

  const unsubState = gameState.subscribe(s => {
    gs = s
    if (s?.phase === 'gameover') endGame()
  })

  onMount(() => {
    Network.onMessage = handleMessage
  })

  onDestroy(() => {
    Network.onMessage = null
    unsubState()
  })

  // My slot = the tech slot claimed by my peerId
  $: mySlot = gs?.techSlots?.find(t => t.claimedBy === Network.myId) ?? null
  $: myRoom = mySlot?.currentRoomId ?? null
  $: roomData = myRoom && gs ? gs.rooms[myRoom] : null
  $: roomImage = roomData?.status === 'destroyed'
    ? (roomData?.imageDamaged ?? '') : (roomData?.image ?? '')

  // Crises in my current room (all active/resolving — including AI-handled ones)
  $: roomCrises = myRoom && gs
    ? Object.values(gs.crises ?? {}).filter(c =>
        c.roomId === myRoom && (c.state === 'active' || c.state === 'resolving')
      )
    : []

  // Adjacent rooms I can move to
  $: adjacentRooms = myRoom
    ? (ROOMS[myRoom]?.connections ?? []).map(id => ROOMS[id]).filter(Boolean)
    : []

  // Injured techs in my room that I could carry (not already being carried)
  $: injuredNearby = myRoom && gs && mySlot && !mySlot.carrying && !mySlot.injured
    ? (gs.techSlots ?? []).filter(t =>
        t.id !== mySlot.id && t.injured && t.currentRoomId === myRoom && t.state !== 'carried'
      )
    : []

  // Coop crises where phase 1 is done but NOT by me
  $: coopPhase2Available = myRoom && gs && mySlot
    ? Object.values(gs.crises ?? {}).filter(c =>
        c.roomId === myRoom &&
        c.state === 'active' &&
        c.coopPhase1Done &&
        c.coopPhase1By !== mySlot.id
      )
    : []

  // Can I do the healing minigame? (carrying someone in med_bay)
  $: canHeal = mySlot?.carrying && myRoom === 'med_bay'

  function handleMessage({ type, payload }) {
    if (type === MSG.STATE_DELTA)    State.applyDelta(payload)
    if (type === MSG.CHAT)           messages = [...messages, payload]
    if (type === MSG.MINIGAME_START) {
      isHealMinigame = false
      activeCrisis = payload.crisis
    }
    if (type === MSG.GAME_OVER) endGame()
  }

  // ── Movement ──────────────────────────────────────────
  function moveToRoom(roomId) {
    if (!mySlot || moveCooldown) return
    moveCooldown = true
    setTimeout(() => moveCooldown = false, 600)
    // Optimistic local update
    State.moveTech(mySlot.id, roomId)
    Network.send(Network.hostId, MSG.MOVE_REQUEST, { slotId: mySlot.id, roomId })
  }

  // ── DÉTRESSE ──────────────────────────────────────────
  function sendDistress() {
    Network.send(Network.hostId, MSG.DISTRESS_SIGNAL, {
      fromId: Network.myId,
      fromName: appCtx.profile.callsign,
      roomId: myRoom,
    })
  }

  // ── Carry / Heal ──────────────────────────────────────
  function startCarry(injuredId) {
    if (!mySlot) return
    State.startCarrying(mySlot.id, injuredId)
    Network.send(Network.hostId, MSG.START_CARRYING, { carrierId: mySlot.id, injuredSlotId: injuredId })
  }

  function stopCarry() {
    if (!mySlot) return
    State.stopCarrying(mySlot.id)
    Network.send(Network.hostId, MSG.STOP_CARRYING, { carrierId: mySlot.id })
  }

  function triggerHeal() {
    if (!mySlot?.carrying) return
    const injured = gs.techSlots.find(t => t.id === mySlot.carrying)
    if (!injured) return
    const injuryDef = INJURY_EVENTS[injured.injuryType]
    injuredSlotForHeal = injured.id
    isHealMinigame = true
    activeCrisis = {
      id: 'heal_' + injured.id,
      name: 'Soigner ' + injured.name,
      minigame: injuryDef?.treatMinigame ?? 'errorscan',
      skillType: 'medical',
      severity: 1,
      xpBase: 30,
    }
  }

  // ── Minigame ──────────────────────────────────────────
  // Tech requests host to start the minigame; host validates and sends back MSG.MINIGAME_START
  function startMinigame(crisis) {
    if (activeCrisis || !mySlot) return
    // Ask host to validate and start — overlay appears on MSG.MINIGAME_START response
    Network.send(Network.hostId, MSG.MINIGAME_REQUEST, { slotId: mySlot.id, crisisId: crisis.id })
  }

  function startCoopPhase2(crisis) {
    if (activeCrisis || !mySlot) return
    Network.send(Network.hostId, MSG.COOP_PHASE2_START, { slotId: mySlot.id, crisisId: crisis.id })
    // Overlay will appear when host sends MSG.MINIGAME_START back
  }

  function handleMinigameResult({ success, xp, skillType }) {
    if (isHealMinigame) {
      if (success) {
        State.healTech(injuredSlotForHeal)
        State.stopCarrying(mySlot.id)
      }
      Network.send(Network.hostId, MSG.MINIGAME_RESULT, {
        isHeal: true,
        success,
        carrierId: mySlot?.id,
        injuredSlotId: injuredSlotForHeal,
      })
      isHealMinigame = false
      injuredSlotForHeal = null
    } else {
      State.finishTechCrisis(mySlot?.id, success)
      Network.send(Network.hostId, MSG.MINIGAME_RESULT, {
        crisisId: activeCrisis?.id,
        slotId: mySlot?.id,
        success, xp, skillType,
        isHeal: false,
      })
    }
    setTimeout(() => { activeCrisis = null }, 2000)
  }

  function endGame() {
    dispatch('gameover', { outcome: gs?.outcome, elapsed: gs?.elapsed })
  }

  let cctvTime = '00:00:00'
  onMount(() => {
    const cctvInterval = setInterval(() => {
      const now = new Date()
      cctvTime = [now.getHours(), now.getMinutes(), now.getSeconds()]
        .map(n => String(n).padStart(2, '0')).join(':')
    }, 1000)
    return () => clearInterval(cctvInterval)
  })

  function toggleMute() {
    const el = document.getElementById('game-music')
    if (!el) return
    el.muted = !el.muted
    localStorage.setItem('nebula_muted', el.muted ? '1' : '0')
  }
</script>

<div id="screen-technician" class="screen screen--active">
  <div class="technician-container">

    <header class="game-header game-header--compact">
      <div class="game-header__left">
        <span class="game-header__cam">{roomData?.name ?? '—'}</span>
        <span class="game-header__role role-badge role-badge--technician">
          {mySlot?.name ?? 'TECH'}
        </span>
        {#if mySlot?.injured}
          <span class="role-badge" style="border-color:var(--color-critical);color:var(--color-critical)">BLESSÉ</span>
        {:else if mySlot?.carrying}
          <span class="role-badge" style="border-color:var(--color-warning);color:var(--color-warning)">
            PORTE {gs.techSlots.find(t => t.id === mySlot.carrying)?.name ?? '?'}
          </span>
        {/if}
      </div>
      <div class="game-header__center">
        <div class="ship-stat ship-stat--sm">
          <span class="ship-stat__label">INTÉG.</span>
          <div class="ship-stat__bar">
            <div class="ship-stat__fill" style="width:{gs?.shipIntegrity ?? 100}%"></div>
          </div>
        </div>
      </div>
      <div class="game-header__right">
        <button class="btn btn--ghost btn--sm btn--mute" on:pointerdown={toggleMute}>♪</button>
      </div>
    </header>

    <!-- Room camera view -->
    <div class="room-view room-view--{roomData?.status ?? 'nominal'}">
      <div class="room-view__cctv-frame">
        <span class="room-view__cctv-label">● REC</span>
        <span class="room-view__cctv-time">{cctvTime}</span>
      </div>
      <div class="room-view__image-wrap">
        <div class="room-view__image" style="background-image:url('{roomImage}')"></div>
        <div class="room-view__scanlines"></div>
        <div class="room-view__noise"></div>
      </div>
    </div>

    <div class="tech-bottom">

      <!-- Crises + carry/heal actions -->
      <div class="panel tech-crisis-panel">
        <div class="panel__label">PANNES EN COURS</div>

        {#if mySlot?.injured}
          <div class="tech-status-msg">✚ Vous êtes blessé ({mySlot.injuryCause}). Un coéquipier doit vous porter à l'Infirmerie.</div>
        {:else}
          {#if roomCrises.length === 0 && coopPhase2Available.length === 0 && injuredNearby.length === 0 && !canHeal}
            <div class="panel__empty">Aucune panne ici</div>
          {/if}

          <!-- Healing action (in med_bay with carried tech) -->
          {#if canHeal}
            {@const carried = gs.techSlots.find(t => t.id === mySlot.carrying)}
            <div class="coop-action">
              <span>✚ {carried?.name} doit être soigné</span>
              <button class="btn btn--primary btn--sm" on:pointerdown={triggerHeal} disabled={!!activeCrisis}>
                Soigner
              </button>
            </div>
          {/if}

          <!-- Carry injured techs nearby -->
          {#each injuredNearby as inj}
            <div class="coop-action">
              <span>✚ {inj.name} est blessé ({inj.injuryCause})</span>
              <button class="btn btn--primary btn--sm" on:pointerdown={() => startCarry(inj.id)}>
                Porter
              </button>
            </div>
          {/each}

          <!-- Stop carrying button -->
          {#if mySlot?.carrying && !canHeal}
            <div class="coop-action coop-action--warning">
              <span>Portez {gs.techSlots.find(t => t.id === mySlot.carrying)?.name} — amenez-le à l'Infirmerie</span>
              <button class="btn btn--ghost btn--sm" on:pointerdown={stopCarry}>Déposer</button>
            </div>
          {/if}

          <!-- Regular crises -->
          {#each roomCrises as crisis}
            {@const typeDef = CRISIS_TYPES[crisis.type]}
            {@const isCoop = typeDef?.cooperative}
            {@const myPhase1 = isCoop && crisis.coopPhase1By === mySlot?.id}
            {@const takenByOther = crisis.state === 'resolving' && crisis.assignedTo !== mySlot?.id}
            <div class="crisis-entry crisis-entry__sev--{crisis.severity <= 1 ? 'low' : crisis.severity === 2 ? 'med' : 'high'}">
              <div class="crisis-entry__info">
                <span class="crisis-entry__name">{crisis.name}</span>
                {#if takenByOther}
                  <span class="crisis-entry__coop">⟳ En cours de réparation...</span>
                {:else if isCoop}
                  <span class="crisis-entry__coop">
                    {crisis.coopPhase1Done
                      ? (myPhase1 ? 'Phase 1 ✓ — En attente du partenaire' : 'Phase 1 ✓')
                      : '⚙ Réparation conjointe — Phase 1/2'}
                  </span>
                {/if}
              </div>
              {#if !takenByOther}
                {#if !isCoop}
                  <button class="btn btn--primary btn--sm"
                    disabled={!!activeCrisis || mySlot?.state === 'resolving'}
                    on:pointerdown={() => startMinigame(crisis)}>
                    Intervenir
                  </button>
                {:else if !crisis.coopPhase1Done}
                  <button class="btn btn--primary btn--sm"
                    disabled={!!activeCrisis || mySlot?.state === 'resolving'}
                    on:pointerdown={() => startMinigame(crisis)}>
                    Phase 1
                  </button>
                {/if}
              {/if}
            </div>
          {/each}

          <!-- Coop phase 2 (phase 1 done by someone else) -->
          {#each coopPhase2Available as crisis}
            <div class="crisis-entry crisis-entry__sev--low">
              <div class="crisis-entry__info">
                <span class="crisis-entry__name">{crisis.name}</span>
                <span class="crisis-entry__coop">⚙ Phase 2 disponible</span>
              </div>
              <button class="btn btn--primary btn--sm"
                disabled={!!activeCrisis || mySlot?.state === 'resolving'}
                on:pointerdown={() => startCoopPhase2(crisis)}>
                Phase 2
              </button>
            </div>
          {/each}
        {/if}
      </div>

      <!-- Movement panel -->
      <div class="panel movement-panel">
        <div class="panel__label">DÉPLACEMENTS</div>
        <div class="movement-rooms">
          {#each adjacentRooms as room}
            {@const targetState = gs?.rooms?.[room.id]}
            <button
              class="movement-room-btn"
              class:movement-room-btn--warning={targetState?.status === 'warning'}
              class:movement-room-btn--critical={targetState?.status === 'critical'}
              class:movement-room-btn--open={targetState?.openAccess > 0}
              disabled={mySlot?.injured || mySlot?.state === 'resolving'}
              on:pointerdown={() => moveToRoom(room.id)}
            >
              {room.name}
              {#if targetState?.activeCrises?.length}
                <span class="movement-room-btn__alert">!</span>
              {/if}
            </button>
          {/each}
        </div>
        <button class="btn btn--distress" on:pointerdown={sendDistress}>
          🔴 DÉTRESSE
        </button>
      </div>
    </div>

    <Chat {messages} compact />
  </div>

  {#if activeCrisis}
    <MinigameOverlay
      crisis={activeCrisis}
      difficulty={appCtx.difficulty}
      profile={appCtx.profile}
      onResult={handleMinigameResult}
    />
  {/if}
</div>
