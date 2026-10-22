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
| **Tests Unitaires actuels (`npm run test:unit`)** | ✅ 156/156 |
| **Statut global de la Phase V1 (Gates A à E)** | 🔄 **En cours — Remédiation requise avant gel V1** |

L'intégralité des correctifs requis sur le moteur Core, les données Gate D et la suite de simulation est planifiée et spécifiée dans [`docs/plan/README.md`](../plan/README.md) et répercutée dans [`docs/PLAN.md`](../PLAN.md). Le développement de l'interface V2 reste strictement bloqué tant que l'ensemble de ces tâches n'est pas validé.

---

## 5. Journal des Tâches de Remédiation

### Tâche 1.0 — Arbitrages de Règles & Alignement Documentaire (`GAME_RULES.md`, `GUIDE.md`, `PLAN.md`)
- **Date** : 2026-10-13
- **Fichiers modifiés** : `docs/GAME_RULES.md`, `docs/GUIDE.md`, `docs/PLAN.md`, `docs/making/README.md`
- **Contenu** : Inscription et harmonisation stricte des 14 arbitrages du plan de remédiation :
  1. Révolution immédiate à Unrest = 100 dans toute phase (sans écrasement par des transitions ultérieures).
  2. Désertion cumulative de 75% à 99% d'Unrest ; *Sanctuary Rights* supprime la désertion sous 90% uniquement.
  3. Quota d'AP en débit brut instantané (AP/s, `ApRateQuota`) à l'inspection ; clics et transferts exclus.
  4. Trésor signé : aucune remise à zéro de dette, solvabilité exigée pour tout choix coûteux (exception explicite : `DISBAND_UNIT` §14.1 autorisé sans AP avec +2 Unrest par unité non payée).
  5. Héraut des menaces : après audit $d$ ($2 \le d \le 9$), annonce et résout la menace $d+1$ ; tribut = $20 \times \text{ApRateQuota}_{d+1}$.
  6. Défaite par conquête : le plancher de 1 province ne protège pas en cas d'effondrement militaire (défaite `conquest` à 0 province).
  7. Biome neutre de départ : biome `heartland` (3 provinces de départ = 750 de capacité) ; perte de province en LIFO.
  8. Achats en vrac : paliers comme tailles maximales d'achat (1, 10, 50, 100) ; validation de toute quantité entière $\le$ max ; Buy Max borné par la taille max.
  9. Salvage défensif : formule de récupération $\text{round}(0.25 \times \text{TributeCost}_{\text{repelled threat}} \times \text{Roll}(0.8, 1.2))$ (d+1 pour le héraut, deadline courante pour un raid surprise) créditée à `state.ap`.
  10. Butin de soldats : soldats capturés au-delà du plafond militaire reversés aux serfs libres.
  11. Prêt lombard : conditionné à `provinces >= 2`.
  12. Raids & Mercenaires : doublement si AP > 2000 généralisé en §8.3 ; Mercenaires = tribut +25% uniquement.
  13. Clic d'amorçage : 50 AP de départ pour recruter le 1er Scribe immédiatement ; tutoriel axé sur le débit de production.
  14. Format de sauvegarde : préfixe `GRA-v1:` stable pour le format d'encodage ; `schemaVersion` dans le payload pour le schéma.
  15. `PLAN.md` mis à jour avec la checklist Tâche 1.0 et rappel de la convention de numérotation.
- **Statut** : ✅ Validée par l'utilisateur (Corrections documentaires intégrées)

