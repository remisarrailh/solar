<!--
  ══════════════════════════════════════════════════════════
   MINIGAME TEMPLATE — Copier ce fichier pour créer un nouveau minijeu

   CHECKLIST POUR UN NOUVEAU MINIJEU :
   1. Copier ce fichier dans src/minigames/montype/MonType.svelte
   2. Créer src/minigames/montype/montype.logic.js  (logique pure, testable)
   3. Créer src/minigames/montype/montype.test.js   (tests Vitest)
   4. Ajouter l'entrée dans src/minigames/index.js  (registre)
   5. Ajouter le config dans src/lib/config.js      (MINIGAME_CONFIGS)
   6. Associer à un type de crise dans CRISIS_TYPES (champ minigame)
  ══════════════════════════════════════════════════════════
-->

<script>
  import { onMount, onDestroy } from 'svelte'
  // import { maLogique } from './montype.logic.js'

  // ── Props obligatoires ──────────────────────────────────
  export let config    // Reçoit: { ...configDeBase, devMode: bool }
  export let onComplete  // Appeler avec: ({ success: bool, completionTime: number })

  // ── État local ──────────────────────────────────────────
  let done = false
  let _timer = config.devMode ? Infinity : config.timeLimit
  let timerInterval

  // ── Lifecycle ───────────────────────────────────────────
  onMount(() => {
    // Initialiser le jeu ici

    // Timer (automatiquement désactivé en devMode)
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
    // Nettoyer les autres ressources ici
  })

  // ── Logique du jeu ──────────────────────────────────────
  function handleSuccess() {
    if (done) return
    done = true
    const elapsed = config.devMode ? 0 : config.timeLimit - _timer
    setTimeout(() => onComplete({ success: true, completionTime: elapsed }), 300)
  }

  function handleFailure() {
    if (done) return
    done = true
    onComplete({ success: false, completionTime: config.timeLimit })
  }
</script>

<!-- ── Template HTML ──────────────────────────────────── -->
<div class="mg-montype">
  <div class="mg-montype__hint">INSTRUCTION DU MINIJEU ICI</div>

  <!-- Contenu du minijeu -->
  <button on:pointerdown={handleSuccess}>RÉUSSIR (TEMP)</button>
  <button on:pointerdown={handleFailure}>ÉCHOUER (TEMP)</button>
</div>

<!-- ── Styles scoped (optionnels) ─────────────────────── -->
<style>
  /* Les styles ici ne s'appliquent qu'à ce composant */
  /* Préférer ajouter les styles dans css/main.css pour la cohérence globale */
</style>
