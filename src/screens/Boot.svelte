<script>
  import { createEventDispatcher, onMount } from 'svelte'
  import { Progression } from '../lib/progression.js'
  import { Network }     from '../lib/network.js'

  const dispatch = createEventDispatcher()

  let line1visible = true
  let line2visible = false
  let line3visible = false
  let errorMsg     = ''
  let showError    = false
  let showRetry    = false

  // Audio
  const Audio = {
    _el: null, _muted: false, _started: false,
    init() {
      this._el = document.getElementById('game-music')
      if (!this._el) return
      this._muted = localStorage.getItem('nebula_muted') === '1'
      this._el.volume = 0.45
      this._el.muted = this._muted
      document.addEventListener('pointerdown', () => this._tryStart(), { once: true })
      document.addEventListener('keydown',     () => this._tryStart(), { once: true })
    },
    _tryStart() {
      if (this._started || !this._el) return
      this._started = true
      this._el.play().catch(() => { this._started = false })
    },
  }

  async function boot() {
    const profile = Progression.load()
    Audio.init()

    setTimeout(() => { line2visible = true }, 500)
    setTimeout(() => { line3visible = true }, 1000)

    try {
      const myPeerId = await Network.init()
      setTimeout(() => {
        dispatch('done', { profile, myPeerId })
      }, 1400)
    } catch (err) {
      errorMsg  = 'Impossible de se connecter au réseau.'
      showError = true
      showRetry = true
    }
  }

  onMount(() => boot())
</script>

<div id="screen-boot" class="screen screen--active">
  <div class="boot-container">
    <div class="boot-logo">
      <span class="boot-logo__prefix">// SYS</span>
      <h1 class="boot-logo__title">NEBULA<br>PROTOCOL</h1>
      <span class="boot-logo__version">v1.0.0 — RESTRICTED ACCESS</span>
    </div>
    <div class="boot-status">
      <div class="boot-status__line" class:boot-status__line--hidden={!line1visible}>
        ▸ Initialisation du réseau P2P...
      </div>
      <div class="boot-status__line" class:boot-status__line--hidden={!line2visible}>
        ▸ Chargement des modules systèmes...
      </div>
      <div class="boot-status__line" class:boot-status__line--hidden={!line3visible}>
        ▸ Connexion établie.
      </div>
    </div>
    {#if showError}
      <div class="boot-error">
        <span class="boot-error__icon">⚠</span>
        <span>{errorMsg}</span>
        {#if showRetry}
          <button class="btn btn--ghost" on:pointerdown={() => { showError = false; showRetry = false; boot() }}>
            RÉESSAYER
          </button>
        {/if}
      </div>
    {/if}
  </div>
</div>
