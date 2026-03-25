<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte'
  import { gameState, State }        from '../lib/state.js'
  import { Progression }             from '../lib/progression.js'
  import { ROOMS, CONTROLLER_ACTIONS, TECH_SLOTS, CRISIS_TYPES, INJURY_EVENTS } from '../lib/config.js'
  import CrisisList                  from '../components/CrisisList.svelte'
  import MinigameOverlay             from '../components/MinigameOverlay.svelte'

  export let appCtx

  const dispatch = createEventDispatcher()

  let gs            = null
  let activeCrisis  = null     // tech currently doing a minigame
  let activeTechId  = null     // which tech slot triggered the minigame
  let pendingAction = null     // controller action waiting for room target
  let healTargetSlot = null    // injured slot being healed
  let healCarrierId  = null    // carrier doing the healing
  let gameInterval

  const unsubState = gameState.subscribe(s => {
    gs = s
    if (s?.phase === 'gameover') endGame()
  })

  // Rooms ordered by grid position
  const roomList = Object.values(ROOMS).sort((a, b) =>
    a.gridRow !== b.gridRow ? a.gridRow - b.gridRow : a.gridCol - b.gridCol
  )

  onMount(() => {
    const localId = appCtx.profile?.playerId ?? Progression.getLocalId()
    State.init({
      mode: 'solo',
      difficulty: appCtx.difficulty ?? 'normal',
      players: {
        [localId]: {
          peerId: localId,
          callsign: appCtx.profile?.callsign ?? 'Commandant',
          role: 'commander',
          currentRoomId: 'bridge',
          progression: Progression.buildSummary(appCtx.profile),
        },
      },
      localPlayerId: localId,
    })

    State._hasSpec = (specId) => {
      const skills = appCtx.profile?.skills ?? {}
      return Object.values(skills).some(s => s.specialization === specId)
    }

    gameInterval = setInterval(() => { State.tick() }, 1000)
  })

  onDestroy(() => {
    clearInterval(gameInterval)
    unsubState()
  })

  function endGame() {
    clearInterval(gameInterval)
    Progression.recordGameEnd(appCtx.profile, 0)
    dispatch('gameover', { outcome: gs?.outcome, elapsed: gs?.elapsed })
  }

  // ── Tab switching ─────────────────────────────────────
  function switchView(view) {
    pendingAction = null
    State.setSoloView(view)
  }

  // ── Controller view: camera + actions ─────────────────
  function handleCameraClick(roomId) {
    const anomaly = gs?.anomalies?.[roomId]
    const actionDef = pendingAction ? CONTROLLER_ACTIONS[pendingAction] : null

    if (pendingAction && actionDef?.requiresTarget) {
      State.triggerControllerAction(pendingAction, roomId)
      pendingAction = null
      return
    }
    if (anomaly && !anomaly.confirmed) {
      State.confirmAnomaly(roomId)
      return
    }
  }

  function handleActionClick(actionId) {
    if (!gs || isActionDisabled(actionId)) return
    const def = CONTROLLER_ACTIONS[actionId]
    if (def.requiresTarget) {
      pendingAction = pendingAction === actionId ? null : actionId
    } else {
      State.triggerControllerAction(actionId, null)
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

  // ── Tech view: movement + minigames ──────────────────
  function moveTech(techId, roomId) {
    State.moveTech(techId, roomId)
  }

  function startMinigame(techId, crisis) {
    if (activeCrisis) return
    if (!State.startTechCrisis(techId, crisis.id)) return
    activeTechId = techId
    activeCrisis = crisis
  }

  function startCoopPhase2Solo(techId, crisis) {
    if (activeCrisis) return
    const typeDef = CRISIS_TYPES[crisis.type]
    if (!State.startCoopPhase2(techId, crisis.id)) return
    activeTechId = techId
    activeCrisis = { ...crisis, minigame: typeDef?.minigame2 ?? crisis.minigame }
  }

  function startCarry(carrierId, injuredId) {
    State.startCarrying(carrierId, injuredId)
  }

  function stopCarry(carrierId) {
    State.stopCarrying(carrierId)
  }

  function triggerHeal(carrierId, injuredSlotId) {
    if (activeCrisis) return
    const injured = gs.techSlots.find(t => t.id === injuredSlotId)
    if (!injured) return
    const injuryDef = INJURY_EVENTS[injured.injuryType]
    healTargetSlot = injuredSlotId
    healCarrierId = carrierId
    activeTechId = carrierId
    activeCrisis = {
      id: 'heal_' + injuredSlotId,
      name: 'Soigner ' + injured.name,
      minigame: injuryDef?.treatMinigame ?? 'errorscan',
      skillType: 'medical',
      severity: 1,
      xpBase: 30,
    }
  }

  function handleMinigameResult({ success, xp, skillType }) {
    if (healTargetSlot) {
      if (success) {
        State.healTech(healTargetSlot)
        State.stopCarrying(healCarrierId)
      }
      healTargetSlot = null
      healCarrierId = null
    } else {
      if (success && xp) Progression.awardXP(skillType, xp, appCtx.profile)
      State.finishTechCrisis(activeTechId, success)
    }
    setTimeout(() => {
      activeCrisis = null
      activeTechId = null
    }, 2000)
  }

  // ── Reactives ─────────────────────────────────────────
  $: soloView     = gs?.soloView ?? 'controller'
  $: techSlots    = gs?.techSlots ?? []
  $: currentTech  = soloView !== 'controller'
    ? techSlots.find(t => t.id === soloView) ?? null
    : null
  $: techRoom     = currentTech?.currentRoomId ?? null
  $: techRoomData = techRoom && gs ? gs.rooms[techRoom] : null
  $: techRoomImage = techRoomData?.status === 'destroyed'
    ? techRoomData?.imageDamaged
    : techRoomData?.image
  $: techAdjacentRooms = techRoom
    ? (ROOMS[techRoom]?.connections ?? []).map(id => ROOMS[id]).filter(Boolean)
    : []
  $: techRoomCrises = techRoom && gs && currentTech
    ? Object.values(gs.crises ?? {}).filter(c =>
        c.roomId === techRoom && (c.state === 'active' || c.state === 'resolving')
      )
    : []

  $: timer     = gs ? formatTime(gs.elapsed) : '00:00'
  $: integrity = gs?.shipIntegrity ?? 100
  $: oxygen    = gs?.oxygenLevel   ?? 100

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

<div id="screen-commander" class="screen screen--active">
  <div class="commander-container">

    <header class="game-header game-header--compact">
      <div class="game-header__left">
        <!-- Tab bar: switch between controller and each tech -->
        <div class="solo-tabs">
          <button
            class="solo-tab solo-tab--controller"
            class:solo-tab--active={soloView === 'controller'}
            on:pointerdown={() => switchView('controller')}
          >CTRL</button>
          {#each techSlots as tech}
            <button
              class="solo-tab"
              class:solo-tab--active={soloView === tech.id}
              class:solo-tab--injured={tech.injured}
              class:solo-tab--busy={tech.state === 'resolving'}
              on:pointerdown={() => switchView(tech.id)}
            >
              {tech.name}
              {#if tech.injured}<span> ✚</span>{/if}
            </button>
          {/each}
        </div>
      </div>
      <div class="game-header__center">
        <div class="ship-stat ship-stat--sm">
          <span class="ship-stat__label">INTÉG.</span>
          <div class="ship-stat__bar">
            <div class="ship-stat__fill" style="width:{integrity}%"></div>
          </div>
          <span class="ship-stat__val">{Math.round(integrity)}%</span>
        </div>
        <div class="ship-stat ship-stat--sm">
          <span class="ship-stat__label">O²</span>
          <div class="ship-stat__bar">
            <div class="ship-stat__fill ship-stat__fill--oxygen" style="width:{oxygen}%"></div>
          </div>
        </div>
      </div>
      <div class="game-header__right">
        <button class="btn btn--ghost btn--sm btn--mute" on:pointerdown={toggleMute} title="Musique">♪</button>
        <div class="game-timer">{timer}</div>
      </div>
    </header>

    <!-- ── CONTROLLER VIEW ─────────────────────────────── -->
    {#if soloView === 'controller'}
      <div class="commander-body">
        <div class="commander-left">

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

          <div class="panel">
            <div class="panel__label">ALERTES</div>
            <CrisisList crises={gs?.crises ?? {}} compact />
          </div>

          <!-- Distress signals -->
          {#if gs?.distressSignals?.length}
            <div class="panel distress-feed">
              <div class="panel__label">🔴 DÉTRESSE</div>
              {#each gs.distressSignals.slice(0, 3) as sig}
                <div class="distress-entry">
                  <span class="distress-entry__name">{sig.fromName}</span>
                  <span class="distress-entry__room">{gs.rooms?.[sig.roomId]?.name ?? sig.roomId}</span>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <div class="commander-right">
          {#if pendingAction}
            <div class="action-prompt">
              <span>Sélectionner une salle cible pour l'action</span>
              <button class="btn btn--ghost btn--sm" on:pointerdown={() => pendingAction = null}>Annuler</button>
            </div>
          {/if}

          <!-- Camera grid -->
          <div class="camera-grid camera-grid--sm">
            {#each roomList as room}
              {@const anomaly = gs?.anomalies?.[room.id]}
              {@const hasAnomaly = anomaly && !anomaly.confirmed}
              {@const roomState = gs?.rooms?.[room.id]}
              <div
                class="camera-cell"
                class:camera-cell--anomaly={hasAnomaly}
                class:camera-cell--warning={roomState?.status === 'warning'}
                class:camera-cell--critical={roomState?.status === 'critical'}
                class:camera-cell--destroyed={roomState?.status === 'destroyed'}
                class:camera-cell--target={pendingAction !== null}
                on:pointerdown={() => handleCameraClick(room.id)}
              >
                <div class="camera-cell__cctv">
                  <span class="camera-cell__rec">● REC</span>
                  {#if hasAnomaly}
                    <span class="camera-cell__anomaly-dot">◈</span>
                  {/if}
                </div>
                <div class="camera-cell__image" style="background-image:url('{roomState?.status === 'destroyed' ? room.imageDamaged : room.image}')">
                  <div class="camera-cell__scanlines"></div>
                </div>
                <div class="camera-cell__label">{room.name}</div>
                <!-- Show which techs are in this room -->
                <div class="camera-cell__crew">
                  {#each techSlots.filter(t => t.currentRoomId === room.id) as t}
                    <span class="camera-cell__crew-dot" title={t.name}></span>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>

    <!-- ── TECH VIEW ────────────────────────────────────── -->
    {:else if currentTech}
      <div class="tech-solo-view">
        {#if currentTech.injured}
          <div class="tech-injured-banner">
            ✚ {currentTech.name} est blessé ({currentTech.injuryCause}) — À conduire à l'Infirmerie
          </div>
        {/if}

        <!-- Room camera -->
        <div class="room-view room-view--sm room-view--{techRoomData?.status ?? 'nominal'}">
          <div class="room-view__cctv-frame">
            <span class="room-view__cctv-label">● {currentTech.name} — {techRoomData?.name ?? '—'}</span>
          </div>
          <div class="room-view__image-wrap">
            <div class="room-view__image" style="background-image:url('{techRoomImage}')"></div>
            <div class="room-view__scanlines"></div>
            <div class="room-view__noise"></div>
          </div>
        </div>

        <div class="tech-solo-bottom">
          <!-- Crises + carry/heal in current room -->
          <div class="panel">
            <div class="panel__label">PANNES EN COURS</div>

            {#if currentTech.injured}
              <div class="tech-status-msg">
                ✚ Blessé ({currentTech.injuryCause}).
                {#if currentTech.state === 'carried'}
                  En cours de transport...
                {:else}
                  Un coéquipier doit le porter à l'Infirmerie.
                {/if}
              </div>
            {:else}

              <!-- Healing action if carrying someone and in med_bay -->
              {#if currentTech.carrying && techRoom === 'med_bay'}
                {@const carried = gs.techSlots.find(t => t.id === currentTech.carrying)}
                <div class="coop-action">
                  <span>✚ Soigner {carried?.name}</span>
                  <button class="btn btn--primary btn--sm"
                    disabled={!!activeCrisis}
                    on:pointerdown={() => triggerHeal(currentTech.id, currentTech.carrying)}>
                    Soigner
                  </button>
                </div>
              {:else if currentTech.carrying}
                <div class="coop-action coop-action--warning">
                  <span>Porte {gs.techSlots.find(t => t.id === currentTech.carrying)?.name} → Infirmerie</span>
                  <button class="btn btn--ghost btn--sm" on:pointerdown={() => stopCarry(currentTech.id)}>Déposer</button>
                </div>
              {/if}

              <!-- Injured techs nearby to carry -->
              {#each (gs.techSlots ?? []).filter(t => t.id !== currentTech.id && t.injured && t.currentRoomId === techRoom && t.state !== 'carried' && !currentTech.carrying) as inj}
                <div class="coop-action">
                  <span>✚ {inj.name} blessé</span>
                  <button class="btn btn--primary btn--sm" on:pointerdown={() => startCarry(currentTech.id, inj.id)}>Porter</button>
                </div>
              {/each}

              {#if techRoomCrises.length === 0}
                <div class="panel__empty">Aucune panne</div>
              {:else}
                {#each techRoomCrises as crisis}
                  {@const typeDef = CRISIS_TYPES[crisis.type]}
                  {@const isCoop = typeDef?.cooperative}
                  {@const takenByOther = crisis.state === 'resolving' && crisis.assignedTo !== currentTech.id}
                  <div class="crisis-entry crisis-entry__sev--{crisis.severity <= 1 ? 'low' : crisis.severity === 2 ? 'med' : 'high'}">
                    <div class="crisis-entry__info">
                      <span class="crisis-entry__name">{crisis.name}</span>
                      {#if takenByOther}
                        <span class="crisis-entry__coop">⟳ En cours de réparation...</span>
                      {:else if isCoop}
                        <span class="crisis-entry__coop">
                          {crisis.coopPhase1Done ? 'Phase 1 ✓' : '⚙ 2 techniciens requis'}
                        </span>
                      {/if}
                    </div>
                    {#if !takenByOther}
                      {#if !isCoop}
                        <button class="btn btn--primary btn--sm"
                          disabled={!!activeCrisis || currentTech.injured || currentTech.state === 'resolving'}
                          on:pointerdown={() => startMinigame(currentTech.id, crisis)}>
                          Intervenir
                        </button>
                      {:else if !crisis.coopPhase1Done}
                        <button class="btn btn--primary btn--sm"
                          disabled={!!activeCrisis || currentTech.state === 'resolving'}
                          on:pointerdown={() => startMinigame(currentTech.id, crisis)}>
                          Phase 1
                        </button>
                      {/if}
                    {/if}
                  </div>
                {/each}
              {/if}

              <!-- Coop phase 2 available (done by a different tech) -->
              {#each Object.values(gs?.crises ?? {}).filter(c => c.roomId === techRoom && c.state === 'active' && c.coopPhase1Done && c.coopPhase1By !== currentTech.id) as crisis}
                <div class="crisis-entry crisis-entry__sev--low">
                  <div class="crisis-entry__info">
                    <span class="crisis-entry__name">{crisis.name}</span>
                    <span class="crisis-entry__coop">⚙ Phase 2 disponible</span>
                  </div>
                  <button class="btn btn--primary btn--sm"
                    disabled={!!activeCrisis || currentTech.state === 'resolving'}
                    on:pointerdown={() => startCoopPhase2Solo(currentTech.id, crisis)}>
                    Phase 2
                  </button>
                </div>
              {/each}
            {/if}
          </div>

          <!-- Movement -->
          <div class="panel movement-panel">
            <div class="panel__label">DÉPLACEMENTS</div>
            <div class="movement-rooms">
              {#each techAdjacentRooms as room}
                {@const targetState = gs?.rooms?.[room.id]}
                <button
                  class="movement-room-btn"
                  class:movement-room-btn--warning={targetState?.status === 'warning'}
                  class:movement-room-btn--critical={targetState?.status === 'critical'}
                  disabled={currentTech.state === 'resolving' || currentTech.injured}
                  on:pointerdown={() => moveTech(currentTech.id, room.id)}
                >
                  {room.name}
                  {#if targetState?.activeCrises?.length}
                    <span class="movement-room-btn__alert">!</span>
                  {/if}
                </button>
              {/each}
            </div>
          </div>
        </div>
      </div>
    {/if}

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
