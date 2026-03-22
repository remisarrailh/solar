// ══════════════════════════════════════════════════════════
//  Minigame: KEYPAD — Memorize and enter a code
// ══════════════════════════════════════════════════════════

let _cleanup = null

export function init(container, config, onComplete) {
  const { code, displayTime, timeLimit, showTwice } = config
  let phase = 'memorize'   // 'memorize' | 'input' | 'done'
  let showCount = 0
  let input = []
  let done = false
  let _timer = timeLimit

  // Build DOM
  container.innerHTML = ''
  const wrapper = document.createElement('div')
  wrapper.className = 'mg-keypad'

  const display = document.createElement('div')
  display.className = 'mg-keypad__display mg-keypad__display--memorize'
  display.textContent = code.join(' ')

  const hint = document.createElement('div')
  hint.className = 'mg-keypad__hint'
  hint.textContent = 'MÉMORISEZ LE CODE...'

  const inputDisplay = document.createElement('div')
  inputDisplay.className = 'mg-keypad__display mg-keypad__display--input'
  inputDisplay.style.display = 'none'
  inputDisplay.textContent = '—'.repeat(code.length)

  const inputHint = document.createElement('div')
  inputHint.className = 'mg-keypad__hint'
  inputHint.style.display = 'none'
  inputHint.textContent = 'ENTREZ LE CODE'

  const grid = document.createElement('div')
  grid.className = 'mg-keypad__grid'
  grid.style.display = 'none'

  // Number buttons 1-9, 0
  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫']
  for (const key of keys) {
    const btn = document.createElement('button')
    btn.className = 'keypad-btn'
    if (!key) { btn.disabled = true; btn.style.opacity = '0'; grid.appendChild(btn); continue }
    if (key === '⌫') btn.classList.add('keypad-btn--clear')
    btn.textContent = key
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      if (phase !== 'input' || done) return
      if (key === '⌫') {
        input.pop()
      } else {
        if (input.length < code.length) input.push(key)
      }
      updateInputDisplay()
    })
    grid.appendChild(btn)
  }

  wrapper.appendChild(display)
  wrapper.appendChild(hint)
  wrapper.appendChild(inputDisplay)
  wrapper.appendChild(inputHint)
  wrapper.appendChild(grid)
  container.appendChild(wrapper)

  function updateInputDisplay() {
    const filled = input.join(' ')
    const empty  = Array(code.length - input.length).fill('_').join(' ')
    inputDisplay.textContent = filled + (filled && empty ? ' ' : '') + empty

    // Check if complete
    if (input.length === code.length) {
      const correct = input.join('') === code.join('')
      if (correct) {
        done = true
        inputDisplay.className = 'mg-keypad__display'
        inputDisplay.style.borderColor = 'var(--color-accent)'
        setTimeout(() => onComplete({ success: true, completionTime: timeLimit - _timer }), 300)
      } else {
        inputDisplay.classList.add('mg-keypad__display--wrong')
        input = []
        setTimeout(() => {
          inputDisplay.classList.remove('mg-keypad__display--wrong')
          inputDisplay.textContent = '—'.repeat(code.length)
        }, 600)
      }
    }
  }

  function startInput() {
    phase = 'input'
    display.style.display = 'none'
    hint.style.display = 'none'
    inputDisplay.style.display = 'flex'
    inputHint.style.display = 'block'
    grid.style.display = 'grid'
    updateInputDisplay()
  }

  // Phase management
  const showDuration = displayTime * 1000
  let phaseTimer

  function showCode() {
    display.style.display = 'flex'
    hint.textContent = 'MÉMORISEZ LE CODE...'
    showCount++
    phaseTimer = setTimeout(() => {
      if (showTwice && showCount < 2) {
        display.style.display = 'none'
        hint.textContent = 'PRÉPAREZ-VOUS...'
        phaseTimer = setTimeout(showCode, 800)
      } else {
        startInput()
      }
    }, showDuration)
  }

  showCode()

  // Countdown timer
  const interval = setInterval(() => {
    _timer -= 1
    if (_timer <= 0 && !done) {
      done = true
      clearInterval(interval)
      onComplete({ success: false, completionTime: timeLimit })
    }
  }, 1000)

  _cleanup = () => {
    clearInterval(interval)
    clearTimeout(phaseTimer)
    container.innerHTML = ''
  }
}

export function destroy() {
  if (_cleanup) { _cleanup(); _cleanup = null }
}
