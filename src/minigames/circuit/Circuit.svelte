<script>
  import { onMount, onDestroy } from 'svelte'
  import { generateSequence, validateStep } from './circuit.logic.js'

  export let config    // { nodes, displayTime, timeLimit, devMode }
  export let onComplete

  let phase = 'watch'   // 'watch' | 'input'
  let inputIdx = 0
  let done = false
  let _timer = config.devMode ? Infinity : config.timeLimit

  const sequence = generateSequence(config.nodes, 6)

  // Node state: 'hidden' | 'highlight' | 'correct' | 'wrong' | 'idle'
  let nodeStates = Array(config.nodes).fill('hidden')
  let hintText = "OBSERVEZ LA SÉQUENCE D'ACTIVATION..."
  let seqInterval, timerInterval

  const cols = Math.ceil(Math.sqrt(config.nodes))

  onMount(() => {
    playSequence()
    if (!config.devMode) {
      timerInterval = setInterval(() => {
        _timer -= 1
        if (_timer <= 0 && !done) {
          done = true
          clearInterval(timerInterval)
          clearInterval(seqInterval)
          onComplete({ success: false, completionTime: config.timeLimit })
        }
      }, 1000)
    }
  })

  onDestroy(() => {
    clearInterval(timerInterval)
    clearInterval(seqInterval)
  })

  function playSequence() {
    let seqIdx = 0
    const stepTime = (config.displayTime * 1000) / sequence.length

    function showNext() {
      if (seqIdx >= sequence.length) {
        nodeStates = Array(config.nodes).fill('hidden')
        setTimeout(() => startInput(), 500)
        return
      }
      const nodeIdx = sequence[seqIdx] - 1
      nodeStates = nodeStates.map((s, i) => i === nodeIdx ? 'highlight' : 'hidden')

      setTimeout(() => {
        nodeStates = nodeStates.map((s, i) => i === nodeIdx ? 'hidden' : s)
        seqIdx++
        seqInterval = setTimeout(showNext, stepTime * 0.4)
      }, stepTime * 0.6)
    }

    seqInterval = setTimeout(showNext, 300)
  }

  function startInput() {
    phase = 'input'
    hintText = 'REPRODUISEZ LA SÉQUENCE'
    nodeStates = Array(config.nodes).fill('idle')
  }

  function clickNode(i) {
    if (phase !== 'input' || done) return
    const result = validateStep(i, sequence, inputIdx)

    if (result === 'wrong') {
      nodeStates = nodeStates.map((s, idx) => idx === i ? 'wrong' : s)
      done = true
      setTimeout(() => onComplete({ success: false, completionTime: config.timeLimit }), 500)
    } else {
      nodeStates = nodeStates.map((s, idx) => idx === i ? 'correct' : s)
      inputIdx++
      if (result === 'complete') {
        done = true
        const elapsed = config.devMode ? 0 : config.timeLimit - _timer
        setTimeout(() => onComplete({ success: true, completionTime: elapsed }), 300)
      }
    }
  }
</script>

<div class="mg-circuit">
  <div class="mg-circuit__hint">{hintText}</div>

  <div class="mg-circuit__grid" style="grid-template-columns: repeat({cols}, 1fr)">
    {#each Array(config.nodes) as _, i}
      <button
        class="circuit-node"
        class:circuit-node--hidden={nodeStates[i] === 'hidden'}
        class:circuit-node--highlight={nodeStates[i] === 'highlight'}
        class:circuit-node--correct={nodeStates[i] === 'correct'}
        class:circuit-node--wrong={nodeStates[i] === 'wrong'}
        on:pointerdown|preventDefault={() => clickNode(i)}
      >{i + 1}</button>
    {/each}
  </div>
</div>
