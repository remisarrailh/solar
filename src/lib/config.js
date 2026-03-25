// ══════════════════════════════════════════════════════════
//  NEBULA PROTOCOL — Game Configuration
//  Pure data — no logic, no DOM, no imports
// ══════════════════════════════════════════════════════════

export const VERSION = '1.0.0'

// ── Rooms ─────────────────────────────────────────────────
export const ROOMS = {
  engine_bay: {
    id: 'engine_bay',
    name: 'Baie Moteur',
    image: 'assets/rooms/engine_bay.png',
    imageDamaged: 'assets/rooms/engine_bay_damaged.png',
    connections: ['corridor_a', 'reactor_core'],
    crisisSlots: 2,
    gridCol: 1,
    gridRow: 2,
  },
  reactor_core: {
    id: 'reactor_core',
    name: 'Réacteur',
    image: 'assets/rooms/reactor_core.png',
    imageDamaged: 'assets/rooms/reactor_core_damaged.png',
    connections: ['engine_bay', 'corridor_a', 'life_support'],
    crisisSlots: 2,
    gridCol: 2,
    gridRow: 2,
  },
  life_support: {
    id: 'life_support',
    name: 'Survie',
    image: 'assets/rooms/life_support.png',
    imageDamaged: 'assets/rooms/life_support_damaged.png',
    connections: ['reactor_core', 'med_bay', 'corridor_a'],
    crisisSlots: 1,
    gridCol: 3,
    gridRow: 2,
  },
  med_bay: {
    id: 'med_bay',
    name: 'Infirmerie',
    image: 'assets/rooms/med_bay.png',
    imageDamaged: 'assets/rooms/med_bay_damaged.png',
    connections: ['life_support', 'corridor_a'],
    crisisSlots: 1,
    gridCol: 4,
    gridRow: 2,
  },
  corridor_a: {
    id: 'corridor_a',
    name: 'Couloir A',
    image: 'assets/rooms/corridor_a.png',
    imageDamaged: 'assets/rooms/corridor_a_damaged.png',
    connections: ['engine_bay', 'reactor_core', 'life_support', 'bridge', 'cargo_hold', 'security'],
    crisisSlots: 1,
    gridCol: 2,
    gridRow: 1,
  },
  bridge: {
    id: 'bridge',
    name: 'Passerelle',
    image: 'assets/rooms/bridge.png',
    imageDamaged: 'assets/rooms/bridge_damaged.png',
    connections: ['corridor_a', 'security'],
    crisisSlots: 1,
    gridCol: 1,
    gridRow: 1,
  },
  security: {
    id: 'security',
    name: 'Sécurité',
    image: 'assets/rooms/security.png',
    imageDamaged: 'assets/rooms/security_damaged.png',
    connections: ['bridge', 'corridor_a', 'cargo_hold'],
    crisisSlots: 1,
    gridCol: 3,
    gridRow: 1,
  },
  cargo_hold: {
    id: 'cargo_hold',
    name: 'Soute',
    image: 'assets/rooms/cargo_hold.png',
    imageDamaged: 'assets/rooms/cargo_hold_damaged.png',
    connections: ['corridor_a', 'security'],
    crisisSlots: 2,
    gridCol: 4,
    gridRow: 1,
  },
}

// ── Crisis Types ───────────────────────────────────────────
// timerBase: seconds at severity 1
export const CRISIS_TYPES = {
  electrical_failure: {
    id: 'electrical_failure',
    name: 'Panne Électrique',
    minigame: 'wires',
    skillType: 'electrical',
    timerBase: 90,
    xpBase: 40,
    icon: '⚡',
  },
  power_surge: {
    id: 'power_surge',
    name: 'Surtension',
    minigame: 'circuit',
    skillType: 'electrical',
    timerBase: 60,
    xpBase: 50,
    icon: '⚡',
  },
  oxygen_leak: {
    id: 'oxygen_leak',
    name: 'Fuite O²',
    minigame: 'gauges',
    skillType: 'mechanical',
    timerBase: 75,
    xpBase: 45,
    icon: '💨',
  },
  hull_breach: {
    id: 'hull_breach',
    name: 'Brèche Coque',
    minigame: 'gauges',
    skillType: 'mechanical',
    timerBase: 60,
    xpBase: 55,
    icon: '⚠',
  },
  system_lockout: {
    id: 'system_lockout',
    name: 'Verrouillage Système',
    minigame: 'keypad',
    skillType: 'security',
    timerBase: 80,
    xpBase: 40,
    icon: '🔒',
  },
  intruder_alert: {
    id: 'intruder_alert',
    name: 'Alerte Intrusion',
    minigame: 'keypad',
    skillType: 'security',
    timerBase: 70,
    xpBase: 50,
    icon: '🔒',
  },
  medical_emergency: {
    id: 'medical_emergency',
    name: 'Urgence Médicale',
    minigame: 'errorscan',
    skillType: 'medical',
    timerBase: 100,
    xpBase: 45,
    icon: '⊕',
  },
  navigation_error: {
    id: 'navigation_error',
    name: 'Erreur Navigation',
    minigame: 'circuit',
    skillType: 'navigation',
    timerBase: 85,
    xpBase: 40,
    icon: '◎',
  },
  joint_repair: {
    id: 'joint_repair',
    name: 'Réparation Conjointe',
    minigame: 'errorscan',   // phase 1 — diagnostic
    minigame2: 'wires',      // phase 2 — must be a DIFFERENT tech
    skillType: 'mechanical',
    timerBase: 120,
    xpBase: 70,
    icon: '⚙',
    cooperative: true,       // requires 2 techs
  },
}

