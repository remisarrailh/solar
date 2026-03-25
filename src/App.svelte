<script>
  import DevPlayground from './screens/DevPlayground.svelte'
  import Boot          from './screens/Boot.svelte'
  import Menu          from './screens/Menu.svelte'
  import Lobby         from './screens/Lobby.svelte'
  import Controller    from './screens/Controller.svelte'
  import Technician    from './screens/Technician.svelte'
  import Commander     from './screens/Commander.svelte'
  import Debrief       from './screens/Debrief.svelte'
  import Progression   from './screens/Progression.svelte'

  // ── Dev mode detection ───────────────────────────────────
  const urlParams    = new URLSearchParams(window.location.search)
  const devMinigame  = urlParams.get('dev')

  // ── App state ────────────────────────────────────────────
  let screen = devMinigame ? 'dev' : 'boot'

  // Shared context passed between screens
  let appCtx = {
    profile:       null,
    gameMode:      null,       // 'solo' | 'multiplayer'
    myRole:        null,       // 'controller' | 'technician' | 'commander'
    selectedRole:  'technician',
    techSlotId:    null,       // which TECH_SLOTS entry this player controls
    lobbyPlayers:  {},         // peerId → { role, techSlotId } from lobby
    isHost:        false,
    myPeerId:      null,
    difficulty:    'normal',
    currentRoomId: null,
    debriefData:   null,
  }

  function navigate(to, ctx = {}) {
    Object.assign(appCtx, ctx)
    screen = to
  }
</script>

{#if screen === 'dev'}
  <DevPlayground />

{:else if screen === 'boot'}
  <Boot on:done={(e) => navigate('menu', { profile: e.detail.profile, myPeerId: e.detail.myPeerId })} />

{:else if screen === 'menu'}
  <Menu
    {appCtx}
    on:host={() => navigate('lobby', { isHost: true, gameMode: 'multiplayer' })}
    on:join={() => navigate('lobby', { isHost: false, gameMode: 'multiplayer' })}
    on:solo={() => navigate('commander', { gameMode: 'solo', myRole: 'commander' })}
    on:progression={() => navigate('progression')}
  />

{:else if screen === 'lobby'}
  <Lobby
    {appCtx}
    on:start={(e) => navigate(e.detail.role === 'controller' ? 'controller' : 'technician', { myRole: e.detail.role, techSlotId: e.detail.techSlotId ?? null })}
    on:back={() => navigate('menu')}
  />

{:else if screen === 'controller'}
  <Controller
    {appCtx}
    on:gameover={(e) => navigate('debrief', { debriefData: e.detail })}
  />

{:else if screen === 'technician'}
  <Technician
    {appCtx}
    on:gameover={(e) => navigate('debrief', { debriefData: e.detail })}
  />

{:else if screen === 'commander'}
  <Commander
    {appCtx}
    on:gameover={(e) => navigate('debrief', { debriefData: e.detail })}
  />

{:else if screen === 'debrief'}
  <Debrief
    {appCtx}
    on:menu={() => navigate('menu')}
  />

{:else if screen === 'progression'}
  <Progression
    {appCtx}
    on:back={() => navigate('menu')}
  />
{/if}