### Tâche 1.1 — Assainissement Architectural, Flux PRNG Persistants (`rngStreams`) & Configuration Injectable (`EngineConfig`)
- **Date** : 2026-10-13
- **Fichiers modifiés & créés** : `src/core/prng.ts`, `src/core/types.ts`, `src/core/phases.ts`, `src/core/config.ts`, `src/data/balance.ts`, `src/core/state.ts`, `src/core/formulas.ts`, `src/core/engine.ts`, `src/core/commands.ts`, `src/core/battle.ts`, `src/__tests__/unit/prng.spec.ts`, `src/__tests__/unit/config.spec.ts`, `src/__tests__/unit/balance.spec.ts`
- **Contenu** :
  1. Rupture du cycle d'import entre `src/data/` et `src/core/` : types transférés vers `src/core/types.ts` et `src/core/phases.ts` ; réexports circulaires de formules et modificateurs supprimés dans `balance.ts`.
  2. Troncature 32-bit stricte de Mulberry32 dans `prng.ts` via `(this.state + 0x6d2b79f5) >>> 0`.
  3. Flux PRNG isolés et persistants `RngStream` ('click' | 'combat' | 'events' | 'council'), `deriveStreamSeed` par hachage FNV-1a 32-bit, et utilitaire `withStatePrng`. Purgé tous les `new PRNG(...)` ad-hoc dans `src/core/`.
  4. Configuration injectable `EngineConfig` et `DEFAULT_ENGINE_CONFIG` dans `src/core/config.ts`. Injecté dans `tick`, `dispatch`, `evaluateDeadlineAudit`, `calculateUnitCost`, `calculateMaxAffordableUnits`. Découplé `TAX_POLL_RATE`, `BASE_POP_GROWTH_RATE_R`, `OVERCROWDING_*`, `SERFS_PER_COLLECTOR`, `PROVINCE_MIN_FLOOR_FOR_FINES`.
  5. Initialisation 100% déterministe de `GameState` sans `Math.random` ni `Date.now` (`runId = run_${seed}`). Enrichi de 18 nouveaux champs, avec 3 provinces de départ `heartland` (capacité 750).
  6. Réinitialisation complète lors de `RESTART_RUN` et copie profonde dans `cloneGameState`.
- **Tests ajoutés** : 14 nouveaux tests (`src/__tests__/unit/prng.spec.ts` et `src/__tests__/unit/config.spec.ts`, enrichissement de `balance.spec.ts`), 70/70 tests unitaires verts (+ 5/5 tests de simulation bots).
- **Patch correctif — Découplage strict & exhaustif d'EngineConfig (2026-10-14)** :
  1. Exception admise et explicitement documentée dans `src/core/config.ts` : `createInitialGameState` dans `state.ts`.
  2. Découplage strict de toutes les constantes résiduelles dans `src/core/` :
     - `src/core/formulas.ts` : `calculateLogisticGrowth` (`BASE_POP_GROWTH_RATE_R`, `STARTING_TAX_RATE`), `calculateHousingCapacity` (`BASE_HOUSING_PER_PROVINCE`), `calculateColonisationCost` (`COLONISATION_*`), `calculateCollectorYield` (`SERFS_PER_COLLECTOR`), `calculatePaperworkFriction` (`BUREAUCRACY_SCALE_S`), `calculateClickValue` (`CLICK_CRITICAL_MULTIPLIER`), `refillTokenBucket` (`CLICK_MAX_TOKENS_PER_SECOND`).
     - `src/core/commands.ts` : `handleBuyUnit`, `handleUnlockPatent` (`PATENT_*`), `handleSetTaxRate` (`TAX_SHOCK_*`, `TAX_PROMULGATION_DELAY_SECONDS`), `handleStampDocument` (`TAX_POLL_RATE`, `CLICK_*`), `handleColoniseProvince`, `handleEnactEdict` (`TAX_POLL_RATE`), `handleAcceptLombardLoan` (`PROVINCE_MIN_FLOOR_FOR_FINES`), et `SELECT_THREAT_RESPONSE` (`config.quotas`).
     - `src/core/battle.ts` : `calculateAttackerPower` (`ATTACKER_SIEGE_FRICTION`), `calculateDefenderPower` (`DEFENDER_FORTIFICATION_BONUS`, `BORDER_STRONGHOLD_DEFENSE_FLAT`), `resolveDefensiveClash` (`PROVINCE_MIN_FLOOR_FOR_FINES`), `resolveOffensiveCampaign`, `resolveScheduledThreat`.
     - `src/core/engine.ts` : propagation systématique de `config` aux formules appelées dans `tick()`.
  3. Tests de garde et de cohérence ajoutés dans `src/__tests__/unit/config.spec.ts` :
     - Test de garde statique : vérifie qu'aucune occurrence de `BALANCE.` ou `DEADLINE_QUOTAS` n'apparaît dans `src/core/` en dehors de `config.ts` et `state.ts`.
     - Test de cohérence : vérifie qu'une surcharge de `SERFS_PER_COLLECTOR` dans `EngineConfig` impacte immédiatement le rendement des collecteurs dans `tick()`.
