# Plan de Remédiation Technique & Assurance Qualité (`docs/plan/`)

> **Document de Pilotage Opérationnel des Correctifs & Finalisation du Core V1**  
> Ce document fait suite à l'audit croisé exhaustif entre la documentation (`docs/GAME_RULES.md`, `docs/GUIDE.md`, `docs/PLAN.md`, `docs/making/README.md`) et le code source réel (`src/core/`, `src/data/`, `src/__tests__/`, `scripts/`).  
> Il répertorie **l'intégralité des bugs, failles d'exploit, ruptures d'invariants et omissions** identifiés, et définit dans l'ordre exact des dépendances toutes les tâches à exécuter lors du prochain run avant le gel définitif du Core V1.
>
> **Révision du 2026-10-13 (contre-audit)** : ajout des anomalies 13 à 20 (vérifiées par reproduction sur le commit `f1d74fd`), d'une Tâche 1.0 d'arbitrage des règles, et correction des consignes du plan initial qui auraient introduit de nouveaux défauts (paliers de vrac contournables, biomes de départ, désertion, flux PRNG unique, absence d'injection de configuration).
>
> **Évolution de règle (2026-10-13)** : le quota d'AP devient un **débit brut instantané (AP/s) mesuré à l'audit**, et non plus un cumul sur la deadline (cf. §1.3 et Tâche 1.0 §3).
>
> **Convention de numérotation** : les « Tâches X.Y » de ce document sont la référence d'exécution. Les « Task X.Y » de [`docs/PLAN.md`](../PLAN.md) suivent un découpage par Gate et ne leur correspondent **pas** une à une (ex. `PLAN.md` Task 1.6 = bot ROI ≠ Tâche 1.6 ci-dessous = combat). En cas de divergence, ce document fait foi.

---

## 1. Synthèse du Diagnostic Croisé (Documentation vs Code Réel)

Bien que le projet compile sans erreur (`vue-tsc`), passe le linter (`oxlint` / `eslint`) et valide les 56 tests unitaires initiaux, l'audit approfondi et les tests empiriques ont mis en évidence **20 anomalies** qui empêchent de considérer la Phase V1 comme terminée :

1. **Taux de victoire du Greedy Bot biaisé par la parité de la seed (`botRunner.ts` L313)** :  
   L'instruction `const maxBarons = state.seed % 2 === 0 ? 5 : 4` force 100% de victoire sur les graines paires (capacité de logement 2 242 $\ge$ 2 200 à D10) et 0% sur les graines impaires (2 152 $<$ 2 200). Le taux de victoire de 50% est donc fabriqué par la proportion de graines paires et non par un calcul de ROI ou par un solveur de quotas.
2. **Exploits critiques sur les Édits d'Urgence (`commands.ts` L286–335)** :  
   Aucun plafond par deadline, aucune limite d'usage par run, aucun coût plancher sur `grand_festival` (gratuit à 0 AP, et **rémunérateur** en dette : à `ap = -1000`, le festival « coûte » -200 et fait remonter le trésor à -800), et les AP saisis (`forced_tithe`, `church_seizure`) sont crédités au quota AP de la deadline. De plus, `church_seizure` ajoute `+0.05` à `'unrest_growth'` (jamais lu par `engine.ts`) au lieu de diviser par 2 la pacification ecclésiastique.
3. **Boucle infinie du Replay dès la première fin de deadline (`replay.ts` L78–95)** :  
   Hors `ACTIVE_CYCLE` (`AUDIT_ASSESSMENT`, `LOMBARD_OFFER`, etc.), `tick()` ne fait plus progresser `totalElapsedSeconds`. Toute exécution de `executeReplay` dépassant $100\text{s}$ boucle à l'infini sans jamais dépiler les commandes inter-deadlines. En outre, `getStateHash()` ignore les unités, les serfs libres, le taux de taxe, les lois et l'état du PRNG.
4. **Absence d'`état PRNG` dans `GameState` & Reroll d'éclaireur inopérant (`prng.ts`, `commands.ts`, `battle.ts`)** :  
   `GameState` ne stocke pas d'état PRNG. Les systèmes instancient à la volée `new PRNG(state.seed + state.tickIndex + ...)`. Comme `tickIndex` est figé entre deux deadlines, `RECON_PATROL` tue un éclaireur sans jamais modifier le tirage ni régénérer de cible (`currentTarget` n'existe pas). De plus, `this.state += 0x6d2b79f5` dans `prng.ts` n'est pas tronqué sur 32 bits (`>>> 0`) : `getState()` dépasse $2^{32}$ dès le 3ᵉ tirage.
5. **Tribut impayable contournant gratuitement la menace (`commands.ts` L522–529)** :  
   Lorsque le joueur choisit `'tribute'` sans posséder les AP requis, `resolveScheduledThreat` retourne `success: false`, mais `commands.ts` avance quand même `state.phase` vers `EXPEDITION`, annulant la menace gratuitement.
6. **Absence de validation des entrées (`commands.ts`, `formulas.ts`)** :  
   - `TICK` accepte un `dt` négatif ou `NaN` (faisant reculer le temps et rendant l'AP négative).
   - `SET_TAX_RATE` accepte `NaN`, ce qui corrompt définitivement `taxRate` et `ap` en `NaN`.
   - `calculateMaxAffordableUnits` renvoie des nombres flottants (ex. `37.6`) lorsque `freeSerfs` est fractionnaire.
   - `BUY_UNIT` accepte des quantités décimales (`count: 2.5`), n'applique ni la restriction `allowsBulk100` ni les paliers de déblocage $10\times$ (D3), $50\times$ (D6), $100\times$ (D8), et accepte toute quantité arbitraire (ex. `count: 99` en D1).
7. **Violation de l'Équation Démographique §3.1 (`TotalPopulation = FreeSerfs + sum(Units)`)** :  
   Rompue lors de la saignée de surpopulation lorsque `freeSerfs` atteint 0 (`engine.ts` L214–215), lors des pertes civiles d'un effondrement défensif (`battle.ts` L355–356), lors de la levée en masse (`battle.ts` L438–439) et lors de `grant_units` (`modifiers.ts` L290–292).
8. **Composition de l'Agitation (`Unrest`), Purge `expiresAt` & Désertion Militaire manquantes (`engine.ts`)** :  
   Composer un delta net signé inverse l'effet des multiplicateurs lorsque la pacification domine ; il faut séparer `'unrest_generation'` et `'unrest_pacification'`. Les modificateurs expirés (`expiresAt`) ne sont jamais purgés, `TickStatCache` n'est jamais utilisé, la formule d'Unrest de surpopulation utilise un taux plat au lieu de $+0.10/\text{s}$ par tranche de 50 habitants en excès (§14.3), et la désertion militaire (§6.5) est absente.
9. **Échec à Deadline 10 avec 0 strike, Censure sur AP négative & Délai de baisse de taxe (`engine.ts`, `commands.ts`)** :  
   Échouer à la Deadline 10 avec 0 strike accorde un pardon royal et permet de passer en Deadline 11 au lieu de déclencher la défaite. La censure (`state.ap *= 0.5`) réduit une dette si `state.ap < 0`. Baisser les impôts subit le délai de 8s alors que §14.2 le réserve aux hausses. La commande `DISBAND_UNIT` (§14.1) est absente.
10. **Calculs militaires fragmentés, Pertes limitées au Tier I & Effets secondaires d'unités omis** :  
    Trois calculs distincts de puissance militaire coexistent (`engine.ts`, `commands.ts`, `battle.ts`). Les `man_at_arms` ne subissent aucune perte en attaque ou en défense victorieuse, et les officiers/éclaireurs survivent à un effondrement défensif. Les effets secondaires de `GAME_RULES.md §4` (`prelate`, `audit_chamber`, `captain`, `sergeant`, `guild`, `man_at_arms`, `scout`, `spymaster`) ne sont pas codés.
11. **Contenu Gate D absent & Biomes non raccordés** :  
    Les catalogues des 30 lois (`laws.ts`), 20 dilemmes (`dilemmas.ts`), menaces/factions (`threats.ts`), biomes (`provinceBiomes`), archives (`archives.ts`), hauts faits (`feats.ts`) et le calcul du score (§13) restent à implémenter.
12. **Tests de simulation cosmétiques & Ordre des phases inversé** :  
    Calibrer les quotas *avant* d'intégrer le contenu Gate D et les effets secondaires d'unités invaliderait l'équilibrage. La **Phase 2 (Contenu Gate D & Biomes)** doit donc précéder la **Phase 3 (Simulations, Solveur Dichotomique & Tests de Sensibilité/Dominance)**.

### 1.1 Anomalies complémentaires (contre-audit du 2026-10-13)

13. **Contournement de la Révolution (`engine.ts` L330–346)** :  
    Le test `unrest >= 100` n'est effectué que dans `tick()`, **après** application de la pacification continue. Une hausse instantanée qui porte l'Unrest à 100 (édit `forced_tithe`, levée en masse, choc fiscal, défaite de campagne, effondrement défensif) est neutralisée au tick suivant dès qu'un clergé existe (reproduit : Unrest 70 + `forced_tithe` + 10 clergés → 100 → 99.99, aucune défaite ; idem levée en masse à 80 → 100 → 99.98). Hors `ACTIVE_CYCLE` (ex. `THREAT_HERALD`), aucun test n'a lieu du tout.
14. **Effacement de dette par `applyEffect` (`modifiers.ts` L560)** :  
    `state.ap = Math.max(0, state.ap + effect.amount)` : un gain efface toute la dette (`-500 + 100 → 0`) et un coût non solvable devient gratuit (`50 - 500 → 0`). Toutes les lois et tous les dilemmes de la Phase 2 transitent par cette fonction. Par ailleurs, tout gain d'AP par effet est crédité au quota AP de la deadline.
15. **Effacement de dette par l'effondrement défensif (`battle.ts` L358–361)** :  
    `lostAp = round(ap × frac)` devient négatif en dette, puis `state.ap = Math.max(0, ap - lostAp)` remet le trésor à 0 (reproduit : `ap = -800` → `0`). La consigne initiale (pillage calculé sur `max(0, ap)`) ne suffit pas tant que le `Math.max(0, …)` final est conservé.
16. **Défaite par Conquête inatteignable (`battle.ts` L343–344, `engine.ts` L385–390)** :  
    `resolveDefensiveClash` applique `PROVINCE_MIN_FLOOR_FOR_FINES` (plancher réservé aux amendes et au prêt lombard par §1.2) : la dernière province ne peut jamais tomber et `defeatReason = 'conquest'` est du code mort.
17. **Décalage d'une deadline du Héraut des Menaces (`phases.ts` L473, `commands.ts` L523)** :  
    Le héraut n'apparaît qu'après l'audit de la deadline $d \ge 3$ et résout la menace avec le quota de $d$ (la deadline **écoulée**), alors que §8 annonce la menace de la deadline **suivante**. Conséquence : la menace de D10 (*The Royal Auditor's Iron Host*) n'est jamais jouée (l'audit de D10 clôt la partie) — 7 menaces atteignables sur les 8 du catalogue. Les champs `currentThreatPower` / `currentThreatTributeAp` ne sont jamais renseignés (les replis `||` sont toujours utilisés).
