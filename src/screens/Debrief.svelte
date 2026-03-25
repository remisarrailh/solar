<script>
  import { createEventDispatcher } from 'svelte'

  export let appCtx

  const dispatch = createEventDispatcher()

  const data    = appCtx.debriefData ?? {}
  const outcome = data.outcome ?? 'loss'
  const elapsed = data.elapsed ?? 0

  function formatTime(s) {
    const m   = Math.floor(s / 60).toString().padStart(2, '0')
    const sec = (s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }
</script>

<div id="screen-debrief" class="screen screen--active">
  <div class="debrief-container">
    <header class="screen-header">
      <div class="screen-header__cam">CAM 99 — RAPPORT DE MISSION</div>
      <h2 class="screen-header__title"
          class:debrief-title--win={outcome === 'win'}
          class:debrief-title--loss={outcome === 'loss'}>
        {outcome === 'win' ? 'MISSION ACCOMPLIE' : 'MISSION ÉCHOUÉE'}
      </h2>
    </header>

    <div class="debrief-body">
      <div class="panel debrief-stats">
        <div class="panel__label">STATISTIQUES</div>
        <div class="debrief-stat-grid">
          <div class="debrief-stat">
            <span class="debrief-stat__val">{formatTime(elapsed)}</span>
            <span class="debrief-stat__label">DURÉE</span>
          </div>
        </div>
      </div>
    </div>

    <div class="debrief-footer">
      <button class="btn btn--primary" on:pointerdown={() => dispatch('menu')}>RETOUR AU MENU</button>
    </div>
  </div>
</div>
