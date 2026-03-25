<script>
  import { MINIGAMES, buildConfig } from '../minigames/index.js'
  import { MINIGAME_CONFIGS } from '../lib/config.js'

  // URL params: ?dev=wires&difficulty=normal
  const params   = new URLSearchParams(window.location.search)
  const initType = params.get('dev') || 'wires'
  const initDiff = params.get('difficulty') || 'normal'

  const types       = Object.keys(MINIGAMES)
  const difficulties = ['easy', 'normal', 'hard']

  let selectedType = types.includes(initType) ? initType : 'wires'
  let selectedDiff = difficulties.includes(initDiff) ? initDiff : 'normal'

  let activeComponent = null
  let activeConfig    = null
  let result          = null   // { success, completionTime }
  let key = 0                  // forces component remount on replay

  async function launchMinigame() {
    result = null
    key++
    const config = buildConfig(selectedType, selectedDiff, null, true)  // devMode = true
    const module = await MINIGAMES[selectedType]()
    activeComponent = module.default
    activeConfig    = config
  }

  function handleComplete(r) {
    result = r
    activeComponent = null
    activeConfig    = null
  }

  // Auto-launch if URL had ?dev= param
  $: if (selectedType && !activeComponent && !result) {
    // only auto-launch on first render
  }
</script>

<div class="dev-playground">
  <header class="dev-playground__header">
    <div class="dev-playground__title">// DEV PLAYGROUND</div>
    <div class="dev-playground__subtitle">Minuteurs désactivés — Résultat affiché directement</div>
  </header>

  {#if !activeComponent && !result}
    <div class="dev-playground__controls">
      <label class="dev-playground__field">
        <span class="panel__label">MINIJEU</span>
        <select class="select" bind:value={selectedType}>
          {#each types as t}
            <option value={t}>{t.toUpperCase()}</option>
          {/each}
        </select>
      </label>

      <label class="dev-playground__field">
        <span class="panel__label">DIFFICULTÉ</span>
        <select class="select" bind:value={selectedDiff}>
          <option value="easy">FACILE</option>
          <option value="normal">NORMAL</option>
          <option value="hard">DIFFICILE</option>
        </select>
      </label>

      <button class="btn btn--primary" on:pointerdown={launchMinigame}>
        ▸ LANCER
      </button>
    </div>

    <div class="dev-playground__tip">
      <span class="panel__label">ASTUCE</span>
      URL directe : <code>?dev=wires&amp;difficulty=hard</code>
    </div>
  {/if}

  {#if activeComponent && activeConfig}
    <div class="dev-playground__game">
      {#key key}
        <svelte:component
          this={activeComponent}
          config={activeConfig}
          onComplete={handleComplete}
        />
      {/key}
    </div>
  {/if}

  {#if result !== null}
    <div class="dev-playground__result"
         class:dev-playground__result--success={result.success}
         class:dev-playground__result--fail={!result.success}>

      <div class="dev-playground__result-icon">{result.success ? '✓' : '✗'}</div>
      <div class="dev-playground__result-status">
        {result.success ? 'RÉUSSI' : 'ÉCHEC'}
      </div>
      {#if result.success}
        <div class="dev-playground__result-time">
          Temps : {result.completionTime}s
        </div>
      {/if}

      <button class="btn btn--primary" on:pointerdown={launchMinigame}>
        ↺ REJOUER
      </button>
      <button class="btn btn--ghost" on:pointerdown={() => { result = null; activeComponent = null }}>
        ← RETOUR
      </button>
    </div>
  {/if}
</div>

<style>
  .dev-playground {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2rem 1rem;
    background: var(--color-bg);
    color: var(--color-text);
  }

  .dev-playground__header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .dev-playground__title {
    font-family: var(--font-display);
    font-size: 1.4rem;
    color: var(--color-accent);
    letter-spacing: 0.2em;
  }

  .dev-playground__subtitle {
    font-size: 0.75rem;
    color: var(--color-text-dim);
    margin-top: 0.25rem;
    letter-spacing: 0.1em;
  }

  .dev-playground__controls {
    display: flex;
    gap: 1.5rem;
    align-items: flex-end;
    flex-wrap: wrap;
    justify-content: center;
    margin-bottom: 1.5rem;
  }

  .dev-playground__field {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .dev-playground__tip {
    font-size: 0.75rem;
    color: var(--color-text-dim);
    text-align: center;
    margin-bottom: 2rem;
  }

  .dev-playground__tip code {
    color: var(--color-accent);
    font-family: var(--font-mono);
  }

  .dev-playground__game {
    width: 100%;
    max-width: 700px;
  }

  .dev-playground__result {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 2rem;
    border: 1px solid var(--color-border);
    background: var(--color-panel);
    min-width: 260px;
  }

  .dev-playground__result--success { border-color: var(--color-accent); }
  .dev-playground__result--fail    { border-color: var(--color-critical); }

  .dev-playground__result-icon {
    font-size: 3rem;
    line-height: 1;
  }

  .dev-playground__result--success .dev-playground__result-icon { color: var(--color-accent); }
  .dev-playground__result--fail    .dev-playground__result-icon { color: var(--color-critical); }

  .dev-playground__result-status {
    font-family: var(--font-display);
    font-size: 1.2rem;
    letter-spacing: 0.2em;
  }

  .dev-playground__result-time {
    font-size: 0.9rem;
    color: var(--color-text-dim);
  }
</style>
