# Journal de Conception & Réalisation du Core Engine (`docs/making/`)

Ce document consigne les travaux réalisés lors de la première passe d'implémentation du moteur Core (`src/core/`), des données de balance (`src/data/`), et du socle de tests (`src/__tests__/`) de **The Grand Audit (Lord Clicker)**, ainsi que le diagnostic d'audit ayant conduit au [Plan de Remédiation Technique (`docs/plan/README.md`)](../plan/README.md).

---

## 1. Contexte Initial & Problématique

Lors de l'audit initial confrontant le prototype existant aux spécifications de référence (`docs/GUIDE.md`, `docs/GAME_RULES.md`, `docs/PLAN.md`), plusieurs manques structurels avaient été constatés :

1. **Modules clés absents** :
   - Absence d'un générateur pseudo-aléatoire déterministe (`prng.ts`).
   - Absence d'un module de résolution de combat asymétrique (`battle.ts`).
   - Absence d'un journal de replay (`replay.ts`) et d'une fonction de hachage d'état.
   - Absence d'un module d'export/import Base64 et de migrations typées (`migrations.ts`).
2. **Divergences dans le moteur économique (`engine.ts` & `commands.ts`)** :
   - Modificateurs universels non branchés sur plusieurs statistiques dérivées.
   - Omission de la pénalité de boycott fiscal de 20% à partir de 50 d'Agitation (*Unrest*).
   - Risque de surexploitation des serfs entre collecteurs d'impôts (`collector`) et fermiers généraux (`farmer_general`).
   - Simulation continuant d'accumuler des ressources hors de la phase `ACTIVE_CYCLE`.
3. **Dédoublement de formules dans `src/data/balance.ts`** :
   - `src/data/balance.ts` dupliquait certaines formules de `src/core/formulas.ts`.

---

## 2. Synthèse des Travaux Réalisés en Première Passe ("Ce qui est effectivement en place")

### 2.1. Modules Core Créés (`src/core/`)

| Fichier | Fonctionnalités Implémentées | Limites Identifiées à Corriger ([`docs/plan/README.md`](../plan/README.md)) |
|---|---|---|
| [`src/core/prng.ts`](../../src/core/prng.ts) | Générateur Mulberry32 32-bit déterministe (`next()`, `nextBetween(min, max)`, `nextInt(min, max)`, `getState()`, `setState()`). | `prngState` non stocké dans `GameState` (instances éphémères `new PRNG(...)` créées à la volée) ; `this.state += 0x6d2b79f5` non tronqué sur 32 bits (`>>> 0`). |
| [`src/core/battle.ts`](../../src/core/battle.ts) | Formule asymétrique (friction offensive -10%, fortification +20%), règle *razor-thin* ($1.00 \le R \le 1.05$ sans gain de province), variété de butin, mortalité d'éclaireur (`performScoutReroll`). | Pertes appliquées uniquement aux `soldier` (épargnant les `man_at_arms` et officiers) ; absence de `currentTarget` (brouillard de guerre, faux registres, embuscades non branchés) ; tribut non bloquant si AP insuffisant. |
| [`src/core/replay.ts`](../../src/core/replay.ts) | Structure `ReplayJournal` horodatée par `timeSeconds` et hachage FNV-1a `getStateHash()`. | Boucle infinie dès qu'une partie franchit $t = 100\text{s}$ (`AUDIT_ASSESSMENT`) ou `LOMBARD_OFFER` car `totalElapsedSeconds` se fige hors `ACTIVE_CYCLE` ; hachage partiel ignorant les unités, serfs et modificateurs. |
| [`src/core/migrations.ts`](../../src/core/migrations.ts) | Export/import Base64 avec préfixe `GRA-v1:` et garde de type `isSerializedSavePayload` sans `any`. | Registre `MIGRATIONS` vide (`v1` initiale) ; absence de rejet des versions futures (`schemaVersion > CURRENT_SCHEMA_VERSION`) et validation superficielle des sous-propriétés de `state`. |

### 2.2. Corrections & Fondations du Moteur (`engine.ts`, `commands.ts`, `modifiers.ts`, `formulas.ts`)

- **Pipeline de composition `composeStat`** ([`src/core/modifiers.ts`](../../src/core/modifiers.ts)) :  
  Implémentation de l'ordre `add` $\to$ `addPct` $\to$ `mul` $\to$ `set` et des résolveurs dynamiques typés par `ResolverKey`. La classe `TickStatCache` est définie mais reste à raccorder dans `engine.ts`.
- **Pénalité de Boycott Fiscal & Bassin partagé de serfs** ([`src/core/engine.ts`](../../src/core/engine.ts)) :  
  Application du multiplicateur $0.8$ sur l'impôt de capitation lorsque `state.unrest >= 50`, et partage strict du bassin `freeSerfs` entre `farmer_general` et `collector`.
