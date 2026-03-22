// ══════════════════════════════════════════════════════════
//  NEBULA PROTOCOL — UI Module
//  DOM manipulation only. Never imports state.js or network.js
// ══════════════════════════════════════════════════════════

import { ROOMS, SKILL_NAMES, SPECIALIZATIONS } from './config.js'

// ── Screen Management ──────────────────────────────────────
export const UI = {

  /** Show a screen by id, hide all others */
  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('screen--active'))
    const el = document.getElementById(`screen-${screenId}`)
    if (el) el.classList.add('screen--active')
  },

  // ── Boot ──────────────────────────────────────────────
  bootProgress(step) {
    // step 1, 2, 3
    for (let i = 1; i <= step; i++) {
      const line = document.getElementById(`boot-line-${i}`)
      if (line) {
        line.classList.remove('boot-status__line--hidden')
        line.classList.add('boot-status__line--visible')
      }
    }
  },

  bootError(msg) {
    const el = document.getElementById('boot-error')
    const msgEl = document.getElementById('boot-error-msg')
    if (el) el.style.display = 'flex'
    if (msgEl) msgEl.textContent = msg
  },

  // ── Main Menu ─────────────────────────────────────────
  setMenuPlayerId(id) {
    const el = document.getElementById('menu-player-id')
    if (el) el.textContent = id
  },

  showJoinOverlay(show) {
    const el = document.getElementById('overlay-join')
    if (el) el.style.display = show ? 'flex' : 'none'
    if (show) document.getElementById('join-code-input')?.focus()
  },

  showNameOverlay(show) {
    const el = document.getElementById('overlay-name')
    if (el) el.style.display = show ? 'flex' : 'none'
    if (show) document.getElementById('name-input')?.focus()
  },

  setJoinError(msg) {
    const el = document.getElementById('join-error')
    if (!el) return
    if (msg) { el.textContent = msg; el.style.display = 'block' }
    else el.style.display = 'none'
  },

  // ── Lobby ─────────────────────────────────────────────
  setRoomCode(code) {
    const el = document.getElementById('lobby-room-code')
    if (el) el.textContent = code
  },

  renderPlayerList(players, myPeerId) {
    const targets = ['lobby-players', 'ctrl-player-list']
    for (const targetId of targets) {
      const el = document.getElementById(targetId)
      if (!el) continue
      el.innerHTML = ''
      for (const p of Object.values(players)) {
        const div = document.createElement('div')
        div.className = 'player-entry' + (p.isHost ? ' player-entry--host' : '')
        if (!p.connected) div.classList.add('player-entry--disconnected')
        const indicator = document.createElement('div')
        indicator.className = 'player-entry__indicator' + (p.ready ? ' player-entry__indicator--ready' : '')
        const name = document.createElement('div')
        name.className = 'player-entry__name'
        name.textContent = p.name + (p.peerId === myPeerId ? ' (vous)' : '')
        const role = document.createElement('div')
        role.className = 'player-entry__role'
        const roomName = p.currentRoomId ? (ROOMS[p.currentRoomId]?.name ?? p.currentRoomId) : null
        role.textContent = (p.role ? ROLE_LABELS[p.role] : '—') + (roomName ? ` · ${roomName}` : '')
        div.appendChild(indicator)
        div.appendChild(name)
        div.appendChild(role)
        el.appendChild(div)
      }
    }
  },

  setRoleSelected(role) {
    document.querySelectorAll('.role-card').forEach(card => {
      card.classList.toggle('role-card--selected', card.dataset.role === role)
    })
  },

  setLobbyReady(canStart, isHost) {
    const startBtn = document.getElementById('btn-lobby-start')
    if (startBtn) {
      startBtn.style.display = isHost ? 'block' : 'none'
      startBtn.disabled = !canStart
    }
  },

  setReadyState(isReady) {
    const btn = document.getElementById('btn-lobby-ready')
    if (btn) {
      btn.textContent = isReady ? 'EN ATTENTE ▸' : 'PRÊT ▸'
      btn.classList.toggle('btn--ghost', isReady)
      btn.classList.toggle('btn--primary', !isReady)
    }
  },

  // ── Ship Map ──────────────────────────────────────────
  /**
   * Render or update ship map.
   * containerId: 'ship-map' or 'cmd-ship-map'
   * rooms: state.rooms
   * players: state.players
   * selectedRoom: roomId or null
   * onRoomClick: fn(roomId)
   */
  renderShipMap(containerId, rooms, players, selectedRoom, onRoomClick) {
    const container = document.getElementById(containerId)
    if (!container) return

    // Build or update room elements
    for (const [roomId, room] of Object.entries(rooms)) {
      let el = container.querySelector(`[data-room-id="${roomId}"]`)
      if (!el) {
        el = document.createElement('div')
        el.className = 'map-room'
        el.dataset.roomId = roomId
        el.style.gridColumn = room.gridCol
        el.style.gridRow = room.gridRow

        const crew = document.createElement('div')
        crew.className = 'map-room__crew'
        crew.dataset.roomCrew = roomId

        const name = document.createElement('div')
        name.className = 'map-room__name'
        name.textContent = room.name

        const alerts = document.createElement('div')
        alerts.className = 'map-room__alerts'
        alerts.dataset.roomAlerts = roomId

        el.appendChild(alerts)
        el.appendChild(crew)
        el.appendChild(name)

        el.addEventListener('pointerdown', () => onRoomClick && onRoomClick(roomId))
        container.appendChild(el)
      }

      // Update status class
      el.className = `map-room map-room--${room.status}`
      if (selectedRoom === roomId) el.classList.add('map-room--selected')

      // Update crisis alert pips
      const alertsEl = el.querySelector(`[data-room-alerts]`)
      if (alertsEl) {
        alertsEl.innerHTML = ''
        for (const crisisId of room.activeCrises) {
          const pip = document.createElement('div')
          pip.className = 'alert-pip alert-pip--warning'
          alertsEl.appendChild(pip)
        }
      }

      // Update crew dots
      const crewEl = el.querySelector(`[data-room-crew]`)
      if (crewEl) {
        crewEl.innerHTML = ''
        for (const p of Object.values(players)) {
          if (p.currentRoomId === roomId) {
            const dot = document.createElement('div')
            dot.className = `crew-dot crew-dot--${p.role}`
            dot.title = p.name
            crewEl.appendChild(dot)
          }
        }
      }
    }
  },

  // ── Room View (Camera) ────────────────────────────────
  /**
   * Update the camera view for a room.
   * imageElId: element id of the .room-view__image div
   * viewElId: element id of the .room-view wrapper
   * room: room state object
   */
  updateRoomView(imageElId, viewElId, room) {
    const viewEl  = document.getElementById(viewElId)
    const imageEl = document.getElementById(imageElId)
    if (!viewEl || !imageEl) return

    // Update status class on the view wrapper
    viewEl.className = viewEl.className
      .replace(/room-view--\w+/g, '')
      .trim() + ` room-view--${room.status}`

    // Load background image with canvas fallback
    loadRoomImage(imageEl, room)
  },

  /**
   * Update crisis indicators overlay inside room view
   * containerId: element with data-room-crisis-indicators
   */
  updateCrisisIndicators(containerId, crises) {
    const el = document.getElementById(containerId)
    if (!el) return
    el.innerHTML = ''
    for (const crisis of Object.values(crises)) {
      if (crisis.state !== 'active' && crisis.state !== 'resolving') continue
      const ind = document.createElement('div')
      ind.className = `crisis-indicator crisis-indicator--${crisis.severity >= 2 ? 'critical' : 'warning'}`
      ind.textContent = crisis.name
      el.appendChild(ind)
    }
  },

  // ── Crisis List ───────────────────────────────────────
  /**
   * Render crisis list.
   * containerId: e.g. 'ctrl-crisis-list'
   * crises: object of crisis states
   * onSelect: optional fn(crisisId)
   */
  renderCrisisList(containerId, crises, onSelect) {
    const el = document.getElementById(containerId)
    if (!el) return
    el.innerHTML = ''

    const activeCrises = Object.values(crises).filter(
      c => c.state === 'active' || c.state === 'resolving'
    )

    if (activeCrises.length === 0) {
      el.innerHTML = '<div class="crisis-list__empty">Zone sécurisée.</div>'
      return
    }

    // Sort: critical first
    activeCrises.sort((a, b) => b.severity - a.severity)

    for (const crisis of activeCrises) {
      const entry = document.createElement('div')
      entry.className = `crisis-entry crisis-entry--${crisis.severity >= 2 ? 'critical' : 'warning'}`
      entry.dataset.crisisId = crisis.id

      const sev = document.createElement('div')
      sev.className = `crisis-entry__sev crisis-entry__sev--${crisis.severity}`

      const info = document.createElement('div')
      info.className = 'crisis-entry__info'
      const name = document.createElement('div')
      name.className = 'crisis-entry__name'
      name.textContent = crisis.name
      const room = document.createElement('div')
      room.className = 'crisis-entry__room'
      room.textContent = ROOMS[crisis.roomId]?.name ?? crisis.roomId

      info.appendChild(name)
      info.appendChild(room)

      const timer = document.createElement('div')
      timer.className = 'crisis-entry__timer'
      timer.dataset.timerFor = crisis.id
      timer.textContent = formatTimer(crisis.timerRemaining)
      updateTimerClass(timer, crisis.timerRemaining, crisis.timerMax)

      entry.appendChild(sev)
      entry.appendChild(info)
      entry.appendChild(timer)

      if (onSelect) entry.addEventListener('pointerdown', () => onSelect(crisis.id))
      el.appendChild(entry)
    }
  },

  /** Update a single crisis timer display — call each second */
  updateCrisisTimers(crises) {
    for (const crisis of Object.values(crises)) {
      const el = document.querySelector(`[data-timer-for="${crisis.id}"]`)
      if (el) {
        el.textContent = formatTimer(crisis.timerRemaining)
        updateTimerClass(el, crisis.timerRemaining, crisis.timerMax)
      }
    }
  },

  // ── HUD ───────────────────────────────────────────────
  updateShipStats(integrity, oxygen, integrityFillId, oxygenFillId, integrityValId, oxygenValId) {
    setBar(integrityFillId, integrity, integrityValId)
    if (oxygenFillId) setBar(oxygenFillId, oxygen)
    if (oxygenValId) {
      const el = document.getElementById(oxygenValId)
      if (el) el.textContent = Math.round(oxygen) + '%'
    }
  },

  updateGameTimer(timerId, elapsed) {
    const el = document.getElementById(timerId)
    if (el) el.textContent = formatTimer(elapsed)
  },

  // ── Skill HUD ─────────────────────────────────────────
  renderSkillHud(containerId, profile) {
    const el = document.getElementById(containerId)
    if (!el) return
    el.innerHTML = ''
    for (const [skill, label] of Object.entries(SKILL_NAMES)) {
      const data = profile.skills[skill]
      const badge = document.createElement('div')
      badge.className = `skill-badge skill-badge--level-${data.level}`
      badge.dataset.skill = skill
      if (data.specialization) badge.classList.add('skill-badge--spec')

      const name = document.createElement('div')
      name.className = 'skill-badge__name'
      name.textContent = label.slice(0, 6).toUpperCase()

      const bar = document.createElement('div')
      bar.className = 'skill-badge__bar'
      const fill = document.createElement('div')
      fill.className = 'skill-badge__bar-fill'
      fill.style.width = (data.level >= 10 ? 100 : (data.xp / data.xpToNext) * 100) + '%'
      bar.appendChild(fill)

      const lvl = document.createElement('div')
      lvl.className = 'skill-badge__level'
      lvl.textContent = `L${data.level}`

      badge.appendChild(name)
      badge.appendChild(bar)
      badge.appendChild(lvl)
      el.appendChild(badge)
    }
  },

  // ── NPC Portraits (Commander) ─────────────────────────
  renderNpcPortraits(npcs, selectedNpcId, onSelect) {
    const el = document.getElementById('npc-portraits')
    if (!el) return
    el.innerHTML = ''
    for (const npc of Object.values(npcs)) {
      const portrait = document.createElement('div')
      portrait.className = 'npc-portrait'
      portrait.dataset.npcId = npc.id

      if (npc.state === 'repairing' || npc.state === 'moving') portrait.classList.add('npc-portrait--busy')
      if (npc.state === 'incapacitated') portrait.classList.add('npc-portrait--incapacitated')
      if (selectedNpcId === npc.id) portrait.classList.add('npc-portrait--selected')

      const img = document.createElement('div')
      img.className = 'npc-portrait__img'
      img.style.background = placeholderColor(npc.id)

      const info = document.createElement('div')
      info.className = 'npc-portrait__info'

      const name = document.createElement('div')
      name.className = 'npc-portrait__name'
      name.textContent = npc.name

      const status = document.createElement('div')
      status.className = 'npc-portrait__status'
      status.textContent = NPC_STATUS_LABELS[npc.state] ?? npc.state

      const prog = document.createElement('div')
      prog.className = 'npc-portrait__progress'
      const fill = document.createElement('div')
      fill.className = 'npc-portrait__progress-fill'
      fill.style.width = npc.state === 'repairing' && npc.repairTimerMax
        ? ((1 - npc.repairTimer / npc.repairTimerMax) * 100) + '%'
        : '0%'
      prog.appendChild(fill)

      info.appendChild(name)
      info.appendChild(status)
      info.appendChild(prog)
      portrait.appendChild(img)
      portrait.appendChild(info)

      portrait.addEventListener('pointerdown', () => onSelect && onSelect(npc.id))
      el.appendChild(portrait)
    }
  },

  // ── Minigame Overlay ──────────────────────────────────
  showMinigameOverlay(overlayId, crisisName) {
    const el = document.getElementById(overlayId)
    if (!el) return
    el.style.display = 'flex'
    const nameEl = el.querySelector('.minigame-overlay__crisis-name')
    if (nameEl) nameEl.textContent = crisisName
    // Hide result
    const resultEl = el.querySelector('.minigame-overlay__result')
    if (resultEl) resultEl.style.display = 'none'
  },

  hideMinigameOverlay(overlayId) {
    const el = document.getElementById(overlayId)
    if (el) el.style.display = 'none'
  },

  updateMinigameTimer(overlayId, remaining, max) {
    const el = document.getElementById(overlayId)
    if (!el) return
    const timerEl = el.querySelector('.minigame-overlay__timer')
    if (!timerEl) return
    timerEl.textContent = Math.ceil(remaining)
    timerEl.className = 'minigame-overlay__timer'
    if (remaining <= max * 0.25) timerEl.classList.add('minigame-overlay__timer--critical')
    else if (remaining <= max * 0.5) timerEl.classList.add('minigame-overlay__timer--warning')
  },

  showMinigameResult(overlayId, success, xp) {
    const el = document.getElementById(overlayId)
    if (!el) return
    const resultEl = el.querySelector('.minigame-overlay__result')
    if (!resultEl) return
    resultEl.style.display = 'flex'
    resultEl.className = `minigame-overlay__result mg-result--${success ? 'success' : 'fail'}`

    const icon = resultEl.querySelector('.mg-result__icon')
    const text = resultEl.querySelector('.mg-result__text')
    const xpEl = resultEl.querySelector('.mg-result__xp')

    if (icon) icon.textContent = success ? '◈' : '✕'
    if (text) text.textContent = success ? 'RÉPARATION RÉUSSIE' : 'ÉCHEC — AGGRAVATION'
    if (xpEl) xpEl.textContent = success ? `+${xp} XP` : ''
  },

  // ── Chat ──────────────────────────────────────────────
  addChatMessage(logId, sender, text, isSystem = false) {
    const el = document.getElementById(logId)
    if (!el) return
    const msg = document.createElement('div')
    msg.className = 'chat-msg' + (isSystem ? ' chat-msg--system' : '')
    if (!isSystem) {
      msg.innerHTML = `<span class="chat-msg__sender">[${escapeHtml(sender)}]</span> ${escapeHtml(text)}`
    } else {
      msg.textContent = text
    }
    el.appendChild(msg)
    el.scrollTop = el.scrollHeight
    // Keep max 50 messages
    while (el.children.length > 50) el.removeChild(el.firstChild)
  },

  // ── Debrief ───────────────────────────────────────────
  renderDebrief(results, xpAwards) {
    // results: { outcome: 'win'|'loss', elapsed, crisisesResolved, shipIntegrity }
    const title = document.getElementById('debrief-title')
    if (title) {
      title.textContent = results.outcome === 'win' ? 'MISSION ACCOMPLIE' : 'MISSION ÉCHOUÉE'
      title.style.color = results.outcome === 'win' ? 'var(--color-accent)' : 'var(--color-critical)'
    }

    const statsEl = document.getElementById('debrief-stats')
    if (statsEl) {
      statsEl.innerHTML = ''
      const stats = [
        { label: 'DURÉE',    val: formatTimer(results.elapsed) },
        { label: 'PANNES',   val: results.crisisesResolved },
        { label: 'INTÉG.',   val: Math.round(results.shipIntegrity) + '%' },
        { label: 'OXYGÈNE',  val: Math.round(results.oxygenLevel) + '%' },
      ]
      for (const s of stats) {
        const div = document.createElement('div')
        div.className = 'debrief-stat'
        div.innerHTML = `<div class="debrief-stat__val">${s.val}</div><div class="debrief-stat__label">${s.label}</div>`
        statsEl.appendChild(div)
      }
    }

    const xpEl = document.getElementById('debrief-xp-list')
    if (xpEl && xpAwards) {
      xpEl.innerHTML = ''
      for (const [skill, award] of Object.entries(xpAwards)) {
        if (!award.amount) continue
        const entry = document.createElement('div')
        entry.className = 'debrief-xp-entry'
        entry.innerHTML = `
          <div class="debrief-xp-entry__skill">${SKILL_NAMES[skill]}</div>
          <div class="debrief-xp-entry__amount">+${award.amount} XP</div>
          ${award.leveledUp ? `<div class="debrief-xp-entry__levelup">NIVEAU ${award.newLevel} !</div>` : ''}
          ${award.newSpec ? `<div class="debrief-xp-entry__levelup">★ ${award.newSpec.name}</div>` : ''}
        `
        xpEl.appendChild(entry)
      }
      if (xpEl.children.length === 0) {
        xpEl.innerHTML = '<div class="crisis-list__empty">Aucun XP gagné.</div>'
      }
    }
  },

  // ── Progression Screen ────────────────────────────────
  renderProgressionScreen(profile) {
    const callsign = document.getElementById('prog-callsign')
    if (callsign) callsign.textContent = profile.callsign

    const games = document.getElementById('prog-total-games')
    if (games) games.textContent = profile.totalGames

    const crises = document.getElementById('prog-total-crises')
    if (crises) crises.textContent = profile.crisisesResolved

    const skillList = document.getElementById('prog-skill-list')
    if (skillList) {
      skillList.innerHTML = ''
      for (const [skill, data] of Object.entries(profile.skills)) {
        const pct = data.level >= 10 ? 100 : (data.xp / data.xpToNext) * 100
        const specName = data.specialization
          ? (SPECIALIZATIONS[skill]?.[data.level]?.name ?? SPECIALIZATIONS[skill]?.[5]?.name ?? '')
          : ''

        const entry = document.createElement('div')
        entry.className = 'skill-entry'
        entry.innerHTML = `
          <div class="skill-entry__header">
            <span class="skill-entry__name">${SKILL_NAMES[skill]}</span>
            <span class="skill-entry__level">Niv. ${data.level} — ${data.xp}/${data.xpToNext || '—'} XP</span>
          </div>
          <div class="skill-entry__bar"><div class="skill-entry__bar-fill" style="width:${pct}%"></div></div>
          ${specName ? `<div class="skill-entry__spec">★ ${specName}</div>` : ''}
        `
        skillList.appendChild(entry)
      }
    }

    const specList = document.getElementById('prog-spec-list')
    if (specList) {
      specList.innerHTML = ''
      let hasSpec = false
      for (const [skill, data] of Object.entries(profile.skills)) {
        for (const [lvl, spec] of Object.entries(SPECIALIZATIONS[skill] ?? {})) {
          if (data.level >= Number(lvl)) {
            hasSpec = true
            const entry = document.createElement('div')
            entry.className = 'spec-entry'
            entry.innerHTML = `
              <div class="spec-entry__name">★ ${spec.name}</div>
              <div class="spec-entry__desc">${spec.desc}</div>
            `
            specList.appendChild(entry)
          }
        }
      }
      if (!hasSpec) {
        specList.innerHTML = '<div class="spec-list__empty">Aucune spécialisation débloquée.</div>'
      }
    }
  },

  // ── CCTV Clock ────────────────────────────────────────
  startCctvClock(elementId) {
    function tick() {
      const el = document.getElementById(elementId)
      if (!el) return
      const now = new Date()
      el.textContent = now.toTimeString().slice(0, 8)
    }
    tick()
    return setInterval(tick, 1000)
  },
}