18. **Économie intégrée sans avancée d'horloge lors du basculement de phase (`engine.ts` L348–383)** :  
    Le tick qui déclenche `LOMBARD_OFFER` (ou une défaite) applique l'économie complète du pas `dt` mais n'avance ni `deadlineTimeSeconds` ni `totalElapsedSeconds` (reproduit : -14.19 AP, horloge +0s). Le résultat dépend de la taille du pas et viole l'invariance step-size.
19. **Buy Max incohérent avec `BUY_UNIT` (`formulas.ts` L120)** :  
    L'inversion logarithmique, non arrondie comme `calculateUnitCost` (arrondi au centième), peut retourner un $K$ dont le coût réel dépasse le budget (1 cas reproduit sur ~160 000 combinaisons), donc rejeté par `BUY_UNIT`.
20. **Omissions mineures de règles (`battle.ts`, `engine.ts`)** :  
    - Le butin `soldiers` (campagnes) ignore le plafond d'ordre militaire (§6.3).
    - Une victoire défensive n'accorde pas le butin de récupération (*salvage*) annoncé par §7.4.2.
    - `LOMBARD_OFFER` est proposé même avec 1 seule province, alors que son acceptation est alors toujours rejetée (offre fantôme).

### 1.2 Consignes du plan initial corrigées dans cette révision

| Consigne initiale | Défaut | Correction (tâche) |
|---|---|---|
| Rejet de `count === 10 / 50 / 100` selon les paliers | Contournable par `count: 99`, `49`, `9` | Plafond `count <= getMaxBulkSize(state, unitId)` (1.5) |
| `provinceBiomes = ['farmlands','farmlands','wilderness']` | Capacité de départ 950 ≠ 750 (§6.1), $r$ modifié | Biome neutre `heartland` pour les 3 provinces de départ (1.0, 1.1) |
| Désertion limitée à `crisisStage === 'strife_desertion'` | S'arrête à ≥ 90% d'Unrest ; incohérent avec *Sanctuary Rights* (« sous 90% ») | Désertion cumulative de 75% à 99% (1.0, 1.3) |
| Boucle `while (desertionTimer >= 15)` | Compteur non borné sans armée → désertion en rafale au 1er recrutement | Réinitialisation du compteur sans unité éligible (1.3) |
| `prngState` unique partagé | Manipulation du hasard (cliquer N fois décale les raids et combats) | Flux PRNG séparés `rngStreams` (1.1) |
| Pillage d'effondrement sur `max(0, ap)` | Insuffisant : la dette restait effacée | Suppression du `Math.max(0, …)` final (1.6) |
| `applyPopulationLoss` dans `formulas.ts` | Module de formules pures ; mutation d'état | Module dédié `src/core/mutations.ts` (1.3) |
| `balanceOverrides` « transmis au moteur » (Phase 3) | Aucun point d'injection : `tick()` lit `BALANCE` / `DEADLINE_QUOTAS` en dur | `EngineConfig` injectable dès la Phase 1 (1.1) |
| Biomes intégrés aux helpers dès 1.5 | Effets de biome codés avant leur tâche (2.2) | Point d'extension neutre en 1.5, effets branchés en 2.2 |
| Tests existants non mentionnés | Plusieurs tests valident le comportement fautif | Réécriture explicite listée dans chaque tâche |

### 1.3 Évolution de règle : Quota d'AP mesuré en débit brut instantané

Le critère AP de l'audit n'est plus l'AP brut **cumulé** sur la deadline (`cumulativeApThisDeadline >= quota.ap`), mais le **débit brut d'AP par seconde au moment de l'inspection** :
$$\text{apMet} \iff \text{GrossApRate}_{t=100\text{s}} \ge \text{ApRateQuota}_k$$
où $\text{GrossApRate}$ est `calculateGrossApRate(state).total` (Tâche 1.5) : production des unités, capitation, multiplicateurs, pénalités de crise (boycott, rébellion) et modificateurs `gross_ap_rate`, **avant** paperasse et entretien.

