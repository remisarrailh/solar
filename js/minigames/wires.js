// ══════════════════════════════════════════════════════════
//  Minigame: WIRES — Connect matching colored wire endpoints
// ══════════════════════════════════════════════════════════

let _cleanup = null

export function init(container, config, onComplete) {
  const { pairs, colors, timeLimit, allowOneMistake } = config
  const usedColors = shuffle([...colors]).slice(0, pairs)

  // Right column order is shuffled independently
  const leftOrder  = usedColors.map((c, i) => ({ color: c, index: i }))
  const rightOrder = shuffle([...leftOrder])

  let selected = null       // { color, side: 'left'|'right', el }
  let connected = {}        // color -> true
  let mistakes = 0
  let done = false

  // Build DOM
  container.innerHTML = ''
  const wrapper = document.createElement('div')
  wrapper.className = 'mg-wires'

  const titleRow = document.createElement('div')
  titleRow.style.cssText = 'position:absolute;top:8px;left:0;right:0;text-align:center'
  titleRow.innerHTML = '<div class="mg-wires__label">CONNECTER LES CÂBLES CORRESPONDANTS</div>'
  wrapper.style.position = 'relative'
  wrapper.appendChild(titleRow)

  // SVG for connections
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('class', 'mg-wires__connections')
  svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2'
  wrapper.appendChild(svg)

  // Left column
  const leftCol = document.createElement('div')
  leftCol.className = 'mg-wires__col'
  leftCol.dataset.side = 'left'
  const leftLabel = document.createElement('div')
  leftLabel.className = 'mg-wires__label'
  leftLabel.textContent = 'SOURCE'
  leftCol.appendChild(leftLabel)

  // Right column
  const rightCol = document.createElement('div')
  rightCol.className = 'mg-wires__col'
  rightCol.dataset.side = 'right'
  const rightLabel = document.createElement('div')
  rightLabel.className = 'mg-wires__label'
  rightLabel.textContent = 'DEST.'
  rightCol.appendChild(rightLabel)

  // Node refs for SVG line drawing
  const leftNodes  = {}
  const rightNodes = {}

  function makeNode(item, side) {
    const btn = document.createElement('button')
    btn.className = `wire-node wire-color--${item.color}`
    btn.dataset.color = item.color
    btn.dataset.side  = side
    const dot = document.createElement('div')
    dot.className = 'wire-node__dot'
    btn.appendChild(dot)
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      handleNodeClick(btn, item.color, side)
    })
    return btn
  }

  for (const item of leftOrder) {
    const node = makeNode(item, 'left')
    leftNodes[item.color] = node
    leftCol.appendChild(node)
  }
  for (const item of rightOrder) {
    const node = makeNode(item, 'right')
    rightNodes[item.color] = node
    rightCol.appendChild(node)
  }

  wrapper.appendChild(leftCol)
  wrapper.appendChild(rightCol)
  container.appendChild(wrapper)

  function handleNodeClick(btn, color, side) {
    if (done) return
    if (connected[color]) return

    if (!selected) {
      // Select this node
      selected = { color, side, el: btn }
      btn.classList.add('wire-node--selected')
      return
    }

    // Deselect if same node
    if (selected.el === btn) {
      btn.classList.remove('wire-node--selected')
      selected = null
      return
    }

    // Must select from opposite side
    if (selected.side === side) {
      selected.el.classList.remove('wire-node--selected')
      selected = { color, side, el: btn }
      btn.classList.add('wire-node--selected')
      return
    }

    // Attempt connection
    const leftColor  = side === 'left' ? color : selected.color
    const rightColor = side === 'right' ? color : selected.color

    selected.el.classList.remove('wire-node--selected')

    if (leftColor === rightColor) {
      // Success!
      connected[leftColor] = true
      leftNodes[leftColor].classList.add('wire-node--connected')
      rightNodes[rightColor].classList.add('wire-node--connected')
      drawLine(svg, leftNodes[leftColor], rightNodes[rightColor], leftColor)

      if (Object.keys(connected).length === pairs) {
        done = true
        setTimeout(() => onComplete({ success: true, completionTime: timeLimit - _timer }), 300)
      }
    } else {
      // Wrong connection
      mistakes++
      if (allowOneMistake && mistakes <= 1) {
        // Flash wrong but continue
        btn.style.outline = '3px solid var(--color-critical)'
        setTimeout(() => { btn.style.outline = '' }, 500)
      } else {
        done = true
        setTimeout(() => onComplete({ success: false, completionTime: timeLimit }), 400)
      }
    }

    selected = null
  }

  // Timer
  let _timer = timeLimit
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

// ── Helpers ────────────────────────────────────────────────
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function drawLine(svg, leftEl, rightEl, color) {
  const svgRect = svg.getBoundingClientRect()
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
  svg.appendChild(line)
}

function colorHex(name) {
  const map = {
    red: '#ff4444', blue: '#4488ff', green: '#44dd66',
    yellow: '#ffcc00', white: '#cccccc', purple: '#bb44ff'
  }
  return map[name] ?? '#ffffff'
}
