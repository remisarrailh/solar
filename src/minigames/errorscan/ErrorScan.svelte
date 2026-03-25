<script>
  import { onMount, onDestroy } from 'svelte'
  import { generateDifferences, checkClick } from './errorscan.logic.js'

  export let config    // { count, timeLimit, devMode }
  export let onComplete

  let found = 0
  let done = false
  let _timer = config.devMode ? Infinity : config.timeLimit
  let timerInterval
  let foundSet = new Set()
  let markers = []

  const differences = generateDifferences(config.count)
  let leftCanvas, rightCanvas, rightWrap

  onMount(() => {
    drawCanvas(leftCanvas, false)
    drawCanvas(rightCanvas, true)

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
  })

  function handleClick(e) {
    if (done) return
    const rect = rightWrap.getBoundingClientRect()
    const xPct = (e.clientX - rect.left) / rect.width
    const yPct = (e.clientY - rect.top)  / rect.height

    const idx = checkClick(xPct, yPct, differences, foundSet)
    if (idx === -1) return

    foundSet.add(idx)
    found++
    markers = [...markers, differences[idx]]

    if (found >= config.count) {
      done = true
      const elapsed = config.devMode ? 0 : config.timeLimit - _timer
      setTimeout(() => onComplete({ success: true, completionTime: elapsed }), 400)
    }
  }

  function drawCanvas(canvas, isAltered) {
    if (!canvas) return
    canvas.width  = 400
    canvas.height = 280
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = '#0a0f1a'
    ctx.fillRect(0, 0, 400, 280)

    ctx.strokeStyle = '#111828'
    ctx.lineWidth = 1
    for (let x = 0; x < 400; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 280); ctx.stroke() }
    for (let y = 0; y < 280; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(400, y); ctx.stroke() }

    const shapes = [
      { x: 40, y: 50, w: 80, h: 60 }, { x: 160, y: 30, w: 100, h: 40 },
      { x: 280, y: 80, w: 70, h: 90 }, { x: 60, y: 160, w: 120, h: 50 },
      { x: 220, y: 150, w: 90, h: 80 }, { x: 50, y: 230, w: 60, h: 30 },
      { x: 300, y: 200, w: 80, h: 50 },
    ]
    ctx.strokeStyle = '#1e3a4a'
    ctx.lineWidth = 2
    for (const s of shapes) {
      ctx.strokeRect(s.x, s.y, s.w, s.h)
      ctx.strokeStyle = '#0f2030'; ctx.lineWidth = 1
      ctx.strokeRect(s.x + 4, s.y + 4, s.w - 8, s.h - 8)
      ctx.strokeStyle = '#1e3a4a'; ctx.lineWidth = 2
    }

    const dots = [
      { x: 80,  y: 80,  color: '#00e5b0' }, { x: 210, y: 50,  color: '#00e5b0' },
      { x: 315, y: 125, color: '#4488ff' }, { x: 120, y: 185, color: '#00e5b0' },
      { x: 265, y: 190, color: '#4488ff' },
    ]
    for (const d of dots) {
      ctx.beginPath(); ctx.arc(d.x, d.y, 5, 0, Math.PI * 2)
      ctx.fillStyle = d.color; ctx.fill()
    }

    ctx.fillStyle = '#1a3040'; ctx.font = '8px monospace'
    ctx.fillText('SYS-ALPHA // PONT', 10, 270)

    if (isAltered) {
      for (let i = 0; i < Math.min(config.count, differences.length); i++) {
        const diff = differences[i]
        const cx = diff.x * 400, cy = diff.y * 280, r = diff.radius * 400
        ctx.fillStyle = '#2a0505'
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
        ctx.strokeStyle = '#ff2233'; ctx.lineWidth = 1
        ctx.strokeRect(cx - r, cy - r, r * 2, r * 2)
        ctx.strokeStyle = '#ff4444'; ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(cx - r * 0.5, cy - r * 0.5); ctx.lineTo(cx + r * 0.5, cy + r * 0.5)
        ctx.moveTo(cx + r * 0.5, cy - r * 0.5); ctx.lineTo(cx - r * 0.5, cy + r * 0.5)
        ctx.stroke()
      }
    }
  }
</script>

<div class="mg-errorscan">
  <div class="mg-errorscan__hint">TROUVEZ LES {config.count} DIFFÉRENCES (IMAGE DROITE)</div>

  <div class="mg-errorscan__images">
    <div class="errorscan-img-wrap">
      <div class="errorscan-label">RÉFÉRENCE</div>
      <canvas bind:this={leftCanvas}></canvas>
    </div>

    <div class="errorscan-img-wrap errorscan-img-wrap--right" bind:this={rightWrap}
         on:pointerdown={handleClick}>
      <div class="errorscan-label">CIBLE ▸ CLIQUEZ ICI</div>
      <canvas bind:this={rightCanvas}></canvas>
      {#each markers as diff}
        <div class="error-marker"
             style="left:{diff.x * 100}%;top:{diff.y * 100}%;width:{diff.radius * 2 * 100}%;height:{diff.radius * 2 * 100}%">
        </div>
      {/each}
    </div>
  </div>

  <div class="mg-errorscan__progress">{found} / {config.count}</div>
</div>