// Which rooms can spawn which crisis types
export const ROOM_CRISIS_MAP = {
  engine_bay:   ['electrical_failure', 'power_surge', 'oxygen_leak', 'joint_repair'],
  reactor_core: ['electrical_failure', 'power_surge', 'hull_breach', 'joint_repair'],
  life_support: ['oxygen_leak', 'hull_breach', 'electrical_failure'],
  med_bay:      ['medical_emergency', 'electrical_failure'],
  corridor_a:   ['hull_breach', 'oxygen_leak'],
  bridge:       ['navigation_error', 'system_lockout', 'electrical_failure'],
  security:     ['system_lockout', 'intruder_alert'],
  cargo_hold:   ['hull_breach', 'oxygen_leak', 'medical_emergency'],
}

// ── Minigame Base Configs ──────────────────────────────────
export const MINIGAME_CONFIGS = {
  wires: {
    easy:   { pairs: 3, timeLimit: 60 },
    normal: { pairs: 4, timeLimit: 45 },
    hard:   { pairs: 5, timeLimit: 35 },
    colors: ['red', 'blue', 'green', 'yellow', 'white', 'purple'],
  },
  keypad: {
    easy:   { length: 4, displayTime: 4, timeLimit: 40 },
    normal: { length: 5, displayTime: 3, timeLimit: 30 },
    hard:   { length: 6, displayTime: 2, timeLimit: 25 },
  },
  gauges: {
    easy:   { count: 2, tolerance: 0.08, timeLimit: 50 },
    normal: { count: 3, tolerance: 0.05, timeLimit: 40 },
    hard:   { count: 4, tolerance: 0.04, timeLimit: 35 },
  },
  circuit: {
    easy:   { nodes: 4, displayTime: 5, timeLimit: 40 },
    normal: { nodes: 6, displayTime: 4, timeLimit: 35 },
    hard:   { nodes: 8, displayTime: 3, timeLimit: 30 },
  },
  errorscan: {
    easy:   { count: 2, timeLimit: 70 },
    normal: { count: 3, timeLimit: 60 },
    hard:   { count: 4, timeLimit: 50 },
  },
}

// ── RPG Progression ────────────────────────────────────────
// Cumulative XP required to reach each level (index = level)
export const XP_TABLE = [0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700, 3250]

export const SKILL_NAMES = {
  electrical: 'Électricité',
  mechanical:  'Mécanique',
  medical:     'Médecine',
  security:    'Sécurité',
  navigation:  'Navigation',
}

export const SPECIALIZATIONS = {
  electrical: {
    5:  { id: 'hot_wire',   name: 'Hot Wire',    desc: 'Temps limite +20% pour les câblages.' },
    10: { id: 'arc_master', name: 'Arc Master',  desc: 'Tolère 1 mauvaise connexion avant l\'échec.' },
  },
  mechanical: {
    5:  { id: 'field_strip', name: 'Field Strip',  desc: 'Tolérance des jauges +0.02.' },
    10: { id: 'zero_point',  name: 'Zero-Point',   desc: 'Une jauge se verrouille automatiquement.' },
  },
  medical: {
    5:  { id: 'triage',       name: 'Triage',        desc: 'Minuteur des pannes sévérité 1 +15s quand dans la salle.' },
    10: { id: 'flatline_rev', name: 'Flatline Rev.', desc: '1 auto-résolution par partie à minuteur=0.' },
  },
  security: {
    5:  { id: 'ghost_protocol', name: 'Ghost Protocol', desc: 'Affichage du code +1s.' },
    10: { id: 'total_recall',   name: 'Total Recall',   desc: 'Le code est affiché deux fois.' },
  },
  navigation: {
    5:  { id: 'jump_vector',    name: 'Jump Vector',     desc: 'Vitesse de déplacement NPC +1 tick.' },
    10: { id: 'subspace_path',  name: 'Subspace Path',   desc: 'La carte révèle les prochaines salles en alerte.' },
  },
}

// ── Game Constants ─────────────────────────────────────────
export const DIFFICULTY = {
  easy:   { crisisInterval: [40, 70], integrityDecay: { 1: 0, 2: 1, 3: 3 }, oxygenDecay: 0.3 },
  normal: { crisisInterval: [25, 50], integrityDecay: { 1: 0, 2: 2, 3: 5 }, oxygenDecay: 0.5 },
  hard:   { crisisInterval: [15, 35], integrityDecay: { 1: 1, 2: 3, 3: 7 }, oxygenDecay: 0.8 },
}

