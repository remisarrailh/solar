<script>
  import { createEventDispatcher } from 'svelte'
  import { Progression }  from '../lib/progression.js'
  import { SKILL_NAMES, SPECIALIZATIONS } from '../lib/config.js'

  export let appCtx

  const dispatch = createEventDispatcher()

  let profile = appCtx.profile ?? Progression.load()

  function reset() {
    if (!confirm('Réinitialiser la progression ?')) return
    profile = Progression.reset()
    appCtx.profile = profile
  }

  $: skillList = Object.entries(SKILL_NAMES).map(([key, name]) => ({
    key,
    name,
    ...profile.skills[key],
  }))

  $: unlockedSpecs = skillList
    .filter(s => s.specialization)
    .map(s => ({
      skillName: s.name,
      spec: SPECIALIZATIONS[s.key]?.[s.level] ?? SPECIALIZATIONS[s.key]?.[5],
    }))
    .filter(s => s.spec)
</script>

<div id="screen-progression" class="screen screen--active">
  <div class="progression-container">
    <header class="screen-header">
      <div class="screen-header__cam">CAM 03 — DOSSIER OPÉRATEUR</div>
      <h2 class="screen-header__title">PROGRESSION</h2>
    </header>

    <div class="progression-body">
      <div class="panel prog-profile">
        <div class="panel__label">PROFIL</div>
        <div class="prog-callsign">{profile.callsign}</div>
        <div class="prog-stats-row">
          <div class="prog-stat">
            <span class="prog-stat__val">{profile.totalGames}</span>
            <span class="prog-stat__label">MISSIONS</span>
          </div>
          <div class="prog-stat">
            <span class="prog-stat__val">{profile.crisisesResolved}</span>
            <span class="prog-stat__label">PANNES RÉSOLUES</span>
          </div>
        </div>
      </div>

      <div class="panel prog-skills">
        <div class="panel__label">COMPÉTENCES</div>
        <div class="skill-list">
          {#each skillList as skill}
            <div class="skill-row">
              <span class="skill-row__name">{skill.name}</span>
              <span class="skill-row__level">L{skill.level}</span>
              <div class="skill-row__bar">
                <div class="skill-row__fill"
                     style="width:{skill.level >= 10 ? 100 : (skill.xp / skill.xpToNext) * 100}%">
                </div>
              </div>
              {#if skill.specialization}
                <span class="skill-row__spec">{skill.specialization}</span>
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <div class="panel prog-specs">
        <div class="panel__label">SPÉCIALISATIONS DÉBLOQUÉES</div>
        {#if unlockedSpecs.length === 0}
          <div class="spec-list__empty">Aucune spécialisation débloquée.</div>
        {:else}
          <div class="spec-list">
            {#each unlockedSpecs as { skillName, spec }}
              <div class="spec-item">
                <div class="spec-item__name">{spec.name}</div>
                <div class="spec-item__skill">{skillName}</div>
                <div class="spec-item__desc">{spec.desc}</div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <div class="progression-footer">
      <button class="btn btn--ghost" on:pointerdown={() => dispatch('back')}>← RETOUR</button>
      <button class="btn btn--ghost btn--danger" on:pointerdown={reset}>RÉINITIALISER</button>
    </div>
  </div>
</div>
