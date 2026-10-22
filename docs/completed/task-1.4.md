# Tâche 1.4 — Garde-fous des Édits d'Urgence (§11), Démobilisation (DISBAND_UNIT, §14.1) & Fiscalité Dynamique (§14.2)

- **Statut** : ✅ Complétée & Validée
- **Date** : 2026-10-14
- **Fichiers modifiés & créés** :
  - `src/core/types.ts` (modifié : ajout de la commande `{ type: 'DISBAND_UNIT'; unitId: UnitId; count: number }` à la taxonomie `Command`)
  - `src/core/phases.ts` (modifié : ajout de `'DISBAND_UNIT'` aux commandes autorisées en `ACTIVE_CYCLE` et `AWAIT_RESUME`)
  - `src/core/engine.ts` (modifié : export de `calculateGrossApRate(state, config): { total: number; pollTax: number }` partagé avec `tick()`, compte à rebours `forcedTitheFreezeTimer` gelant `canGrow` pendant 20s)
  - `src/core/commands.ts` (modifié : garde-fous d'édits d'urgence dans `handleEnactEdict`, rejet du 2e édit par deadline, pénalités croissantes `mult = 1 + 0.5 * k`, plafonnement de `church_seizure` à 2/run, coût dynamique de `grand_festival` avec rejet pour insolvabilité ; implémentation de `handleDisbandUnit` avec indemnités de licenciement à 50% du coût de base, Unrest sur vétérans impayés, retour aux serfs libres sans perte démographique, et détection de mutinerie > 10% en 10s ; révision de `handleSetTaxRate` avec rejet des taux non finis, baisse immédiate annulant toute promulgation pendante, et choc fiscal si delta > 15%)
  - `src/__tests__/unit/phases.spec.ts` (modifié : ajout de l'échantillon `DISBAND_UNIT` validé exhaustivement sur les 12 phases x 22 commandes)
  - `src/__tests__/unit/engine.spec.ts` (modifié : réécriture du test monolithique d'édits L191–208 en 4 tests distincts par deadline avec test de rejet du 2e édit)
  - `src/__tests__/unit/edicts_disband.spec.ts` (nouveau : 12 tests unitaires couvrant les 3 sous-systèmes de la tâche)

---

## 1. Actions Réalisées

1. **Édits d'Urgence (`handleEnactEdict`, GAME_RULES §11)** :
   - Enforce strictement un seul édit d'urgence par deadline (`state.lastEdictDeadline === state.deadline`).
   - Pénalités croissantes indexées sur l'historique de run : $\text{mult} = 1 + 0.5 \times k$ où $k = \text{state.edictUsageCounts[edictId]}$.
   - `forced_tithe` :
     - Ajoute $30 \times \text{pollTax}$ à `state.ap` sans incrémenter les quotas d'AP (`cumulativeApThisDeadline` et `totalCumulativeAp` restent intacts).
     - Inflige $+35 \times \text{mult}$ Unrest via `addUnrest`.
     - Arme `state.forcedTitheFreezeTimer = 20`, bloquant `canGrow` dans `tick()` tant qu'il reste supérieur à 0.
   - `church_seizure` :
     - Rejet strict si $k \ge 2$ (*"Maximum 2 saisies d'Église par run"*).
     - Ajoute $\max(300, 25 \times \text{Gross AP/s})$ à `state.ap` sans crédit de quota.
     - Modificateur multiplicatif $\times 0.5$ sur `'unrest_pacification'` expirant à $\text{totalElapsedSeconds} + 60 \times \text{mult}$.
     - Inflige $+10 \times \text{mult}$ Unrest via `addUnrest`.
   - `grand_festival` :
     - Coût dynamique $= \max(100, 0.20 \times \max(0, \text{state.ap}), 30 \times \text{Gross AP/s})$.
     - Rejet strict pour insolvabilité si `state.ap < cost` (protège contre l'effacement de dette à trésor négatif).
     - Déduit le coût et pacifie $-20$ Unrest via `addUnrest(state, -20)`.
   - Les compteurs `state.lastEdictDeadline` et `state.edictUsageCounts[edictId]` sont mis à jour uniquement en cas de succès.

2. **Démobilisation (`DISBAND_UNIT`, GAME_RULES §14.1)** :
   - Validations d'entrée : entier positif `count > 0`, unité existante, effectif possédé suffisant.
   - Indemnité par unité $= 0.50 \times \text{baseCost}$.
   - Calcul des effectifs payés et impayés : $\text{paidUnits} = \min(\text{count}, \lfloor \max(0, \text{state.ap}) / \text{severancePerUnit} \rfloor)$, $\text{unpaidUnits} = \text{count} - \text{paidUnits}$.
   - Déduction de $\text{paidUnits} \times \text{severancePerUnit}$ sur le solde positif de `state.ap`.
   - En cas d'insolvabilité, le licenciement est autorisé sans bloquer, mais chaque unité non payée inflige $+2$ Unrest immédiat.
   - Transfert 1 pour 1 : `state.units[unitId] -= count` et `state.freeSerfs += count`, garantissant l'invariant $\text{TotalPopulation} = \text{FreeSerfs} + \sum \text{Units}$.
   - Mutinerie militaire : si `def.order === 'military'`, enregistrement de `{ timeSeconds, count }` dans `state.disbandedMilitaryHistory` (purge des entrées $> 10\text{s}$). Si le total démobilisé sur 10s dépasse $10\%$ de l'effectif militaire actif avant licenciement, $+15$ Unrest (mutinerie) et réinitialisation de l'historique.

3. **Fiscalité Dynamique (`handleSetTaxRate`, GAME_RULES §14.2)** :
   - Rejet immédiat si `!Number.isFinite(command.rate)`.
   - Baisse ou maintien d'impôt ($\text{targetRate} \le \text{currentRate}$) : application immédiate ($\text{taxRate} = \text{targetRate}$, $\text{pendingTaxRate} = \text{null}$, $\text{taxPromulgationTimer} = 0$).
   - Hausse d'impôt ($\text{targetRate} > \text{currentRate}$) : choc fiscal immédiat de $+20$ Unrest si l'augmentation dépasse 15 points de pourcentage, armement du délai de promulgation de 8s ($\text{pendingTaxRate} = \text{targetRate}$, $\text{taxPromulgationTimer} = 8$).

4. **Réécriture des Tests Existants** :
   - `src/__tests__/unit/engine.spec.ts` L191–208 : réécrit en 4 tests distincts couvrant chaque édit sur une deadline dédiée et constatant le rejet strict du second édit au sein d'une même deadline.

---

## 2. Vérification & Revue Indépendante

- **Suite de tests unitaires** : 124/124 tests passés (`vitest run`).
- **Simulations bots Monte Carlo** : 5/5 passés (`vitest run src/__tests__/simulation`).
- **Typage & Linters** :
  - `npx vue-tsc --build` : 0 erreur.
  - `npx oxlint .` : 0 warning, 0 erreur.
  - `npx eslint .` : 0 warning, 0 erreur.
- **Revue Indépendante** : Sous-agent `research` (Task 1.4 Reviewer) — avis **CONFORME** sur toutes les spécifications et invariants.
