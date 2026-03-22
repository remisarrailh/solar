// ══════════════════════════════════════════════════════════
//  Minigame Dispatcher
//  Contract: every module exports init(container, config, onComplete) + destroy()
// ══════════════════════════════════════════════════════════

import { MINIGAME_CONFIGS } from '../config.js'
import { Progression } from '../progression.js'

const MODULE_MAP = {
  wires:     () => import('./wires.js'),
  keypad:    () => import('./keypad.js'),
  gauges:    () => import('./gauges.js'),
  circuit:   () => import('./circuit.js'),
  errorscan: () => import('./errorscan.js'),
}

let _activeModule = null

export const MinigameDispatcher = {

  active: null,

  /**
   * Trigger a minigame.
   * @param {string} crisisId
   * @param {string} minigameType  e.g. 'wires'
   * @param {string} difficulty    e.g. 'normal'
   * @param {string} skillType     e.g. 'electrical'
   * @param {object} profile       player progression profile
   * @param {HTMLElement} container DOM element to render into
   * @param {function} onComplete  fn({ success, completionTime, xp })
   */
  async trigger(crisisId, minigameType, difficulty, skillType, severity, profile, container, onComplete) {
    // Abort previous
    this.abort()

    const baseConfig = MINIGAME_CONFIGS[minigameType]?.[difficulty]
    if (!baseConfig) {
      console.error('Unknown minigame:', minigameType)
      return
    }

    // Build config with specialization bonuses
    const config = buildConfig(minigameType, baseConfig, difficulty, profile)

    const loader = MODULE_MAP[minigameType]
    if (!loader) return

    const module = await loader()
    _activeModule = module
    this.active = crisisId

    module.init(container, config, ({ success, completionTime }) => {
      const xp = success
        ? Progression.computeXP(severity, completionTime, config.timeLimit)
        : 0
      this.active = null
      _activeModule = null
      onComplete({ success, completionTime, xp, skillType })
    })
  },

  abort() {
    if (_activeModule?.destroy) _activeModule.destroy()
    _activeModule = null
    this.active = null
  },
}

// ── Config Builder ─────────────────────────────────────────
function buildConfig(type, base, difficulty, profile) {
  const config = { ...base }
  const skills = profile?.skills ?? {}

  if (type === 'wires') {
    const colors = [...MINIGAME_CONFIGS.wires.colors]
    config.colors = colors
    // Hot Wire: +20% time
    if (hasSpec(skills, 'electrical', 'hot_wire')) {
      config.timeLimit = Math.round(config.timeLimit * 1.2)
    }
    // Arc Master: allow 1 mistake
    config.allowOneMistake = hasSpec(skills, 'electrical', 'arc_master')
  }

  if (type === 'keypad') {
    // Generate random code
    config.code = Array.from({ length: base.length }, () => Math.floor(Math.random() * 10))
    // Ghost Protocol: +1s display
    if (hasSpec(skills, 'security', 'ghost_protocol')) config.displayTime += 1
    // Total Recall: show twice
    config.showTwice = hasSpec(skills, 'security', 'total_recall')
    config.length = base.length
  }

  if (type === 'gauges') {
    // Generate random targets
    config.targets = Array.from({ length: base.count }, () => Math.round(Math.random() * 80 + 10) / 100)
    config.count = base.count
    // Field Strip: tolerance +0.02
    if (hasSpec(skills, 'mechanical', 'field_strip')) config.tolerance += 0.02
    // Zero-Point: auto-lock one gauge
    config.autoLockOne = hasSpec(skills, 'mechanical', 'zero_point')
  }

  if (type === 'circuit') {
    // Generate random sequence
    const nodeCount = base.nodes
    config.nodes = nodeCount
    const seq = shuffle(Array.from({ length: nodeCount }, (_, i) => i + 1))
    config.sequence = seq.slice(0, Math.min(nodeCount, 6))
  }

  if (type === 'errorscan') {
    // Generate random difference positions
    config.differences = Array.from({ length: base.count }, () => ({
      x: Math.random() * 0.7 + 0.1,
      y: Math.random() * 0.7 + 0.1,
      radius: 0.06,
    }))
    config.count = base.count
  }

  return config
}

function hasSpec(skills, skillName, specId) {
  return skills[skillName]?.specialization === specId
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
