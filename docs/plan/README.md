# Plan de Remédiation Technique & Assurance Qualité (`docs/plan/`)

> **Document de Pilotage Opérationnel des Correctifs & Finalisation du Core V1**  
> Ce document fait suite à l'audit croisé exhaustif entre la documentation (`docs/GAME_RULES.md`, `docs/GUIDE.md`, `docs/PLAN.md`, `docs/making/README.md`) et le code source réel (`src/core/`, `src/data/`, `src/__tests__/`, `scripts/`).  
> Il répertorie **l'intégralité des bugs, failles d'exploit, ruptures d'invariants et omissions** identifiés, et définit dans l'ordre exact des dépendances toutes les tâches à exécuter lors du prochain run avant le gel définitif du Core V1.

---

## 1. Synthèse du Diagnostic Croisé (Documentation vs Code Réel)

Bien que le projet compile sans erreur (`vue-tsc`), passe le linter (`oxlint` / `eslint`) et valide les 56 tests unitaires initiaux, l'audit approfondi et les tests empiriques ont mis en évidence **12 anomalies majeures** qui empêchent de considérer la Phase V1 comme terminée :

1. **Taux de victoire du Greedy Bot biaisé par la parité de la seed (`botRunner.ts` L313)** :  
   L'instruction `const maxBarons = state.seed % 2 === 0 ? 5 : 4` force 100% de victoire sur les graines paires (capacité de logement 2 242 $\ge$ 2 200 à D10) et 0% sur les graines impaires (2 152 $<$ 2 200). Le taux de victoire de 50% est donc fabriqué par la proportion de graines paires et non par un calcul de ROI ou par un solveur de quotas.
2. **Exploits critiques sur les Édits d'Urgence (`commands.ts` L286–335)** :  
   Aucun plafond par deadline, aucune limite d'usage par run, aucun coût plancher sur `grand_festival` (gratuit à 0 AP), et les AP saisis (`forced_tithe`, `church_seizure`) sont crédités au quota AP de la deadline. De plus, `church_seizure` ajoute `+0.05` à `'unrest_growth'` (jamais lu par `engine.ts`) au lieu de diviser par 2 la pacification ecclésiastique.
3. **Boucle infinie du Replay dès la première fin de deadline (`replay.ts` L78–95)** :  
   Hors `ACTIVE_CYCLE` (`AUDIT_ASSESSMENT`, `LOMBARD_OFFER`, etc.), `tick()` ne fait plus progresser `totalElapsedSeconds`. Toute exécution de `executeReplay` dépassant $100\text{s}$ boucle à l'infini sans jamais dépiler les commandes inter-deadlines. En outre, `getStateHash()` ignore les unités, les serfs libres, le taux de taxe, les lois et l'état du PRNG.
