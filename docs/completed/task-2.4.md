# Tâche 2.4 — Menaces & Factions (`threats.ts`), Édits (`edicts.ts`), Archives (`archives.ts`), Hauts Faits (`feats.ts`) & Dynastic Scoring

- **Statut** : ✅ Complétée & Validée
- **Date** : 2026-10-19
- **Fichiers modifiés & créés** :
  - `src/data/threats.ts` (nouveau : 8 menaces programmées Deadlines 3 à 10 et 6 factions féodales avec traits réactifs)
  - `src/data/edicts.ts` (nouveau : 3 édits d'urgence du Seigneur `forced_tithe`, `church_seizure`, `grand_festival`)
  - `src/data/archives.ts` (nouveau : 8 atouts des Archives Nationales et helper `applyArchivePerks`)
  - `src/data/feats.ts` (nouveau : 8 hauts faits royaux et évaluateur `evaluateFeats`)
  - `src/data/balance.ts` (modifié : ré-export des catalogues de contenu)
  - `src/core/types.ts` (modifié : ajout de `scoutsSacrificed`, `militaryRecruitedCount`, `taxRateViolated15`, `lombardBailoutAccepted` à `GameState`)
  - `src/core/state.ts` (modifié : initialisation de ces compteurs de hauts faits dans `createInitialGameState`)
  - `src/core/commands.ts` (modifié : incrémentation de `militaryRecruitedCount` sur `BUY_UNIT`, passage de `lombardBailoutAccepted = true` sur `ACCEPT_LOMBARD_LOAN`, support du 6ème slot de loi via l'atout `archive:sixth_law_slot`)
  - `src/core/battle.ts` (modifié : incrémentation de `scoutsSacrificed` sur `performScoutReroll`, prise en compte de l'atout `archive:spymaster_network` dans la réduction de marge d'incertitude)
  - `src/core/engine.ts` (modifié : détection du franchissement fiscal `taxRate > 15` pour `taxRateViolated15`)
  - `src/core/formulas.ts` (modifié : ajout de `calculateRunScore` et `getDynasticTitle` conformes à GAME_RULES §13)
  - `src/__tests__/unit/feats_scoring.spec.ts` (nouveau : 17 tests unitaires validant l'exhaustivité des catalogues, les traits de factions, l'application des archives, l'évaluation des hauts faits et les formules de score)

---

## 1. Actions Réalisées

1. **Menaces Programmées & Factions Réactives (`src/data/threats.ts`)** :
   - 8 Menaces séquencées pour les Deadlines 3 à 10 (`Border Raiders`, `Rebellious Marches Baron`, `Nomadic Steppe Horde`, `Renegade Free Companies`, `Holy League Crusade`, `Pretender Duke's Vanguard`, `Grand Inquisitorial Armada`, `Royal Auditor's Iron Host`).
   - 6 Factions (`outlaws`, `barons`, `mercenaries`, `zealots`, `steppe_horsemen`, `imperial_legions`) avec traits réactifs (e.g. bandits infligeant +15% de pertes civiles si < 10 soldats, mercenaires exigeant +25% de tribut, zélotes déclenchant une défection religieuse si Décontentement > 60%).

2. **Édits d'Urgence (`src/data/edicts.ts`)** :
   - Définition complète des 3 édits d'urgence (`forced_tithe`, `church_seizure`, `grand_festival`) avec descriptions des gains et pénalités réactives conformément à GAME_RULES §11.

3. **Méta-progression des Archives Nationales (`src/data/archives.ts`)** :
   - 8 atouts permanents (`starting_treasury`, `ancient_cadastre`, `charter_of_liberties`, `standing_vanguard`, `primogeniture_decrees`, `spymaster_network`, `royal_chronicle`, `sixth_law_slot`).
   - `applyArchivePerks(state, perks)` appliquant immédiatement les modificateurs et les unités tout en préservant strictement l'invariant démographique $\text{TotalPopulation} = \text{FreeSerfs} + \sum \text{Units}$.
   - Prise en compte dans `commands.ts` du 6ème slot de loi lorsque `archive:sixth_law_slot` est actif.

4. **Hauts Faits Royaux (`src/data/feats.ts`)** :
   - 8 hauts faits royaux (`royal_pacifist`, `scout_butcher`, `fiscal_paradise`, `iron_bailout`, `croesus_of_the_realm`, `the_six_seals`, `unyielding_governance`, `imperial_barony`), chacun accordant +0.5 point d'archive.
   - `evaluateFeats(state)` évaluant fidèlement l'état final du run à partir des compteurs déterminés dans `GameState`.

5. **Formules de Score & Titres Dynastiques (`src/core/formulas.ts`)** :
   - `calculateRunScore(state)` implémentant la formule de prestige §13.1 :  
     $\text{Score} = (\text{TotalCumulativeAp} \times 0.01) + (\text{PeakPopulation} \times 2) + (\text{Provinces} \times 500) + (\text{Victories} \times 200) - (\text{Strikes} \times 1000)$.
   - `getDynasticTitle(state, score)` octroyant le titre approprié lors d'une défaite (*Bankrupt Beggar*, *The Fallen Tyrant*, *The Subjugated Vassal*, *The Disgraced Regent*) ou d'une victoire (*The Bloodied Conqueror*, *Father of the Nation*, *Grand Treasurer of the Crown*, *Universal Sovereign*).

---

## 2. Vérification & Tests

- **Tests unitaires (`src/__tests__/unit/feats_scoring.spec.ts`)** : 17 tests couvrant l'intégralité du contenu ajouté.
- **Suite globale** : 20 suites / 211 tests passés avec succès (`npm run test:unit`).
- **Typage & Linter** : 0 erreur, 0 avertissement (`vue-tsc --build`, `oxlint`, `eslint`).
