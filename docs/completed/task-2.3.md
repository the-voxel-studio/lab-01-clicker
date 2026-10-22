# Tâche 2.3 — Catalogues des 30 Lois Impériales (`src/data/laws.ts`) & 20 Dilemmes du Sénéchal (`src/data/dilemmas.ts`)

- **Statut** : ✅ Complétée & Validée
- **Date** : 2026-10-19
- **Fichiers modifiés & créés** :
  - `src/data/laws.ts` (nouveau : 30 lois impériales réparties entre Chancelier, Prélat et Maréchal)
  - `src/data/dilemmas.ts` (nouveau : 20 dilemmes du Sénéchal avec prédicats dynamiques et choix binaires)
  - `src/core/types.ts` (modifié : ajout du champ `lastAuditOutcome` à `GameState`)
  - `src/core/state.ts` (modifié : initialisation de `lastAuditOutcome: null`)
  - `src/core/engine.ts` (modifié : stockage de `state.lastAuditOutcome = outcome` lors de l'audit)
  - `src/core/modifiers.ts` (modifié : ajout de `canAffordEffects` et gestion des déductions d'unités négatives dans `applyEffect`)
  - `src/core/commands.ts` (modifié : tirage déterministe via le flux `council` pour les dilemmes et le draft de 3 lois, validation et solvabilité stricte dans `RESOLVE_DILEMMA` et `ENACT_LAW`, contrôle du plafond de lois actives)
  - `src/__tests__/unit/laws_dilemmas.spec.ts` (nouveau : 10 tests unitaires validant l'exhaustivité des catalogues, le tirage déterministe, la solvabilité et les plafonds de lois)

---

## 1. Actions Réalisées

1. **Catalogue des 30 Lois Impériales (`src/data/laws.ts`)** :
   - 10 Lois Chancelier (Administration & Fiscal) : `royal_scriptorium`, `general_cadastre`, `exceptional_tithe`, `single_window_bureaucracy`, `stamp_duty_monopoly`, `crown_monopolies`, `chancery_red_tape`, `corvee_exemption_tax`, `auditors_inquisition`, `imperial_bond_floating`.
   - 10 Lois Prélat (Le Peuple & Église) : `census_edict`, `holy_days_vigils`, `primogeniture_decrees`, `grand_kermesse`, `sanctuary_rights`, `monastic_granaries`, `tithe_commutation`, `sumptuary_edicts`, `parish_relief_registers`, `papal_concordat`.
   - 10 Lois Maréchal (Militaire & Guerre) : `standing_garrisons`, `merit_pay`, `sanctioned_plunder`, `officer_academies`, `feudal_retinue_levy`, `scorched_earth`, `vanguard_drills`, `guerrilla_border_watch`, `mercenary_capitulation`, `marshals_carte_blanche`.
   - Définitions sous forme de structures de données pures (`Modifier[]`, `Effect[]`), sans fonction sérialisée.

2. **Catalogue des 20 Dilemmes du Sénéchal (`src/data/dilemmas.ts`)** :
   - 20 dilemmes réactifs avec prédicats de déclenchement dynamiques (`trigger(state, config)`) et choix binaires (Effets A et B).
   - Utilisation de `lastAuditOutcome.grossApRate / quota.apRate` pour les prédicats relatifs aux quotas (dilemmes 2 et 5).

3. **Garde-fous de Solvabilité & Moteur de Décision** :
   - `canAffordEffects(state, effects)` vérifie la solvabilité des coûts en AP négatifs (`state.ap >= cost`), en population et en effectifs d'unités.
   - `RESOLVE_DILEMMA` et `ENACT_LAW` rejettent immédiatement les choix non solvables sans faire progresser la phase.
   - En entrant en `COUNCIL_DILEMMA`, sélection déterministe via `withStatePrng(state, 'council', …)`.
   - En entrant en `COUNCIL_LAWS`, génération d'un draft de 3 lois (1 par ordre, non actives) via `withStatePrng(state, 'council', …)`.
   - Enactment contrôlé par le plafond de 5 lois actives (ou 4 si le Concordat Papal est actif).

---

## 2. Vérification & Tests

- **Tests unitaires (`src/__tests__/unit/laws_dilemmas.spec.ts`)** : 10 tests couvrant les 30 lois, 20 dilemmes, la solvabilité et le respect des phases.
- **Suite globale** : 19 suites / 194 tests passés avec succès (`npm run test:unit`).
- **Simulations** : 5/5 conformes (`npm run test:sim`).
- **Typage & Linter** : 0 erreur, 0 avertissement (`vue-tsc`, `oxlint`, `eslint`).