- **Revue indépendante** : Revue critique par sous-agent `research` effectuée. Découplage strict vérifié : conforme, zéro fuite de constantes hors exceptions admises.
- **Statut** : ✅ Complétée & Validée (conforme au plan de remédiation).

### Tâche 1.2 — Composition Duale de l'Agitation, Révolution Immédiate, Purge `expiresAt` & `TickStatCache`
- **Date** : 2026-10-14
- **Fichiers modifiés & créés** : `src/core/types.ts`, `src/core/mutations.ts`, `src/core/modifiers.ts`, `src/core/engine.ts`, `src/core/commands.ts`, `src/core/battle.ts`, `src/__tests__/unit/mutations.spec.ts`, `src/__tests__/unit/modifiers.spec.ts`
- **Contenu** :
  1. Scission de `StatKey` : `'unrest_growth'` remplacé par `'unrest_generation' | 'unrest_pacification'`, prévenant toute inversion de signe lors de réductions multiplicatives de la pacification.
  2. Suppression de la surcharge 3-args de `composeStat` dans `modifiers.ts`, exigeant systématiquement la clé de statistique.
  3. Création de `src/core/mutations.ts` avec `triggerDefeat(state, reason)` (idempotent, sanctuarisé) et `addUnrest(state, delta, config)` borné à $[0, 100]$ avec déclenchement immédiat de la défaite `revolution` dès $100$.
  4. Remplacement exhaustif de toutes les mutations directes de `state.unrest` par des appels à `addUnrest` (chocs fiscaux, édits, résolutions militaires, levée en masse, pas de simulation, effets instantanés).
  5. Sanctuarisation de l'état de défaite dans `dispatchCommand` : toutes les transitions de phase post-action sont conditionnées par `if (!state.isGameOver)`.
  6. Purge des modificateurs expirés au tout début de `tick()` (`mod.expiresAt > state.totalElapsedSeconds`).
  7. Raccordement et gestion du cache `TickStatCache` au pas de tick pour mémoiser les composantes statistiques sans fuite d'état, invalidé à chaque début de tick et à chaque dispatch non-TICK.
  8. Découplage de la génération et de la pacification d'agitation dans `tick()` calculées séparément via `composeStat` et sommées dans `addUnrest((composedGen - composedPac) * dt)`.
- **Tests ajoutés** : 7 tests dans `src/__tests__/unit/mutations.spec.ts` (clamp, révolution immédiate, régressions forced_tithe + 10 clergés et levy en masse en THREAT_HERALD, composition duale, purge expiresAt, invalidation tickStatCache). Réécriture des tests L40-44 de `modifiers.spec.ts`.
- **Revue indépendante** : Revue par sous-agent `research` effectuée. Tous les critères, invariants et règles validés CONFORME.
- **Statut** : ✅ Complétée & Validée.

