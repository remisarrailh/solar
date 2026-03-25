<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte'
  import { Network, MSG } from '../lib/network.js'
  import { Progression }  from '../lib/progression.js'
  import { TECH_SLOTS }   from '../lib/config.js'

  export let appCtx

  const dispatch = createEventDispatcher()

  let players      = {}   // { peerId: { callsign, role, techSlotId, ready } }
  let selectedRole = appCtx.selectedRole ?? 'technician'
  let selectedSlot = TECH_SLOTS[0].id   // default first available slot
  let difficulty   = appCtx.difficulty   ?? 'normal'
  let isReady      = false
  let roomCode     = ''
  let copyLabel    = 'COPIER LE CODE'

  onMount(() => {
    if (appCtx.isHost) {
      Network.host()
      roomCode = Network.myId
      players[Network.myId] = {
        callsign: appCtx.profile?.callsign ?? 'Host',
        role: selectedRole,
        techSlotId: selectedRole === 'technician' ? selectedSlot : null,
        ready: false,
      }
    }

    Network.onMessage   = handleMessage
    Network.onPeerJoin  = (peerId) => {
      players = { ...players, [peerId]: { callsign: '...', role: 'technician', techSlotId: null, ready: false } }
    }
    Network.onPeerLeave = (peerId) => {
      const { [peerId]: _, ...rest } = players
      players = rest
    }
  })

  onDestroy(() => {
    Network.onMessage   = null
    Network.onPeerJoin  = null
    Network.onPeerLeave = null
  })

  function handleMessage({ type, payload, senderId }) {
    if (type === MSG.JOIN) {
      players = {
        ...players,
        [senderId]: { callsign: payload.callsign, role: payload.role, techSlotId: payload.techSlotId ?? null, ready: false }
      }
      if (appCtx.isHost) {
        const summary = Progression.buildSummary(appCtx.profile)
        Network.send(senderId, MSG.WELCOME, { roomCode, players, difficulty, summary })
      }
    }
    if (type === MSG.WELCOME) {
      players    = payload.players
      roomCode   = payload.roomCode
      difficulty = payload.difficulty
    }
    if (type === MSG.PLAYER_JOINED) {
      players = { ...players, [senderId]: payload }
    }
    if (type === MSG.GAME_START) {
      appCtx.difficulty  = payload.difficulty
      appCtx.techSlotId  = selectedRole === 'technician' ? selectedSlot : null
      appCtx.lobbyPlayers = payload.players ?? players
      dispatch('start', { role: selectedRole, techSlotId: appCtx.techSlotId })
    }
  }

  function setRole(role) {
    selectedRole = role
    if (players[Network.myId]) {
      players[Network.myId].role = role
      players[Network.myId].techSlotId = role === 'technician' ? selectedSlot : null
    }
    broadcastJoin()
  }

  function setSlot(slotId) {
    if (isSlotTaken(slotId)) return
    selectedSlot = slotId
    if (players[Network.myId]) {
      players[Network.myId].techSlotId = slotId
    }
    broadcastJoin()
  }

  function broadcastJoin() {
    if (!appCtx.isHost) {
      Network.send(Network.hostId, MSG.JOIN, {
        callsign: appCtx.profile?.callsign,
        role: selectedRole,
        techSlotId: selectedRole === 'technician' ? selectedSlot : null,
      })
    }
  }

  function toggleReady() {
    isReady = !isReady
    if (players[Network.myId]) players[Network.myId].ready = isReady
  }

  function startGame() {
    const startPayload = { difficulty, players }
    Network.broadcast(MSG.GAME_START, startPayload)
    appCtx.difficulty   = difficulty
    appCtx.techSlotId   = selectedRole === 'technician' ? selectedSlot : null
    appCtx.lobbyPlayers = players
    dispatch('start', { role: selectedRole, techSlotId: appCtx.techSlotId })
  }

  async function copyCode() {
    await navigator.clipboard.writeText(roomCode).catch(() => {})
    copyLabel = 'COPIÉ !'
    setTimeout(() => { copyLabel = 'COPIER LE CODE' }, 1500)
  }

  function isSlotTaken(slotId) {
    return Object.entries(players).some(([peerId, p]) =>
      peerId !== Network.myId && p.role === 'technician' && p.techSlotId === slotId
    )
  }

  $: playerList   = Object.entries(players)
  $: canStart     = appCtx.isHost && playerList.length >= 1
  $: takenSlots   = new Set(
    Object.entries(players)
      .filter(([id]) => id !== Network.myId)
      .map(([, p]) => p.techSlotId)
      .filter(Boolean)
  )
