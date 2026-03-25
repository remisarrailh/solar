<script>
  export let crises   = {}
  export let compact  = false
  export let onCrisis = null

  $: activeCrises = Object.values(crises).filter(
    c => c.state === 'active' || c.state === 'resolving'
  ).sort((a, b) => a.timerRemaining - b.timerRemaining)

  function timerClass(c) {
    if (c.timerRemaining <= 10) return 'crisis-entry__timer--critical'
    if (c.timerRemaining <= 30) return 'crisis-entry__timer--warning'
    return ''
  }
</script>

<div class="crisis-list" class:crisis-list--compact={compact}>
  {#if activeCrises.length === 0}
    <div class="crisis-list__empty">Aucune alerte.</div>
  {:else}
    {#each activeCrises as crisis (crisis.id)}
      <div
        class="crisis-entry"
        class:crisis-entry--warning={crisis.severity === 1}
        class:crisis-entry--critical={crisis.severity >= 2}
        on:pointerdown={() => onCrisis?.(crisis.id)}
      >
        <div class="crisis-entry__sev crisis-entry__sev--{crisis.severity}"></div>
        <div class="crisis-entry__info">
          <div class="crisis-entry__name">{crisis.name}</div>
          {#if !compact}
            <div class="crisis-entry__room">{crisis.roomId.replace(/_/g, ' ').toUpperCase()}</div>
          {/if}
        </div>
        <div class="crisis-entry__timer {timerClass(crisis)}">{crisis.timerRemaining}s</div>
      </div>
    {/each}
  {/if}
</div>
