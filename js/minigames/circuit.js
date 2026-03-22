// ══════════════════════════════════════════════════════════
//  Minigame: CIRCUIT — Watch sequence, then click nodes in order
// ══════════════════════════════════════════════════════════

let _cleanup = null

export function init(container, config, onComplete) {
  const { nodes, sequence, displayTime, timeLimit } = config
  let phase = 'watch'    // 'watch' | 'input'
  let inputIdx = 0
  let done = false
  let _timer = timeLimit

  container.innerHTML = ''
  const wrapper = document.createElement('div')
  wrapper.className = 'mg-circuit'

  const hint = document.createElement('div')
  hint.className = 'mg-circuit__hint'
  hint.textContent = 'OBSERVEZ LA SÉQUENCE D\'ACTIVATION...'

  const cols = Math.ceil(Math.sqrt(nodes))
  const grid = document.createElement('div')
  grid.className = 'mg-circuit__grid'
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`

  const nodeEls = []

  for (let i = 0; i < nodes; i++) {
    const btn = document.createElement('button')
    btn.className = 'circuit-node circuit-node--hidden'
    btn.dataset.index = i
    btn.textContent = i + 1

    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      if (phase !== 'input' || done) return
      const idx = parseInt(btn.dataset.index)

      if (idx === sequence[inputIdx] - 1) {
        btn.classList.remove('circuit-node--hidden')
        btn.classList.add('circuit-node--correct')
        inputIdx++

        if (inputIdx >= sequence.length) {
          done = true
          setTimeout(() => onComplete({ success: true, completionTime: timeLimit - _timer }), 300)
        }
      } else {
        // Wrong node
        btn.classList.add('circuit-node--wrong')
        done = true
        setTimeout(() => onComplete({ success: false, completionTime: timeLimit }), 500)
      }
    })

    nodeEls.push(btn)
    grid.appendChild(btn)
  }

  wrapper.appendChild(hint)
  wrapper.appendChild(grid)
  container.appendChild(wrapper)

  // Play sequence
  let seqIdx = 0
  let seqInterval

  function showNextInSequence() {
    if (seqIdx >= sequence.length) {
      // All shown — transition to input phase
      clearInterval(seqInterval)
      setTimeout(startInput, 500)
      return
    }

    const nodeIdx = sequence[seqIdx] - 1
    const el = nodeEls[nodeIdx]

    // Highlight
    el.classList.remove('circuit-node--hidden')
    el.classList.add('circuit-node--highlight')

    setTimeout(() => {
      // Hide again
      el.classList.remove('circuit-node--highlight')
      el.classList.add('circuit-node--hidden')
      seqIdx++
    }, (displayTime * 1000) / sequence.length * 0.6)
  }

  // Step through with spacing
  const stepTime = (displayTime * 1000) / sequence.length
  seqInterval = setInterval(showNextInSequence, stepTime)
  showNextInSequence()

  function startInput() {
    phase = 'input'
    hint.textContent = 'REPRODUISEZ LA SÉQUENCE'
    // Show all nodes as clickable (hidden labels)
    for (const el of nodeEls) {
      el.classList.remove('circuit-node--highlight', 'circuit-node--hidden', 'circuit-node--correct')
    }
  }

  const interval = setInterval(() => {
    _timer -= 1
    if (_timer <= 0 && !done) {
      done = true
      clearInterval(interval)
      clearInterval(seqInterval)
      onComplete({ success: false, completionTime: timeLimit })
    }
  }, 1000)

  _cleanup = () => {
    clearInterval(interval)
    clearInterval(seqInterval)
    container.innerHTML = ''
  }
}

export function destroy() {
  if (_cleanup) { _cleanup(); _cleanup = null }
}
