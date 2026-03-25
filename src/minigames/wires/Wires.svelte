<script>
  import { onMount, onDestroy } from 'svelte'
  import { generateWires, colorHex } from './wires.logic.js'

  export let config   // { pairs, colors, timeLimit, allowOneMistake, devMode }
  export let onComplete // ({ success, completionTime }) => void

  let container
  let timerInterval
  let _timer = config.devMode ? Infinity : config.timeLimit
  let done = false

  // State
  let connected = {}     // color -> true
  let selected = null    // { color, side, el }
  let mistakes = 0

  // DOM refs
  let leftNodes  = {}
  let rightNodes = {}
  let svgEl

  onMount(() => {
    const { leftOrder, rightOrder } = generateWires(config.colors, config.pairs)

    // Build left column nodes
    const leftCol  = container.querySelector('[data-side="left"]')
    const rightCol = container.querySelector('[data-side="right"]')

    for (const item of leftOrder) {
      const btn = makeNode(item.color, 'left')
      leftNodes[item.color] = btn
      leftCol.appendChild(btn)
    }
    for (const item of rightOrder) {
      const btn = makeNode(item.color, 'right')
      rightNodes[item.color] = btn
      rightCol.appendChild(btn)
    }

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

  function makeNode(color, side) {
    const btn = document.createElement('button')
    btn.className = `wire-node wire-color--${color}`
    btn.dataset.color = color
    btn.dataset.side  = side
    const dot = document.createElement('div')
    dot.className = 'wire-node__dot'
    btn.appendChild(dot)
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      handleNodeClick(btn, color, side)
    })
    return btn
  }

  function handleNodeClick(btn, color, side) {
    if (done) return
    if (connected[color]) return

    if (!selected) {
      selected = { color, side, el: btn }
      btn.classList.add('wire-node--selected')
      return
    }

    if (selected.el === btn) {
      btn.classList.remove('wire-node--selected')
      selected = null
      return
    }

    if (selected.side === side) {
      selected.el.classList.remove('wire-node--selected')
      selected = { color, side, el: btn }
      btn.classList.add('wire-node--selected')
      return
    }

    const leftColor  = side === 'left'  ? color : selected.color
    const rightColor = side === 'right' ? color : selected.color

    selected.el.classList.remove('wire-node--selected')

    if (leftColor === rightColor) {
      connected[leftColor] = true
      leftNodes[leftColor].classList.add('wire-node--connected')
      rightNodes[rightColor].classList.add('wire-node--connected')
      drawLine(leftNodes[leftColor], rightNodes[rightColor], leftColor)

      if (Object.keys(connected).length === config.pairs) {
        done = true
        const elapsed = config.devMode ? 0 : config.timeLimit - _timer
        setTimeout(() => onComplete({ success: true, completionTime: elapsed }), 300)
      }
    } else {
      mistakes++
      if (config.allowOneMistake && mistakes <= 1) {
        btn.style.outline = '3px solid var(--color-critical)'
        setTimeout(() => { btn.style.outline = '' }, 500)
      } else {
        done = true
        setTimeout(() => onComplete({ success: false, completionTime: config.timeLimit }), 400)
      }
    }

    selected = null
  }

  function drawLine(leftEl, rightEl, color) {
    const svgRect   = svgEl.getBoundingClientRect()
    const leftRect  = leftEl.getBoundingClientRect()
    const rightRect = rightEl.getBoundingClientRect()

    const x1 = leftRect.right  - svgRect.left
    const y1 = leftRect.top    + leftRect.height / 2 - svgRect.top
    const x2 = rightRect.left  - svgRect.left
    const y2 = rightRect.top   + rightRect.height / 2 - svgRect.top

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    line.setAttribute('x1', x1)
    line.setAttribute('y1', y1)
    line.setAttribute('x2', x2)
    line.setAttribute('y2', y2)
    line.setAttribute('stroke', colorHex(color))
    line.setAttribute('stroke-width', '3')
    line.setAttribute('stroke-linecap', 'round')
    svgEl.appendChild(line)
  }
</script>

<div class="mg-wires" style="position:relative" bind:this={container}>
  <div style="position:absolute;top:8px;left:0;right:0;text-align:center">
    <div class="mg-wires__label">CONNECTER LES CÂBLES CORRESPONDANTS</div>
  </div>

  <svg class="mg-wires__connections" bind:this={svgEl}
       style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2">
  </svg>

  <div class="mg-wires__col" data-side="left">
    <div class="mg-wires__label">SOURCE</div>
  </div>
  <div class="mg-wires__col" data-side="right">
    <div class="mg-wires__label">DEST.</div>
  </div>
</div>
