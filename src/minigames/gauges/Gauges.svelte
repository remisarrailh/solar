<script>
  import { onMount, onDestroy } from 'svelte'
  import { generateTargets, isGaugeOk } from './gauges.logic.js'

  export let config    // { count, tolerance, timeLimit, autoLockOne, devMode }
  export let onComplete

  let done = false
  let _timer = config.devMode ? Infinity : config.timeLimit
  let timerInterval

  const lockedIndex = config.autoLockOne ? 0 : -1
  const targets = generateTargets(config.count)

  // Initial slider values: locked gauge = target, others random
  let values = targets.map((t, i) =>
    i === lockedIndex ? Math.round(t * 100) : Math.round(Math.random() * 100)
  )

  $: gaugeOk = values.map((v, i) =>
    i === lockedIndex ? true : isGaugeOk(v / 100, targets[i], config.tolerance)
  )

  $: allOk = gaugeOk.every(Boolean)

  // Watch for completion
  $: if (allOk && !done) {
    done = true
    const elapsed = config.devMode ? 0 : config.timeLimit - _timer
    setTimeout(() => onComplete({ success: true, completionTime: elapsed }), 400)
  }

  onMount(() => {
    if (!config.devMode) {
      timerInterval = setInterval(() => {
        _timer -= 1
        if (_timer <= 0 && !done) {
          done = true
          clearInterval(timerInterval)
          onComplete({ success: false, completionTime: config.timeLimit })
        }
      }, 1000)
    }
  })

  onDestroy(() => {
    clearInterval(timerInterval)
  })
</script>

<div class="mg-gauges" style="position:relative;padding-top:2rem">
  <div style="position:absolute;top:8px;left:0;right:0;text-align:center;font-size:9px;letter-spacing:0.2em;color:var(--color-text-dim)">
    ALIGNER LES JAUGES SUR LES CIBLES
  </div>

  {#each targets as target, i}
    <div class="mg-gauge" class:mg-gauge--ok={gaugeOk[i]}>
      <div class="mg-gauge__track" style={i === lockedIndex ? 'border-color:var(--color-accent)' : ''}>
        <div class="mg-gauge__target" style="bottom:{target * 100}%;top:auto"></div>
        <input
          type="range"
          min="0" max="100"
          bind:value={values[i]}
          disabled={i === lockedIndex}
        />
      </div>
      <div class="mg-gauge__label">{String.fromCharCode(65 + i)}</div>
    </div>
  {/each}
</div>
