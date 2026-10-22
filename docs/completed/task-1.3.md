# Tâche 1.3 — Invariant Démographique (§3.1), Trésor Signé, Surpopulation (§14.3) & Désertion Militaire (§6.5)

- **Statut** : ✅ Complétée & Validée
- **Date** : 2026-10-14
- **Fichiers modifiés & créés** :
  - `src/core/types.ts` (modifié : ajout du drapeau optionnel `external?: boolean` sur `grant_units` dans `Effect`)
  - `src/core/mutations.ts` (modifié : export de `POPULATION_LOSS_CASCADE_ORDER` et `applyPopulationLoss(state, loss, isStarvation)`)
  - `src/core/engine.ts` (modifié : saignée de surpopulation routée via `applyPopulationLoss`, formule proportionnelle d'Unrest de surpopulation `+0.10/s` par tranche de 50 habitants en excès plafonnée à `1.0/s`, boucle déterministe de désertion militaire `soldier` à 15s puis `man_at_arms` à 30s)
  - `src/core/modifiers.ts` (modifié : `applyEffect` sans clamp `Math.max(0)` sur l'AP et sans crédit indu de quota, `grant_units` consommant les serfs libres ou incrémentant la population si `external: true`, `instant_resource: 'population'` négatif via `applyPopulationLoss`)
  - `src/core/battle.ts` (modifié : pertes civiles d'effondrement défensif et levée en masse routées via `applyPopulationLoss`)
  - `src/__tests__/unit/demographics.spec.ts` (nouveau : 16 tests unitaires couvrant l'invariant démographique strict `< 1e-6`, la cascade ordonnée, `starvationLosses`, la surpopulation proportionnelle, les 5 cas de désertion militaire, le trésor signé, et l'invariance en combat)
  - `src/__tests__/unit/modifiers.spec.ts` (modifié : alignement de l'attendu de quota L131 à `0`)
  - `src/__tests__/unit/engine.spec.ts` (modifié : alignement de l'attendu d'Unrest de surpopulation L94 à `+0.10 * 2.0` conformément à la formule proportionnelle de GAME_RULES §14.3)

---

## 1. Actions Réalisées

1. **Helper d'Invariant Démographique (`applyPopulationLoss`, `src/core/mutations.ts`)** :
   - Déclaration de l'ordre hiérarchique déterministe `POPULATION_LOSS_CASCADE_ORDER` :
     - Tier I civil / administratif (`peasant`, `artisan`, `clergy`, `notable`, `scribe`, `supervisor`, `archivist`, `collector`)
     - Tier II civil / administratif (`farmer`, `guild`, `prelate`, `baron`, `clerk`, `provincial_steward`, `audit_chamber`, `farmer_general`)
     - Tier I militaire (`soldier`, `sergeant`, `quartermaster`, `scout`)
     - Tier II militaire (`man_at_arms`, `captain`, `grand_marshal`, `spymaster`)
   - Déduction prioritaire de `state.freeSerfs`.
   - En cas d'excédent (`loss > state.freeSerfs`), cascade sur les unités actives selon cet ordre exact, avec prise en compte entière des unités et restitution d'éventuels arrondis fractionnaires aux serfs libres.
   - Réconciliation stricte : `state.totalPopulation = state.freeSerfs + sum(units)`.
   - Incrémentation de `state.starvationLosses` par la perte effective lorsque `isStarvation = true`.

2. **Surpopulation Proportionnelle (§14.3, `src/core/engine.ts`)** :
   - Lorsque `state.totalPopulation > maxPop`, saignée démographique appliquée via `applyPopulationLoss(state, bleed, true)` avec `isStarvation = true`.
   - Calcul de l'excédent initial du tick `initialExcessPop = Math.max(0, state.totalPopulation - maxPop)`.
   - Calcul de l'Unrest proportionnel :
     $$\text{OvercrowdingUnrest/s} = \min\left(1.0, 0.10 \times \frac{\text{initialExcessPop}}{50}\right)$$
     intégré dans `baseUnrestGen` et composé sous `'unrest_generation'`.

3. **Désertion Militaire Cumulative (§6.5, arbitrage 1.0 §2, `src/core/engine.ts`)** :
   - Active dès que `state.unrest >= 75`, sauf si le flag ou la loi `law:sanctuary_rights` est actif **et** `state.unrest < 90`.
   - Éligibilité : `soldier` (seuil 15s) en priorité, sinon `man_at_arms` (seuil 30s) si 0 soldat actif, sinon aucune unité.
   - En l'absence d'unité éligible ou si la désertion est inactive : `state.desertionTimer = 0` (aucune accumulation latente).
   - En cas d'éligibilité : `state.desertionTimer += dt`, puis boucle `while (eligible && state.desertionTimer >= eligible.threshold)` retirant 1 unité et décrémentant `state.totalPopulation -= 1`, avec réévaluation dynamique de l'éligibilité à chaque itération.

4. **Trésor Signé & Correction de `applyEffect` (`src/core/modifiers.ts`)** :
   - `instant_resource: 'ap'` : `state.ap += effect.amount` sans clamp `Math.max(0)` et sans incrémentation erronée de `cumulativeApThisDeadline` ni `totalCumulativeAp`.
   - `grant_units` : consomme `freeSerfs` par défaut dans la limite disponible (`Math.min(count, Math.floor(freeSerfs))`), ou incrémente `totalPopulation` si `effect.external === true`.
   - `instant_resource: 'population'` : déduction négative via `applyPopulationLoss(state, -effect.amount)`, incrémentation positive sur `totalPopulation` et `freeSerfs`.

5. **Sécurisation des Combats (`src/core/battle.ts`)** :
   - Pertes civiles lors d'un effondrement défensif (`resolveDefensiveClash`) et lors d'une levée en masse (`resolveScheduledThreat`) routées via `applyPopulationLoss`.

---

## 2. Vérification & Revue Indépendante

- **Suite de tests unitaires** : 93/93 tests passés (`vitest run`).
- **Simulations bots Monte Carlo** : 5/5 passés (`vitest run src/__tests__/simulation`).
- **Typage & Linters** :
  - `npx vue-tsc --build` : 0 erreur.
  - `npx oxlint .` : 0 warning, 0 erreur.
  - `npx eslint .` : 0 warning, 0 erreur.
- **Revue indépendante (sous-agent read-only)** : Statut **CONFORME** sans réserve sur l'ensemble des 6 critères et actions de la Tâche 1.3, avec prise en compte immédiate des observations préventives sur la levée en masse et l'excédent de surpopulation.
