// ══════════════════════════════════════════════════════════
//  Minigame: ERRORSCAN — Spot the differences between two images
//  Uses canvas placeholders when images are unavailable
// ══════════════════════════════════════════════════════════

let _cleanup = null

export function init(container, config, onComplete) {
  const { imageBase, imageAlt, differences, count, timeLimit } = config
  let found = 0
  let done = false
  let _timer = timeLimit

  container.innerHTML = ''
  const wrapper = document.createElement('div')
  wrapper.className = 'mg-errorscan'

  const hint = document.createElement('div')
  hint.className = 'mg-errorscan__hint'
  hint.textContent = `TROUVEZ LES ${count} DIFFÉRENCES (IMAGE DROITE)`

  const progress = document.createElement('div')
  progress.className = 'mg-errorscan__progress'
  progress.textContent = `${found} / ${count}`

  const imagesRow = document.createElement('div')
  imagesRow.className = 'mg-errorscan__images'

  // Left (reference)
  const leftWrap = document.createElement('div')
  leftWrap.className = 'errorscan-img-wrap'
  const leftLabel = document.createElement('div')
  leftLabel.className = 'errorscan-label'
  leftLabel.textContent = 'RÉFÉRENCE'
  leftWrap.appendChild(leftLabel)

  // Right (altered) — clickable
  const rightWrap = document.createElement('div')
  rightWrap.className = 'errorscan-img-wrap errorscan-img-wrap--right'
  const rightLabel = document.createElement('div')
  rightLabel.className = 'errorscan-label'
  rightLabel.textContent = 'CIBLE ▸ CLIQUEZ ICI'
  rightWrap.appendChild(rightLabel)

  // Canvas-based placeholder images (always used — no external images needed)
  const leftCanvas  = createScanCanvas(false, differences, count)
  const rightCanvas = createScanCanvas(true,  differences, count)

  leftWrap.appendChild(leftCanvas)
  rightWrap.appendChild(rightCanvas)
  imagesRow.appendChild(leftWrap)
  imagesRow.appendChild(rightWrap)

  wrapper.appendChild(hint)
  wrapper.appendChild(imagesRow)
  wrapper.appendChild(progress)
  container.appendChild(wrapper)

  // Click detection on right canvas
  const foundDiffs = new Set()

  rightWrap.addEventListener('pointerdown', (e) => {
    if (done) return
    const rect = rightWrap.getBoundingClientRect()
    const xPct = (e.clientX - rect.left) / rect.width
    const yPct = (e.clientY - rect.top)  / rect.height

    for (let i = 0; i < differences.length; i++) {
      if (foundDiffs.has(i)) continue
      const diff = differences[i]
      const dx = xPct - diff.x
      const dy = yPct - diff.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist <= diff.radius) {
        foundDiffs.add(i)
        found++
        progress.textContent = `${found} / ${count}`

        // Visual marker
        const marker = document.createElement('div')
        marker.className = 'error-marker'
        marker.style.left = (diff.x * 100) + '%'
        marker.style.top  = (diff.y * 100) + '%'
        marker.style.width  = (diff.radius * 2 * 100) + '%'
        marker.style.height = (diff.radius * 2 * 100) + '%'
        rightWrap.appendChild(marker)

        if (found >= count) {
          done = true
          setTimeout(() => onComplete({ success: true, completionTime: timeLimit - _timer }), 400)
        }
        return
      }
    }
  })

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

// ── Placeholder canvas generator ───────────────────────────
function createScanCanvas(isAltered, differences, count) {
  const canvas = document.createElement('canvas')
  canvas.width  = 400
  canvas.height = 280
  const ctx = canvas.getContext('2d')

  // Background: dark industrial panel
  ctx.fillStyle = '#0a0f1a'
  ctx.fillRect(0, 0, 400, 280)

  // Grid lines
  ctx.strokeStyle = '#111828'
  ctx.lineWidth = 1
  for (let x = 0; x < 400; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 280); ctx.stroke() }
  for (let y = 0; y < 280; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(400, y); ctx.stroke() }

  // Draw some "machinery" shapes using seeded positions
  const shapes = [
    { x: 40, y: 50, w: 80, h: 60 },
    { x: 160, y: 30, w: 100, h: 40 },
    { x: 280, y: 80, w: 70, h: 90 },
    { x: 60, y: 160, w: 120, h: 50 },
    { x: 220, y: 150, w: 90, h: 80 },
    { x: 50, y: 230, w: 60, h: 30 },
    { x: 300, y: 200, w: 80, h: 50 },
  ]

  ctx.strokeStyle = '#1e3a4a'
  ctx.lineWidth = 2
  for (const s of shapes) {
    ctx.strokeRect(s.x, s.y, s.w, s.h)
    // Inner detail
    ctx.strokeStyle = '#0f2030'
    ctx.lineWidth = 1
    ctx.strokeRect(s.x + 4, s.y + 4, s.w - 8, s.h - 8)
    ctx.strokeStyle = '#1e3a4a'
    ctx.lineWidth = 2
  }

  // Status dots
  const dots = [
    { x: 80,  y: 80,  color: '#00e5b0' },
    { x: 210, y: 50,  color: '#00e5b0' },
    { x: 315, y: 125, color: '#4488ff' },
    { x: 120, y: 185, color: '#00e5b0' },
    { x: 265, y: 190, color: '#4488ff' },
  ]
  for (const d of dots) {
    ctx.beginPath()
    ctx.arc(d.x, d.y, 5, 0, Math.PI * 2)
    ctx.fillStyle = d.color
    ctx.fill()
  }

  // Label text
  ctx.fillStyle = '#1a3040'
  ctx.font = '8px monospace'
  ctx.fillText('SYS-ALPHA // PONT', 10, 270)

  // Draw differences on altered image
  if (isAltered) {
    for (let i = 0; i < Math.min(count, differences.length); i++) {
      const diff = differences[i]
      const cx = diff.x * 400
      const cy = diff.y * 280
      const r  = diff.radius * 400

      // Replace the region with an anomaly
      ctx.fillStyle = '#2a0505'
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
      ctx.strokeStyle = '#ff2233'
      ctx.lineWidth = 1
      ctx.strokeRect(cx - r, cy - r, r * 2, r * 2)

      // X marker
      ctx.strokeStyle = '#ff4444'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(cx - r * 0.5, cy - r * 0.5)
      ctx.lineTo(cx + r * 0.5, cy + r * 0.5)
      ctx.moveTo(cx + r * 0.5, cy - r * 0.5)
      ctx.lineTo(cx - r * 0.5, cy + r * 0.5)
      ctx.stroke()
    }
  }

  return canvas
}
