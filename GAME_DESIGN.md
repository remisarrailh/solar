# NEBULA PROTOCOL — Game Design Reference

Ce fichier explique la mécanique du jeu et comment modifier chaque aspect.
Chaque section pointe vers les fichiers à éditer.

---

## Rôles des joueurs

### Contrôleur (1 joueur)
**Ce qu'il voit :** Une grille de 8 caméras couvrant toutes les salles du vaisseau.

**Mécaniques :**
- **Surveillance des anomalies** : Quand une crise apparaît dans une salle, un petit point subtil clignote sur la caméra correspondante. Le contrôleur doit cliquer dessus pour "confirmer" l'anomalie → **+15 secondes** sur le timer de la crise. Aucune pénalité s'il ne la voit pas.
- **Actions vaisseau** : 4 boutons d'action avec cooldown. Certaines actions nécessitent de choisir une salle cible.
- **Réception des DÉTRESSE** : Les techniciens peuvent envoyer un ping structuré visible dans la sidebar.

**Fichiers :**
- `src/screens/Controller.svelte` — interface
- `src/lib/config.js > CONTROLLER_ACTIONS` — définir/modifier les actions
- `src/lib/state.js > confirmAnomaly()` et `triggerControllerAction()` — logique

---

### Techniciens (1–4 joueurs)
**Ce qu'ils voient :** La caméra de leur salle actuelle, les pannes présentes, les salles adjacentes.

**Mécaniques :**
- **Déplacement autonome** : Boutons pour se déplacer vers les salles adjacentes. Immédiat.
- **Intervenir sur une panne** : Cliquer "Intervenir" sur une crise dans leur salle → minijeu.
- **Bouton DÉTRESSE** : Envoie un ping au contrôleur avec nom + salle actuelle.
- **Blessure** : Si une crise escalade (sévérité 3) dans leur salle, le technicien est blessé. Il ne peut plus se déplacer seul ni faire de minijeux — il faut qu'un autre technicien l'emmène en Infirmerie.

**Fichiers :**
- `src/screens/Technician.svelte` — interface
- `src/lib/config.js > INJURY_EVENTS` — quelles crises blessent + quel minijeu soigne
- `src/lib/state.js > moveTech()`, `startTechCrisis()`, `finishTechCrisis()`, `healTech()`

---

### Mode Solo (Commander)
Le joueur contrôle à la fois le contrôleur et les 4 techniciens en basculant manuellement entre les vues via une barre d'onglets en haut.

**Onglets :** `[CTRL] [Voss] [Chen] [Cross] [Reyes]`

- Vue CTRL : caméras + actions (même interface que le contrôleur multijoueur)
- Vue Tech : caméra de la salle, pannes, déplacements, minijeux

**Difficulté ajustée :** En solo, réduire `crisisInterval` dans `config.js > DIFFICULTY` pour avoir moins de crises simultanées.

**Fichiers :**
- `src/screens/Commander.svelte` — interface
- `src/lib/state.js > setSoloView()` — changer l'onglet actif

---

## Actions du Contrôleur

Défini dans `src/lib/config.js > CONTROLLER_ACTIONS`.

| Action | Système requis | Désactivé si... | Effet |
|--------|----------------|-----------------|-------|
| Rediriger Énergie ⚡ | reactor_core | electrical_failure / power_surge | `powerBoosted` dans la salle cible pendant 20s |
| Boost O² 💨 | life_support | oxygen_leak / hull_breach | `oxygenBoost = 15` (ralentit fuite) |
| Ouvrir Accès 🚪 | bridge | system_lockout | `openAccess` dans la salle cible pendant 20s |
| Confinement 🔒 | security | intruder_alert | Gèle les timers dans la salle cible 10s |

**Pour ajouter une action :**
1. Ajouter une entrée dans `CONTROLLER_ACTIONS` (config.js)
2. Ajouter la logique dans `State.triggerControllerAction()` (state.js)

---

## Slots de Techniciens

Défini dans `src/lib/config.js > TECH_SLOTS`.

4 techniciens pré-définis. En multijoueur, un joueur peut "réclamer" un slot (MSG.TECH_SLOT_REQUEST). Les slots non réclamés sont contrôlés par IA (non implémenté — à faire).

**Pour modifier un technicien :**
Éditer directement l'entrée dans `TECH_SLOTS`. Chaque slot a :
- `id` : identifiant unique
- `name` : nom affiché
- `startRoom` : salle de départ
- `skills` : compétences (electrical, mechanical, medical, security, navigation) → influence les timers bonus et spécialisations

---

## Crises

Défini dans `src/lib/config.js > CRISIS_TYPES` et `ROOM_CRISIS_MAP`.

**Pour ajouter un type de crise :**
1. Ajouter dans `CRISIS_TYPES` avec `minigame`, `skillType`, `timerBase`, `xpBase`
2. Ajouter dans `ROOM_CRISIS_MAP` pour les salles où elle peut apparaître
3. Si cette crise peut blesser des techniciens, ajouter dans `INJURY_EVENTS`

**Escalade :**
- Sévérité 1 → 2 : timer réduit de 40%, timer redémarré
- Sévérité 3 : `_handleCatastrophe()` — salle détruite, intégrité -20, techniciens blessés

---

## Minijeux

Chaque minijeu est dans `src/minigames/<nom>/`.

**Contrat :**
```svelte
export let config    // { difficulty, devMode, ...params }
export let onComplete // ({ success, completionTime }) => void
```

