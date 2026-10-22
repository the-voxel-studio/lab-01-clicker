# Tâche 1.2 — Composition Duale de l'Agitation, Révolution Immédiate, Purge `expiresAt` & `TickStatCache`

- **Statut** : ✅ Complétée & Validée
- **Date** : 2026-10-14
- **Fichiers modifiés & créés** :
  - `src/core/types.ts` (modifié : remplacement de `'unrest_growth'` par `'unrest_generation' | 'unrest_pacification'` dans `StatKey`)
  - `src/core/mutations.ts` (nouveau : `triggerDefeat`, `addUnrest` avec clamp `[0, 100]` et révolution immédiate)
  - `src/core/modifiers.ts` (modifié : suppression surcharge 3-args de `composeStat`, routage `instant_resource: 'unrest'` vers `addUnrest`)
  - `src/core/engine.ts` (modifié : export `tickStatCache = new TickStatCache()`, purge `expiresAt` au début de `tick()`, calcul séparé de `unrest_generation` et `unrest_pacification` via `composeStat` et `addUnrest`, routage des défaites vers `triggerDefeat`)
  - `src/core/commands.ts` (modifié : routage des hausses/baisses d'agitation vers `addUnrest`, garde `if (!state.isGameOver)` sur toutes les transitions de phase post-commande, invalidation `tickStatCache.clear()` sur toute commande non-TICK)
  - `src/core/battle.ts` (modifié : routage de tous les deltas d'agitation de combat, raid, levée en masse vers `addUnrest`)
  - `src/__tests__/unit/mutations.spec.ts` (nouveau : 7 tests unitaires couvrant clamp, révolution immédiate, régression forced_tithe + 10 clergy, régression levy en THREAT_HERALD, composition duale sans inversion de signe, extinction exacte à expiresAt, invalidation tickStatCache au dispatch)
  - `src/__tests__/unit/modifiers.spec.ts` (modifié : réécriture des tests L40-44 ciblant `'unrest_generation'`, suppression du test de surcharge 3-args)

---

## 1. Actions Réalisées

1. **Scission StatKey Dual Unrest** (`src/core/types.ts`) :
   - Remplacement de `'unrest_growth'` par `'unrest_generation' | 'unrest_pacification'`.
   - Empêche toute inversion mathématique de signe lors de l'application de modificateurs multiplicatifs de pacification (ex. `church_seizure` divisant la pacification par 2 sans affecter la génération fiscale).

2. **Suppression de la surcharge 3-args sans statKey** (`src/core/modifiers.ts`) :
   - La signature de `composeStat` exige désormais obligatoirement `composeStat(statKey: StatKey, baseValue: number, modifiers: readonly Modifier[], rawState?: RawEvaluationState): number`.
   - Tous les appels du dépôt ont été alignés.

3. **Module de Mutations & Révolution Immédiate** (`src/core/mutations.ts`) :
   - `triggerDefeat(state, reason)` : fixe atomiquement `isGameOver = true`, `isVictory = false`, `defeatReason = reason`, `phase = 'RUN_DEFEAT'`. Idempotent si `state.isGameOver` est déjà vrai.
   - `addUnrest(state, delta, config)` : borne `state.unrest` dans $[0, 100]$ via `Math.max(0, Math.min(100, state.unrest + delta))`. Dès que `state.unrest >= 100`, déclenche immédiatement `triggerDefeat(state, 'revolution')`.

4. **Remplacement exhaustif des mutations directes de `state.unrest`** :
   - Toutes les affectations directes de `state.unrest` dans `engine.ts`, `commands.ts` (`handleSetTaxRate`, `handleEnactEdict`), `battle.ts` (`resolveOffensiveCampaign`, `resolveDefensiveClash`, `resolveScheduledThreat`) et `modifiers.ts` (`applyEffect`) transitent désormais par `addUnrest`.
   - Vérification statique : aucune affectation directe résiduelle de `state.unrest` dans `src/` en dehors de `mutations.ts:40`.

5. **Sanctuarisation de l'état de défaite (`RUN_DEFEAT`)** (`src/core/commands.ts`) :
   - Dans `dispatchCommand`, toutes les affectations consécutives de `state.phase` (`getNextInterDeadlinePhase` après `SUBMIT_AUDIT`, `RESOLVE_DILEMMA`, `ENACT_LAW`, `REJECT_LAWS`, `SELECT_THREAT_RESPONSE`, `LAUNCH_ATTACK`, `SKIP_EXPEDITION`, et `ACTIVE_CYCLE` après `RESOLVE_RAID_DEFENSE`) sont enveloppées dans `if (!state.isGameOver)`.
   - Garantit qu'une défaite par révolution (ex. levée en masse) ou faillite n'est jamais écrasée par la transition de phase suivante.

6. **Purge des modificateurs expirés au début de `tick()`** (`src/core/engine.ts`) :
   - Au tout début de `tick()`, filtrage de `state.activeModifiers` :
     ```typescript
     state.activeModifiers = state.activeModifiers.filter(
       (mod) => mod.expiresAt === undefined || mod.expiresAt > state.totalElapsedSeconds
     )
     ```
   - Le temps écoulé est actualisé dès l'entrée de pas actif, assurant l'extinction rigoureuse des modificateurs temporaires.

7. **Raccordement & Invalidation de `TickStatCache`** (`src/core/engine.ts`, `src/core/commands.ts`) :
   - Export d'une instance singleton `tickStatCache = new TickStatCache()`.
   - Mémoisation au sein du pas de tick pour `housing_capacity`, `pop_growth_rate`, `paperwork_friction`, `tax_efficiency`, `gross_ap_rate`, `unrest_generation`, `unrest_pacification`.
   - Réinitialisation à chaque début de `tick()` et à chaque commande dans `dispatch` (`if (command.type !== 'TICK') tickStatCache.clear()`), évitant toute fuite d'état ou valeur obsolète.

8. **Calcul découplé Génération / Pacification dans `tick()`** (`src/core/engine.ts`) :
   - `baseUnrestGen` = taxe (`state.taxRate > 25 ? ((state.taxRate - 25) / 10) * 0.05 : 0`) + surpopulation (`state.totalPopulation > maxPop ? config.balance.OVERCROWDING_UNREST_RATE : 0`).
   - `composedGen = Math.max(0, tickStatCache.getOrCompute('unrest_generation', state.tickIndex, () => composeStat('unrest_generation', baseUnrestGen, state.activeModifiers, rawState)))`.
   - `baseUnrestPac = (state.units.clergy ?? 0) * 0.02 + (state.units.prelate ?? 0) * 0.15`.
   - `composedPac = Math.max(0, tickStatCache.getOrCompute('unrest_pacification', state.tickIndex, () => composeStat('unrest_pacification', baseUnrestPac, state.activeModifiers, rawState)))`.
   - Routage du delta net : `addUnrest(state, (composedGen - composedPac) * dt, config)`.

---

## 2. Vérification & Revue Indépendante

- **Suite de tests unitaires** : 77/77 tests passés (`vitest run`).
- **Simulations bots Monte Carlo** : 5/5 passés (`vitest run src/__tests__/simulation`).
- **Typage & Linters** :
  - `npx vue-tsc --build` : 0 erreur.
  - `npx oxlint .` : 0 warning, 0 erreur.
  - `npx eslint .` : 0 warning, 0 erreur.
- **Revue indépendante (sous-agent read-only)** : Statut **CONFORME** sans réserve sur l'ensemble des 9 critères et actions de la Tâche 1.2.