### Tâche 1.3 — Invariant Démographique (§3.1), Trésor Signé, Surpopulation (§14.3) & Désertion Militaire (§6.5)
- **Date** : 2026-10-14
- **Fichiers modifiés & créés** : `src/core/types.ts`, `src/core/mutations.ts`, `src/core/engine.ts`, `src/core/modifiers.ts`, `src/core/battle.ts`, `src/__tests__/unit/demographics.spec.ts`, `src/__tests__/unit/modifiers.spec.ts`, `src/__tests__/unit/engine.spec.ts`
- **Contenu** :
  1. Helper d'invariant démographique `applyPopulationLoss(state, loss, isStarvation)` dans `src/core/mutations.ts` : déduit d'abord de `freeSerfs`, puis cascade sur les unités selon `POPULATION_LOSS_CASCADE_ORDER` (Tier I civil -> Tier II civil -> Tier I militaire -> Tier II militaire), réconcilie `state.totalPopulation = state.freeSerfs + sum(units)` et incrémente `starvationLosses` si `isStarvation`.
  2. Surpopulation (§14.3) dans `src/core/engine.ts` : saignée démographique routée via `applyPopulationLoss(state, bleed, true)`, et Unrest proportionnel $\min(1.0, 0.10 \times \frac{\text{initialExcessPop}}{50})$ intégré à `baseUnrestGen`.
  3. Désertion militaire cumulative (§6.5, arbitrage 1.0 §2) : active dès que Unrest $\ge 75$ (sauf sous 90% si `law:sanctuary_rights`), consomme 1 `soldier` tous les 15s ou 1 `man_at_arms` tous les 30s, remet le timer à 0 sans armée éligible ou désertion inactive, et décrémente `totalPopulation` et l'unité déserteuse.
  4. Trésor signé et correction de `applyEffect` dans `src/core/modifiers.ts` : suppression du clamp `Math.max(0)` sur l'AP (dettes préservées sans crédit indu de quota), `grant_units` consomme `freeSerfs` ou incrémente `totalPopulation` si `external: true`, `instant_resource: 'population'` négatif routé via `applyPopulationLoss`.
  5. Sécurisation des batailles dans `src/core/battle.ts` : effondrement défensif et levée en masse routés par `applyPopulationLoss`.
- **Tests ajoutés** : 16 nouveaux tests dans `src/__tests__/unit/demographics.spec.ts`, 93/93 tests unitaires verts (+ 5/5 tests de simulation bots).
- **Revue indépendante** : Revue par sous-agent `research` effectuée. Statut CONFORME sur l'ensemble des 6 critères et actions.
- **Statut** : ✅ Complétée & Validée.