Conséquences :
- **Cohérence des trois critères** : AP, Population et Militaire sont tous trois des instantanés à l'inspection.
- **Fin des exploits de quota par transfert** : un apport ponctuel (édits, prêt lombard, butin, salvage, effets de lois et dilemmes) ne modifie pas le débit et ne peut donc plus satisfaire le critère AP. Le problème de « crédit de quota » disparaît par construction.
- **Clics** : les clics (`STAMP_DOCUMENT`) ne comptent plus pour le quota ; ils restent un outil d'amorçage et de trésorerie (achat de producteurs, survie à la faillite).
- **Invariance au pas de temps** : le critère ne dépend plus de l'intégration temporelle de l'AP.
- **Manipulation de fin de deadline acceptée** : l'état au moment de l'audit fait foi (ex. repasser sous 50% d'Unrest juste avant l'audit lève le boycott fiscal et augmente le débit), au même titre que la Population et le Militaire.
- **Données** : `DeadlineQuota.ap` (AP cumulés) est renommé `DeadlineQuota.apRate` (AP/s). Le tribut, défini jusqu'ici comme $0.20 \times \text{ApQuota}$, devient $\text{TributeCost} = 20 \times \text{ApRateQuota}$ (20 secondes de débit exigé), ce qui conserve les montants du tableau §8.1 avec les quotas provisoires ci-dessous.
- **Quotas provisoires** (jusqu'au solveur de la Tâche 3.2) : $\text{ApRateQuota}_k = \text{ApQuota}_k / 100$, soit `5, 12, 22, 35, 55, 85, 130, 195, 285, 420` AP/s pour D1 à D10.
- `cumulativeApThisDeadline` n'intervient plus dans l'audit ; il est conservé comme statistique d'affichage (production + clics de la deadline). `totalCumulativeAp` reste la base du score (§13.1) et du haut fait *Crœsus*.

---

## 2. Architecture d'Exécution Priorisée (Dépendances Corrigées)

```mermaid
flowchart TD
    subgraph Phase 1 : Intégrité du Moteur Core & Règles Système
        T1_0["TÂCHE 1.0 : Arbitrages de Règles & Alignement GAME_RULES / GUIDE"]
        T1_1["TÂCHE 1.1 : Contrats types.ts, Fin Import Circulaire, rngStreams & EngineConfig"]
        T1_2["TÂCHE 1.2 : Dual Unrest (Gen/Pac), Révolution Immédiate, Purge expiresAt & TickStatCache"]
        T1_3["TÂCHE 1.3 : Invariant Population §3.1, AP sans Clamp, Surpopulation §14.3 & Désertion §6.5"]
        T1_4["TÂCHE 1.4 : Garde-fous Édits §11, DISBAND_UNIT §14.1 & Taxe §14.2"]
        T1_5["TÂCHE 1.5 : Validation Entrées, Clic Unifié, Plafond Vrac §5.1, Buy Max & Plafonds"]
        T1_6["TÂCHE 1.6 : Combat Unifié, Conquête, Héraut D+1, Horloge, Tribut, Raids & D10"]
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
        T3_3["TÂCHE 3.3 : Vrai Test de Sensibilité ±10% (EngineConfig)"]
        T3_4["TÂCHE 3.4 : Vrai Test de Dominance Post-D3 (t > 300s) par Archétype"]
        T3_5["TÂCHE 3.5 : Invariance Step-Size sur 20 Replays Complets & CLI REPL"]
    end

    T1_0 --> T1_1 --> T1_2 --> T1_3 --> T1_4 --> T1_5 --> T1_6 --> T1_7
    T1_7 --> T2_1 --> T2_2 --> T2_3 --> T2_4
    T2_4 --> T3_1 --> T3_2 --> T3_3 --> T3_4 --> T3_5
```

---

## 3. Spécification Détaillée des Tâches de Remédiation

### Phase 1 : Intégrité du Moteur Core & Règles Système (`src/core/` & `src/data/balance.ts`)

#### Tâche 1.0 : Arbitrages de Règles & Alignement Documentaire (`GAME_RULES.md`, `GUIDE.md`, `PLAN.md`)
- **Fichiers impactés** : `docs/GAME_RULES.md`, `docs/GUIDE.md`, `docs/PLAN.md`
- **Objectif** : inscrire dans les règles de référence les décisions dont dépendent les tâches 1.1 à 1.7, **avant** toute modification du code, afin que le code et les tests aient une spécification non ambiguë.
- **Arbitrages à inscrire** :
  1. **Révolution immédiate (§6.5)** : l'Unrest atteignant 100 à n'importe quel instant (hausse continue ou instantanée, dans n'importe quelle phase) déclenche immédiatement la défaite `revolution`.
  2. **Désertion cumulative (§6.5)** : la désertion s'applique de **75% à 99%** d'Unrest (paliers `strife_desertion` et `urban_rebellion`), comme le boycott fiscal et le gel démographique qui sont déjà cumulatifs. La loi *Sanctuary Rights* (§10.2) supprime la désertion **sous 90%** uniquement.
  3. **Quota d'AP en débit brut instantané (§1.1, §1.3, §8.1, §11)** : réécrire le critère AP selon le §1.3 de ce document (débit brut AP/s mesuré à l'inspection, `ApRateQuota`). Mettre à jour en conséquence :
     - §1.1 (définition du critère AP) et §1.3 (projection à 50s : le débit brut courant à $t = 50\text{s}$ est comparé à `ApRateQuota`, sans extrapolation) ;
     - §2 et §2.3 (supprimer « squeeze out critical AP before an audit buzzer » : les clics ne comptent plus pour le quota) ;
     - §8.1 ($\text{TributeCost} = 20 \times \text{ApRateQuota}$, montants inchangés) ;
     - §9 (dilemmes « Passed quota by < 15% / > 200% » : ratio débit mesuré / `ApRateQuota`) ;
     - §11 et §14.4 (les mentions « excluded from AP quota » deviennent superflues : un transfert ne modifie pas le débit) ;
     - §21.2 (le score médian du bot sur l'axe AP devient le débit brut médian à l'audit).

     `totalCumulativeAp` (score, haut fait *Crœsus*) ne compte que la production et les clics, jamais les transferts de capital.
  4. **Trésor signé** : aucune mécanique ne remet une dette (`ap < 0`) à zéro. Les coûts en AP d'un choix (dilemme, loi) exigent `state.ap >= coût` ; sinon le choix est rejeté.
  5. **Héraut des menaces (§8, §8.1)** : après l'audit de la deadline $d$ (pour $2 \le d \le 9$), le héraut annonce et fait résoudre la menace de la deadline **$d+1$** (puissance $0.80 \times \text{MilitaryQuota}_{d+1}$, tribut $0.20 \times \text{ApQuota}_{d+1}$). Les 8 menaces D3–D10 deviennent toutes atteignables ; le tableau §8.1 reste inchangé.
  6. **Conquête (§1.2, §7.4.2)** : le plancher de 1 province ne s'applique qu'à la censure royale et au prêt lombard. Un effondrement défensif à 1 province prend la dernière province et déclenche la défaite `conquest`.
  7. **Biome neutre de départ (§6.1, §7.2)** : ajouter le biome `heartland` (*Cœur du Domaine*, aucun bonus : capacité ×1.0, $\Delta r = 0$, aucune défense ni réduction). Les 3 provinces de départ sont `heartland` (capacité de départ conservée à 750). Une province colonisée est `heartland` ; une province conquise reçoit le biome de `currentTarget`. Une province perdue (censure, prêt lombard, effondrement) retire la **dernière acquise** (LIFO).
  8. **Achats en vrac (§5.1, §5.3)** : les paliers définissent une **taille maximale** d'achat ($1$, puis $\le 10$ à D3 ou Pop $\ge 250$, $\le 50$ à D6 ou Pop $\ge 1\,000$, $\le 100$ à D8 pour `peasant` / `scribe` uniquement). Toute quantité entière de 1 à ce maximum est valide. Buy Max retourne $\min(\text{K abordable}, \text{taille max})$.
  9. **Salvage défensif (§7.4.2)** : valeur proposée, à recalibrer en Phase 3 : $\text{SalvageAP} = \text{round}(0.25 \times \text{TributeCost}_{\text{deadline courante}} \times \text{Roll}(0.8, 1.2))$, crédité à `state.ap` uniquement.
  10. **Butin de soldats (§7.4.1)** : les soldats capturés au-delà de la marge du plafond militaire (§6.3) rejoignent les serfs libres.
  11. **Prêt lombard (§14.4)** : l'offre n'est présentée que si `provinces >= 2`.
  12. **Raids & Mercenaires (§7.5 vs §8.3)** : le doublement de la probabilité de raid si `ap > 2000` est une règle générale (§8.3). Le trait réactif des Mercenaires (§7.5) se limite au tribut +25% (pas de second doublement).
  13. **Clic d'amorçage (§2.1, §17)** : corriger le texte « en 15 clics, le joueur recrute son premier Scribe » : les 50 AP de départ permettent un recrutement immédiat (`STARTING_AP` inchangé). Le tutoriel (§17, étape 4) précise que le critère AP porte sur le débit de production, pas sur le trésor.
  14. **Format de sauvegarde (§18)** : le préfixe `GRA-v1:` désigne la version du **format d'encodage** et reste stable ; la version du **schéma** d'état est portée par `schemaVersion` dans le payload.
  15. **`PLAN.md`** : répercuter les tâches de ce document dans les checklists et y rappeler la convention de numérotation.
- **Critère d'acceptation** : `GAME_RULES.md` et `GUIDE.md` énoncent les 14 arbitrages ci-dessus sans contradiction entre eux ; `PLAN.md` renvoie à ce document.

---

#### Tâche 1.1 : Assainissement Architectural, Flux PRNG Persistants (`rngStreams`) & Configuration Injectable (`EngineConfig`)
- **Fichiers impactés** : `src/core/prng.ts`, `src/core/types.ts`, `src/core/state.ts`, `src/core/config.ts` (nouveau), `src/data/balance.ts`, `src/core/engine.ts`, `src/core/commands.ts`
- **Actions techniques à réaliser** :
  1. **Rupture du cycle d'import** : Déplacer les définitions de types moteurs (`StatKey`, `ModifierOp`, `ResolverKey`, `Modifier`, `Effect`, `Command`, `RunPhase`, `ALLOWED_COMMANDS_BY_PHASE`, `isCommandAllowedInPhase`) vers `src/core/types.ts` et `src/core/phases.ts` (avec réexport depuis `balance.ts` si nécessaire pour la rétrocompatibilité des tests), et supprimer le réexport circulaire de `core/formulas` et `core/modifiers` depuis `src/data/balance.ts`.
  2. **Troncature 32-bit dans `prng.ts`** : Dans `PRNG.next()`, remplacer `let t = (this.state += 0x6d2b79f5)` par :
     ```typescript
     this.state = (this.state + 0x6d2b79f5) >>> 0
     let t = this.state
     ```
  3. **Flux PRNG séparés** : Pour empêcher la manipulation du hasard (un clic consommant un tirage décalerait tous les raids et combats suivants), définir :
     ```typescript
     export type RngStream = 'click' | 'combat' | 'events' | 'council'
     ```
     - `click` : critiques de `STAMP_DOCUMENT`.
     - `combat` : batailles, `currentTarget`, `RECON_PATROL`.
     - `events` : raids surprises.
     - `council` : tirages de lois et de dilemmes.

     Initialiser chaque flux via `deriveStreamSeed(seed, stream)` (hachage FNV-1a 32-bit de `` `${seed}:${stream}` ``, `>>> 0`). Ajouter l'utilitaire `withStatePrng<T>(state: GameState, stream: RngStream, fn: (prng: PRNG) => T): T` qui instancie `new PRNG(state.rngStreams[stream])`, exécute `fn(prng)`, puis sauvegarde `state.rngStreams[stream] = prng.getState()`. Plus aucun `new PRNG(state.seed + …)` ne doit subsister dans `src/core/`.
  4. **Configuration injectable (`src/core/config.ts`)** : Créer
     ```typescript
     export interface EngineConfig {
       balance: BalanceConfig            // constantes numériques de BALANCE (dont r0, ratios de coût, TAX_POLL_RATE)
       quotas: readonly DeadlineQuota[]  // quotas d'audit
     }
     export const DEFAULT_ENGINE_CONFIG: EngineConfig
     ```
     Ajouter un paramètre optionnel final `config: EngineConfig = DEFAULT_ENGINE_CONFIG` à `tick`, `dispatch`, `evaluateDeadlineAudit` et aux formules qui lisent des constantes d'équilibrage (`calculateUnitCost` lit le ratio de coût du tier depuis `config.balance` et non depuis `UNITS_DATA[...].costRatio`). La configuration n'est **pas** stockée dans `GameState` (non sérialisée). C'est le point d'entrée requis par le solveur (3.2) et le test de sensibilité (3.3).
  5. **Enrichissement de `GameState` (`types.ts` & `state.ts`)** :
     Ajouter dans `GameState` et initialiser de façon 100% déterministe dans `createInitialGameState` (remplacer `Date.now()` et `Math.random()` pour `runId` par `` `run_${seed}` ``) :
     - `rngStreams: Record<RngStream, number>` (initialisé via `deriveStreamSeed`)
     - `interimWarningOnTrack: boolean | null` (initialisé à `null`)
     - `desertionTimer: number` (initialisé à `0`)
     - `forcedTitheFreezeTimer: number` (initialisé à `0`)
     - `lastEdictDeadline: number` (initialisé à `0`)
     - `edictUsageCounts: Record<'forced_tithe' | 'church_seizure' | 'grand_festival', number>` (initialisé à `{ forced_tithe: 0, church_seizure: 0, grand_festival: 0 }`)
     - `disbandedMilitaryHistory: Array<{ timeSeconds: number; count: number }>` (initialisé à `[]`)
     - `provinceBiomes: BiomeId[]` (initialisé à `['heartland', 'heartland', 'heartland']` ; ajouter `'heartland'` à `BiomeId` et à `BIOMES_DATA` avec des valeurs neutres, cf. Tâche 1.0 §7)
     - `currentTarget: CampaignTarget | null` (initialisé à `null`)
     - `campaignsLaunchedThisDeadline: number` (initialisé à `0`)
     - `lastSurpriseRaidTime: number` (initialisé à `-60`)
     - `surpriseRaidTriggeredThisDeadline: boolean` (initialisé à `false`)
     - `pendingDeadlineAudit: boolean` (initialisé à `false`, cf. Tâche 1.6 §6)
     - `currentLawDraft: string[]` (initialisé à `[]`)
     - `currentDilemmaId: string | null` (initialisé à `null`)
     - `victoriesCount: number` (initialisé à `0`)
     - `peakPopulation: number` (initialisé à `BALANCE.STARTING_POPULATION`)
     - `starvationLosses: number` (initialisé à `0`)
  6. **`cloneGameState` & `handleRestartRun`** : copier en profondeur (`rngStreams`, `edictUsageCounts`, `disbandedMilitaryHistory`, `provinceBiomes`, `currentTarget`, `currentLawDraft`) et réinitialiser **l'intégralité** des champs, y compris `clickTokens`, `currentThreatPower`, `currentThreatTributeAp`, `runId` (`` `run_${seed}` ``) et `rngStreams` (dérivés de la nouvelle graine). Le plus sûr : `Object.assign(state, createInitialGameState({ seed, archivePoints: state.archivePoints }))`.
- **Critère d'acceptation** : Aucune dépendance circulaire entre `src/data/` et `src/core/`, aucun appel à `Math.random()` ou `Date.now()` dans `state.ts`, chaque flux de `state.rngStreams` évolue de manière déterministe et indépendante (un `STAMP_DOCUMENT` supplémentaire ne modifie aucun tirage des flux `combat` / `events`), un état neuf a une capacité de logement de 750, et un `tick` exécuté avec une `EngineConfig` modifiée (ex. $r_0 \times 1.1$) produit une croissance différente de la configuration par défaut.

---

#### Tâche 1.2 : Composition Duale de l'Agitation, Révolution Immédiate, Purge `expiresAt` & `TickStatCache`
- **Fichiers impactés** : `src/core/types.ts`, `src/core/modifiers.ts`, `src/core/mutations.ts` (nouveau), `src/core/engine.ts`, `src/core/commands.ts`, `src/core/battle.ts`, `src/__tests__/unit/modifiers.spec.ts`
- **Actions techniques à réaliser** :
  1. Dans `StatKey`, remplacer `'unrest_growth'` par `'unrest_generation' | 'unrest_pacification'`.
  2. Dans `modifiers.ts`, supprimer la surcharge à 3 arguments sans `statKey` de `composeStat` afin d'exiger systématiquement `composeStat(statKey: StatKey, baseValue: number, modifiers: readonly Modifier[], rawState?: RawEvaluationState): number`.
  3. **Révolution immédiate (`src/core/mutations.ts`)** : créer
     - `triggerDefeat(state, reason: DefeatReason): void` : fixe `isGameOver = true`, `isVictory = false`, `defeatReason = reason`, `phase = 'RUN_DEFEAT'` (sans effet si `isGameOver` est déjà vrai).
     - `addUnrest(state, delta: number): void` : `state.unrest = clamp(state.unrest + delta, 0, 100)` puis, si `state.unrest >= 100`, `triggerDefeat(state, 'revolution')`.

     Remplacer **toutes** les mutations directes de `state.unrest` (`engine.ts`, `commands.ts` : choc fiscal, édits ; `battle.ts` : campagnes, défense, levée en masse ; `modifiers.ts` : `instant_resource: 'unrest'`) par `addUnrest`.
  4. **Aucune transition de phase après une défaite** : dans `dispatch`, toute affectation de `state.phase` consécutive au traitement d'une commande (ex. `getNextInterDeadlinePhase` après `SELECT_THREAT_RESPONSE: 'levy'`, `RESOLVE_RAID_DEFENSE`) est conditionnée par `!state.isGameOver`, afin de ne jamais écraser `RUN_DEFEAT`.
  5. Au tout début de `tick()` dans `engine.ts`, purger les modificateurs expirés en vérifiant `mod.expiresAt !== undefined` :
     ```typescript
     state.activeModifiers = state.activeModifiers.filter(
       (mod) => mod.expiresAt === undefined || mod.expiresAt > state.totalElapsedSeconds
     )
     ```
  6. Raccorder une instance de `TickStatCache` pour mémoriser les évaluations de statistiques au sein d'un même `tickIndex` (cache invalidé dès qu'une commande modifie `activeModifiers`, les unités ou les provinces au sein du même tick).
  7. Dans `tick()` (`engine.ts`), calculer séparément la génération et la pacification d'Unrest (`GAME_RULES.md §6.5`) :
     - `baseUnrestGen` = tax unrest + overcrowding unrest (§14.3). La réduction par `prelate` (-20% par Prélat, plafonnée à -80%) est ajoutée en Tâche 2.1.
     - `composedGen = Math.max(0, composeStat('unrest_generation', baseUnrestGen, state.activeModifiers, rawState))`
     - `baseUnrestPac` = `(state.units.clergy ?? 0) * 0.02 + (state.units.prelate ?? 0) * 0.15`
     - `composedPac = Math.max(0, composeStat('unrest_pacification', baseUnrestPac, state.activeModifiers, rawState))`
     - `addUnrest(state, (composedGen - composedPac) * dt)`
  8. **Tests existants à réécrire** : `modifiers.spec.ts` L40–44 (utilise `'unrest_growth'`) doit cibler `'unrest_generation'`.