</script>

<div id="screen-lobby" class="screen screen--active">
  <div class="lobby-container">
    <header class="screen-header">
      <div class="screen-header__cam">CAM 01 — SALLE DE BRIEFING</div>
      <h2 class="screen-header__title">BRIEFING PRÉ-MISSION</h2>
    </header>

    <div class="lobby-body">
      <!-- Left: room code + player list -->
      <div class="lobby-code-panel panel">
        <div class="panel__label">CODE DE LA SALLE</div>
        <div class="lobby-room-code">{roomCode || '——————'}</div>
        {#if roomCode}
          <button class="btn btn--ghost btn--sm" on:pointerdown={copyCode}>{copyLabel}</button>
        {/if}
        <div class="panel__label" style="margin-top:1rem">ÉQUIPAGE ({playerList.length})</div>
        <div class="lobby-players">
          {#each playerList as [peerId, p]}
            <div class="lobby-player">
              <span class="lobby-player__callsign">{p.callsign}</span>
              <span class="lobby-player__role">{p.role === 'controller' ? 'CTRL' : p.techSlotId ? p.techSlotId.replace('tech_','').toUpperCase() : 'TECH'}</span>
              {#if p.ready}<span class="lobby-player__ready">✓</span>{/if}
            </div>
          {/each}
        </div>
      </div>

      <!-- Right: role + slot selection -->
      <div class="lobby-role-panel panel">
        <div class="panel__label">CHOISIR UN RÔLE</div>
        <div class="role-cards">
          <div class="role-card" class:role-card--selected={selectedRole === 'controller'}
               on:pointerdown={() => setRole('controller')}>
            <div class="role-card__icon">◈</div>
            <div class="role-card__name">CONTRÔLEUR</div>
            <div class="role-card__desc">Vue caméras du vaisseau. Détecte les anomalies. Active les systèmes.</div>
          </div>
          <div class="role-card" class:role-card--selected={selectedRole === 'technician'}
               on:pointerdown={() => setRole('technician')}>
            <div class="role-card__icon">◉</div>
            <div class="role-card__name">TECHNICIEN</div>
            <div class="role-card__desc">Intervient sur le terrain. Répare les pannes. Peut se blesser.</div>
          </div>
        </div>

        <!-- Tech slot picker — only for technicians -->
        {#if selectedRole === 'technician'}
          <div class="panel__label" style="margin-top: 1rem">CHOISIR UN TECHNICIEN</div>
          <div class="slot-picker">
            {#each TECH_SLOTS as slot}
              {@const taken = takenSlots.has(slot.id)}
              <button
                class="slot-btn"
                class:slot-btn--selected={selectedSlot === slot.id}
                class:slot-btn--taken={taken}
                disabled={taken}
                on:pointerdown={() => setSlot(slot.id)}
              >
                <span class="slot-btn__name">{slot.name.toUpperCase()}</span>
                <span class="slot-btn__room">{slot.startRoom.replace('_', ' ')}</span>
                {#if taken}<span class="slot-btn__taken">Pris</span>{/if}
              </button>
            {/each}
          </div>
        {/if}

        <div class="lobby-settings">
          <div class="panel__label">PARAMÈTRES</div>
          {#if appCtx.isHost}
            <label class="setting-row">
              <span>Difficulté</span>
              <select class="select" bind:value={difficulty}>
                <option value="easy">FACILE</option>
                <option value="normal">NORMAL</option>
                <option value="hard">DIFFICILE</option>
              </select>
            </label>
          {:else}
            <div class="setting-row">
              <span>Difficulté</span>
              <span>{difficulty.toUpperCase()}</span>
            </div>
          {/if}
        </div>
      </div>
    </div>

    <div class="lobby-footer">
      <button class="btn btn--ghost" on:pointerdown={() => dispatch('back')}>← RETOUR</button>

      {#if !appCtx.isHost}
        <button class="btn btn--primary"
                class:btn--secondary={isReady}
                on:pointerdown={toggleReady}>
          {isReady ? '✓ PRÊT' : 'PRÊT ▸'}
        </button>
      {/if}

      {#if canStart}
        <button class="btn btn--primary" on:pointerdown={startGame}>LANCER LA MISSION ▸</button>
      {/if}
    </div>
  </div>
</div>
