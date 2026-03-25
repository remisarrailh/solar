<script>
  import { ROOMS } from '../lib/config.js'

  export let rooms     = {}     // from gameState.rooms
  export let players   = {}     // from gameState.players
  export let techSlots = []     // from gameState.techSlots
  export let onRoom    = null   // optional: (roomId) => void

  const roomList = Object.values(ROOMS)

  $: roomsWithState = roomList.map(def => ({
    ...def,
    status: rooms[def.id]?.status ?? 'nominal',
    activeCrises: rooms[def.id]?.activeCrises ?? [],
  }))

  $: playersByRoom = Object.values(players).reduce((acc, p) => {
    if (p.currentRoomId) {
      if (!acc[p.currentRoomId]) acc[p.currentRoomId] = []
      acc[p.currentRoomId].push(p)
    }
    return acc
  }, {})

  $: techsByRoom = techSlots.reduce((acc, t) => {
    if (t.currentRoomId && t.state !== 'carried') {
      if (!acc[t.currentRoomId]) acc[t.currentRoomId] = []
      acc[t.currentRoomId].push(t)
    }
    return acc
  }, {})
</script>

<!-- The .ship-map container is provided by the parent (panel class) -->
{#each roomsWithState as room}
  <div
    class="map-room"
    class:map-room--nominal={room.status === 'nominal'}
    class:map-room--warning={room.status === 'warning'}
    class:map-room--critical={room.status === 'critical'}
    class:map-room--destroyed={room.status === 'destroyed'}
    style="grid-column:{room.gridCol};grid-row:{room.gridRow}"
    on:pointerdown={() => onRoom?.(room.id)}
  >
    <div class="map-room__alerts">
      {#each room.activeCrises.slice(0, 3) as _}
        <div class="alert-pip alert-pip--{room.status === 'critical' ? 'critical' : 'warning'}"></div>
      {/each}
    </div>
    <div class="map-room__crew">
      {#each (playersByRoom[room.id] ?? []) as p}
        <div class="crew-dot crew-dot--{p.role}" title={p.callsign}></div>
      {/each}
      {#each (techsByRoom[room.id] ?? []) as t}
        <div
          class="crew-dot crew-dot--technician"
          class:crew-dot--injured={t.injured}
          title="{t.name}{t.injured ? ' [BLESSÉ]' : ''}"
        ></div>
      {/each}
    </div>
    <div class="map-room__name">{room.name}</div>
  </div>
{/each}
