<script>
  import { MINIGAMES, buildConfig, computeXP } from '../minigames/index.js'

  export let crisis     = null    // crisis object to resolve
  export let difficulty = 'normal'
  export let profile    = null
  export let onResult   = null    // ({ success, xp, skillType }) => void
  export let devMode    = false

  let activeComponent = null
  let config          = null
  let result          = null
  let timer           = 0
  let timerInterval

  $: if (crisis && !activeComponent) launchMinigame()

  async function launchMinigame() {
    result = null
    timer  = 0

    const cfg = buildConfig(crisis.minigame, difficulty, profile, devMode)
    if (!cfg) return

    config = cfg
    timer  = cfg.timeLimit

    const module = await MINIGAMES[crisis.minigame]()
    activeComponent = module.default

    if (!devMode) {
      timerInterval = setInterval(() => {
        timer = Math.max(0, timer - 1)
      }, 1000)
    }
  }

  function handleComplete({ success, completionTime }) {
    clearInterval(timerInterval)
    activeComponent = null

    const xp = success ? computeXP(crisis.severity, completionTime, config.timeLimit) : 0
    result = { success, xp }

    onResult?.({ success, xp, skillType: crisis.skillType })
  }

  $: if (!crisis) {
    clearInterval(timerInterval)
    activeComponent = null
    result = null
  }
</script>

{#if crisis}
  <div class="minigame-overlay">
    <div class="minigame-overlay__header">
      <div class="minigame-overlay__crisis-name">{crisis.name.toUpperCase()}</div>
      {#if !devMode}
        <div class="minigame-overlay__timer" class:minigame-overlay__timer--critical={timer <= 10}>
          {timer}
        </div>
      {:else}
        <div class="minigame-overlay__timer">∞</div>
      {/if}
    </div>

    <div class="minigame-container">
      {#if activeComponent}
        <svelte:component
          this={activeComponent}
          {config}
          onComplete={handleComplete}
        />
      {/if}
    </div>

    {#if result !== null}
      <div class="minigame-overlay__result">
        <div class="mg-result__icon">{result.success ? '✓' : '✗'}</div>
        <div class="mg-result__text">{result.success ? 'RÉPARATION RÉUSSIE' : 'ÉCHEC DE RÉPARATION'}</div>
        {#if result.success}
          <div class="mg-result__xp">+{result.xp} XP</div>
        {/if}
      </div>
    {/if}
  </div>
{/if}
