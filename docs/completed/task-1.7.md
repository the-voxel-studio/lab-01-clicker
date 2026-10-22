# Tâche 1.7 — Refonte du Journal de Replay Multi-Deadlines (`replay.ts`) & Migration Séquentielle `v1 -> v2` (`migrations.ts`)

- **Statut** : ✅ Complétée & Validée
- **Date** : 2026-10-14
- **Fichiers modifiés & créés** :
  - `src/core/replay.ts` (modifié : élimination de la boucle infinie dans `executeReplay`, réinjection du reliquat `dt - consumedDt`, dispatch conditionné par `isCommandAllowedInPhase`, support du paramètre `EngineConfig`, renforcement exhaustif de `getStateHash`)
  - `src/core/migrations.ts` (modifié : `CURRENT_SCHEMA_VERSION = 2`, maintien de `SAVE_PREFIX = 'GRA-v1:'`, pipeline séquentiel `MIGRATIONS[1]` pour migration `v1 -> v2` avec injection des champs Gate B/C, validation stricte du schéma et rejet des valeurs `NaN`/non-finies)
  - `src/__tests__/unit/replay.spec.ts` (modifié : tests de replay multi-deadlines D1–D3, terminaison propre sans boucle infinie, invariance de pas multi-deadlines avec réinjection de reliquat, injection d'EngineConfig et sensibilité complète de `getStateHash`)
  - `src/__tests__/unit/migrations.spec.ts` (modifié : migration effective de `v1-save.json` vers v2 avec préfixe `GRA-v1:`, rejet des versions futures `schemaVersion > CURRENT_SCHEMA_VERSION`, rejet des versions invalides `< 1`, rejet des valeurs corrompues/non-finies)

---

## 1. Actions Réalisées

1. **Élimination de la boucle infinie dans `executeReplay` (`replay.ts`)** :
   - Dépêche conditionnelle en phase `ACTIVE_CYCLE` : les commandes ne sont exécutées que si `isCommandAllowedInPhase(state.phase, entry.command.type)` est vrai, évitant de dépêcher prématurément des commandes inter-deadlines (`SUBMIT_AUDIT`, etc.) lorsque le temps d'horloge atteint l'échéance alors que le cycle actif est encore en cours.
   - Filet de sécurité en phases de pause/crise : lorsque `state.phase !== 'ACTIVE_CYCLE'`, scan des commandes restantes via `sortedEntries.slice(nextEntryIndex).some(...)`. Si aucune commande ne permet de sortir de la phase en cours, sortie propre de la boucle (`break`) au lieu de tourner indéfiniment sur `tick(state, dt)`.
   - Si la commande suivante immédiate est permise dans la phase en pause, dépêche immédiate avec propagation de la configuration du moteur.

2. **Réinjection du Reliquat Temporel `dt - consumedDt` & Invariance Multi-Deadlines** :
   - Mémorisation du reliquat non consommé lors des bornages de fin de deadline (`leftoverDt += (stepDt - consumed)`).
   - Réinjection prioritaire de `leftoverDt` lors du premier tick suivant la reprise de gouvernance.
   - Bornage strict de `stepDt = Math.min(stepDt, maxDurationSeconds - state.totalElapsedSeconds)` pour éviter les dépassements temporels en fin de partie.
   - Validation de l'invariance numérique sur 2 deadlines complètes avec un delta AP $< 1.5\%$ entre `dt = 0.05s` et `dt = 0.7s`.

3. **Renforcement Exhaustif de `getStateHash(state)` (`replay.ts`)** :
   - Hachage FNV-1a 32-bit incluant l'intégralité des 15 composantes critiques du `GameState` :
     1. `deadline`
     2. `phase`
     3. `ap` (arrondi à 0.1)
     4. `totalPopulation` (arrondi à 0.1)
     5. `freeSerfs` (arrondi à 0.1)
     6. `milPower` (calculé via `calculateMilitaryPower(state)`)
     7. `provinces`
     8. `provinceBiomes.join(',')`
     9. `taxRate`
     10. `unrest` (arrondi à 0.1)
     11. `strikes`
     12. `rngStreams` (`click`, `combat`, `events`, `council`)
     13. Roster complet des 24 unités trié par identifiant (`${id}:${count}`)
     14. `activeLaws.join(',')`
     15. `activeModifiers.length`
     16. Flags de fin de partie (`isGameOver`, `isVictory`, `defeatReason`)

4. **Migration Séquentielle `v1 -> v2` & Préservation du Préfixe (`migrations.ts`)** :
   - Incrément de `CURRENT_SCHEMA_VERSION = 2`.
   - Préservation stricte de `SAVE_PREFIX = 'GRA-v1:'` (format d'encodage d'enveloppe indépendant du schéma interne, conformément à `GAME_RULES.md §18` et à l'Arbitrage 1.0 §14).
   - Implémentation de `MIGRATIONS[1]` :
     - Dérivation déterministe des flux `rngStreams` à partir de `state.seed` via `deriveStreamSeed`.
     - Initialisation du tableau `provinceBiomes` avec `Math.max(1, provinces)` entrées `'heartland'`.
     - Injection des valeurs par défaut pour tous les nouveaux champs de `GameState` (`desertionTimer: 0`, `forcedTitheFreezeTimer: 0`, `lastSurpriseRaidTime: -60`, `edictUsageCounts`, `currentLawDraft`, `currentTarget: null`, etc.).
   - Validation stricte lors de l'import :
     - Rejet des schémas futurs (`schemaVersion > CURRENT_SCHEMA_VERSION`).
     - Rejet des schémas invalides (`schemaVersion < 1` ou non entier).
     - Validation des valeurs numériques récursives : rejet des payloads contenant `NaN` ou des valeurs non finies.

---

## 2. Vérification & Tests

- **Tests unitaires ajoutés** :
  - `replay.spec.ts` :
    - `replays multi-deadline runs spanning audits, dilemmas, laws, threats, and expeditions` (D1 à D3 avec commandes inter-deadlines et raid surprise).
    - `terminates cleanly without infinite loop when game is paused and journal has no unblocking entries`.
    - `preserves step-size invariance across multiple deadlines with reliquat re-injection` (`dt = 0.05s` vs `0.7s`).
    - `accepts custom EngineConfig to alter replay mechanics`.
    - `strengthens getStateHash to include all specified state components` (tests de sensibilité ciblés).
  - `migrations.spec.ts` :
    - `loads and validates legacy save fixtures (v1-save.json) via v1 -> v2 migration pipeline`.
    - `rejects unsupported future schema versions (schemaVersion > CURRENT_SCHEMA_VERSION)`.
    - `rejects invalid schema versions (schemaVersion < 1 or non-integer)`.
    - `rejects saves containing NaN or non-finite numerical values`.

- **Résultats automatisés** :
  - `vue-tsc --build` : 0 erreur
  - `oxlint .` : 0 erreur, 0 avertissement
  - `eslint .` : 0 erreur, 0 avertissement
  - `vitest run` : 16 suites / 164 tests passés avec succès
  - Revue indépendante par sous-agent : **CONFORME** sans réserve