**Pour créer un minijeu :**
1. Copier `src/minigames/MINIGAME_TEMPLATE.svelte`
2. Créer `src/minigames/<nom>/<Nom>.svelte` + `<nom>.logic.js` + `<nom>.test.js`
3. Ajouter dans `src/minigames/index.js > MINIGAMES`
4. Référencer dans une crise (`minigame: '<nom>'`) dans `CRISIS_TYPES`

**Mode dev sans timer :** `?dev=<nom>` dans l'URL → DevPlayground

---

## Systèmes d'État

`src/lib/state.js > State` — toutes les mutations du jeu.

Méthodes clés :
| Méthode | Usage |
|---------|-------|
| `State.init()` | Initialise une partie |
| `State.tick()` | Avance d'une seconde (appelé par setInterval) |
| `State.spawnCrisis()` | Génère une crise aléatoire |
| `State.escalateCrisis(id)` | Monte une crise de sévérité |
| `State.resolveCrisis(id)` | Résout une crise (après minijeu réussi) |
| `State.confirmAnomaly(roomId)` | Contrôleur confirme une anomalie caméra |
| `State.triggerControllerAction(id, roomId)` | Active une action contrôleur |
| `State.moveTech(slotId, roomId)` | Déplace un technicien |
| `State.startTechCrisis(slotId, crisisId)` | Technicien commence un minijeu |
| `State.finishTechCrisis(slotId, success)` | Résultat du minijeu |
| `State.healTech(slotId)` | Soigne un technicien blessé |
| `State.sendDistress(fromId, name, roomId)` | Enregistre un signal DÉTRESSE |

Le store Svelte `gameState` est automatiquement mis à jour après chaque mutation via `_push()`.

---

## Multijoueur (P2P via PeerJS)

Architecture : **host-authoritative**. Le contrôleur est l'hôte.

- L'hôte tourne `State.tick()` chaque seconde et broadcast `MSG.STATE_DELTA`
- Les clients reçoivent le delta et appellent `State.applyDelta()`
- Les techniciens envoient des requêtes à l'hôte (mouvement, minijeu, détresse)

**Messages réseau** définis dans `src/lib/network.js > MSG`.

| Message | Direction | Payload |
|---------|-----------|---------|
| STATE_DELTA | host → all | delta d'état |
| MOVE_REQUEST | tech → host | `{ roomId }` |
| DISTRESS_SIGNAL | tech → host | `{ fromId, fromName, roomId }` |
| CONTROLLER_ACTION | controller → host | `{ actionId, targetRoomId }` |
| ANOMALY_CONFIRMED | controller → host | `{ roomId }` |
| TECH_SLOT_REQUEST | player → host | `{ slotId }` — réclamer un slot |
| MINIGAME_START | host → tech | `{ crisis }` |
| MINIGAME_RESULT | tech → host | `{ crisisId, success, xp, skillType }` |

---

## Minijeux coopératifs (implémenté)

Le type `joint_repair` (`CRISIS_TYPES.joint_repair`) requiert 2 techniciens distincts :

1. **Phase 1** (diagnostic) — n'importe quel tech fait le minijeu `errorscan`
2. **Phase 2** (réparation finale) — un AUTRE tech doit faire le minijeu `wires`

Le premier tech à intervenir voit "Phase 1". Quand il finit, `crisis.coopPhase1Done = true`. N'importe quel autre tech dans la salle voit alors "Phase 2 disponible".

En solo, switcher entre deux techs pour faire les deux phases.

**Ajouter d'autres crises coop :** Mettre `cooperative: true` + `minigame2: '<nom>'` dans `CRISIS_TYPES`.

---

## Système de blessure et transport (implémenté)

**Blessure :** Quand une crise atteint sévérité 3 (`_handleCatastrophe`), les techs présents dans la salle deviennent blessés :
- `tech.injured = true`, `tech.injuryType = crisis.type`, `tech.state = 'injured'`
- Blessé = ne peut plus se déplacer ni faire de minijeux

**Transport :**
- Un tech sain dans la même salle qu'un blessé voit "Porter [nom]"
- `State.startCarrying(carrierId, injuredId)` — les deux se déplacent ensemble
- `State.stopCarrying(carrierId)` — dépose le blessé

**Soin :**
- Quand le porteur arrive en `med_bay` avec le blessé, bouton "Soigner" apparaît
- Déclenche un minijeu (défini dans `INJURY_EVENTS[crisis.type].treatMinigame`)
- Succès → `State.healTech(injuredId)` + `State.stopCarrying(carrierId)`

**Modifier les soins :** Éditer `INJURY_EVENTS` dans `config.js`.

---

## IA pour slots non réclamés (implémenté)

`State._tickUnclaimedSlots()` est appelé à chaque tick. Les slots sans `claimedBy` :
- Se déplacent automatiquement vers les crises (après 8 ticks sans assignation)
- "Réparent" les crises en simulant un temps fixe (`30 - skill * 3` secondes)

En multijoueur avec moins de 4 joueurs techniciens, les slots non réclamés agissent comme IA.
En solo, l'IA est désactivée (`mode === 'solo'` est ignoré dans `_tickUnclaimedSlots`). Le joueur contrôle tous les slots manuellement via les onglets.

---

## Idées futures

- **Éditeur de scénarios** : Fichier JSON par scénario avec crises scriptées à intervalles fixes.
- **Objectifs de mission** : Conditions de victoire au-delà de "survivre" (ex: réparer le réacteur avant 5 minutes).
- **Communication contrainte** : Retrait du chat libre, seuls DÉTRESSE + ping de salle disponibles, pour forcer la communication vocale.