- **Critère d'acceptation** : Un modificateur multiplicatif sur `'unrest_pacification'` (ex. `church_seizure` `mul: 0.5`) réduit uniquement la pacification sans jamais inverser le signe de la génération fiscale, et s'éteint exactement à `expiresAt`. Tests de régression : Unrest 70 + `forced_tithe` avec 10 clergés → défaite `revolution` immédiate (sans tick) ; Unrest 80 + levée en masse en `THREAT_HERALD` → `phase === 'RUN_DEFEAT'` (non écrasée par `EXPEDITION`).

---

#### Tâche 1.3 : Invariant Démographique (§3.1), Trésor Signé, Surpopulation (§14.3) & Désertion Militaire (§6.5)
- **Fichiers impactés** : `src/core/mutations.ts`, `src/core/engine.ts`, `src/core/modifiers.ts`, `src/core/battle.ts`, `src/__tests__/unit/modifiers.spec.ts`
- **Actions techniques à réaliser** :
  1. **Helper d'invariant démographique (`mutations.ts`)** : Créer `applyPopulationLoss(state: GameState, loss: number, isStarvation = false): number` qui déduit `loss` de `state.totalPopulation` et en priorité de `state.freeSerfs`. Si `loss > state.freeSerfs` (ex. plus aucun serf libre lors d'une famine ou d'un massacre), l'excédent entier est retiré des unités civiles/administratives puis militaires (ordre déterministe : Tier I avant Tier II, ordre de déclaration de `UNITS_DATA`) de sorte que $\text{TotalPopulation} = \text{FreeSerfs} + \sum \text{Units}$ reste toujours vérifié. Retourne la perte effective et incrémente `state.starvationLosses` si `isStarvation`.
  2. **Surpopulation (`GAME_RULES.md §14.3`)** :
     - Lorsque `state.totalPopulation > maxPop`, appliquer `applyPopulationLoss(state, bleed, true)`.
     - Calculer l'Unrest de surpopulation proportionnel :
       $$\text{OvercrowdingUnrest/s} = \min\left(1.0, 0.10 \times \frac{\text{TotalPopulation} - \text{MaxPopulation}}{50}\right)$$
       et l'ajouter à `baseUnrestGen` (Tâche 1.2).
  3. **Désertion Militaire (`GAME_RULES.md §6.5`, arbitrage 1.0 §2)** :
     - La désertion est active lorsque `state.unrest >= 75` (paliers `strife_desertion` **et** `urban_rebellion`), sauf si le flag de loi `'law:sanctuary_rights'` est actif **et** `state.unrest < 90`.
     - Déterminer l'unité éligible : `soldier` si `(state.units.soldier ?? 0) > 0` (seuil 15s), sinon `man_at_arms` si `(state.units.man_at_arms ?? 0) > 0` (seuil 30s), sinon aucune.
     - Si aucune unité n'est éligible ou si la désertion n'est pas active : `state.desertionTimer = 0` (pas d'accumulation latente qui provoquerait une désertion en rafale au premier recrutement).
     - Sinon : `state.desertionTimer += dt`, puis tant qu'une unité est éligible et que `state.desertionTimer >= seuil(unité éligible)` : `state.desertionTimer -= seuil`, retirer 1 unité et `state.totalPopulation -= 1` (le déserteur quitte le royaume). Réévaluer l'unité éligible et son seuil à chaque itération.
  4. **Correction de `applyEffect` (`modifiers.ts`)** :
     - `instant_resource: 'ap'` : `state.ap += effect.amount` **sans** `Math.max(0, …)` et **sans** créditer `cumulativeApThisDeadline` ni `totalCumulativeAp` (arbitrage 1.0 §3–4). La solvabilité des coûts est vérifiée en amont par l'appelant (`canAffordEffects(state, effects)`, utilisé en 2.3).
     - `grant_units` : si le recrutement consomme des serfs (cas par défaut), décrémenter `freeSerfs` (les unités au-delà des serfs disponibles ne sont pas accordées) ; si l'effet ajoute des recrues extérieures (`external: true`), incrémenter `totalPopulation` pour maintenir l'équation §3.1.
     - `instant_resource: 'population'` négatif : passer par `applyPopulationLoss(state, -effect.amount)` ; positif : incrémenter `freeSerfs` et `totalPopulation`.
     - `instant_resource: 'unrest'` : passer par `addUnrest` (Tâche 1.2).
  5. **Tests existants à réécrire** : `modifiers.spec.ts` L130–133 (`expect(state.cumulativeApThisDeadline).toBe(300)`) doit attendre `0`.
- **Critère d'acceptation** : Un test unitaire vérifie l'invariant `Math.abs(state.totalPopulation - (state.freeSerfs + sumUnits(state))) < 1e-6` après chaque tick de surpopulation, désertion (soldats à 15s, hommes d'armes à 30s, poursuite à 95% d'Unrest, arrêt sous 90% avec *Sanctuary Rights*), bataille et effet. Tests de régression : `ap = -500` + effet `+100` → `-400` ; aucune désertion immédiate lors du recrutement d'un soldat après 60s à 80% d'Unrest sans armée.

---

#### Tâche 1.4 : Garde-fous des Édits d'Urgence (§11), Démobilisation (`DISBAND_UNIT`, §14.1) & Fiscalité (§14.2)
- **Fichiers impactés** : `src/core/commands.ts`, `src/core/engine.ts`, `src/core/types.ts`, `src/__tests__/unit/engine.spec.ts`
- **Actions techniques à réaliser** :
  1. **Édits d'Urgence (`handleEnactEdict`, `GAME_RULES.md §11`)** :
     - Refuser si `state.lastEdictDeadline === state.deadline` (*"Un seul édit d'urgence est autorisé par deadline"*).
     - Soit $k = \text{state.edictUsageCounts[edictId]}$ et $\text{mult} = 1 + 0.5 \times k$.
     - **`forced_tithe`** :
       - Ajoute $30 \times \text{pollTaxPerSec}$ à `state.ap` **sans** toucher à `cumulativeApThisDeadline` ni `totalCumulativeAp`. `pollTaxPerSec` est la composante capitation de `calculateGrossApRate(state)` (efficacité fiscale et boycott inclus), exposée par ce helper (Tâche 1.5).
       - `addUnrest(state, 35 × mult)` et fixe `state.forcedTitheFreezeTimer = 20` (bloquant `canGrow` dans `tick()` tant que `forcedTitheFreezeTimer > 0`, décrémenté de `dt` à chaque tick).
     - **`church_seizure`** :
       - Refuser si `state.edictUsageCounts.church_seizure >= 2` (*"Maximum 2 saisies d'Église par run"*).
       - Ajoute $\max(300, 25 \times \text{calculateGrossApRate(state)})$ à `state.ap` (**sans** toucher aux compteurs de quota AP).
       - Ajoute un modificateur `{ source: 'edict:church_seizure', stat: 'unrest_pacification', op: 'mul', value: 0.5, appliedAt: state.totalElapsedSeconds, expiresAt: state.totalElapsedSeconds + 60 * mult }` et `addUnrest(state, 10 × mult)`.
     - **`grand_festival`** :
       - Coût $= \max(100, 0.20 \times \max(0, \text{state.ap}), 30 \times \text{calculateGrossApRate(state)})$ (toujours $\ge 100$, jamais négatif).
       - Refuser si `state.ap < cost`. Déduire `cost` de `state.ap` et `addUnrest(state, -20)`.
     - Mettre à jour `state.lastEdictDeadline = state.deadline` et `state.edictUsageCounts[edictId] += 1` uniquement en cas de succès.
  2. **Démobilisation (`DISBAND_UNIT`, `GAME_RULES.md §14.1`)** :
     - Ajouter `{ type: 'DISBAND_UNIT'; unitId: UnitId; count: number }` dans `Command` et l'autoriser dans `ACTIVE_CYCLE` et `AWAIT_RESUME`.
     - Vérifier que `Number.isInteger(count) && count > 0` et `(state.units[unitId] ?? 0) >= count`.
     - Calculer l'indemnité par unité : $\text{severancePerUnit} = 0.50 \times \text{def.baseCost}$.
     - Nombre d'unités couvertes par le trésor positif : $\text{paidUnits} = \min\big(\text{count}, \lfloor \max(0, \text{state.ap}) / \text{severancePerUnit} \rfloor\big)$, $\text{unpaidUnits} = \text{count} - \text{paidUnits}$.
     - Déduire $\text{paidUnits} \times \text{severancePerUnit}$ de `state.ap` ; `addUnrest(state, 2 × unpaidUnits)` si $\text{unpaidUnits} > 0$.
     - Décrémenter `state.units[unitId] -= count` et incrémenter `state.freeSerfs += count`.
     - Si `def.order === 'military'`, enregistrer `{ timeSeconds: state.totalElapsedSeconds, count }` dans `state.disbandedMilitaryHistory` (en purgeant les entrées $> 10\text{s}$). Si le total démobilisé sur 10s dépasse $10\%$ de l'effectif militaire actif avant licenciement, `addUnrest(state, 15)` (mutinerie) et vider l'historique pour éviter le double déclenchement.
  3. **Fiscalité (`handleSetTaxRate`, `GAME_RULES.md §14.2`)** :
     - Rejeter si `!Number.isFinite(command.rate)`.
     - Si `targetRate <= state.taxRate` (baisse ou maintien) : appliquer **immédiatement** `state.taxRate = targetRate`, `state.pendingTaxRate = null`, `state.taxPromulgationTimer = 0`.
     - Si `targetRate > state.taxRate` (hausse) : appliquer le choc fiscal (`addUnrest(state, 20)` si `targetRate - state.taxRate > 15`) et programmer `state.pendingTaxRate = targetRate`, `state.taxPromulgationTimer = 8`.
  4. **Tests existants à réécrire** : `engine.spec.ts` « executes emergency edicts accurately » (L191–208) enchaîne trois édits dans la même deadline et attend le succès des trois : le réécrire en un test par édit (deadlines distinctes) et ajouter le rejet du 2ᵉ édit d'une même deadline.
- **Critère d'acceptation** : Impossible de spammer les édits dans un même deadline, impossible de gonfler le quota AP via les édits, festival rejeté à `ap = -1000` (aucun gain d'AP), baisse de taxe immédiate, et tests unitaires complets de `DISBAND_UNIT` (avec et sans AP, et mutinerie $> 10\%$).