export const NPC_MOVE_TICKS  = 3   // seconds per room hop
export const PEER_TIMEOUT_MS = 15000
export const PING_INTERVAL_MS = 5000
export const HOST_PROMOTE_DELAY_MS = 2000
export const FLATLINE_USES_PER_GAME = 1
export const TRIAGE_BONUS_SECS = 15

// ── Controller Actions ─────────────────────────────────────
// system: room that provides the function — if that room has an active matching crisis, action is OFFLINE
// affectedBy: crisis types that disable the action
// requiresTarget: player must click a room camera after clicking the action button
export const CONTROLLER_ACTIONS = {
  reroute_power: {
    id: 'reroute_power',
    name: 'Rediriger Énergie',
    desc: 'Réduit la dégradation d\'intégrité dans la salle cible pendant 20s.',
    icon: '⚡',
    system: 'reactor_core',
    affectedBy: ['electrical_failure', 'power_surge'],
    cooldown: 30,
    requiresTarget: true,
  },
  boost_oxygen: {
    id: 'boost_oxygen',
    name: 'Boost O²',
    desc: 'Injecte de l\'O² — ralentit toute fuite pendant 15s.',
    icon: '💨',
    system: 'life_support',
    affectedBy: ['oxygen_leak', 'hull_breach'],
    cooldown: 45,
    requiresTarget: false,
  },
  open_access: {
    id: 'open_access',
    name: 'Ouvrir Accès',
    desc: 'Passage immédiat vers la salle cible pour 20s.',
    icon: '🚪',
    system: 'bridge',
    affectedBy: ['system_lockout'],
    cooldown: 20,
    requiresTarget: true,
  },
  lockdown: {
    id: 'lockdown',
    name: 'Confinement',
    desc: 'Gèle les timers des crises dans la salle cible pendant 10s.',
    icon: '🔒',
    system: 'security',
    affectedBy: ['intruder_alert'],
    cooldown: 60,
    requiresTarget: true,
  },
}

// ── Technician Slots ───────────────────────────────────────
// Used in solo mode (player-controlled) and as NPC fallback in multiplayer
// In multiplayer: if no human player holds a slot, it becomes AI-controlled
export const TECH_SLOTS = [
  { id: 'tech_voss',   name: 'Voss',    startRoom: 'engine_bay',
    skills: { electrical: 3, mechanical: 2, medical: 1, security: 1, navigation: 1 } },
  { id: 'tech_chen',   name: 'Chen',    startRoom: 'med_bay',
    skills: { electrical: 1, mechanical: 1, medical: 4, security: 1, navigation: 2 } },
  { id: 'tech_cross',  name: 'Cross',   startRoom: 'security',
    skills: { electrical: 1, mechanical: 1, medical: 1, security: 4, navigation: 2 } },
  { id: 'tech_reyes',  name: 'Reyes',   startRoom: 'cargo_hold',
    skills: { electrical: 2, mechanical: 3, medical: 1, security: 1, navigation: 2 } },
]

// ── Injury Events ──────────────────────────────────────────
// Crisis types that can injure technicians present in the room when crisis escalates
export const INJURY_EVENTS = {
  power_surge:     { cause: 'Électrocution', treatMinigame: 'errorscan' },
  oxygen_leak:     { cause: 'Asphyxie',      treatMinigame: 'gauges'    },
  hull_breach:     { cause: 'Dépressurisation', treatMinigame: 'gauges' },
  medical_emergency: { cause: 'Contamination', treatMinigame: 'errorscan' },
}

// ── NPCs (Solo mode) ───────────────────────────────────────
export const NPCS = {
  npc_voss: {
    id: 'npc_voss',
    name: 'Tech. Voss',
    portrait: 'assets/ui/npc_voss.png',
    portraitBusy: 'assets/ui/npc_voss_busy.png',
    skills: { electrical: 4, mechanical: 2, medical: 1, security: 2, navigation: 1 },
    startRoom: 'engine_bay',
  },
  npc_chen: {
    id: 'npc_chen',
    name: 'Dr. Chen',
    portrait: 'assets/ui/npc_chen.png',
    portraitBusy: 'assets/ui/npc_chen_busy.png',
    skills: { electrical: 1, mechanical: 1, medical: 5, security: 1, navigation: 2 },
    startRoom: 'med_bay',
  },
  npc_cross: {
    id: 'npc_cross',
    name: 'Off. Cross',
    portrait: 'assets/ui/npc_cross.png',
    portraitBusy: 'assets/ui/npc_cross_busy.png',
    skills: { electrical: 1, mechanical: 1, medical: 1, security: 5, navigation: 3 },
    startRoom: 'security',
  },
}
