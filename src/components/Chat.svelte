<script>
  import { Network, MSG } from '../lib/network.js'

  export let messages  = []   // [{ callsign, text, ts }]
  export let compact   = false

  let input = ''

  function send() {
    const text = input.trim()
    if (!text) return
    input = ''
    const msg = { callsign: 'Moi', text, ts: Date.now() }
    Network.broadcast(MSG.CHAT, msg)
    messages = [...messages, msg]
  }

  function onKeydown(e) {
    if (e.key === 'Enter') send()
  }
</script>

<div class="chat-panel" class:chat-panel--compact={compact}>
  {#if !compact}
    <div class="panel__label">COMMUNICATIONS</div>
  {/if}
  <div class="chat-log">
    {#each messages as m}
      <div class="chat-msg">
        <span class="chat-msg__callsign">{m.callsign}</span>
        <span class="chat-msg__text">{m.text}</span>
      </div>
    {/each}
  </div>
  <div class="chat-input-row">
    <input class="input-chat" type="text" placeholder="Message..." maxlength="80"
           bind:value={input} on:keydown={onKeydown} />
    <button class="btn btn--ghost btn--sm" on:pointerdown={send}>▸</button>
  </div>
</div>
