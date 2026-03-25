<script>
  import { createEventDispatcher } from 'svelte'
  import { Network, MSG }  from '../lib/network.js'
  import { Progression }   from '../lib/progression.js'

  export let appCtx

  const dispatch = createEventDispatcher()

  let showJoinOverlay = false
  let showNameOverlay = false
  let joinCode        = ''
  let joinError       = ''
  let callsign        = appCtx.profile?.callsign ?? ''
  let pendingAction   = null  // 'host' | 'join' | 'solo'

  $: playerId = appCtx.myPeerId ?? '—'

  function requireCallsign(action) {
    if (appCtx.profile?.callsign && appCtx.profile.callsign !== 'Opérateur') {
      doAction(action)
    } else {
      pendingAction = action
      showNameOverlay = true
    }
  }

  function confirmName() {
    if (!callsign.trim()) return
    appCtx.profile = Progression.setCallsign(appCtx.profile, callsign)
    showNameOverlay = false
    doAction(pendingAction)
  }

  function doAction(action) {
    if (action === 'host')  { dispatch('host') }
    if (action === 'join')  { showJoinOverlay = true }
    if (action === 'solo')  { dispatch('solo') }
  }

  async function confirmJoin() {
    if (!joinCode.trim()) return
    joinError = ''
    try {
      await Network.join(joinCode.trim())
      showJoinOverlay = false
      dispatch('join')
    } catch (e) {
      joinError = 'Connexion impossible. Vérifiez le code.'
    }
  }
</script>

<div id="screen-main-menu" class="screen screen--active">
  <div class="menu-container">
    <header class="menu-header">
      <div class="menu-header__cctv">CAM 00 — PONT PRINCIPAL</div>
      <h1 class="menu-header__title">NEBULA<br><span>PROTOCOL</span></h1>
      <div class="menu-header__sub">SYSTÈME DE GESTION DE CRISE — NIVEAU ROUGE</div>
    </header>

    <nav class="menu-nav">
      <button class="btn btn--primary menu-btn" on:pointerdown={() => requireCallsign('host')}>
        <span class="btn__icon">◈</span> CRÉER UNE PARTIE
      </button>
      <button class="btn btn--primary menu-btn" on:pointerdown={() => requireCallsign('join')}>
        <span class="btn__icon">◉</span> REJOINDRE UNE PARTIE
      </button>
      <button class="btn btn--secondary menu-btn" on:pointerdown={() => requireCallsign('solo')}>
        <span class="btn__icon">◇</span> MODE SOLO — COMMANDANT
      </button>
      <button class="btn btn--ghost menu-btn" on:pointerdown={() => dispatch('progression')}>
        <span class="btn__icon">◈</span> PROGRESSION
      </button>
    </nav>

    <div class="menu-footer">
      <span>ID OPÉRATEUR : <span>{playerId}</span></span>
      <span>PROTOCOLE PeerJS ACTIF</span>
    </div>
  </div>

  <!-- Join overlay -->
  {#if showJoinOverlay}
    <div class="overlay">
      <div class="overlay__panel">
        <div class="overlay__title">ENTRER LE CODE DE LA SALLE</div>
        <input class="input-code" type="text" placeholder="79785f25-0ed3-4e5b-..." maxlength="36"
               bind:value={joinCode} autocomplete="off" spellcheck="false" />
        <div class="overlay__actions">
          <button class="btn btn--primary" on:pointerdown={confirmJoin}>SE CONNECTER</button>
          <button class="btn btn--ghost"   on:pointerdown={() => { showJoinOverlay = false; joinError = '' }}>ANNULER</button>
        </div>
        {#if joinError}
          <div class="overlay__error">{joinError}</div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Name overlay -->
  {#if showNameOverlay}
    <div class="overlay">
      <div class="overlay__panel">
        <div class="overlay__title">IDENTITÉ DE L'OPÉRATEUR</div>
        <input class="input-code" type="text" placeholder="CALLSIGN" maxlength="16"
               bind:value={callsign} autocomplete="off" spellcheck="false" />
        <div class="overlay__actions">
          <button class="btn btn--primary" on:pointerdown={confirmName}>CONFIRMER</button>
        </div>
      </div>
    </div>
  {/if}
</div>
