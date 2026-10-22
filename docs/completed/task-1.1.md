# Tâche 1.1 — Assainissement Architectural, Flux PRNG Persistants (`rngStreams`) & Configuration Injectable (`EngineConfig`)

- **Statut** : ✅ Complétée & Validée
- **Date** : 2026-10-13 (Patch correctif : 2026-10-14)
- **Fichiers modifiés & créés** :
  - `src/core/prng.ts` (modifié : troncature 32-bit, `RngStream`, `deriveStreamSeed`, `withStatePrng`)
  - `src/core/types.ts` (modifié : source unique des types domaine, 18 nouveaux champs `GameState`, `CampaignTarget`)
  - `src/core/phases.ts` (modifié : définition autonome de `RunPhase`, permissions et transitions sans dépendance vers `balance.ts`)
  - `src/core/config.ts` (nouveau : `EngineConfig`, `BalanceConfig`, `DEFAULT_ENGINE_CONFIG`, documentation de l'exception `createInitialGameState`)
  - `src/data/balance.ts` (modifié : rupture du cycle d'import, ajout du biome `heartland`, suppression des réexports circulaires)
  - `src/core/state.ts` (modifié : `runId` déterministe `` `run_${seed}` ``, initialisation `rngStreams` et nouveaux champs, `cloneGameState` en profondeur)
  - `src/core/formulas.ts` (modifié : injection de `config` pour `calculateUnitCost`, `calculateMaxAffordableUnits`, `calculateLogisticGrowth`, `calculateHousingCapacity`, `calculateColonisationCost`, `calculateCollectorYield`, `calculatePaperworkFriction`, `calculateClickValue`, `refillTokenBucket`, suppression des imports `BALANCE`)
  - `src/core/engine.ts` (modifié : injection de `config` dans `tick`, `evaluateDeadlineAudit`, utilisation des constantes via `config.balance`, propagation de `config` aux formules appelées)
  - `src/core/commands.ts` (modifié : injection de `config` dans `dispatch`, `handleBuyUnit`, `handleUnlockPatent`, `handleSetTaxRate`, `handleStampDocument`, `handleColoniseProvince`, `handleEnactEdict`, `handleAcceptLombardLoan`, `SELECT_THREAT_RESPONSE`, propagation à combat/battle, suppression de `BALANCE` et `DEADLINE_QUOTAS`)
  - `src/core/battle.ts` (modifié : suppression des `new PRNG(...)` ad-hoc au profit de `withStatePrng(state, 'combat', ...)`, suppression de l'import `BALANCE`, injection de `config` dans le calcul des puissances et résolutions de clash)
  - `src/__tests__/unit/prng.spec.ts` (nouveau : 5 tests pour Mulberry32 32-bit, graines dérivées, isolation des flux et dispatch `STAMP_DOCUMENT`)
  - `src/__tests__/unit/config.spec.ts` (nouveau : 9 tests pour `EngineConfig`, $r_0$, `TAX_POLL_RATE`, coût des unités, capacité 750, `cloneGameState` en profondeur, `RESTART_RUN`, test de garde statique contre `BALANCE.`/`DEADLINE_QUOTAS`, test de cohérence sur `SERFS_PER_COLLECTOR`)
  - `src/__tests__/unit/balance.spec.ts` (modifié : ajout des assertions sur le biome `heartland`)

---

## 1. Actions Réalisées

1. **Rupture du cycle d'import (`src/data/` vs `src/core/`)** :
   - Déplacement des définitions de types moteurs (`UnitId`, `UnitOrder`, `UnitRole`, `UnitTier`, `StatKey`, `ModifierOp`, `ResolverKey`, `Modifier`, `Effect`, `Command`, `BiomeId`, `BiomeDef`) vers `src/core/types.ts`.
   - Définition de `RunPhase`, `ALLOWED_COMMANDS_BY_PHASE`, `isCommandAllowedInPhase` dans `src/core/phases.ts`.
   - Suppression du réexport circulaire de `core/formulas` et `core/modifiers` depuis `src/data/balance.ts`.

2. **Troncature 32-bit dans `prng.ts`** :
   - Remplacement de `let t = (this.state += 0x6d2b79f5)` par `this.state = (this.state + 0x6d2b79f5) >>> 0`, garantissant l'absence de débordement au-delà de 32 bits non signés.

3. **Flux PRNG séparés (`rngStreams`)** :
   - Définition de `RngStream = 'click' | 'combat' | 'events' | 'council'`.
   - Fonction pure `deriveStreamSeed(seed, stream)` basée sur le hachage FNV-1a 32-bit.
   - Utilitaire `withStatePrng(state, stream, fn)` exécutant et persistant atomiquement le flux PRNG concerné.
   - Suppression de tous les `new PRNG(state.seed + ...)` ad-hoc dans `src/core/` (`battle.ts`, `commands.ts`).

4. **Configuration injectable (`src/core/config.ts`)** :
   - Création de l'interface `BalanceConfig`, de l'interface `EngineConfig` et de la constante canonique `DEFAULT_ENGINE_CONFIG`.
   - Paramètre par défaut `config: EngineConfig = DEFAULT_ENGINE_CONFIG` injecté dans toutes les fonctions du moteur `src/core/`.
   - Exception admise et explicitement documentée dans `src/core/config.ts` : `createInitialGameState` dans `state.ts` (valeurs initiales immuables de nouvelle partie).

5. **Enrichissement de `GameState` & Déterminisme absolu** :
   - Suppression de tout appel à `Math.random()` et `Date.now()` dans `state.ts`. `runId` est calculé par `` `run_${seed}` ``.
   - Ajout des 18 nouveaux champs requis (`rngStreams`, `interimWarningOnTrack`, `desertionTimer`, `forcedTitheFreezeTimer`, `lastEdictDeadline`, `edictUsageCounts`, `disbandedMilitaryHistory`, `provinceBiomes`, `currentTarget`, `campaignsLaunchedThisDeadline`, `lastSurpriseRaidTime`, `surpriseRaidTriggeredThisDeadline`, `pendingDeadlineAudit`, `currentLawDraft`, `currentDilemmaId`, `victoriesCount`, `peakPopulation`, `starvationLosses`).
   - Biome neutre `heartland` défini avec multiplicateur de capacité 1.0, $\Delta r = 0$, et initialisé sur les 3 provinces de départ (capacité garantie à 750).

6. **Deep copy & Réinitialisation `RESTART_RUN`** :
   - `cloneGameState` copie en profondeur l'ensemble des structures d'objets et tableaux (`rngStreams`, `provinceBiomes`, `units`, `unlockedPatents`, `activeLaws`, `currentLawDraft`, `currentTarget`, `disbandedMilitaryHistory`, `edictUsageCounts`, `activeModifiers`).
   - `handleRestartRun` utilise `Object.assign(state, createInitialGameState({ seed, archivePoints: state.archivePoints }))` pour une réinitialisation 100% propre et déterministe.

7. **Patch correctif — Découplage strict & exhaustif d'EngineConfig (Post-Audit 1.1)** :
   - *Contexte* : Le rapport initial mentionnait un découplage sans avoir éliminé les constantes en dur dans `formulas.ts`, `commands.ts` et `battle.ts`.
   - *Fichiers touchés par ce correctif* :
     - `src/core/config.ts` : Documentation dans l'en-tête TSDoc de l'exception `createInitialGameState`.
     - `src/core/formulas.ts` : Injection de `config: EngineConfig = DEFAULT_ENGINE_CONFIG` dans `calculateLogisticGrowth` (`BASE_POP_GROWTH_RATE_R`, `STARTING_TAX_RATE`), `calculateHousingCapacity` (`BASE_HOUSING_PER_PROVINCE`), `calculateColonisationCost` (`COLONISATION_*`), `calculateCollectorYield` (`SERFS_PER_COLLECTOR`), `calculatePaperworkFriction` (`BUREAUCRACY_SCALE_S`), `calculateClickValue` (`CLICK_CRITICAL_MULTIPLIER`), `refillTokenBucket` (`CLICK_MAX_TOKENS_PER_SECOND`). Suppression totale des imports et références à `BALANCE`.
     - `src/core/commands.ts` : Suppression des imports `BALANCE` et `DEADLINE_QUOTAS`. Injection de `config` dans `handleBuyUnit`, `handleUnlockPatent` (`PATENT_*`), `handleSetTaxRate` (`TAX_SHOCK_*`, `TAX_PROMULGATION_DELAY_SECONDS`), `handleStampDocument` (`TAX_POLL_RATE`, `CLICK_*`), `handleColoniseProvince`, `handleEnactEdict` (`TAX_POLL_RATE`), `handleAcceptLombardLoan` (`PROVINCE_MIN_FLOOR_FOR_FINES`), et lecture de `config.quotas` dans `SELECT_THREAT_RESPONSE`. Propagation de `config` à `resolveOffensiveCampaign`, `resolveDefensiveClash`, `resolveScheduledThreat`.
     - `src/core/battle.ts` : Suppression de l'import `BALANCE`. Injection de `config: EngineConfig = DEFAULT_ENGINE_CONFIG` dans `calculateAttackerPower` (`ATTACKER_SIEGE_FRICTION`), `calculateDefenderPower` (`DEFENDER_FORTIFICATION_BONUS`, `BORDER_STRONGHOLD_DEFENSE_FLAT`), `resolveDefensiveClash` (`PROVINCE_MIN_FLOOR_FOR_FINES`), `resolveOffensiveCampaign`, `resolveScheduledThreat`.
     - `src/core/engine.ts` : Propagation systématique de `config` dans les appels à `refillTokenBucket`, `calculateHousingCapacity`, `calculateLogisticGrowth`, `calculatePaperworkFriction`, `calculateCollectorYield`.
     - `src/__tests__/unit/config.spec.ts` :
       - **Test de garde statique** : Scanne tous les fichiers source de `src/core/*.ts` et valide qu'aucune occurrence de `BALANCE.` ou `DEADLINE_QUOTAS` n'apparaît en dehors de `config.ts` et `state.ts`.
       - **Test de cohérence** : Valide qu'en surchargeant `SERFS_PER_COLLECTOR` (ex. 50 au lieu de 100), le rendement des collecteurs calculé dans `tick()` suit fidèlement la configuration surchargée (+0.80 AP/s d'écart mesuré pour 2 collecteurs sur 100 serfs).

---

## 2. Validation & Revue Indépendante

- **Linters & Types** :
  - `npx vue-tsc --build` : 0 erreur
  - `npx oxlint .` : 0 avertissement, 0 erreur
  - `npx eslint .` : 0 avertissement, 0 erreur
- **Tests Unitaires** :
  - `npx vitest run` : 70/70 tests passés (11 fichiers de test)
  - `npx vitest run src/__tests__/simulation` : 5/5 tests passés
- **Revue indépendante par sous-agent** :
  - Découplage strict vérifié : Conforme, aucune référence `BALANCE.` ni `DEADLINE_QUOTAS` hors exceptions admises.
  - Zéro régression sur les invariants et compatibilité complète.
