<script>
  import { onMount, onDestroy } from 'svelte'
  import { generateCode, validateInput } from './keypad.logic.js'

  export let config    // { length, displayTime, timeLimit, showTwice, devMode }
  export let onComplete

  let phase = 'memorize'   // 'memorize' | 'input' | 'done'
  let showCount = 0
  let input = []
  let done = false
  let _timer = config.devMode ? Infinity : config.timeLimit
  let phaseTimer

  const code = generateCode(config.length)
  const displayTime = config.displayTime ?? 3

  let showCode = true
  let hintText = 'MÉMORISEZ LE CODE...'
  let inputDone = false
  let wrongFlash = false

  let timerInterval

  onMount(() => {
    scheduleHide()
    if (!config.devMode) {
      timerInterval = setInterval(() => {
        _timer -= 1
        if (_timer <= 0 && !done) {
          done = true
          clearInterval(timerInterval)
          clearTimeout(phaseTimer)
          onComplete({ success: false, completionTime: config.timeLimit })
        }
      }, 1000)
    }
  })

  onDestroy(() => {
    clearInterval(timerInterval)
    clearTimeout(phaseTimer)
  })

  function scheduleHide() {
    showCount++
    phaseTimer = setTimeout(() => {
      if (config.showTwice && showCount < 2) {
        showCode = false
        hintText = 'PRÉPAREZ-VOUS...'
        phaseTimer = setTimeout(() => {
          showCode = true
          hintText = 'MÉMORISEZ LE CODE...'
          scheduleHide()
        }, 800)
      } else {
        showCode = false
        phase = 'input'
        hintText = 'ENTREZ LE CODE'
      }
    }, displayTime * 1000)
  }

  function pressKey(key) {
    if (phase !== 'input' || done) return
    if (key === '⌫') {
      input = input.slice(0, -1)
    } else {
      if (input.length < code.length) input = [...input, key]
    }
    checkInput()
  }

  function checkInput() {
    const result = validateInput(input, code)
    if (result === 'correct') {
      done = true
      inputDone = true
      const elapsed = config.devMode ? 0 : config.timeLimit - _timer
      setTimeout(() => onComplete({ success: true, completionTime: elapsed }), 300)
    } else if (result === 'wrong') {
      wrongFlash = true
      input = []
      setTimeout(() => { wrongFlash = false }, 600)
    }
  }

  $: inputDisplay = phase === 'input'
    ? [...input, ...Array(code.length - input.length).fill('_')].join(' ')
    : code.join(' ')

  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫']
</script>

<div class="mg-keypad">
  {#if showCode}
    <div class="mg-keypad__display mg-keypad__display--memorize">{code.join(' ')}</div>
    <div class="mg-keypad__hint">{hintText}</div>
  {:else if phase === 'memorize'}
    <div class="mg-keypad__hint">{hintText}</div>
  {/if}

  {#if phase === 'input'}
    <div class="mg-keypad__display mg-keypad__display--input"
         class:mg-keypad__display--wrong={wrongFlash}
         class:mg-keypad__display--correct={inputDone}>
      {inputDisplay}
    </div>
    <div class="mg-keypad__hint">ENTREZ LE CODE</div>
    <div class="mg-keypad__grid">
      {#each keys as key}
        {#if !key}
          <button class="keypad-btn" disabled style="opacity:0"></button>
        {:else}
          <button
            class="keypad-btn"
            class:keypad-btn--clear={key === '⌫'}
            on:pointerdown|preventDefault={() => pressKey(key)}
          >{key}</button>
        {/if}
      {/each}
    </div>
  {/if}
</div>
