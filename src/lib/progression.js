// ══════════════════════════════════════════════════════════
//  NEBULA PROTOCOL — Progression System
//  All local, reads/writes localStorage
// ══════════════════════════════════════════════════════════

import { XP_TABLE, SPECIALIZATIONS, SKILL_NAMES } from './config.js'

const STORAGE_KEY = 'nebula_progression'
const ID_KEY      = 'nebula_player_id'

// ── Helpers ────────────────────────────────────────────────
function generateId() {
  return 'NB-' + Math.random().toString(36).slice(2, 8).toUpperCase()
}

function defaultSkill() {
  return { level: 1, xp: 0, xpToNext: XP_TABLE[1], specialization: null }
}

function defaultProfile(id) {
  return {
    playerId: id,
    callsign: 'Opérateur',
    skills: {
      electrical: defaultSkill(),
      mechanical:  defaultSkill(),
      medical:     defaultSkill(),
      security:    defaultSkill(),
      navigation:  defaultSkill(),
    },
    totalGames: 0,
    crisisesResolved: 0,
  }
}

// ── Public API ─────────────────────────────────────────────
export const Progression = {

  /** Returns stable player UUID, creates if absent */
  getLocalId() {
    let id = localStorage.getItem(ID_KEY)
    if (!id) {
      id = generateId()
      localStorage.setItem(ID_KEY, id)
    }
    return id
  },

  /** Load profile from localStorage; create default if absent */
  load() {
    const id = this.getLocalId()
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const p = JSON.parse(raw)
        // Migrate missing fields
        for (const skill of Object.keys(SKILL_NAMES)) {
          if (!p.skills[skill]) p.skills[skill] = defaultSkill()
        }
        return p
      }
    } catch (e) { /* invalid JSON — reset */ }
    const p = defaultProfile(id)
    this.save(p)
    return p
  },

  /** Persist profile */
  save(profile) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
  },

  /** Set callsign and save */
  setCallsign(profile, callsign) {
    profile.callsign = callsign.trim().slice(0, 16) || 'Opérateur'
    this.save(profile)
    return profile
  },

  /**
   * Award XP to a skill.
   * Returns { profile, leveledUp: bool, newSpec: spec|null }
   */
  awardXP(skill, amount, profile) {
    const s = profile.skills[skill]
    if (!s || s.level >= 10) return { profile, leveledUp: false, newSpec: null }

    s.xp += amount
    let leveledUp = false
    let newSpec = null

    while (s.level < 10 && s.xp >= XP_TABLE[s.level]) {
      s.xp -= XP_TABLE[s.level]
      s.level++
      leveledUp = true
      s.xpToNext = s.level < 10 ? XP_TABLE[s.level] : 0

      // Check specialization unlock
      const spec = SPECIALIZATIONS[skill]?.[s.level]
      if (spec) {
        s.specialization = spec.id
        newSpec = spec
      }
    }

    // If at cap
    if (s.level >= 10) {
      s.xp = 0
      s.xpToNext = 0
    }

    this.save(profile)
    return { profile, leveledUp, newSpec }
  },

  /**
   * Compute XP reward for a completed minigame.
   * bonus: true if completed in <50% of timeLimit
   */
  computeXP(severity, completionTime, timeLimit, isBonus = false) {
    let xp = 40 * severity
    if (isBonus || completionTime < timeLimit * 0.5) xp = Math.floor(xp * 1.5)
    return xp
  },

  /**
   * Returns the level-based modifier for a skill.
   * Used by minigames to adjust configs.
   * Returns a multiplier: e.g. 1.2 = 20% bonus
   */
  getLevelBonus(skill, level) {
    // Every 2 levels above 1 grants +5% bonus
    return 1 + Math.max(0, level - 1) * 0.05
  },

  /** Returns specialization id for a skill at given level, or null */
  getSpecialization(skill, level, profile) {
    if (profile) {
      return profile.skills[skill]?.specialization ?? null
    }
    if (level >= 10) return SPECIALIZATIONS[skill]?.[10]?.id ?? null
    if (level >= 5)  return SPECIALIZATIONS[skill]?.[5]?.id  ?? null
    return null
  },

  /** Compact summary sent to host on join */
  buildSummary(profile) {
    const summary = {}
    for (const [skill, data] of Object.entries(profile.skills)) {
      summary[skill] = { level: data.level, spec: data.specialization }
    }
    return { callsign: profile.callsign, skills: summary }
  },

  /**
   * Apply CSS classes to HUD skill badge elements based on level.
   * hudEl: the .skill-hud container element
   */
  applyLevelVisuals(profile, hudEl) {
    if (!hudEl) return
    for (const [skill, data] of Object.entries(profile.skills)) {
      const el = hudEl.querySelector(`[data-skill="${skill}"]`)
      if (!el) continue
      // Remove old level classes
      el.className = el.className.replace(/skill-badge--level-\d+/g, '').trim()
      el.classList.add(`skill-badge--level-${data.level}`)
      if (data.specialization) {
        el.classList.add('skill-badge--spec')
      } else {
        el.classList.remove('skill-badge--spec')
      }
      // Update bar fill
      const fill = el.querySelector('.skill-badge__bar-fill')
      const label = el.querySelector('.skill-badge__level')
      if (fill) {
        const pct = data.level >= 10 ? 100 : (data.xp / data.xpToNext) * 100
        fill.style.width = pct + '%'
      }
      if (label) label.textContent = `L${data.level}`
    }
  },

  /** Reset profile (confirm first!) */
  reset() {
    localStorage.removeItem(STORAGE_KEY)
    return this.load()
  },

  /** Increment game count and save */
  recordGameEnd(profile, crisisesResolvedThisGame) {
    profile.totalGames++
    profile.crisisesResolved += crisisesResolvedThisGame
    this.save(profile)
    return profile
  },
}