- **Gel de la simulation hors `ACTIVE_CYCLE`** ([`src/core/engine.ts`](../../src/core/engine.ts)) :  
  `tick()` retourne immédiatement si `state.phase !== 'ACTIVE_CYCLE'`, mettant notamment en pause le compte à rebours de faillite pendant `LOMBARD_OFFER`.
- **Commandes & Permissions de Phase** ([`src/core/phases.ts`](../../src/core/phases.ts), [`src/core/commands.ts`](../../src/core/commands.ts)) :  
  Table `ALLOWED_COMMANDS_BY_PHASE` et vérification `assertCommandAllowed(state.phase, command)` avant exécution.

### 2.3. Organisation de la Suite de Tests (`src/__tests__/`)

```
src/__tests__/
├── App.spec.ts                  # Montage du composant racine Vue
├── simulation/
│   ├── botRunner.ts             # Exécuteur de simulation headless
│   └── archetypeBots.spec.ts    # Tests des 3 bots (échantillon initial réduit)
└── unit/
    ├── balance.spec.ts          # Constantes, 24 unités, biomes, menaces
    ├── battle.spec.ts           # Combat asymétrique, friction, butin, éclaireurs
    ├── engine.spec.ts           # Boucle de tick, règle 2-sur-3, faillite, pardon
    ├── formulas.spec.ts         # Mathématiques pures (coûts, Buy Max, impôts)
    ├── migrations.spec.ts       # Export/import Base64 GRA-v1:
    ├── modifiers.spec.ts        # Pipeline add -> addPct -> mul -> set, TickStatCache
    ├── phases.spec.ts           # Transitions inter-deadlines et permissions
    └── replay.spec.ts           # Reproductibilité sur 1 deadline (< 100s)
```

---

## 3. Enseignements de l'Audit Croisé (Documentation vs Code)

L'audit approfondi du commit `f1d74fd` a révélé pourquoi plusieurs validations semblaient passer alors que le moteur présentait encore des écarts critiques par rapport à `GAME_RULES.md` et `PLAN.md` :

1. **Biais artificiel dans le calibrage du Greedy Bot (`seed % 2`)** :
   - Dans `botRunner.ts`, le plafond de Barons achetés par le Greedy Bot dépendait de la parité de la graine (`const maxBarons = state.seed % 2 === 0 ? 5 : 4`). Comme 4 Barons plafonnaient la population sous le quota de Deadline 10 (2 152 < 2 200) et 5 Barons au-dessus (2 242 > 2 200), le taux de victoire de ~50% reflétait uniquement la proportion de graines paires et non un véritable calcul de ROI ni un solveur dichotomique du coefficient $c$.
2. **Exploits sur les Édits d'Urgence & le Tribut** :
   - Les édits (`forced_tithe`, `church_seizure`, `grand_festival`) pouvaient être exécutés en boucle dans le même tick sans cooldown ni limite, gonflant artificiellement le quota d'AP.
   - Choisir de payer le tribut (`SELECT_THREAT_RESPONSE: 'tribute'`) sans avoir les AP requis retournait `success: false` mais faisait quand même avancer la phase hors de `THREAT_HERALD`, annulant gratuitement la menace.
3. **Invariant Démographique & Mécaniques Incomplètes** :
   - L'équation $\text{TotalPopulation} = \text{FreeSerfs} + \sum \text{Units}$ pouvait être rompue lors des saignées de surpopulation, des effondrements défensifs, de la levée en masse et de `grant_units`.
   - Plusieurs règles de `GAME_RULES.md` (désertion à 75–89% d'Unrest, séparation `unrest_generation` / `unrest_pacification`, purge de `expiresAt`, défaite immédiate en cas d'échec à Deadline 10, commande `DISBAND_UNIT`, effets secondaires des unités Tier I/II, raids surprises D3+, catalogues des 30 lois et 20 dilemmes) restaient à implémenter.

---

## 4. État Actuel & Prochaine Étape

| Vérification Technique | État |
|---|:---:|
| **Type Checking (`vue-tsc --build`)** | ✅ 0 erreur |
| **Linting (`oxlint` + `eslint`)** | ✅ 0 avertissement, 0 erreur |
| **Tests Unitaires actuels (`npm run test:unit`)** | ✅ 56/56 |
| **Statut global de la Phase V1 (Gates A à E)** | 🔄 **En cours — Remédiation requise avant gel V1** |

L'intégralité des correctifs requis sur le moteur Core, les données Gate D et la suite de simulation est planifiée et spécifiée dans [`docs/plan/README.md`](../plan/README.md) et répercutée dans [`docs/PLAN.md`](../PLAN.md). Le développement de l'interface V2 reste strictement bloqué tant que l'ensemble de ces tâches n'est pas validé.
