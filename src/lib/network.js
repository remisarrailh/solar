// ══════════════════════════════════════════════════════════
//  NEBULA PROTOCOL — Network Layer (PeerJS abstraction)
//  No game logic here. Pure P2P communication.
// ══════════════════════════════════════════════════════════

import Peer from 'peerjs'
import { PEER_TIMEOUT_MS, PING_INTERVAL_MS } from './config.js'

export const MSG = {
  JOIN:               'MSG_JOIN',
  WELCOME:            'MSG_WELCOME',
  PLAYER_JOINED:      'MSG_PLAYER_JOINED',
  PLAYER_LEFT:        'MSG_PLAYER_LEFT',
  STATE_DELTA:        'MSG_STATE_DELTA',
  CRISIS_SPAWNED:     'MSG_CRISIS_SPAWNED',
  CRISIS_ESCALATED:   'MSG_CRISIS_ESCALATED',
  CRISIS_RESOLVED:    'MSG_CRISIS_RESOLVED',
  MINIGAME_START:     'MSG_MINIGAME_START',
  MINIGAME_RESULT:    'MSG_MINIGAME_RESULT',
  REQUEST_DISPATCH:   'MSG_REQUEST_DISPATCH',
  DISPATCH_NPC:       'MSG_DISPATCH_NPC',
  CHAT:               'MSG_CHAT',
  PING:               'MSG_PING',
  PONG:               'MSG_PONG',
  GAME_START:         'MSG_GAME_START',
  GAME_OVER:          'MSG_GAME_OVER',
  MOVE_REQUEST:       'MSG_MOVE_REQUEST',       // tech → host: { roomId }
  DISTRESS_SIGNAL:    'MSG_DISTRESS_SIGNAL',    // tech → host: { fromId, fromName, roomId }
  CONTROLLER_ACTION:  'MSG_CONTROLLER_ACTION',  // controller → host: { actionId, targetRoomId }
  ANOMALY_CONFIRMED:  'MSG_ANOMALY_CONFIRMED',  // controller → host: { roomId }
  TECH_SLOT_REQUEST:  'MSG_TECH_SLOT_REQUEST',  // player → host: { slotId } — take over a tech slot
  START_CARRYING:     'MSG_START_CARRYING',     // tech → host: { carrierId, injuredSlotId }
  STOP_CARRYING:      'MSG_STOP_CARRYING',      // tech → host: { carrierId }
  HEAL_REQUEST:       'MSG_HEAL_REQUEST',       // tech → host: { carrierId, injuredSlotId }
  COOP_PHASE2_START:  'MSG_COOP_PHASE2_START',    // tech → host: { slotId, crisisId }
  MINIGAME_REQUEST:   'MSG_MINIGAME_REQUEST',      // tech → host: { slotId, crisisId }
}

export const Network = {
  peer:         null,
  connections:  {},
  isHost:       false,
  hostId:       null,
  myId:         null,
  _pingTimers:  {},
  _lastPing:    {},

  onMessage:    null,
  onPeerJoin:   null,
  onPeerLeave:  null,

  init(customId) {
    return new Promise((resolve, reject) => {
      if (this.peer) {
        this.peer.destroy()
        this.peer = null
      }

      const peer = new Peer(customId, { debug: 0 })

      peer.on('open', (id) => {
        this.peer = peer
        this.myId = id
        resolve(id)
      })

      peer.on('error', (err) => {
        console.error('[Network] Peer error:', err)
        if (err.type === 'unavailable-id' && customId) {
          peer.destroy()
          this.init(undefined).then(resolve).catch(reject)
          return
        }
        reject(err)
      })

      peer.on('connection', (conn) => {
        this._setupConnection(conn)
      })

      setTimeout(() => reject(new Error('PeerJS init timeout')), 15000)
    })
  },

  host() {
    this.isHost = true
    this.hostId = this.myId
  },

  join(hostId) {
    return new Promise((resolve, reject) => {
      if (!this.peer) { reject(new Error('Peer not initialized')); return }
      this.isHost = false
      this.hostId = hostId

      const conn = this.peer.connect(hostId, { reliable: true })
      conn.on('open', () => {
        this._setupConnection(conn)
        resolve(conn)
      })
      conn.on('error', reject)
      setTimeout(() => reject(new Error('Connection timeout')), 10000)
    })
  },

  send(peerId, type, payload) {
    const conn = this.connections[peerId]
    if (!conn || !conn.open) return
    try {
      conn.send({ type, senderId: this.myId, payload })
    } catch (e) {
      console.warn('[Network] send error:', e)
    }
  },

  broadcast(type, payload, exceptPeerId) {
    for (const [peerId, conn] of Object.entries(this.connections)) {
      if (peerId === exceptPeerId) continue
      if (!conn.open) continue
      try {
        conn.send({ type, senderId: this.myId, payload })
      } catch (e) {
        console.warn('[Network] broadcast error to', peerId, e)
      }
    }
  },

  disconnect(peerId) {
    const conn = this.connections[peerId]
    if (conn) { try { conn.close() } catch (e) {} }
    this._removePeer(peerId, 'manual')
  },

  destroy() {
    for (const peerId of Object.keys(this.connections)) {
      this._removePeer(peerId, 'destroy')
    }
    if (this.peer) {
      try { this.peer.destroy() } catch (e) {}
      this.peer = null
    }
    this.isHost = false
    this.hostId = null
    this.myId   = null
  },

  promoteToHost(otherPeerIds) {
    this.isHost = true
    this.hostId = this.myId
    for (const peerId of otherPeerIds) {
      if (!this.connections[peerId]) {
        const conn = this.peer.connect(peerId, { reliable: true })
        conn.on('open', () => this._setupConnection(conn))
      }
    }
  },

  getPeerIds() {
    return Object.keys(this.connections)
  },

  _setupConnection(conn) {
    const peerId = conn.peer
    this.connections[peerId] = conn
    this._lastPing[peerId] = Date.now()

    conn.on('data', (data) => {
      if (!data?.type) return
      if (data.type === MSG.PING) {
        this.send(peerId, MSG.PONG, { clientTime: data.payload.clientTime })
        this._lastPing[peerId] = Date.now()
        return
      }
      if (data.type === MSG.PONG) {
        this._lastPing[peerId] = Date.now()
        return
      }
      this.onMessage?.(data, peerId)
    })

    conn.on('close', () => {
      this._removePeer(peerId, 'disconnect')
    })

    conn.on('error', (err) => {
      console.warn('[Network] Connection error with', peerId, err)
      this._removePeer(peerId, 'error')
    })

    this._pingTimers[peerId] = setInterval(() => {
      if (!conn.open) { this._removePeer(peerId, 'timeout'); return }
      this.send(peerId, MSG.PING, { clientTime: Date.now() })

      if (this.isHost && Date.now() - (this._lastPing[peerId] ?? 0) > PEER_TIMEOUT_MS) {
        this._removePeer(peerId, 'timeout')
      }
    }, PING_INTERVAL_MS)

    this.onPeerJoin?.(peerId)
  },

  _removePeer(peerId, reason) {
    clearInterval(this._pingTimers[peerId])
    delete this._pingTimers[peerId]
    delete this._lastPing[peerId]
    delete this.connections[peerId]
    this.onPeerLeave?.(peerId, reason)
  },
}