4. **Absence d'`état PRNG` dans `GameState` & Reroll d'éclaireur inopérant (`prng.ts`, `commands.ts`, `battle.ts`)** :  
   `GameState` ne stocke pas `prngState`. Les systèmes instancient à la volée `new PRNG(state.seed + state.tickIndex + ...)`. Comme `tickIndex` est figé entre deux deadlines, `RECON_PATROL` tue un éclaireur sans jamais modifier le tirage ni régénérer de cible (`currentTarget` n'existe pas). De plus, `this.state += 0x6d2b79f5` dans `prng.ts` n'est pas tronqué sur 32 bits (`>>> 0`).
5. **Tribut impayable contournant gratuitement la menace (`commands.ts` L522–529)** :  
   Lorsque le joueur choisit `'tribute'` sans posséder les AP requis, `resolveScheduledThreat` retourne `success: false`, mais `commands.ts` avance quand même `state.phase` vers `EXPEDITION`, annulant la menace gratuitement.
6. **Absence de validation des entrées (`commands.ts`, `formulas.ts`)** :  
   - `TICK` accepte un `dt` négatif ou `NaN` (faisant reculer le temps et rendant l'AP négative).
   - `SET_TAX_RATE` accepte `NaN`, ce qui corrompt définitivement `taxRate` et `ap` en `NaN`.
   - `calculateMaxAffordableUnits` renvoie des nombres flottants (ex. `37.6`) lorsque `freeSerfs` est fractionnaire.
   - `BUY_UNIT` accepte des quantités décimales (`count: 2.5`) et n'applique ni la restriction `allowsBulk100` ni les paliers de déblocage $10\times$ (D3), $50\times$ (D6), $100\times$ (D8).
7. **Violation de l'Équation Démographique §3.1 (`TotalPopulation = FreeSerfs + sum(Units)`)** :  
   Rompue lors de la saignée de surpopulation lorsque `freeSerfs` atteint 0 (`engine.ts` L214–215), lors des pertes civiles d'un effondrement défensif (`battle.ts` L355–356), lors de la levée en masse (`battle.ts` L438–439) et lors de `grant_units` (`modifiers.ts` L290–292).
8. **Composition de l'Agitation (`Unrest`), Purge `expiresAt` & Désertion Militaire manquantes (`engine.ts`)** :  
   Composer un delta net signé inverse l'effet des multiplicateurs lorsque la pacification domine ; il faut séparer `'unrest_generation'` et `'unrest_pacification'`. Les modificateurs expirés (`expiresAt`) ne sont jamais purgés, `TickStatCache` n'est jamais utilisé, la formule d'Unrest de surpopulation utilise un taux plat au lieu de $+0.10/\text{s}$ par tranche de 50 habitants en excès (§14.3), et la désertion militaire à 75–89% d'Unrest (§6.5) est absente.
9. **Échec à Deadline 10 avec 0 strike, Censure sur AP négative & Délai de baisse de taxe (`engine.ts`, `commands.ts`)** :  
   Échouer à la Deadline 10 avec 0 strike accorde un pardon royal et permet de passer en Deadline 11 au lieu de déclencher la défaite. La censure (`state.ap *= 0.5`) réduit une dette si `state.ap < 0`. Baisser les impôts subit le délai de 8s alors que §14.2 le réserve aux hausses. La commande `DISBAND_UNIT` (§14.1) est absente.
10. **Calculs militaires fragmentés, Pertes limitées au Tier I & Effets secondaires d'unités omis** :  
    Trois calculs distincts de puissance militaire coexistent (`engine.ts`, `commands.ts`, `battle.ts`). Les `man_at_arms` ne subissent aucune perte en attaque ou en défense victorieuse, et les officiers/éclaireurs survivent à un effondrement défensif. Les effets secondaires de `GAME_RULES.md §4` (`prelate`, `audit_chamber`, `captain`, `sergeant`, `guild`, `man_at_arms`, `scout`, `spymaster`) ne sont pas codés.
11. **Contenu Gate D absent & Biomes non raccordés** :  
    Les catalogues des 30 lois (`laws.ts`), 20 dilemmes (`dilemmas.ts`), menaces/factions (`threats.ts`), biomes (`provinceBiomes`), archives (`archives.ts`), hauts faits (`feats.ts`) et le calcul du score (§13) restent à implémenter.
12. **Tests de simulation cosmétiques & Ordre des phases inversé** :  
    Calibrer les quotas *avant* d'intégrer le contenu Gate D et les effets secondaires d'unités invaliderait l'équilibrage. La **Phase 2 (Contenu Gate D & Biomes)** doit donc précéder la **Phase 3 (Simulations, Solveur Dichotomique & Tests de Sensibilité/Dominance)**.

---

## 2. Architecture d'Exécution Priorisée (Dépendances Corrigées)

```mermaid
flowchart TD
    subgraph Phase 1 : Intégrité du Moteur Core & Règles Système
        T1_1["TÂCHE 1.1 : Contrats types.ts, Fin Import Circulaire & prngState"]
        T1_2["TÂCHE 1.2 : Dual Unrest (Gen/Pac), Purge expiresAt & TickStatCache"]
        T1_3["TÂCHE 1.3 : Invariant Population §3.1, Surpopulation §14.3 & Désertion §6.5"]
        T1_4["TÂCHE 1.4 : Garde-fous Édits §11, DISBAND_UNIT §14.1 & Taxe §14.2"]
        T1_5["TÂCHE 1.5 : Validation Entrées, Clic Unifié, Paliers Vrac §5.1 & Plafonds"]
        T1_6["TÂCHE 1.6 : Unification Combat, currentTarget, Tribut §8.2, Raids §8.3 & D10"]
        T1_7["TÂCHE 1.7 : Replay Multi-Deadlines sans Boucle Infinie & Migration v1->v2"]
    end

    subgraph Phase 2 : Effets Secondaires, Biomes & Contenu Gate D
        T2_1["TÂCHE 2.1 : Effets Secondaires des 24 Unités (GAME_RULES §4)"]
        T2_2["TÂCHE 2.2 : Biomes de Provinces (provinceBiomes & Bonus Système)"]
        T2_3["TÂCHE 2.3 : Catalogues des 30 Lois (laws.ts) & 20 Dilemmes (dilemmas.ts)"]
        T2_4["TÂCHE 2.4 : Factions Réactives, Archives, Hauts Faits & Score (§13)"]
    end

    subgraph Phase 3 : Simulations Réelles, Solveur & Gel Gate E
        T3_1["TÂCHE 3.1 : Suppression seed % 2 & Vrais Bots ROI / Archétypes (100+ seeds)"]
        T3_2["TÂCHE 3.2 : Solveur Dichotomique de c (200 seeds) & Monotonicité Quotas"]
        T3_3["TÂCHE 3.3 : Vrai Test de Sensibilité ±10% (balanceOverrides)"]
        T3_4["TÂCHE 3.4 : Vrai Test de Dominance Post-D3 (t > 300s) par Archétype"]
        T3_5["TÂCHE 3.5 : Invariance Step-Size sur 20 Replays Complets & CLI REPL"]
    end

    T1_1 --> T1_2 --> T1_3 --> T1_4 --> T1_5 --> T1_6 --> T1_7
    T1_7 --> T2_1 --> T2_2 --> T2_3 --> T2_4
    T2_4 --> T3_1 --> T3_2 --> T3_3 --> T3_4 --> T3_5
```

---

## 3. Spécification Détaillée des Tâches de Remédiation

### Phase 1 : Intégrité du Moteur Core & Règles Système (`src/core/` & `src/data/balance.ts`)

#### Tâche 1.1 : Assainissement Architectural (`balance.ts` $\leftrightarrow$ `types.ts`) & `prngState` Persistant
- **Fichiers impactés** : `src/core/prng.ts`, `src/core/types.ts`, `src/core/state.ts`, `src/data/balance.ts`
- **Actions techniques à réaliser** :
  1. **Rupture du cycle d'import** : Déplacer les définitions de types moteurs (`StatKey`, `ModifierOp`, `ResolverKey`, `Modifier`, `Effect`, `Command`, `RunPhase`, `ALLOWED_COMMANDS_BY_PHASE`, `isCommandAllowedInPhase`) vers `src/core/types.ts` et `src/core/phases.ts` (avec réexport depuis `balance.ts` si nécessaire pour la rétrocompatibilité des tests), et supprimer le réexport circulaire de `core/formulas` et `core/modifiers` depuis `src/data/balance.ts`.
  2. **Troncature 32-bit dans `prng.ts`** : Dans `PRNG.next()`, remplacer `let t = (this.state += 0x6d2b79f5)` par :
     ```typescript
     this.state = (this.state + 0x6d2b79f5) >>> 0
     let t = this.state
     ```
     Ajouter une fonction utilitaire `withStatePrng<T>(state: GameState, fn: (prng: PRNG) => T): T` qui instancie `new PRNG(state.prngState)`, exécute `fn(prng)`, puis sauvegarde `state.prngState = prng.getState()`.
  3. **Enrichissement de `GameState` (`types.ts` & `state.ts`)** :
     Ajouter dans `GameState` et initialiser de façon 100% déterministe dans `createInitialGameState` (remplacer `Date.now()` et `Math.random()` pour `runId` par `` `run_${seed}` ``) :
     - `prngState: number` (initialisé à `(seed >>> 0)`)
     - `interimWarningOnTrack: boolean | null` (initialisé à `null`)
     - `desertionTimer: number` (initialisé à `0`)
     - `forcedTitheFreezeTimer: number` (initialisé à `0`)
     - `lastEdictDeadline: number` (initialisé à `0`)
     - `edictUsageCounts: Record<'forced_tithe' | 'church_seizure' | 'grand_festival', number>` (initialisé à `{ forced_tithe: 0, church_seizure: 0, grand_festival: 0 }`)
     - `disbandedMilitaryHistory: Array<{ timeSeconds: number; count: number }>` (initialisé à `[]`)
     - `provinceBiomes: BiomeId[]` (initialisé à `['farmlands', 'farmlands', 'wilderness']` ou 3 provinces initiales équilibrées)
     - `currentTarget: CampaignTarget | null` (initialisé à `null`)
     - `campaignsLaunchedThisDeadline: number` (initialisé à `0`)
     - `lastSurpriseRaidTime: number` (initialisé à `-60`)
     - `surpriseRaidTriggeredThisDeadline: boolean` (initialisé à `false`)
     - `currentLawDraft: string[]` (initialisé à `[]`)
     - `currentDilemmaId: string | null` (initialisé à `null`)
     - `victoriesCount: number` (initialisé à `0`)
     - `peakPopulation: number` (initialisé à `BALANCE.STARTING_POPULATION`)
     - `starvationLosses: number` (initialisé à `0`)
     Mettre à jour `cloneGameState` et `handleRestartRun` pour copier/réinitialiser l'intégralité de ces champs.
- **Critère d'acceptation** : Aucune dépendance circulaire entre `src/data/` et `src/core/`, aucun appel à `Math.random()` ou `Date.now()` dans `state.ts`, et `state.prngState` évolue de manière déterministe à chaque tirage.

---

#### Tâche 1.2 : Composition Duale de l'Agitation (`unrest_generation` / `unrest_pacification`), Purge `expiresAt` & `TickStatCache`
- **Fichiers impactés** : `src/core/types.ts`, `src/core/modifiers.ts`, `src/core/engine.ts`
- **Actions techniques à réaliser** :
  1. Dans `StatKey`, remplacer `'unrest_growth'` par `'unrest_generation' | 'unrest_pacification'`.
  2. Dans `modifiers.ts`, supprimer la surcharge à 3 arguments sans `statKey` de `composeStat` afin d'exiger systématiquement `composeStat(statKey: StatKey, baseValue: number, modifiers: readonly Modifier[], rawState?: RawEvaluationState): number`.
  3. Au tout début de `tick()` dans `engine.ts`, purger les modificateurs expirés en vérifiant `mod.expiresAt !== undefined` :
     ```typescript
     state.activeModifiers = state.activeModifiers.filter(
       (mod) => mod.expiresAt === undefined || mod.expiresAt > state.totalElapsedSeconds
     )
     ```
  4. Raccorder une instance de `TickStatCache` pour mémoriser les évaluations de statistiques au sein d'un même `tickIndex`.
  5. Dans `tick()` (`engine.ts`), calculer séparément la génération et la pacification d'Unrest (`GAME_RULES.md §6.5`) :
     - `baseUnrestGen` = tax unrest (réduit de 20% par `prelate`, plafonné à -80%) + overcrowding unrest (§14.3).
     - `composedGen = Math.max(0, composeStat('unrest_generation', baseUnrestGen, state.activeModifiers, rawState))`
     - `baseUnrestPac` = `(state.units.clergy ?? 0) * 0.02 + (state.units.prelate ?? 0) * 0.15`
     - `composedPac = Math.max(0, composeStat('unrest_pacification', baseUnrestPac, state.activeModifiers, rawState))`
     - `const netUnrestDeltaPerSec = composedGen - composedPac`
     - `state.unrest = Math.max(0, Math.min(100, state.unrest + netUnrestDeltaPerSec * dt))`
- **Critère d'acceptation** : Un modificateur multiplicatif sur `'unrest_pacification'` (ex. `church_seizure` `mul: 0.5`) réduit uniquement la pacification sans jamais inverser le signe de la génération fiscale, et s'éteint exactement à `expiresAt`.

---

#### Tâche 1.3 : Invariant Démographique (§3.1), Surpopulation (§14.3) & Désertion Militaire (§6.5)
- **Fichiers impactés** : `src/core/formulas.ts`, `src/core/engine.ts`, `src/core/modifiers.ts`, `src/core/battle.ts`
- **Actions techniques à réaliser** :
  1. **Helper d'invariant démographique** : Créer `applyPopulationLoss(state: GameState, loss: number, isStarvation = false): number` qui déduit `loss` de `state.totalPopulation` et en priorité de `state.freeSerfs`. Si `loss > state.freeSerfs` (ex. plus aucun serf libre lors d'une famine ou d'un massacre), l'excédent entier est retiré des unités civiles/administratives puis militaires de sorte que $\text{TotalPopulation} = \text{FreeSerfs} + \sum \text{Units}$ reste toujours vérifié.
  2. **Surpopulation (`GAME_RULES.md §14.3`)** :
     - Lorsque `state.totalPopulation > maxPop`, appliquer `applyPopulationLoss(state, bleed, true)` (incrémentant `state.starvationLosses`).
     - Calculer l'Unrest de surpopulation proportionnel :
       $$\text{OvercrowdingUnrest/s} = \min\left(1.0, 0.10 \times \frac{\text{TotalPopulation} - \text{MaxPopulation}}{50}\right)$$
       et l'ajouter à `baseUnrestGen`.
  3. **Désertion Militaire (`GAME_RULES.md §6.5` — palier `strife_desertion` 75–89%)** :
     - Lorsque `crisisStage === 'strife_desertion'` (et que le flag de loi `'law:sanctuary_rights'` n'est pas actif), incrémenter `state.desertionTimer += dt`.
     - Si `(state.units.soldier ?? 0) > 0` et `state.desertionTimer >= 15` : tant que `state.desertionTimer >= 15` et `state.units.soldier > 0`, décrémenter `state.desertionTimer -= 15`, `state.units.soldier -= 1`, `state.totalPopulation = Math.max(0, state.totalPopulation - 1)`.
     - Sinon, si `(state.units.soldier ?? 0) === 0`, `(state.units.man_at_arms ?? 0) > 0` et `state.desertionTimer >= 30` : décrémenter `state.desertionTimer -= 30`, `state.units.man_at_arms -= 1`, `state.totalPopulation = Math.max(0, state.totalPopulation - 1)`.
     - Si `crisisStage !== 'strife_desertion'`, réinitialiser `state.desertionTimer = 0`.
  4. **Correction de `applyEffect` (`modifiers.ts`)** :
     - Pour `grant_units` : si le recrutement consomme des serfs (ou ajoute des citoyens), mettre à jour `freeSerfs` / `totalPopulation` pour maintenir l'équation §3.1.
     - Pour `instant_resource: 'population'` négatif : passer par `applyPopulationLoss(state, -effect.amount)`.
- **Critère d'acceptation** : Un test unitaire vérifie l'invariant `Math.abs(state.totalPopulation - (state.freeSerfs + sumUnits(state))) < 1e-6` après chaque tick de surpopulation, désertion (soldats à 15s, hommes d'armes à 30s), bataille et effet.

---

#### Tâche 1.4 : Garde-fous des Édits d'Urgence (§11), Démobilisation (`DISBAND_UNIT`, §14.1) & Fiscalité (§14.2)
- **Fichiers impactés** : `src/core/commands.ts`, `src/core/engine.ts`, `src/core/types.ts`
- **Actions techniques à réaliser** :
  1. **Édits d'Urgence (`handleEnactEdict`, `GAME_RULES.md §11`)** :
     - Refuser si `state.lastEdictDeadline === state.deadline` (*"Un seul édit d'urgence est autorisé par deadline"*).
     - Soit $k = \text{state.edictUsageCounts[edictId]}$ et $\text{mult} = 1 + 0.5 \times k$.
     - **`forced_tithe`** :
       - Ajoute $30 \times \text{pollTaxPerSec}$ à `state.ap` **sans** toucher à `cumulativeApThisDeadline` ni `totalCumulativeAp`.
       - Ajoute $35 \times \text{mult}$ à `state.unrest` et fixe `state.forcedTitheFreezeTimer = 20` (bloquant `canGrow` dans `tick()` tant que `forcedTitheFreezeTimer > 0`).
     - **`church_seizure`** :
       - Refuser si `state.edictUsageCounts.church_seizure >= 2` (*"Maximum 2 saisies d'Église par run"*).
       - Ajoute $\max(300, 25 \times \text{calculateGrossApRate(state)})$ à `state.ap` (**sans** toucher aux compteurs de quota AP).
       - Ajoute un modificateur `{ source: 'edict:church_seizure', stat: 'unrest_pacification', op: 'mul', value: 0.5, appliedAt: state.totalElapsedSeconds, expiresAt: state.totalElapsedSeconds + 60 * mult }` et inflige $+10 \times \text{mult}$ Unrest immédiat.
     - **`grand_festival`** :
       - Coût $= \max(100, 0.20 \times \text{state.ap}, 30 \times \text{calculateGrossApRate(state)})$.
       - Refuser si `state.ap < cost`. Déduire `cost` de `state.ap` et réduire `state.unrest` de $20$.
     - Mettre à jour `state.lastEdictDeadline = state.deadline` et `state.edictUsageCounts[edictId] += 1`.
  2. **Démobilisation (`DISBAND_UNIT`, `GAME_RULES.md §14.1`)** :
     - Ajouter `{ type: 'DISBAND_UNIT'; unitId: UnitId; count: number }` dans `Command` et l'autoriser dans `ACTIVE_CYCLE` et `AWAIT_RESUME`.
     - Vérifier que `Number.isInteger(count) && count > 0` et `(state.units[unitId] ?? 0) >= count`.
     - Calculer l'indemnité par unité : $\text{severancePerUnit} = 0.50 \times \text{def.baseCost}$.
     - Nombre d'unités couvertes par le trésor positif : $\text{paidUnits} = \min\big(\text{count}, \lfloor \max(0, \text{state.ap}) / \text{severancePerUnit} \rfloor\big)$, $\text{unpaidUnits} = \text{count} - \text{paidUnits}$.
     - Déduire $\min(\max(0, \text{state.ap}), \text{count} \times \text{severancePerUnit})$ de `state.ap` ; infliger $+2 \times \text{unpaidUnits}$ d'Unrest immédiat si $\text{unpaidUnits} > 0$.
     - Décrémenter `state.units[unitId] -= count` et incrémenter `state.freeSerfs += count`.
     - Si `def.order === 'military'`, enregistrer `{ timeSeconds: state.totalElapsedSeconds, count }` dans `state.disbandedMilitaryHistory` (en purgeant les entrées $> 10\text{s}$). Si le total démobilisé sur 10s dépasse $10\%$ de l'effectif militaire actif avant licenciement, infliger $+15$ Unrest immédiat (mutinerie) et vider l'historique pour éviter le double déclenchement.
  3. **Fiscalité (`handleSetTaxRate`, `GAME_RULES.md §14.2`)** :
     - Rejeter si `!Number.isFinite(command.rate)`.
     - Si `targetRate <= state.taxRate` (baisse ou maintien) : appliquer **immédiatement** `state.taxRate = targetRate`, `state.pendingTaxRate = null`, `state.taxPromulgationTimer = 0`.
     - Si `targetRate > state.taxRate` (hausse) : appliquer le choc fiscal (+20 Unrest si `targetRate - state.taxRate > 15`) et programmer `state.pendingTaxRate = targetRate`, `state.taxPromulgationTimer = 8`.
- **Critère d'acceptation** : Impossible de spammer les édits dans un même deadline, impossible de gonfler le quota AP via les édits, baisse de taxe immédiate, et tests unitaires complets de `DISBAND_UNIT` (avec et sans AP, et mutinerie $> 10\%$).

---

#### Tâche 1.5 : Validation Stricte des Entrées, Harmonisation du Clic, Paliers Vrac (§5.1) & Plafonds d'Ordres
- **Fichiers impactés** : `src/core/formulas.ts`, `src/core/engine.ts`, `src/core/commands.ts`
- **Actions techniques à réaliser** :
  1. **Helpers partagés dans `engine.ts`** :
     - Exporter `calculateMaxPopulation(state: GameState): number` (intégrant les bonus de biomes `Farmlands` $\times 1.5$ / `Wilderness` $\times 0.8$, Notables, Barons et `composeStat('housing_capacity', ...)`).
     - Exporter `calculateNetPaperwork(state: GameState): number` (intégrant la réduction de biome `Wilderness` $-5\%$, Archivistes, Chambres des comptes et `composeStat('paperwork_friction', ...)`).
     - Exporter `calculateGrossApRate(state: GameState): number` (intégrant Scribes, Clercs, Superviseurs, Intendants, Collecteurs, Fermiers généraux, capitation, Artisans, Guildes, biomes `Trade Hub` $+15\%$, boycott fiscal et `composeStat('gross_ap_rate', ...)`).
  2. **Harmonisation de `STAMP_DOCUMENT` & `BUY_UNIT` (`commands.ts`)** :
     - Dans `handleStampDocument`, utiliser `calculateGrossApRate(state)` et `calculateNetPaperwork(state)`, et déterminer le coup critique via `withStatePrng(state, (prng) => prng.next() < critChance)` (supprimer la surcharge `command.isCritical` ou la restreindre).
     - Dans `handleBuyUnit`, utiliser `calculateMaxPopulation(state)` pour calculer `orderCaps` afin que les modificateurs de logement soient pris en compte.
  3. **Validation des entrées & Paliers d'achat en vrac (`GAME_RULES.md §5.1`)** :
     - Dans `calculateMaxAffordableUnits` (`formulas.ts`), retourner `Math.min(affordableByAp, Math.floor(freeSerfs), Math.floor(orderHeadroom))` pour garantir un entier.
     - Dans `handleBuyUnit` :
       - Rejeter si `!Number.isInteger(count) || count <= 0`.
       - Si `count === 10` et `state.deadline < 3 && state.totalPopulation < 250`, rejeter.
       - Si `count === 50` et `state.deadline < 6 && state.totalPopulation < 1000`, rejeter.
       - Si `count === 100` : rejeter si `!def.allowsBulk100` ou si `state.deadline < 8`.
     - Dans `dispatch` (`TICK`) : rejeter si `!Number.isFinite(command.dt) || command.dt <= 0`.
     - Dans `dispatch` (`default`) : retourner `{ success: false, error: 'Unsupported command' }`.
- **Critère d'acceptation** : Rejet strict de `dt <= 0`, `rate: NaN`, `count: 2.5`, et `count: 100` sur toute unité autre que `peasant` / `scribe` ou avant D8 ; Buy Max retourne toujours un entier.

---

#### Tâche 1.6 : Unification Militaire, Cible d'Expédition (`currentTarget`), Tribut Bloquant (§8.2), Raids Surprises (§8.3) & Deadline 10 (§1.2–§1.3)
- **Fichiers impactés** : `src/core/engine.ts`, `src/core/commands.ts`, `src/core/battle.ts`
- **Actions techniques à réaliser** :
  1. **Unification militaire & ventilation des pertes (`battle.ts`, `commands.ts`)** :
     - Remplacer les formules militaires inlinées dans `commands.ts` (`LAUNCH_ATTACK`, `RESOLVE_RAID_DEFENSE`) et `battle.ts` (`resolveScheduledThreat`) par `calculateMilitaryPower(state)`.
     - Dans `resolveOffensiveCampaign` et la branche victorieuse de `resolveDefensiveClash`, ventiler les pertes proportionnellement entre `soldier` et `man_at_arms` (en appliquant la réduction de pertes de $-5\%$ par `captain`, plafonnée à $-50\%$).
     - Lors d'un `Defensive Collapse` (`resolveDefensiveClash`), tuer 100% de toutes les unités de l'ordre `'military'` (en les déduisant de `totalPopulation`) et appliquer les pertes civiles (15–25%) via `applyPopulationLoss(state, lostCivilians)` et le pillage d'AP sur `Math.max(0, state.ap)`.
  2. **Cible d'expédition (`currentTarget`), Brouillard de Guerre & `RECON_PATROL` (`GAME_RULES.md §7.1 & §7.3`)** :
     - Générer un `currentTarget` déterministe via `withStatePrng` à l'entrée en phase `EXPEDITION` : puissance réelle ennemie, marge d'incertitude $M = \max(0.05, 0.45 - 0.12 \times \text{scouts} - 0.30 \times \text{spymasters})$, biome (`farmlands` | `trade_hub` | `stronghold` | `wilderness`), type de butin, `isFalseLedger` (15% de chance $\to$ butin réduit de 60–80%), `isAmbush` (10% de chance $\to$ force ennemie $+25\%$), révélés si `(state.units.spymaster ?? 0) >= 1`.
     - `RECON_PATROL` sacrifie 1 `scout` (`totalPopulation -= 1`) et génère un nouveau `currentTarget` via `withStatePrng`.
     - Autoriser jusqu'à **2 campagnes** par phase `EXPEDITION` (`state.campaignsLaunchedThisDeadline < 2`) : `LAUNCH_ATTACK` incrémente `campaignsLaunchedThisDeadline`, génère une nouvelle cible s'il reste 1 campagne possible, et ne passe automatiquement à `AWAIT_RESUME` qu'après la 2ᵉ campagne (ou via `SKIP_EXPEDITION`).
  3. **Tribut bloquant (`SELECT_THREAT_RESPONSE`, `GAME_RULES.md §8.2`)** :
     - Dans `commands.ts`, si `res.success === false` (ex. `'tribute'` choisi avec `state.ap < tributeAp`), **ne pas** appeler `getNextInterDeadlinePhase` et retourner `{ success: false, error: res.message }` en restant en phase `THREAT_HERALD`.
  4. **Raids Surprises (`SURPRISE_RAID`, `GAME_RULES.md §8.3`)** :
     - Dans `tick()` (`engine.ts`), si `state.deadline >= 3`, `!state.surpriseRaidTriggeredThisDeadline`, `state.totalElapsedSeconds - state.lastSurpriseRaidTime >= 60`, et qu'une tranche de 10s de `deadlineTimeSeconds` est franchie :
       - Calculer $p = 0.02 \times (\text{state.ap} > 2000 ? 2 : 1) + (\text{milPower} < 0.5 \times \text{quota.military} ? 0.02 : 0) + (\text{state.unrest} > 60 ? 0.02 : 0)$.
       - Tirer avec `withStatePrng` : si déclenché, fixer `state.phase = 'SURPRISE_RAID'`, `state.surpriseRaidTriggeredThisDeadline = true`, `state.lastSurpriseRaidTime = state.totalElapsedSeconds`.
       - Lors de `RESOLVE_RAID_DEFENSE`, utiliser `raidPower = Math.round(0.50 * quota.military)` et compter les provinces `'stronghold'` dans `strongholdCount`.
  5. **Deadline 10, Censure sur AP positive & Avertissement à 50s (`GAME_RULES.md §1.2 & §1.3`)** :
     - Dans `evaluateDeadlineAudit`, si `!passedAudit` et (`state.strikes >= 1` **ou** `state.deadline >= 10`), déclencher immédiatement la défaite (`state.isGameOver = true`, `state.defeatReason = 'quota_failure'`, `state.phase = 'RUN_DEFEAT'`).
     - Lors d'une censure royale (D1–D9, 0 strike), confisquer `state.ap -= Math.max(0, state.ap) * 0.5` (ne jamais diviser une dette par 2).
     - À $t = 50\text{s}$, calculer `state.interimWarningOnTrack` selon la formule de projection 2-sur-3 (§1.3).
     - Conserver le reliquat `dt` (`overflow = state.deadlineTimeSeconds - 100.0`) ou borner l'intégration de fin de deadline à `100.0 - prevDeadlineTime` pour éliminer la dérive de pas de temps.
- **Critère d'acceptation** : Tests unitaires validant le rejet d'un tribut impayable sans changement de phase, la défaite immédiate en cas d'échec à D10 avec 0 strike, le reroll effectif de `currentTarget` par `RECON_PATROL`, et le déclenchement déterministe de `SURPRISE_RAID`.

---

#### Tâche 1.7 : Refonte du Journal de Replay Multi-Deadlines (`replay.ts`) & Migration Séquentielle `v1 -> v2` (`migrations.ts`)
- **Fichiers impactés** : `src/core/replay.ts`, `src/core/migrations.ts`, `src/__tests__/unit/replay.spec.ts`, `src/__tests__/unit/migrations.spec.ts`
- **Actions techniques à réaliser** :
  1. **Élimination de la boucle infinie dans `executeReplay` (`replay.ts`)** :
     - Lorsqu'une commande est enregistrée ou rejouée, permettre l'exécution des commandes inter-deadlines et de crise (où `state.phase !== 'ACTIVE_CYCLE'` et `totalElapsedSeconds` est en pause) dès que `entry.timeSeconds <= state.totalElapsedSeconds`.
     - Si `state.phase !== 'ACTIVE_CYCLE'` et qu'aucune entrée restante du journal ne permet de sortir de la phase en pause, sortir proprement de la boucle (ou avancer via les entrées d'inter-deadline) au lieu d'appeler `tick(state, dt)` à l'infini.
  2. **Renforcement de `getStateHash(state)` (`replay.ts`)** :
     - Inclure dans le payload haché : `deadline`, `phase`, `ap`, `totalPopulation`, `freeSerfs`, `milPower`, `provinces`, `provinceBiomes.join(',')`, `taxRate`, `unrest`, `strikes`, `prngState`, les effectifs des 24 unités, `activeLaws.join(',')`, et le nombre de modificateurs actifs.
  3. **Migration `v1 -> v2` & Validation Stricte (`migrations.ts`)** :
     - Passer `CURRENT_SCHEMA_VERSION = 2`.
     - Ajouter `MIGRATIONS[1]` qui transforme un payload `v1` (tel que `src/__tests__/__fixtures__/saves/v1-save.json`) en payload `v2` en injectant toutes les nouvelles propriétés de `GameState` avec leurs valeurs par défaut déterministes.
     - Rejeter explicitement tout payload dont `schemaVersion > CURRENT_SCHEMA_VERSION` ou`< 1`, ainsi que tout état contenant des nombres `NaN` / non finis.
- **Critère d'acceptation** : Un journal de replay traversant plusieurs deadlines (avec audits, lois, menaces et campagnes) se rejoue intégralement sans blocage, et `v1-save.json` migre proprement vers le schéma `v2`.

---

### Phase 2 : Effets Secondaires, Biomes & Contenu Gate D (`src/data/` & `src/core/`)

> [!IMPORTANT]
> Cette phase doit impérativement être exécutée **avant** le calibrage final des bots et du solveur de quotas (Phase 3), car les 30 lois, les 20 dilemmes, les 4 biomes et les effets secondaires des unités modifient substantiellement les courbes économiques et militaires d'une partie.

#### Tâche 2.1 : Effets Secondaires des 24 Unités (`GAME_RULES.md §4`)
- **Fichiers impactés** : `src/core/engine.ts`, `src/core/battle.ts`, `src/core/formulas.ts`
- **Actions techniques à réaliser** :
  1. `prelate` : réduit l'Unrest fiscal de $-20\%$ par Prélat (plafonné à $-80\%$).
  2. `audit_chamber` : augmente le plafond du compte à rebours de faillite de $+10\text{s}$ par unité ($30 + 10 \times \text{audit\_chamber}$).
  3. `captain` : réduit le taux de pertes militaires (`casualtyRate`) de $-5\%$ relatif/plat par Capitaine (plancher de pertes minimum respecté).
  4. `sergeant` : augmente le butin de bataille (`resolveCampaignLoot`) de $+2\%$ par Sergent.
  5. `guild` : augmente l'AP issu du pillage de campagne de $+1\%$ par Guilde.
  6. `man_at_arms` : ajoute $+0.5$ de défense passive plate par Homme d'armes lors des batailles défensives (`calculateDefenderPower`).
  7. `scout` & `spymaster` : réduisent la marge d'incertitude $M$ de 12 et 30 points de pourcentage respectivement (plancher $\pm 5\%$), et `spymaster >= 1` révèle `isFalseLedger` et `isAmbush` sur `currentTarget`.
- **Critère d'acceptation** : Tests unitaires dédiés dans `formulas.spec.ts`, `engine.spec.ts` et `battle.spec.ts` vérifiant chacun des 7 effets secondaires.

---

#### Tâche 2.2 : Modélisation des Biomes de Provinces (`src/data/biomes.ts`, `src/core/engine.ts`)
- **Fichiers impactés** : `src/data/biomes.ts`, `src/core/engine.ts`, `src/core/commands.ts`, `src/core/battle.ts`
- **Actions techniques à réaliser** :
  1. Créer `src/data/biomes.ts` exportant `BIOMES_DATA` et les fonctions d'agrégation des bonus de `state.provinceBiomes` (`farmlands`, `trade_hub`, `stronghold`, `wilderness`).
  2. Maintenir `state.provinceBiomes.length === state.provinces` lors de la colonisation (`COLONISE_PROVINCE`), de la conquête (`resolveOffensiveCampaign`), de la perte défensive (`resolveDefensiveClash`), de la censure royale (`evaluateDeadlineAudit`) et du prêt lombard (`ACCEPT_LOMBARD_LOAN`).
  3. Appliquer dans `engine.ts` et `battle.ts` les effets cumulés de chaque province possédée :
     - `farmlands` : capacité de logement de la province $\times 1.5$ ($375$) et $+0.001$ au taux de croissance logistique $r$.
     - `trade_hub` : $+15\%$ d'efficacité fiscale (`tax_efficiency`) par comptoir commercial.
     - `stronghold` : $+12$ de défense passive plate par bastion dans `calculateDefenderPower`.
     - `wilderness` : capacité de logement de la province $\times 0.8$ ($200$) et $-5\%$ d'inertie de paperasse par province sauvage.
- **Critère d'acceptation** : La conquête ou colonisation d'une province de chaque biome modifie immédiatement la capacité de logement, le taux $r$, l'efficacité fiscale, la défense passive ou la paperasse conformément à `GAME_RULES.md §7.2`.

---

#### Tâche 2.3 : Catalogues des 30 Lois Impériales (`src/data/laws.ts`) & 20 Dilemmes du Sénéchal (`src/data/dilemmas.ts`)
- **Fichiers à créer / modifier** : `src/data/laws.ts`, `src/data/dilemmas.ts`, `src/core/modifiers.ts`, `src/core/commands.ts`, `src/core/engine.ts`
- **Actions techniques à réaliser** :
  1. Créer `src/data/laws.ts` contenant les 30 lois (`GAME_RULES.md §10` : 10 Chancelier, 10 Prélat, 10 Maréchal) sous forme de structures de données pures (`Effect[]` / `Modifier[]` et `ResolverKey`, zéro fonction sérialisée).
  2. Créer `src/data/dilemmas.ts` contenant les 20 dilemmes du Sénéchal (`GAME_RULES.md §9`) avec leurs prédicats de déclenchement et leurs choix A/B (`Effect[]`).
  3. Lors du passage en `COUNCIL_DILEMMA`, sélectionner de façon déterministe via `withStatePrng` un dilemme éligible (`state.currentDilemmaId`). Câbler `RESOLVE_DILEMMA` pour appliquer les effets du choix sélectionné via `applyEffect`.
  4. Lors du passage en `COUNCIL_LAWS`, tirer 3 lois non encore actives (1 par ordre) dans `state.currentLawDraft`. Câbler `ENACT_LAW` pour vérifier que `lawId` appartient au draft (ou au catalogue), qu'elle n'est pas déjà active, que le plafond de lois actives (5, ou 6 avec la charte d'archive) est respecté, et appliquer ses effets.
- **Critère d'acceptation** : Tests unitaires validant le tirage et l'application des lois et dilemmes sans fonction sérialisée dans `GameState`.

---

#### Tâche 2.4 : Menaces, Factions Réactives (`threats.ts`), Archives (`archives.ts`), Hauts Faits (`feats.ts`) & Score (§13)
- **Fichiers à créer / modifier** : `src/data/threats.ts`, `src/data/edicts.ts`, `src/data/archives.ts`, `src/data/feats.ts`, `src/core/formulas.ts`
- **Actions techniques à réaliser** :
  1. Créer `src/data/threats.ts` répertoriant les 8 menaces programmées (Deadlines 3 à 10) et les 6 factions ennemies avec leurs traits réactifs (`GAME_RULES.md §7.5` : Bandits $+15\%$ pertes civiles si $< 10$ soldats, Barons rebelles $+10\%$ puissance si armée $\ge 1.2 \times \text{Quota}$, Mercenaires tribut $+25\%$ et chance de raid $\times 2$ si AP $> 2000$, Zélotes $+15$ Unrest et désertion si Unrest $> 60\%$, Cavaliers des steppes incertitude $\times 2$, Légions impériales 2 provinces menacées en cas d'effondrement).
  2. Créer `src/data/edicts.ts`, `src/data/archives.ts` (8 chartes permanentes de méta-progression, `GAME_RULES.md §15`) et `src/data/feats.ts` (8 hauts faits royaux, `GAME_RULES.md §19`).
  3. Implémenter dans `src/core/formulas.ts` le calculateur de score de fin de partie et l'attribution du titre dynastique (`GAME_RULES.md §13.1 & §13.2`).
- **Critère d'acceptation** : Les traits réactifs des factions, les bonus d'archives, la détection des 8 hauts faits et la formule de score sont couverts par des tests unitaires.

---

### Phase 3 : Rigueur des Simulations, Solveur Dichotomique & Gel Gate E (`src/__tests__/` & `scripts/`)

#### Tâche 3.1 : Suppression du Biais `seed % 2` & Vrais Bots ROI / Archétypes (100+ Seeds)
- **Fichiers impactés** : `src/__tests__/simulation/botRunner.ts`, `src/__tests__/simulation/archetypeBots.spec.ts`
- **Actions techniques à réaliser** :
  1. **Supprimer immédiatement `const maxBarons = state.seed % 2 === 0 ? 5 : 4`** dans `botRunner.ts`, ainsi que tous les `console.log` de débogage.
  2. Implémenter pour `greedyRoiBotStrategy` une véritable fonction d'évaluation du temps d'amortissement marginal (ROI) pondérée par l'écart aux quotas (AP, Population, Militaire), avec une légère imprécision humaine tirée du `prng` de décision (et non de la parité de la graine).
  3. Implémenter deux stratégies expertes distinctes (`bureaucratExpertStrategy` et `conquerorExpertStrategy` combinées dans `expertBotStrategy`) capables de choisir les meilleures lois lors de `COUNCIL_LAWS`, le meilleur choix de dilemme lors de `COUNCIL_DILEMMA`, et de lancer des expéditions militaires lorsque le ratio de victoire estimé est $\ge 1.35$.
  4. Évaluer les 3 niveaux de bots sur **100 graines fixes minimum** :
     - Random Noise Bot : taux de victoire $< 5\%$.
     - Greedy ROI Bot : taux de victoire dans $[35\%, 65\%]$.
     - Archetype Expert Bot : taux de victoire $> 65\%$.
- **Critère d'acceptation** : Le taux de victoire du Greedy Bot varie continûment lorsque l'on multiplie les quotas par un facteur d'échelle, et les 3 paliers sont validés sur 100 graines fixes en $< 2\text{s}$.

---

#### Tâche 3.2 : Solveur Dichotomique du Coefficient $c$ (200 Seeds) & Non-Régression (`scripts/generate-balance-report.ts`)
- **Fichiers impactés** : `scripts/generate-balance-report.ts`, `src/data/balance.generated.ts`, `src/__tests__/unit/balance.spec.ts`
- **Actions techniques à réaliser** :
  1. Remplacer le tableau statique de `scripts/generate-balance-report.ts` par le solveur dichotomique exécutant le Greedy ROI Bot sur 200 graines fixes pour déterminer le coefficient $c$ tel que $\text{Quota}_k = \text{round}(c \times \text{MedianGreedyBotScore}_k)$ place le taux de victoire au centre de la bande $[35\%, 65\%]$.
  2. Régénérer `src/data/balance.generated.ts`.
  3. Ajouter dans `src/__tests__/unit/balance.spec.ts` un test vérifiant la monotonicité stricte des quotas ($\text{Quota}_{k+1} > \text{Quota}_k$ sur chaque métrique) et l'identité du fichier généré.
- **Critère d'acceptation** : `scripts/generate-balance-report.ts` calcule réellement les quotas par simulation et le test unitaire garantit l'absence de régression.

---

#### Tâche 3.3 : Vrai Test de Sensibilité Paramétrique ($\pm 10\%$ via `balanceOverrides`)
- **Fichiers impactés** : `src/__tests__/simulation/botRunner.ts`, `src/__tests__/simulation/archetypeBots.spec.ts`
- **Actions techniques à réaliser** :
  1. Permettre à `runSimulation` d'accepter un paramètre optionnel `balanceOverrides?: Partial< { basePopGrowthRateR: number; tierICostRatio: number; tierIICostRatio: number; taxPollRate: number } >` transmis au moteur.
  2. Dans `archetypeBots.spec.ts`, remplacer le faux test (`seed 5001` vs `seed 5002`) par une exécution sur 50 graines fixes sous un profil $-10\%$ et un profil $+10\%$.
  3. Vérifier que le taux de victoire évolue dans le bon sens (croissant avec l'assouplissement économique) tout en restant borné dans $[15\%, 85\%]$ sans effondrement à 0% ni saturation à 100%.
- **Critère d'acceptation** : Le test de sensibilité modifie effectivement les constantes mathématiques du moteur et prouve sa résilience à $\pm 10\%$.

---

#### Tâche 3.4 : Vrai Test de Dominance Post-Deadline 3 ($t > 300\text{s}$)
- **Fichiers impactés** : `src/__tests__/simulation/botRunner.ts`, `src/__tests__/simulation/archetypeBots.spec.ts`
- **Actions techniques à réaliser** :
  1. Enregistrer dans `BotRunResult` un dictionnaire `postD3UnitExpenditures: Record<UnitId, number>` ne comptabilisant que les achats effectués lorsque `state.deadline > 3` (`state.totalElapsedSeconds > 300`).
  2. Simuler 100 parties réparties entre les archétypes (Bureaucrate, Conquérant, Greedy).
  3. Vérifier que sur l'échantillon agrégé :
     - Aucune des 24 unités n'a un nombre d'achats égal à 0 (`totalPurchases[unitId] > 0`).
     - Aucune unité ne dépasse 60% des dépenses post-Deadline 3 d'un archétype.
- **Critère d'acceptation** : Validation complète du critère `GAME_RULES.md §21.3` sur les 24 unités.

---

#### Tâche 3.5 : Invariance Step-Size sur 20 Journaux Complets & Outil CLI REPL (`scripts/repl.ts`)
- **Fichiers impactés** : `src/__tests__/unit/replay.spec.ts`, `scripts/repl.ts`
- **Actions techniques à réaliser** :
  1. Générer 20 journaux de replay complets (couvrant plusieurs deadlines, achats, taxes, lois, dilemmes et batailles) et vérifier dans `replay.spec.ts` que l'exécution à $\Delta t = 0.05\text{s}$, $0.5\text{s}$ et $1.0\text{s}$ produit un écart d'AP $< 1.5\%$ et une issue de victoire/défaite identique à $\ge 99\%$.
  2. Créer `scripts/repl.ts` permettant d'inspecter l'état, d'avancer de $N$ secondes et d'envoyer n'importe quelle commande `Command` en ligne de commande.
- **Critère d'acceptation** : Les 20 replays multi-deadlines convergent entre $0.05\text{s}$ et $1.0\text{s}$, et `scripts/repl.ts` est fonctionnel.

---

## 4. Critères de Clôture & Gel du Moteur Core (Sign-Off Gate E)

Le moteur Core (`src/core/` et `src/data/`) ne pourra être déclaré **gelé** pour autoriser le démarrage de la Phase V2 (UI Vue 3, Pinia, Web Audio) qu'une fois **tous** les critères ci-dessous simultanément validés :

1. **Compilation & Typage** : `npm run type-check` retourne 0 erreur, 0 `any`, 0 `@ts-ignore`, et 0 dépendance circulaire `data <-> core`.
2. **Qualité & Linter** : `npm run lint` retourne 0 avertissement et 0 erreur, sans aucun `console.log` résiduel dans `src/`.
3. **Invariant Démographique & Règles Unitaires** : `npm run test:unit` passe à 100% et vérifie explicitement l'équation $\text{TotalPopulation} = \text{FreeSerfs} + \sum \text{Units}$, la séparation `unrest_generation` / `unrest_pacification`, la purge `expiresAt`, la désertion (15s/30s), les garde-fous des édits, le rejet du tribut impayable, `DISBAND_UNIT`, l'échec à D10, les 7 effets secondaires d'unités, les 4 biomes, les 30 lois, les 20 dilemmes et la migration `v1 -> v2`.
4. **Simulations Statistiques Honnêtes** : `npm run test:sim` valide sur $\ge 100$ graines fixes (sans astuce `seed % 2`) :
   - Random Noise Bot $< 5\%$ de victoires.
   - Greedy ROI Bot dans $[35\%, 65\%]$ de victoires.
   - Archetype Expert Bot $> 65\%$ de victoires.
   - Dominance post-D3 ($< 60\%$ par unité, 0 unité jamais achetée sur les 24).
   - Sensibilité réelle $\pm 10\%$ via `balanceOverrides`.
5. **Intégrité du Replay** : `executeReplay` fonctionne sur des parties complètes multi-deadlines avec une dérive $< 1.5\%$ entre $\Delta t = 0.05\text{s}$ et $\Delta t = 1.0\text{s}$.