### Tâche 1.4 — Garde-fous des Édits d'Urgence (§11), Démobilisation (DISBAND_UNIT, §14.1) & Fiscalité Dynamique (§14.2)
- **Date** : 2026-10-14
- **Fichiers modifiés & créés** : `src/core/types.ts`, `src/core/phases.ts`, `src/core/engine.ts`, `src/core/commands.ts`, `src/__tests__/unit/phases.spec.ts`, `src/__tests__/unit/engine.spec.ts`, `src/__tests__/unit/edicts_disband.spec.ts`
- **Contenu** :
  1. Édits d'urgence (`handleEnactEdict`, GAME_RULES §11) :
     - Enforce un édit d'urgence maximum par deadline (`state.lastEdictDeadline === state.deadline`).
     - Pénalités d'Unrest et de durée croissantes de $+50\%$ par utilisation préalable ($\text{mult} = 1 + 0.5 \times k$).
     - `forced_tithe` : ajout de $30 \times \text{pollTax}$ sans toucher aux quotas d'AP, $+35 \times \text{mult}$ Unrest, et gel démographique de 20s (`forcedTitheFreezeTimer = 20` bloquant `canGrow`).
     - `church_seizure` : plafonnement strict à 2 utilisations par run, ajout de $\max(300, 25 \times \text{Gross AP/s})$ sans crédit de quota, réduction de pacification de 50% expirant à $60 \times \text{mult}$ secondes, et $+10 \times \text{mult}$ Unrest.
     - `grand_festival` : coût dynamique $\max(100, 0.20 \times \max(0, \text{state.ap}), 30 \times \text{Gross AP/s})$, rejet strict si `state.ap < cost` (protège contre l'effacement de dette), et pacification de $-20$ Unrest.
     - Compteurs et statut d'édit mis à jour uniquement en cas de succès.
  2. Démobilisation (`DISBAND_UNIT`, GAME_RULES §14.1) :
     - Commande `{ type: 'DISBAND_UNIT'; unitId: UnitId; count: number }` autorisée en `ACTIVE_CYCLE` et `AWAIT_RESUME`.
     - Indemnité de licenciement à $50\%$ du coût de base payée sur le trésor positif ; en cas d'insolvabilité, le licenciement réussit sans bloquer mais inflige $+2$ Unrest par unité impayée.
     - Transfert 1 pour 1 vers les serfs libres, préservant rigoureusement l'invariant démographique.
     - Risque de mutinerie militaire : si le volume démobilisé sur 10s dépasse $10\%$ de l'armée active pré-licenciement, $+15$ Unrest (mutinerie) et réinitialisation de l'historique glissant.
  3. Fiscalité dynamique (`handleSetTaxRate`, GAME_RULES §14.2) :
     - Rejet des taux non finis (`NaN`, infini).
     - Baisse ou maintien immédiat sans délai de promulgation, annulant toute promulgation haussière pendante.
     - Hausse avec délai de promulgation de 8s et choc fiscal de $+20$ Unrest si l'augmentation dépasse 15 points.
  4. Réécriture des tests existants : `engine.spec.ts` L191–208 scindé en 4 tests distincts par deadline + test de rejet du 2e édit.
- **Tests ajoutés** : 12 nouveaux tests unitaires dans `src/__tests__/unit/edicts_disband.spec.ts`, 124/124 tests unitaires verts (+ 5/5 tests de simulation bots).
- **Revue indépendante** : Revue par sous-agent `research` effectuée. Statut CONFORME sur l'ensemble des points techniques et critères d'acceptation.
- **Statut** : ✅ Complétée & Validée.

### Tâche 1.5 — Validation Stricte des Entrées (§1.5), Harmonisation du Clic, Plafond de Vrac (§5.1), Buy Max & Plafonds d'Ordres
- **Date** : 2026-10-14
- **Fichiers modifiés & créés** : `src/core/types.ts`, `src/core/formulas.ts`, `src/core/engine.ts`, `src/core/commands.ts`, `src/__tests__/unit/validation_bulk.spec.ts`
- **Contenu** :
  1. Suppression du drapeau optionnel `isCritical?: boolean` dans `STAMP_DOCUMENT` (`types.ts`). Tirage critique purement déterministe par `withStatePrng(state, 'click', ...)` sur le flux dédié `state.rngStreams.click`.
  2. Raccordement de `calculateGrossApRate` et `calculateNetPaperwork` dans `handleStampDocument` : production brute temps-réel, bonus de sceau `click_power`, et atténuation royale de 50% de la friction de paperasse nette.
  3. Plafonds d'achat en gros (`getMaxBulkSize`, GAME_RULES §5.1, arbitrage 1.0 §8) : paliers 1x (défaut), 10x (D3+ ou Pop 250+), 50x (D6+ ou Pop 1000+), 100x (D8+ et `allowsBulk100`). Rejet strict dans `handleBuyUnit` si `count > maxBulk`.
  4. Révision de `calculateMaxAffordableUnits` (GAME_RULES §5.3) : prise en compte du plafond `maxBulkSize`, `Math.floor` sur `freeSerfs` et `orderHeadroom`, boucle de compensation d'arrondi virgule flottante garantissant la propriété universelle `BUY_UNIT(affordable)` toujours valide.
  5. Validation stricte des commandes (§1.5) : `TICK` impose `dt > 0` et fini ; `BUY_UNIT` impose `count` entier positif ; `dispatch` retourne `{ success: false, error: 'Unsupported command' }` pour les commandes non gérées au lieu d'ignorer silencieusement.
  6. Harmonisation des helpers du moteur : export de `calculateMaxPopulation`, `calculateNetPaperwork`, `getBiomeModifiers` et `calculateGrossApRate` depuis `engine.ts` ; `BUY_UNIT` et `tick()` partagent rigoureusement les mêmes calculs de capacité et de friction.
- **Tests ajoutés** : 12 nouveaux tests unitaires dans `src/__tests__/unit/validation_bulk.spec.ts`, 136/136 tests unitaires verts (+ 5/5 tests de simulation bots).
- **Revue indépendante** : Revue par sous-agent `research` effectuée. Statut CONFORME sur l'ensemble des critères d'acceptation, des invariants du système et des règles du jeu. Cas critique déterministe renforcé suite aux suggestions de la revue.
- **Statut** : ✅ Complétée & Validée.

### Tâche 1.6 — Combat Asymétrique, Horloge de Tick Bornée, Quotas en Débit Brut (`apRate`), Raids Surprises & Héraut D+1
- **Date** : 2026-10-14
- **Fichiers modifiés & créés** : `scripts/generate-balance-report.ts`, `src/data/balance.generated.ts`, `src/data/balance.ts`, `src/core/types.ts`, `src/core/phases.ts`, `src/core/battle.ts`, `src/core/engine.ts`, `src/core/commands.ts`, `src/core/modifiers.ts`, `src/__tests__/unit/balance.spec.ts`, `src/__tests__/unit/phases.spec.ts`, `src/__tests__/unit/military_threats_clock.spec.ts`, `src/__tests__/simulation/botRunner.ts`, `src/__tests__/simulation/archetypeBots.spec.ts`
- **Contenu** :
  1. Effondrement défensif dévastateur & préservation de dette (`battle.ts`) : pillage 30–50% préservant la dette signée sans `Math.max` final (ex. -800 AP reste -800 AP) ; perte d'une province sans plancher entraînant défaite `conquest` si provinces $\le 0$ ; 100% de l'ordre militaire massacré ; pertes civiles de 15–25% ; $+20$ Unrest.
  2. Plafond militaire, butin de campagne & salvage défensif (arbitrages 1.0 §9–10) : aucun crédit de quota d'audit sur le butin de campagne ; soldats capturés plafonnés au headroom militaire de l'ordre (`orderCaps.military - currentMil`), l'excédent rejoignant `freeSerfs` pour préserver strictement l'invariant démographique ; salvage défensif sur victoire repoussée crédité sur le flux `'combat'` sans affecter les compteurs d'audit.
  3. Héraut des menaces à D+1 (arbitrage 1.0 §5) : activé de D2 à D9 inclusivement (8 menaces résolues sur un run) ; transition renseignant automatiquement `currentThreatPower` et `currentThreatTributeAp` ; lecture directe dans `SELECT_THREAT_RESPONSE` sans repli `'||'`.
  4. Tribut bloquant & levée en masse (§8.2) : refus avec `success: false` sans transition de phase si `state.ap < currentThreatTributeAp` ; levée en masse appliquant 5% de pertes civiles et $+30$ Unrest conditionnée par `!state.isGameOver`.
  5. Horloge de tick bornée & dérive de pas de temps (anomalie 18) : `stepDt = Math.min(dt, 100 - state.deadlineTimeSeconds)` ; horloge avancée immédiatement avant toute transition de phase ; `consumedDt = stepDt` exposé ; armement de `pendingDeadlineAudit` lors d'un franchissement de deadline hors `ACTIVE_CYCLE`, exécuté dès le retour en cycle actif.
  6. Expéditions & cibles déterministes (§7.1, §7.3) : génération déterministe de `currentTarget` sur le flux `'combat'` avec marge 0.45, biome, butin, fausse comptabilité (15%, -60–80% butin) et embuscade (10%, +25% force ennemie) ; `RECON_PATROL` sacrifiant 1 scout (`totalPopulation -= 1`) ; limite stricte de 2 campagnes par phase d'expédition.
  7. Raids surprises spontanés (`SURPRISE_RAID`, §8.3) : déclenchement déterministe à chaque palier de 10s en D3+ avec cooldown de 60s selon probabilité $p$ sur le flux `'events'` ; `RESOLVE_RAID_DEFENSE` défendant à 50% du quota militaire avec bastions et salvage.
  8. Quota d'AP en débit brut instantané (`apRate`, §1.2, §1.3) : quotas renommés en `apRate` dans `balance.generated.ts` et `balance.ts` (`[5, 12, 22, 35, 55, 85, 130, 195, 285, 420]` AP/s) ; `evaluateDeadlineAudit` comparant `grossApRate >= quota.apRate` ; trésor gonflé sans débit rejeté ; défaite immédiate en D10 sans strike ; Royal Censure confisquant 50% de l'AP positive uniquement ; avertissement à 50s selon la règle 2-sur-3 ; garde interdisant `RESUME_GOVERNANCE` au-delà de Deadline 10.
  9. Prêt lombard (arbitrage 1.0 §11) : conditionné à `provinces >= 2` dans `tick()`.
  10. Nettoyage orphelin : retrait définitif de `COMBAT_RESOLUTION` et `RESOLVE_COMBAT`.
- **Tests ajoutés** : 20 nouveaux tests unitaires dans `src/__tests__/unit/military_threats_clock.spec.ts`, 156/156 tests unitaires verts.
- **Revue indépendante** : Revue par sous-agent `research` effectuée. Statut CONFORME sur l'ensemble des 10 actions techniques, critères d'acceptation et invariants. Les 6 recommandations de renforcement des tests du relecteur ont été intégralement implémentées et validées.
- **Statut** : ✅ Complétée & Validée.

### Tâche 1.7 — Refonte du Journal de Replay Multi-Deadlines (`replay.ts`) & Migration Séquentielle `v1 -> v2` (`migrations.ts`)
- **Date** : 2026-10-14
- **Fichiers modifiés & créés** : `src/core/replay.ts`, `src/core/migrations.ts`, `src/__tests__/unit/replay.spec.ts`, `src/__tests__/unit/migrations.spec.ts`
- **Contenu** :
  1. Élimination de la boucle infinie dans `executeReplay` (`replay.ts`) :
     - Dépêche des commandes inter-deadlines et de crise autorisée dès que `entry.timeSeconds <= totalElapsedSeconds` avec vérification préalable de permission `isCommandAllowedInPhase`.
     - Filet de sécurité en phases hors-cycle (`AUDIT_ASSESSMENT`, `COUNCIL_DILEMMA`, etc.) : scan des commandes restantes via `sortedEntries.slice(nextEntryIndex).some(...)` et sortie propre de la boucle (`break`) si aucune commande ne permet de sortir de la phase en cours.
     - Dépêche immédiate de la commande unblocking si elle est permise dans la phase en cours.
  2. Réinjection du reliquat `dt - consumedDt` et invariance de pas multi-deadlines :
     - Mémorisation de `leftoverDt` lors des troncatures de fin de deadline et réinjection prioritaire au premier tick suivant la reprise de cycle.
     - Bornage de `stepDt = Math.min(stepDt, maxDurationSeconds - state.totalElapsedSeconds)` pour éviter les dépassements temporels en fin de run.
     - Prise en compte du paramètre optionnel `EngineConfig` transmis à `dispatch` et `tick`.
  3. Renforcement de `getStateHash(state)` :
     - Hachage incluant rigoureusement les 15 composantes exigées : `deadline`, `phase`, `ap`, `totalPopulation`, `freeSerfs`, `milPower`, `provinces`, `provinceBiomes.join(',')`, `taxRate`, `unrest`, `strikes`, les 4 flux `rngStreams`, les 24 unités triées (`${id}:${count}`), `activeLaws.join(',')`, et le nombre de modificateurs actifs.
  4. Migration séquentielle `v1 -> v2` & validation stricte (`migrations.ts`) :
     - `CURRENT_SCHEMA_VERSION = 2` et conservation stricte du préfixe stable d'enveloppe `SAVE_PREFIX = 'GRA-v1:'`.
     - Pipeline `MIGRATIONS[1]` injectant déterministement les 4 flux `rngStreams` dérivés de `seed` via `deriveStreamSeed`, `provinceBiomes` (`heartland` $\times$ `provinces`), et toutes les nouvelles propriétés par défaut du `GameState`.
     - Validation stricte lors de l'import : rejet des schémas futurs (`schemaVersion > CURRENT_SCHEMA_VERSION`), des versions invalides (`< 1` ou non entières), et des payloads contenant `NaN` ou des nombres non finis.
- **Tests ajoutés** : 8 nouveaux tests unitaires (5 dans `replay.spec.ts`, 3 dans `migrations.spec.ts`), 164/164 tests unitaires verts.
- **Revue indépendante** : Revue par sous-agent `research` effectuée. Statut CONFORME sur l'ensemble des critères d'acceptation, invariants et règles documentaires.
- **Statut** : ✅ Complétée & Validée.

