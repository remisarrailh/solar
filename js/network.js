// ══════════════════════════════════════════════════════════
//  NEBULA PROTOCOL — Network Layer (PeerJS abstraction)
//  No game logic here. Pure P2P communication.
// ══════════════════════════════════════════════════════════

import { PEER_TIMEOUT_MS, PING_INTERVAL_MS, HOST_PROMOTE_DELAY_MS } from './config.js'

// ── Message Types ──────────────────────────────────────────
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
}

// ── Network Object ─────────────────────────────────────────
export const Network = {
  peer:         null,
  connections:  {},     // { peerId: DataConnection }
  isHost:       false,
  hostId:       null,
  myId:         null,
  _pingTimers:  {},     // { peerId: intervalId }
  _lastPing:    {},     // { peerId: timestamp }

  // Callbacks set by main.js
  onMessage:    null,   // fn(message, fromPeerId)
  onPeerJoin:   null,   // fn(peerId)
  onPeerLeave:  null,   // fn(peerId, reason)

  /**
   * Initialize PeerJS Peer.
   * @param {string|undefined} customId  Optional short custom ID (for host room code)
   * Returns Promise<myId>
   */
  init(customId) {
    return new Promise((resolve, reject) => {
      if (this.peer) {
        this.peer.destroy()
        this.peer = null
      }

      // PeerJS with public broker
      const peer = new Peer(customId, {
        debug: 0,
      })

      peer.on('open', (id) => {
        this.peer = peer
        this.myId = id
        resolve(id)
      })

      peer.on('error', (err) => {
        console.error('[Network] Peer error:', err)
        // If custom ID is already taken, retry without custom ID
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

      // Timeout
      setTimeout(() => reject(new Error('PeerJS init timeout')), 15000)
    })
  },

  /** Host: open for connections (already done on peer.on('connection')) */
  host() {
    this.isHost = true
    this.hostId = this.myId
  },

  /**
   * Client: connect to host.
   * Returns Promise that resolves when connection is open.
   */
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

  /** Send a message to a specific peer */
  send(peerId, type, payload) {
    const conn = this.connections[peerId]
    if (!conn || !conn.open) return
    try {
      conn.send({ type, senderId: this.myId, payload })
    } catch (e) {
      console.warn('[Network] send error:', e)
    }
  },

  /** Broadcast to all connected peers */
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

  /** Close connection to a peer */
  disconnect(peerId) {
    const conn = this.connections[peerId]
    if (conn) { try { conn.close() } catch (e) {} }
    this._removePeer(peerId, 'manual')
  },

  /** Clean up everything */
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

  /**
   * Take over as host (client promotion).
   * Called when host disconnects and this client has lowest peer ID.
   */
  promoteToHost(otherPeerIds) {
    this.isHost = true
    this.hostId = this.myId
    // Re-establish connections with remaining peers
    for (const peerId of otherPeerIds) {
      if (!this.connections[peerId]) {
        const conn = this.peer.connect(peerId, { reliable: true })
        conn.on('open', () => this._setupConnection(conn))
      }
    }
  },

  /** Get all connected peer IDs */
  getPeerIds() {
    return Object.keys(this.connections)
  },

  // ── Private ─────────────────────────────────────────────
  _setupConnection(conn) {
    const peerId = conn.peer
    this.connections[peerId] = conn
    this._lastPing[peerId] = Date.now()

    conn.on('data', (data) => {
      if (!data?.type) return
      // Handle ping/pong internally
      if (data.type === MSG.PING) {
        this.send(peerId, MSG.PONG, { clientTime: data.payload.clientTime })
        this._lastPing[peerId] = Date.now()
        return
      }
      if (data.type === MSG.PONG) {
        this._lastPing[peerId] = Date.now()
        return
      }
      // Delegate to game layer
      this.onMessage?.(data, peerId)
    })

    conn.on('close', () => {
      this._removePeer(peerId, 'disconnect')
    })

    conn.on('error', (err) => {
      console.warn('[Network] Connection error with', peerId, err)
      this._removePeer(peerId, 'error')
    })

    // Start ping loop (client pings host, host pings all)
    this._pingTimers[peerId] = setInterval(() => {
      if (!conn.open) { this._removePeer(peerId, 'timeout'); return }
      this.send(peerId, MSG.PING, { clientTime: Date.now() })

      // Timeout check (host side)
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