---

#### Tâche 1.5 : Validation Stricte des Entrées, Harmonisation du Clic, Plafond de Vrac (§5.1), Buy Max & Plafonds d'Ordres
- **Fichiers impactés** : `src/core/formulas.ts`, `src/core/engine.ts`, `src/core/commands.ts`
- **Actions techniques à réaliser** :
  1. **Helpers partagés dans `engine.ts`** :
     - Exporter `calculateMaxPopulation(state: GameState): number` (Notables, Barons, `composeStat('housing_capacity', ...)` et multiplicateur de biome agrégé via `getBiomeModifiers(state)`).
     - Exporter `calculateNetPaperwork(state: GameState): number` (Archivistes, Chambres des comptes, réduction de biome agrégée et `composeStat('paperwork_friction', ...)`).
     - Exporter `calculateGrossApRate(state: GameState): { total: number; pollTax: number }` (Scribes, Clercs, Superviseurs, Intendants, Collecteurs, Fermiers généraux, capitation, Artisans, Guildes, bonus de biome agrégé, boycott fiscal et `composeStat('gross_ap_rate', ...)`). `tick()` utilise ce helper.
     - `getBiomeModifiers(state)` est créé ici et agrège `BIOMES_DATA` sur `state.provinceBiomes` ; comme toutes les provinces sont `heartland` jusqu'à la Tâche 2.2, il est neutre en Phase 1 (aucun changement d'équilibrage).
  2. **Harmonisation de `STAMP_DOCUMENT` & `BUY_UNIT` (`commands.ts`)** :
     - Dans `handleStampDocument`, utiliser `calculateGrossApRate(state).total` et `calculateNetPaperwork(state)`, et déterminer le coup critique via `withStatePrng(state, 'click', (prng) => prng.next() < critChance)`. Supprimer le champ `isCritical` de la commande `STAMP_DOCUMENT` (les tests forcent le critique via un `rngStreams.click` choisi).
     - Dans `handleBuyUnit`, utiliser `calculateMaxPopulation(state)` pour calculer `orderCaps` afin que les modificateurs de logement soient pris en compte.
  3. **Taille maximale de vrac (`GAME_RULES.md §5.1`, arbitrage 1.0 §8)** :
     - Ajouter dans `formulas.ts` la fonction pure `getMaxBulkSize(deadline: number, totalPopulation: number, def: UnitBalanceDef): 1 | 10 | 50 | 100` :
       - `100` si `deadline >= 8 && def.allowsBulk100` ;
       - sinon `50` si `deadline >= 6 || totalPopulation >= 1000` ;
       - sinon `10` si `deadline >= 3 || totalPopulation >= 250` ;
       - sinon `1`.
     - Dans `handleBuyUnit` : rejeter si `!Number.isInteger(count) || count <= 0`, puis rejeter si `count > getMaxBulkSize(...)` (couvre `99`, `49`, `9` et non seulement `10 / 50 / 100`).
  4. **Buy Max (`calculateMaxAffordableUnits`)** :
     - Retourner `Math.min(affordableByAp, Math.floor(freeSerfs), Math.floor(orderHeadroom), maxBulkSize)` (nouveau paramètre `maxBulkSize`) pour garantir un entier valide.
     - Après l'inversion logarithmique, corriger l'écart d'arrondi : `while (k > 0 && calculateUnitCost(unitId, currentOwned, k) > availableAp) k--`.
  5. **Validation du `dispatch`** :
     - `TICK` : rejeter si `!Number.isFinite(command.dt) || command.dt <= 0`.
     - `default` : retourner `{ success: false, error: 'Unsupported command' }` (couvre `RESOLVE_COMBAT` tant que `COMBAT_RESOLUTION` n'est pas câblé, cf. Tâche 1.6 §9).
- **Critère d'acceptation** : Rejet strict de `dt <= 0`, `rate: NaN`, `count: 2.5`, `count: 99` en D1 avec 100 habitants, et `count: 100` sur toute unité autre que `peasant` / `scribe` ou avant D8 ; test de propriété : pour une grille de budgets, de quantités possédées et d'unités, `BUY_UNIT` avec la quantité retournée par Buy Max réussit toujours (si $K > 0$).

---

#### Tâche 1.6 : Unification Militaire, Conquête, Héraut D+1, Horloge de Tick, Cible d'Expédition, Tribut Bloquant (§8.2), Raids Surprises (§8.3) & Deadline 10 (§1.2–§1.3)
- **Fichiers impactés** : `src/core/engine.ts`, `src/core/commands.ts`, `src/core/battle.ts`, `src/core/phases.ts`, `src/__tests__/unit/phases.spec.ts`, `src/__tests__/unit/battle.spec.ts`
- **Actions techniques à réaliser** :
  1. **Unification militaire & ventilation des pertes (`battle.ts`, `commands.ts`)** :
     - Remplacer les formules militaires inlinées dans `commands.ts` (`LAUNCH_ATTACK`, `RESOLVE_RAID_DEFENSE`) et `battle.ts` (`resolveScheduledThreat`) par `calculateMilitaryPower(state)`.
     - Dans `resolveOffensiveCampaign` et la branche victorieuse de `resolveDefensiveClash`, ventiler les pertes proportionnellement entre `soldier` et `man_at_arms`. La réduction de pertes par `captain` est ajoutée en Tâche 2.1.
     - Remplacer les PRNG par défaut des fonctions de `battle.ts` par `withStatePrng(state, 'combat', …)`.
  2. **Effondrement défensif, trésor signé & conquête (`resolveDefensiveClash`, arbitrages 1.0 §4 et §6)** :
     - Tuer 100% de toutes les unités de l'ordre `'military'` (en les déduisant de `totalPopulation`) et appliquer les pertes civiles (15–25%) via `applyPopulationLoss(state, lostCivilians)`.
     - Pillage : `lostAp = Math.round(Math.max(0, state.ap) * apLossFraction)` puis `state.ap -= lostAp` **sans** `Math.max(0, …)` final (une dette n'est jamais effacée).
     - Province : `state.provinces -= 1` **sans** plancher (`PROVINCE_MIN_FLOOR_FOR_FINES` reste réservé à la censure et au prêt lombard) ; retirer la dernière entrée de `provinceBiomes` ; si `state.provinces <= 0`, `triggerDefeat(state, 'conquest')`.
     - `addUnrest(state, 20)`.
  3. **Butin, salvage & plafond militaire (arbitrages 1.0 §9–10)** :
     - Campagnes : ne créditer **ni** `cumulativeApThisDeadline` **ni** `totalCumulativeAp` avec le butin d'AP. Plafonner les soldats capturés à la marge `calculateOrderCaps(calculateMaxPopulation(state)).military - effectifMilitaire` ; l'excédent rejoint `freeSerfs` (et `totalPopulation`).
     - Victoire défensive : créditer `state.ap` du salvage $\text{round}(0.25 \times \text{TributeCost} \times \text{Roll}(0.8, 1.2))$ tiré sur le flux `combat`.
  4. **Héraut des menaces à D+1 (`phases.ts`, `commands.ts`, arbitrage 1.0 §5)** :
     - `getNextInterDeadlinePhase('COUNCIL_LAWS', deadline)` retourne `'THREAT_HERALD'` si `deadline >= 2 && deadline <= 9`, sinon `'EXPEDITION'`.
     - À l'entrée en `THREAT_HERALD`, renseigner `state.currentThreatPower = getThreatPower(quota(deadline + 1).military)` et `state.currentThreatTributeAp = getThreatTributeAp(quota(deadline + 1).apRate)` (avec `getThreatTributeAp(apRate) = Math.round(20 * apRate)`). `SELECT_THREAT_RESPONSE` lit ces champs (suppression des replis `||`).
     - Mettre à jour `phases.spec.ts` (le test de progression attend actuellement le héraut à partir de D3).
  5. **Tribut bloquant (`SELECT_THREAT_RESPONSE`, `GAME_RULES.md §8.2`)** :
     - Si `res.success === false` pour `'tribute'` (`state.ap < tributeAp`), **ne pas** appeler `getNextInterDeadlinePhase` et retourner `{ success: false, error: res.message }` en restant en phase `THREAT_HERALD`.
     - La levée en masse applique ses pertes via `applyPopulationLoss` et son Unrest via `addUnrest` ; la transition de phase n'a lieu que si `!state.isGameOver` (Tâche 1.2 §4).
  6. **Horloge de tick & dérive de pas de temps (anomalie 18)** :
     - Au début de `tick()` en `ACTIVE_CYCLE`, si `state.pendingDeadlineAudit` (ou `deadlineTimeSeconds >= 100`), exécuter l'audit **sans** intégrer d'économie et retourner.
     - Borner le pas intégré : `stepDt = Math.min(dt, 100 - state.deadlineTimeSeconds)` ; intégrer l'économie sur `stepDt` puis avancer **immédiatement** `deadlineTimeSeconds` et `totalElapsedSeconds` de `stepDt`, **avant** toute bascule de phase (révolution, `LOMBARD_OFFER`, `SURPRISE_RAID`).
     - Si `deadlineTimeSeconds >= 100` : lancer l'audit si la phase est toujours `ACTIVE_CYCLE`, sinon fixer `state.pendingDeadlineAudit = true` (audit exécuté au premier tick après le retour en `ACTIVE_CYCLE`).
     - Exposer `consumedDt = stepDt` dans `TickResult` ; l'appelant (store, bot, replay) réinjecte le reliquat `dt - consumedDt` après la reprise.
  7. **Cible d'expédition (`currentTarget`), Brouillard de Guerre & `RECON_PATROL` (`GAME_RULES.md §7.1 & §7.3`)** :
     - Générer un `currentTarget` déterministe via `withStatePrng(state, 'combat', …)` à l'entrée en phase `EXPEDITION` : puissance réelle ennemie, marge d'incertitude $M = 0.45$ (réduction par `scout` / `spymaster` ajoutée en Tâche 2.1), biome (`farmlands` | `trade_hub` | `stronghold` | `wilderness`), type de butin, `isFalseLedger` (15% de chance $\to$ butin réduit de 60–80%), `isAmbush` (10% de chance $\to$ force ennemie $+25\%$).
     - `RECON_PATROL` sacrifie 1 `scout` (`totalPopulation -= 1`) et génère un nouveau `currentTarget` via le flux `combat`.
     - Autoriser jusqu'à **2 campagnes** par phase `EXPEDITION` (`state.campaignsLaunchedThisDeadline < 2`) : `LAUNCH_ATTACK` incrémente `campaignsLaunchedThisDeadline`, génère une nouvelle cible s'il reste 1 campagne possible, et ne passe automatiquement à `AWAIT_RESUME` qu'après la 2ᵉ campagne (ou via `SKIP_EXPEDITION`). `RESUME_GOVERNANCE` remet `campaignsLaunchedThisDeadline` à 0.
  8. **Raids Surprises (`SURPRISE_RAID`, `GAME_RULES.md §8.3`)** :
     - Dans `tick()` (`engine.ts`), si `state.deadline >= 3`, `!state.surpriseRaidTriggeredThisDeadline`, `state.totalElapsedSeconds - state.lastSurpriseRaidTime >= 60`, et qu'une tranche de 10s de `deadlineTimeSeconds` est franchie :
       - Calculer $p = 0.02 \times (\text{state.ap} > 2000 ? 2 : 1) + (\text{milPower} < 0.5 \times \text{quota.military} ? 0.02 : 0) + (\text{state.unrest} > 60 ? 0.02 : 0)$.
       - Tirer avec `withStatePrng(state, 'events', …)` : si déclenché, fixer `state.phase = 'SURPRISE_RAID'`, `state.surpriseRaidTriggeredThisDeadline = true`, `state.lastSurpriseRaidTime = state.totalElapsedSeconds`.
       - Lors de `RESOLVE_RAID_DEFENSE`, utiliser `raidPower = Math.round(0.50 * quota.military)` et compter les provinces `'stronghold'` de `provinceBiomes` dans `strongholdCount` ; ne revenir en `ACTIVE_CYCLE` que si `!state.isGameOver`.
     - `RESUME_GOVERNANCE` remet `surpriseRaidTriggeredThisDeadline` à `false`.
  9. **Phases & commandes orphelines** : retirer `COMBAT_RESOLUTION` / `RESOLVE_COMBAT` de `RunPhase` / `Command` (les batailles sont résolues instantanément), ou les câbler explicitement ; aucune phase ne doit accepter une commande sans effet.
  10. **Deadline 10, Quota d'AP en débit, Censure sur AP positive, Avertissement à 50s & Garde de reprise (`GAME_RULES.md §1.2 & §1.3`)** :
      - **Quota d'AP en débit (§1.3 de ce document)** : renommer `DeadlineQuota.ap` en `apRate` (`balance.generated.ts`, `scripts/generate-balance-report.ts`, `EngineConfig.quotas`) ; mettre à jour la table provisoire du script (`5, 12, 22, 35, 55, 85, 130, 195, 285, 420`) puis régénérer `balance.generated.ts` via le script (fichier généré, jamais édité à la main). Dans `evaluateDeadlineAudit`, `apMet = calculateGrossApRate(state, config).total >= quota.apRate` ; exposer `grossApRate` dans `AuditOutcome`. Supprimer le quota de repli `500 * state.deadline`.
      - Dans `evaluateDeadlineAudit`, si `!passedAudit` et (`state.strikes >= 1` **ou** `state.deadline >= 10`), `triggerDefeat(state, 'quota_failure')`.
      - Lors d'une censure royale (D1–D9, 0 strike), confisquer `state.ap -= Math.max(0, state.ap) * 0.5` (ne jamais diviser une dette par 2) et retirer la dernière entrée de `provinceBiomes` si une province est confisquée.
      - À $t = 50\text{s}$, calculer `state.interimWarningOnTrack` selon la règle 2-sur-3 (§1.3) en comparant le débit brut courant à `apRate`, la population et la puissance militaire courantes aux quotas de la deadline.
      - `handleResumeGovernance` rejette si `state.deadline >= 10` (filet de sécurité).
  11. **Prêt lombard (arbitrage 1.0 §11)** : dans `tick()`, ne basculer en `LOMBARD_OFFER` que si `state.lombardBailoutAvailable && state.provinces >= 2` ; sinon le compte à rebours de faillite continue normalement.
- **Critère d'acceptation** : Tests unitaires validant :
  - le rejet d'un tribut impayable sans changement de phase ;
  - la défaite immédiate en cas d'échec à D10 avec 0 strike ;
  - le reroll effectif de `currentTarget` par `RECON_PATROL` ;
  - le déclenchement déterministe de `SURPRISE_RAID` ;
  - l'effondrement à `ap = -800` laissant `ap = -800` ;
  - l'effondrement à 1 province déclenchant `defeatReason === 'conquest'` ;
  - la résolution de 8 menaces (D3 à D10) sur une partie complète ;
  - un tick basculant en `LOMBARD_OFFER` avançant l'horloge de `consumedDt` ;
  - l'absence d'offre lombarde à 1 province ;
  - le critère AP satisfait par le débit brut instantané (ex. 10 Clercs en D1) et **non** satisfait par un trésor gonflé par édit, prêt lombard ou butin ;
  - `balance.spec.ts` L99 réécrit : `tributeAp === Math.round(20 * quota.apRate)`.

---

#### Tâche 1.7 : Refonte du Journal de Replay Multi-Deadlines (`replay.ts`) & Migration Séquentielle `v1 -> v2` (`migrations.ts`)
- **Fichiers impactés** : `src/core/replay.ts`, `src/core/migrations.ts`, `src/__tests__/unit/replay.spec.ts`, `src/__tests__/unit/migrations.spec.ts`
- **Actions techniques à réaliser** :
  1. **Élimination de la boucle infinie dans `executeReplay` (`replay.ts`)** :
     - Lorsqu'une commande est enregistrée ou rejouée, permettre l'exécution des commandes inter-deadlines et de crise (où `state.phase !== 'ACTIVE_CYCLE'` et `totalElapsedSeconds` est en pause) dès que `entry.timeSeconds <= state.totalElapsedSeconds`.
     - Si `state.phase !== 'ACTIVE_CYCLE'` et qu'aucune entrée restante du journal ne permet de sortir de la phase en pause, sortir proprement de la boucle au lieu d'appeler `tick(state, dt)` à l'infini.
     - Réinjecter le reliquat `dt - consumedDt` (Tâche 1.6 §6) après une reprise.
     - `executeReplay` accepte une `EngineConfig` optionnelle (Tâche 1.1).
  2. **Renforcement de `getStateHash(state)` (`replay.ts`)** :
     - Inclure dans le payload haché : `deadline`, `phase`, `ap`, `totalPopulation`, `freeSerfs`, `milPower`, `provinces`, `provinceBiomes.join(',')`, `taxRate`, `unrest`, `strikes`, les 4 valeurs de `rngStreams`, les effectifs des 24 unités, `activeLaws.join(',')`, et le nombre de modificateurs actifs.
  3. **Migration `v1 -> v2` & Validation Stricte (`migrations.ts`)** :
     - Passer `CURRENT_SCHEMA_VERSION = 2`. **Conserver** `SAVE_PREFIX = 'GRA-v1:'` (version du format d'encodage, indépendante du schéma — arbitrage 1.0 §14).
     - Ajouter `MIGRATIONS[1]` qui transforme un payload `v1` (tel que `src/__tests__/__fixtures__/saves/v1-save.json`) en payload `v2` en injectant toutes les nouvelles propriétés de `GameState` avec leurs valeurs par défaut déterministes (`rngStreams` dérivés de `state.seed`, `provinceBiomes` = `heartland` × `provinces`).
     - Rejeter explicitement tout payload dont `schemaVersion > CURRENT_SCHEMA_VERSION` ou `< 1`, ainsi que tout état contenant des nombres `NaN` / non finis.
- **Critère d'acceptation** : Un journal de replay traversant plusieurs deadlines (avec audits, lois, menaces et campagnes) se rejoue intégralement sans blocage, et `v1-save.json` migre proprement vers le schéma `v2` en conservant le préfixe `GRA-v1:`.

---

### Phase 2 : Effets Secondaires, Biomes & Contenu Gate D (`src/data/` & `src/core/`)

> [!IMPORTANT]
> Cette phase doit impérativement être exécutée **avant** le calibrage final des bots et du solveur de quotas (Phase 3), car les 30 lois, les 20 dilemmes, les 4 biomes et les effets secondaires des unités modifient substantiellement les courbes économiques et militaires d'une partie.

#### Tâche 2.1 : Effets Secondaires des 24 Unités (`GAME_RULES.md §4`)
- **Fichiers impactés** : `src/core/engine.ts`, `src/core/battle.ts`, `src/core/formulas.ts`
- **Actions techniques à réaliser** :
  1. `prelate` : réduit l'Unrest fiscal de $-20\%$ par Prélat (plafonné à $-80\%$) dans `baseUnrestGen`.
  2. `audit_chamber` : augmente le plafond du compte à rebours de faillite de $+10\text{s}$ par unité ($30 + 10 \times \text{audit\_chamber}$) ; le seuil de l'offre lombarde reste à 20s restantes.
  3. `captain` : réduit le taux de pertes militaires (`casualtyRate`) de $-5\%$ relatif par Capitaine, plafonné à $-50\%$.
  4. `sergeant` : augmente le butin de bataille (`resolveCampaignLoot`) de $+2\%$ par Sergent.
  5. `guild` : augmente l'AP issu du pillage de campagne de $+1\%$ par Guilde.
  6. `man_at_arms` : ajoute $+0.5$ de défense passive plate par Homme d'armes lors des batailles défensives (`calculateDefenderPower`).
  7. `scout` & `spymaster` : réduisent la marge d'incertitude $M$ de 12 et 30 points de pourcentage respectivement (plancher $\pm 5\%$), et `spymaster >= 1` révèle `isFalseLedger` et `isAmbush` sur `currentTarget`.
- **Critère d'acceptation** : Tests unitaires dédiés dans `formulas.spec.ts`, `engine.spec.ts` et `battle.spec.ts` vérifiant chacun des 7 effets secondaires.

---

#### Tâche 2.2 : Modélisation des Biomes de Provinces (`src/data/biomes.ts`, `src/core/engine.ts`)
- **Fichiers impactés** : `src/data/biomes.ts`, `src/core/engine.ts`, `src/core/commands.ts`, `src/core/battle.ts`
- **Actions techniques à réaliser** :
  1. Créer `src/data/biomes.ts` exportant `BIOMES_DATA` (déplacé depuis `balance.ts`, incluant le biome neutre `heartland`) ; `getBiomeModifiers(state)` (créé en 1.5) agrège désormais les bonus réels.
  2. Maintenir `state.provinceBiomes.length === state.provinces` : colonisation (`COLONISE_PROVINCE`) → ajoute `heartland` ; conquête (`resolveOffensiveCampaign`) → ajoute `currentTarget.biome` ; perte (effondrement défensif, censure royale, prêt lombard) → retire la **dernière** entrée (LIFO).
  3. Appliquer dans `engine.ts` et `battle.ts` les effets cumulés de chaque province possédée :
     - `farmlands` : capacité de logement de la province $\times 1.5$ ($375$) et $+0.001$ au taux de croissance logistique $r$.
     - `trade_hub` : $+15\%$ d'efficacité fiscale (`tax_efficiency`) par comptoir commercial.
     - `stronghold` : $+12$ de défense passive plate par bastion dans `calculateDefenderPower`.
     - `wilderness` : capacité de logement de la province $\times 0.8$ ($200$) et $-5\%$ d'inertie de paperasse par province sauvage.
     - `heartland` : aucun effet.
- **Critère d'acceptation** : Un état neuf conserve une capacité de 750 ; la conquête d'une province de chaque biome modifie immédiatement la capacité de logement, le taux $r$, l'efficacité fiscale, la défense passive ou la paperasse conformément à `GAME_RULES.md §7.2` ; la perte d'une province retire exactement le dernier biome acquis.

---

#### Tâche 2.3 : Catalogues des 30 Lois Impériales (`src/data/laws.ts`) & 20 Dilemmes du Sénéchal (`src/data/dilemmas.ts`)
- **Fichiers à créer / modifier** : `src/data/laws.ts`, `src/data/dilemmas.ts`, `src/core/modifiers.ts`, `src/core/commands.ts`, `src/core/engine.ts`
- **Actions techniques à réaliser** :
  1. Créer `src/data/laws.ts` contenant les 30 lois (`GAME_RULES.md §10` : 10 Chancelier, 10 Prélat, 10 Maréchal) sous forme de structures de données pures (`Effect[]` / `Modifier[]` et `ResolverKey`, zéro fonction sérialisée).
  2. Créer `src/data/dilemmas.ts` contenant les 20 dilemmes du Sénéchal (`GAME_RULES.md §9`) avec leurs prédicats de déclenchement et leurs choix A/B (`Effect[]`).
  3. Ajouter `canAffordEffects(state, effects): boolean` (somme des `instant_resource: 'ap'` négatifs $\le \max(0, \text{state.ap})$, et coûts en unités/serfs disponibles). `RESOLVE_DILEMMA` et `ENACT_LAW` rejettent un choix non solvable **sans** changer de phase.
  4. Les prédicats de dilemme fondés sur le quota (« Passed quota by < 15% / > 200% ») utilisent `AuditOutcome.grossApRate / quota.apRate` de l'audit qui vient d'avoir lieu (à mémoriser dans `GameState`, ex. `lastAuditOutcome`).
  5. Lors du passage en `COUNCIL_DILEMMA`, sélectionner de façon déterministe via `withStatePrng(state, 'council', …)` un dilemme éligible (`state.currentDilemmaId`). Câbler `RESOLVE_DILEMMA` pour appliquer les effets du choix sélectionné via `applyEffect`.
  6. Lors du passage en `COUNCIL_LAWS`, tirer via le flux `council` 3 lois non encore actives (1 par ordre) dans `state.currentLawDraft`. Câbler `ENACT_LAW` pour vérifier que `lawId` appartient au draft, qu'elle n'est pas déjà active, que le plafond de lois actives (5, ou 6 avec la charte d'archive) est respecté (sinon rejet explicite, et non succès silencieux), et appliquer ses effets.
- **Critère d'acceptation** : Tests unitaires validant le tirage et l'application des lois et dilemmes sans fonction sérialisée dans `GameState`, et le rejet d'un choix coûteux non solvable.

---

#### Tâche 2.4 : Menaces, Factions Réactives (`threats.ts`), Archives (`archives.ts`), Hauts Faits (`feats.ts`) & Score (§13)
- **Fichiers à créer / modifier** : `src/data/threats.ts`, `src/data/edicts.ts`, `src/data/archives.ts`, `src/data/feats.ts`, `src/core/formulas.ts`
- **Actions techniques à réaliser** :
  1. Créer `src/data/threats.ts` répertoriant les 8 menaces programmées (Deadlines 3 à 10, annoncées après l'audit de la deadline précédente conformément à la Tâche 1.6 §4) et les 6 factions ennemies avec leurs traits réactifs (`GAME_RULES.md §7.5` : Bandits $+15\%$ pertes civiles si $< 10$ soldats, Barons rebelles $+10\%$ puissance si armée $\ge 1.2 \times \text{Quota}$, Mercenaires tribut $+25\%$ — **sans** second doublement de la chance de raid, déjà couvert par la règle générale §8.3 —, Zélotes $+15$ Unrest et désertion si Unrest $> 60\%$, Cavaliers des steppes incertitude $\times 2$, Légions impériales 2 provinces menacées en cas d'effondrement, pouvant déclencher la défaite `conquest`).
  2. Créer `src/data/edicts.ts`, `src/data/archives.ts` (8 chartes permanentes de méta-progression, `GAME_RULES.md §15`) et `src/data/feats.ts` (8 hauts faits royaux, `GAME_RULES.md §19`).
  3. Implémenter dans `src/core/formulas.ts` le calculateur de score de fin de partie et l'attribution du titre dynastique (`GAME_RULES.md §13.1 & §13.2`). « Total AP Produced » = `totalCumulativeAp` (production et clics uniquement, arbitrage 1.0 §3).
- **Critère d'acceptation** : Les traits réactifs des factions, les bonus d'archives, la détection des 8 hauts faits et la formule de score sont couverts par des tests unitaires.

---

### Phase 3 : Rigueur des Simulations, Solveur Dichotomique & Gel Gate E (`src/__tests__/` & `scripts/`)

#### Tâche 3.1 : Suppression du Biais `seed % 2` & Vrais Bots ROI / Archétypes (100+ Seeds)
- **Fichiers impactés** : `src/__tests__/simulation/botRunner.ts`, `src/__tests__/simulation/archetypeBots.spec.ts`
- **Actions techniques à réaliser** :
  1. **Supprimer immédiatement `const maxBarons = state.seed % 2 === 0 ? 5 : 4`** dans `botRunner.ts`, ainsi que tous les `console.log` de débogage.
  2. Implémenter pour `greedyRoiBotStrategy` une véritable fonction d'évaluation du temps d'amortissement marginal (ROI) pondérée par l'écart aux quotas (débit brut d'AP en AP/s, Population, Militaire), avec une légère imprécision humaine tirée d'un `PRNG` de décision propre au bot (distinct des `rngStreams` du moteur, et non de la parité de la graine).
  3. Implémenter deux stratégies expertes distinctes (`bureaucratExpertStrategy` et `conquerorExpertStrategy` combinées dans `expertBotStrategy`) capables de choisir les meilleures lois lors de `COUNCIL_LAWS`, le meilleur choix de dilemme lors de `COUNCIL_DILEMMA`, et de lancer des expéditions militaires lorsque le ratio de victoire estimé est $\ge 1.35$.
  4. Les bots respectent `getMaxBulkSize` et réinjectent le reliquat `dt - consumedDt` (Tâche 1.6 §6).
  5. Évaluer les 3 niveaux de bots sur **100 graines fixes minimum** :
     - Random Noise Bot : taux de victoire $< 5\%$.
     - Greedy ROI Bot : taux de victoire dans $[35\%, 65\%]$.
     - Archetype Expert Bot : taux de victoire $> 65\%$.
- **Critère d'acceptation** : Le taux de victoire du Greedy Bot varie continûment lorsque l'on multiplie les quotas par un facteur d'échelle (via `EngineConfig.quotas`), et les 3 paliers sont validés sur 100 graines fixes en $< 2\text{s}$.

---

#### Tâche 3.2 : Solveur Dichotomique du Coefficient $c$ (200 Seeds) & Non-Régression (`scripts/generate-balance-report.ts`)
- **Fichiers impactés** : `scripts/generate-balance-report.ts`, `src/data/balance.generated.ts`, `src/__tests__/unit/balance.spec.ts`
- **Actions techniques à réaliser** :
  1. Remplacer le tableau statique de `scripts/generate-balance-report.ts` par le solveur dichotomique exécutant le Greedy ROI Bot sur 200 graines fixes pour déterminer le coefficient $c$ tel que $\text{Quota}_k = \text{round}(c \times \text{MedianGreedyBotScore}_k)$ (sur l'axe AP, le score est le **débit brut** mesuré à l'audit $k$ ; les quotas `apRate` peuvent être arrondis au dixième pour les premières deadlines) place le taux de victoire au centre de la bande $[35\%, 65\%]$. Chaque candidat $c$ est évalué en passant les quotas candidats via `EngineConfig.quotas` (sans réécrire le fichier généré entre deux itérations).
  2. Régénérer `src/data/balance.generated.ts`.
  3. Ajouter dans `src/__tests__/unit/balance.spec.ts` un test vérifiant la monotonicité stricte des quotas ($\text{Quota}_{k+1} > \text{Quota}_k$ sur chaque métrique) et l'identité du fichier généré.
- **Critère d'acceptation** : `scripts/generate-balance-report.ts` calcule réellement les quotas par simulation et le test unitaire garantit l'absence de régression.

---

#### Tâche 3.3 : Vrai Test de Sensibilité Paramétrique ($\pm 10\%$ via `EngineConfig`)
- **Fichiers impactés** : `src/__tests__/simulation/botRunner.ts`, `src/__tests__/simulation/archetypeBots.spec.ts`
- **Actions techniques à réaliser** :
  1. Permettre à `runSimulation` d'accepter un paramètre optionnel `balanceOverrides?: Partial<{ basePopGrowthRateR: number; tierICostRatio: number; tierIICostRatio: number; taxPollRate: number }>`, converti en `EngineConfig` (Tâche 1.1) et transmis à `tick` / `dispatch`.
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
3. **Invariant Démographique & Règles Unitaires** : `npm run test:unit` passe à 100% et vérifie explicitement :
   - l'équation $\text{TotalPopulation} = \text{FreeSerfs} + \sum \text{Units}$ ;
   - la séparation `unrest_generation` / `unrest_pacification`, la purge `expiresAt` et la révolution immédiate à 100 d'Unrest dans toutes les phases ;
   - la désertion cumulative (15s/30s, 75–99%, compteur réinitialisé sans armée) ;
   - le trésor signé (aucun effacement de dette par effet, festival ou effondrement) ;
   - le critère AP évalué sur le débit brut instantané (`apRate`), insensible aux transferts de capital et aux clics ;
   - les garde-fous des édits, le rejet du tribut impayable, `DISBAND_UNIT` et l'échec à D10 ;
   - la défaite par conquête, les 8 menaces D3–D10 atteignables et l'horloge de tick avancée lors d'une bascule de phase ;
   - la taille maximale de vrac et la cohérence Buy Max / `BUY_UNIT` ;
   - l'indépendance des flux `rngStreams` ;
   - les 7 effets secondaires d'unités, les 4 biomes (+ `heartland` neutre), les 30 lois, les 20 dilemmes et la migration `v1 -> v2`.
4. **Simulations Statistiques Honnêtes** : `npm run test:sim` valide sur $\ge 100$ graines fixes (sans astuce `seed % 2`) :
   - Random Noise Bot $< 5\%$ de victoires.
   - Greedy ROI Bot dans $[35\%, 65\%]$ de victoires.
   - Archetype Expert Bot $> 65\%$ de victoires.
   - Dominance post-D3 ($< 60\%$ par unité, 0 unité jamais achetée sur les 24).
   - Sensibilité réelle $\pm 10\%$ via `EngineConfig`.
5. **Intégrité du Replay** : `executeReplay` fonctionne sur des parties complètes multi-deadlines avec une dérive $< 1.5\%$ entre $\Delta t = 0.05\text{s}$ et $\Delta t = 1.0\text{s}$.
6. **Cohérence Documentaire** : `GAME_RULES.md`, `GUIDE.md` et `PLAN.md` reflètent les arbitrages de la Tâche 1.0.
