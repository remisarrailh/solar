// ══════════════════════════════════════════════════════════
//  Minigame Registry
//  To add a new minigame:
//  1. Create src/minigames/mygame/ with MyGame.svelte + mygame.logic.js + mygame.test.js
//  2. Add an entry below: mytype: () => import('./mygame/MyGame.svelte')
//  3. Add base configs in src/lib/config.js under MINIGAME_CONFIGS
//  4. Map it to a crisis type in CRISIS_TYPES (minigame field)
// ══════════════════════════════════════════════════════════

import { MINIGAME_CONFIGS } from '../lib/config.js'
import { Progression } from '../lib/progression.js'

export const MINIGAMES = {
  wires:     () => import('./wires/Wires.svelte'),
  keypad:    () => import('./keypad/Keypad.svelte'),
  gauges:    () => import('./gauges/Gauges.svelte'),
  circuit:   () => import('./circuit/Circuit.svelte'),
  errorscan: () => import('./errorscan/ErrorScan.svelte'),
}

/**
 * Build a full config for a minigame, applying specialization bonuses.
 * @param {string} type         - minigame type key
 * @param {string} difficulty   - 'easy' | 'normal' | 'hard'
 * @param {object} profile      - player progression profile (or null)
 * @param {boolean} devMode     - if true, timers are disabled in minigame
 */
export function buildConfig(type, difficulty, profile, devMode = false) {
  const baseConfig = MINIGAME_CONFIGS[type]?.[difficulty]
  if (!baseConfig) {
    console.error('[Minigames] Unknown config:', type, difficulty)
    return null
  }

  const config = { ...baseConfig, devMode }
  const skills = profile?.skills ?? {}

  if (type === 'wires') {
    config.colors = [...MINIGAME_CONFIGS.wires.colors]
    if (hasSpec(skills, 'electrical', 'hot_wire'))
      config.timeLimit = Math.round(config.timeLimit * 1.2)
    config.allowOneMistake = hasSpec(skills, 'electrical', 'arc_master')
  }

  if (type === 'keypad') {
    config.length = baseConfig.length
    if (hasSpec(skills, 'security', 'ghost_protocol')) config.displayTime += 1
    config.showTwice = hasSpec(skills, 'security', 'total_recall')
  }

  if (type === 'gauges') {
    config.count = baseConfig.count
    if (hasSpec(skills, 'mechanical', 'field_strip')) config.tolerance += 0.02
    config.autoLockOne = hasSpec(skills, 'mechanical', 'zero_point')
  }

  if (type === 'circuit') {
    config.nodes = baseConfig.nodes
  }

  if (type === 'errorscan') {
    config.count = baseConfig.count
  }

  return config
}

/**
 * Compute XP reward after a successful minigame.
 */
export function computeXP(severity, completionTime, timeLimit) {
  return Progression.computeXP(severity, completionTime, timeLimit)
}

function hasSpec(skills, skillName, specId) {
  return skills[skillName]?.specialization === specId
}
