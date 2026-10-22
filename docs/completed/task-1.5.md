# Tâche 1.5 — Validation Stricte des Entrées (§1.5), Harmonisation du Clic, Plafond de Vrac (§5.1), Buy Max & Plafonds d'Ordres

- **Statut** : ✅ Complétée & Validée
- **Date** : 2026-10-14
- **Fichiers modifiés & créés** :
  - `src/core/types.ts` (modifié : suppression du champ optionnel `isCritical?: boolean` de `STAMP_DOCUMENT`)
  - `src/core/formulas.ts` (modifié : implémentation de `getMaxBulkSize` selon GAME_RULES §5.1 / Arbitrage 1.0 §8 ; révision de `calculateMaxAffordableUnits` avec prise en compte de `maxBulkSize`, `Math.floor` sur `freeSerfs` et `orderHeadroom`, et boucle de correction d'arrondi virgule flottante)
  - `src/core/engine.ts` (modifié : export de `getBiomeModifiers(state)`, `calculateMaxPopulation(state, config)` et `calculateNetPaperwork(state, config)` ; intégration des biomes et `composeStat` ; délégation de `tick()` vers ces helpers partagés)
  - `src/core/commands.ts` (modifié : validation stricte `dt > 0` et fini dans `TICK` ; validation `count` entier positif et respect du plafond `getMaxBulkSize` dans `handleBuyUnit` ; calcul des plafonds d'ordres via `calculateMaxPopulation` ; `handleStampDocument` raccordé à `calculateGrossApRate`, `calculateNetPaperwork` et tirage critique déterministe via `state.rngStreams.click` ; retour de `{ success: false, error: 'Unsupported command' }` sur les commandes non gérées dans `dispatch`)
  - `src/__tests__/unit/validation_bulk.spec.ts` (nouveau : 12 tests unitaires couvrant la validation des entrées, les plafonds de vrac, le Buy Max avec test de propriété exhaustif, et les helpers partagés du moteur avec tirage critique déterministe)

---

## 1. Actions Réalisées

1. **Suppression de `isCritical?: boolean` & Clic Déterministe (GAME_RULES §2, §6.4)** :
   - Le drapeau `isCritical?: boolean` a été définitivement retiré de la commande `STAMP_DOCUMENT` dans `types.ts`.
   - Le caractère critique du clic est désormais déterminé exclusivement par le flux PRNG déterministe `state.rngStreams.click` via `withStatePrng(state, 'click', (prng) => prng.next() < config.balance.CLICK_CRITICAL_CHANCE)`.
   - Les flux `combat`, `events` et `council` restent strictement isolés et indépendants des actions de clic.
   - Les coups critiques appliquent le multiplicateur $\times 3$ (`config.balance.CLICK_CRITICAL_MULTIPLIER`) et émettent l'événement `'CRITICAL STAMP!'`.

2. **Raccordement de `calculateGrossApRate` & Paperasse Nette** :
   - `handleStampDocument` calcule le rendement instantané via `calculateGrossApRate(state, config).total` (incluant production passive, collecteurs, fermiers généraux, impôt de capitation avec boycott fiscal, et bonus de trait de biome `taxEfficiencyBonus`).
   - Le sceau impérial applique le modificateur `composeStat('click_power', 1.0, ...)`.
   - La paperasse nette `calculateNetPaperwork(state, config)` est atténuée de 50% selon le privilège du souverain (`CLICK_PAPERWORK_MITIGATION = 0.5`).

3. **Plafonds d'Achat en Gros (`getMaxBulkSize`, GAME_RULES §5.1, Arbitrage 1.0 §8)** :
   - `getMaxBulkSize(deadline, totalPopulation, def, config)` implémente strictement les paliers officiels :
     - Mode $1\times$ par défaut ;
     - Mode $10\times$ à Deadline $\ge 3$ OU Population $\ge 250$ ;
     - Mode $50\times$ à Deadline $\ge 6$ OU Population $\ge 1\,000$ ;
     - Mode $100\times$ à Deadline $\ge 8$ ET unité avec `def.allowsBulk100` (`peasant` et `scribe` uniquement).
   - Rejet immédiat dans `handleBuyUnit` avec message explicite si `count > maxBulk`.

4. **Buy Max & Plafonds d'Ordres (`calculateMaxAffordableUnits`, GAME_RULES §5.3)** :
   - Signature mise à jour pour supporter le plafond `maxBulkSize`.
   - Application de `Math.floor` sur `freeSerfs` et `orderHeadroom` pour interdire tout résultat fractionnaire.
   - Boucle de correction numérique pour compenser les arrondis de virgule flottante :
     `while (affordableByAp > 0 && calculateUnitCost(...) > availableAp) affordableByAp--`.
   - Test de propriété exhaustif validant que pour toute combinaison unité / budget / possession, `BUY_UNIT(affordable)` réussit **toujours**.

5. **Validation Stricte des Commandes (§1.5)** :
   - `TICK` : rejette immédiatement tout `dt` non fini ou $\le 0$ avec `{ success: false, error: 'Tick delta time dt must be a positive finite number.' }`.
   - `BUY_UNIT` : rejette tout `count` non entier ou $\le 0$ avec `{ success: false, error: 'Purchase count must be a positive integer.' }`.
   - `dispatch` : la branche par défaut retourne désormais `{ success: false, error: 'Unsupported command' }` au lieu de réussir silencieusement.

6. **Harmonisation des Helpers du Moteur** :
   - Export de `calculateMaxPopulation`, `calculateNetPaperwork`, `getBiomeModifiers` et `calculateGrossApRate`.
   - Les calculs d'ordres dans `BUY_UNIT` et la simulation périodique dans `tick()` utilisent désormais ces mêmes helpers unifiés.

---

## 2. Vérification & Revue Indépendante

- **Suite de tests unitaires** : 136/136 tests passés (`vitest run`).
- **Simulations bots Monte Carlo** : 5/5 passés (`vitest run src/__tests__/simulation`).
- **Typage & Linters** :
  - `npx vue-tsc --build` : 0 erreur.
  - `npx oxlint .` : 0 warning, 0 erreur.
  - `npx eslint .` : 0 warning, 0 erreur.
- **Revue Indépendante** : Sous-agent `research` (Task 1.5 Reviewer) — avis **CONFORME** sur toutes les actions techniques, critères d'acceptation et invariants du système. Cas de test critique ajouté suite à la recommandation du relecteur.