// ── Private Helpers ────────────────────────────────────────
function formatTimer(seconds) {
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

function updateTimerClass(el, remaining, max) {
  el.classList.remove('crisis-entry__timer--warning', 'crisis-entry__timer--critical')
  if (remaining <= max * 0.25) el.classList.add('crisis-entry__timer--critical')
  else if (remaining <= max * 0.5) el.classList.add('crisis-entry__timer--warning')
}

function setBar(fillId, pct, valId) {
  const fill = document.getElementById(fillId)
  if (!fill) return
  fill.style.width = Math.max(0, Math.min(100, pct)) + '%'
  fill.classList.remove('ship-stat__fill--warning', 'ship-stat__fill--critical')
  if (pct <= 25) fill.classList.add('ship-stat__fill--critical')
  else if (pct <= 50) fill.classList.add('ship-stat__fill--warning')
  if (valId) {
    const v = document.getElementById(valId)
    if (v) v.textContent = Math.round(pct) + '%'
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function placeholderColor(seed) {
  // Deterministic color from string seed
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffffff
  const hue = h % 360
  return `hsl(${hue}, 40%, 20%)`
}

/**
 * Load a room background image into the .room-view__image element,
 * falling back to a canvas placeholder if the image fails to load.
 */
function loadRoomImage(el, room) {
  // Try to set background; handle missing asset gracefully
  const img = new Image()
  img.onload = () => {
    el.style.backgroundImage = `url('${img.src}')`
    el.style.backgroundColor = ''
  }
  img.onerror = () => {
    // Generate canvas placeholder
    const canvas = generatePlaceholder(room.name, room.status)
    el.style.backgroundImage = `url('${canvas.toDataURL()}')`
    el.style.backgroundSize = 'cover'
  }
  img.src = room.image
}

function generatePlaceholder(label, status) {
  const canvas = document.createElement('canvas')
  canvas.width = 800
  canvas.height = 500
  const ctx = canvas.getContext('2d')

  const colors = {
    nominal:   '#0a1020',
    warning:   '#1a1000',
    critical:  '#1a0005',
    destroyed: '#050505',
  }
  ctx.fillStyle = colors[status] || colors.nominal
  ctx.fillRect(0, 0, 800, 500)

  // Grid lines (circuit-board feel)
  ctx.strokeStyle = '#151530'
  ctx.lineWidth = 1
  for (let x = 0; x < 800; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 500); ctx.stroke() }
  for (let y = 0; y < 500; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(800, y); ctx.stroke() }

  // Label
  ctx.fillStyle = status === 'critical' ? '#441122'
    : status === 'warning' ? '#332200'
    : '#112233'
  ctx.fillRect(200, 200, 400, 100)

  ctx.fillStyle = status === 'critical' ? '#ff2233'
    : status === 'warning' ? '#ffaa00'
    : '#334466'
  ctx.font = 'bold 18px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(`[ ${label.toUpperCase()} ]`, 400, 248)
  ctx.font = '11px monospace'
  ctx.fillStyle = '#334466'
  ctx.fillText('// IMAGE NON CHARGÉE', 400, 275)

  return canvas
}

const ROLE_LABELS = {
  controller: 'CONTRÔLEUR',
  technician: 'TECHNICIEN',
  commander:  'COMMANDANT',
}

const NPC_STATUS_LABELS = {
  idle:           'En attente',
  moving:         'En déplacement...',
  repairing:      'En réparation...',
  incapacitated:  'Hors service',
}
