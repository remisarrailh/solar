// ══════════════════════════════════════════════════════════
//  Minigame: GAUGES — Drag sliders to match target values
// ══════════════════════════════════════════════════════════

let _cleanup = null

export function init(container, config, onComplete) {
  const { count, targets, tolerance, timeLimit, autoLockOne } = config
  let done = false
  let _timer = timeLimit
  // Auto-lock first gauge (Zero-Point specialization)
  const lockedIndex = autoLockOne ? 0 : -1

  container.innerHTML = ''
  const wrapper = document.createElement('div')
  wrapper.className = 'mg-gauges'

  // Hint
  const hint = document.createElement('div')
  hint.style.cssText = 'position:absolute;top:8px;left:0;right:0;text-align:center;font-size:9px;letter-spacing:0.2em;color:var(--color-text-dim)'
  hint.textContent = 'ALIGNER LES JAUGES SUR LES CIBLES'
  wrapper.style.position = 'relative'
  wrapper.style.paddingTop = '2rem'
  wrapper.appendChild(hint)

  const gaugeEls = []

  for (let i = 0; i < count; i++) {
    const target = targets[i]
    const locked = i === lockedIndex

    const gauge = document.createElement('div')
    gauge.className = 'mg-gauge'

    const track = document.createElement('div')
    track.className = 'mg-gauge__track'

    // Target marker — position from bottom
    const targetEl = document.createElement('div')
    targetEl.className = 'mg-gauge__target'
    targetEl.style.bottom = (target * 100) + '%'
    targetEl.style.top = 'auto'
    track.appendChild(targetEl)

    // Range input (rotated via CSS)
    const range = document.createElement('input')
    range.type = 'range'
    range.min = '0'
    range.max = '100'
    range.value = locked ? Math.round(target * 100) : Math.round(Math.random() * 100)
    range.disabled = locked
    if (locked) {
      range.value = Math.round(target * 100)
      track.style.borderColor = 'var(--color-accent)'
    }
    track.appendChild(range)

    const label = document.createElement('div')
    label.className = 'mg-gauge__label'
    label.textContent = String.fromCharCode(65 + i) // A, B, C...

    gauge.appendChild(track)
    gauge.appendChild(label)
    wrapper.appendChild(gauge)

    gaugeEls.push({ range, track, gauge, target, locked })
    range.addEventListener('input', checkAll)
  }

  container.appendChild(wrapper)

  function checkAll() {
    if (done) return
    let allOk = true
    for (const { range, track, gauge, target, locked } of gaugeEls) {
      const val = parseInt(range.value) / 100
      const ok = Math.abs(val - target) <= tolerance
      gauge.classList.toggle('mg-gauge--ok', ok || locked)
      if (!ok && !locked) allOk = false
    }
    if (allOk) {
      done = true
      setTimeout(() => onComplete({ success: true, completionTime: timeLimit - _timer }), 400)
    }
  }

  // Initial state check (locked gauge may already be ok)
  checkAll()

  const interval = setInterval(() => {
    _timer -= 1
    if (_timer <= 0 && !done) {
      done = true
      clearInterval(interval)
      onComplete({ success: false, completionTime: timeLimit })
    }
  }, 1000)

  _cleanup = () => { clearInterval(interval); container.innerHTML = '' }
}

export function destroy() {
  if (_cleanup) { _cleanup(); _cleanup = null }
}
