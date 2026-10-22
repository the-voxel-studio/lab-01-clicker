# Tâche 1.6 — Combat Asymétrique, Horloge de Tick Bornée, Quotas en Débit Brut (`apRate`), Raids Surprises & Héraut D+1

- **Statut** : ✅ Complétée & Validée
- **Date** : 2026-10-14
- **Fichiers modifiés & créés** :
  - `scripts/generate-balance-report.ts` (modifié : quotas renommés en `apRate` avec table provisoire `[5, 12, 22, 35, 55, 85, 130, 195, 285, 420]` AP/s)
  - `src/data/balance.generated.ts` (régénéré automatiquement via `scripts/generate-balance-report.ts`)
  - `src/data/balance.ts` (modifié : signature `getThreatTributeAp(apRate: number) = Math.round(20 * apRate)` ; `getDeadlineThreat(quota)` transmet `quota.apRate`)
  - `src/core/types.ts` (modifié : suppression des identifiants orphelins `COMBAT_RESOLUTION` dans `RunPhase` et `RESOLVE_COMBAT` dans `Command` ; champ obligatoire `grossApRate: number` dans `AuditOutcome`)
  - `src/core/phases.ts` (modifié : suppression de `COMBAT_RESOLUTION` et `RESOLVE_COMBAT` de la matrice des permissions ; `getNextInterDeadlinePhase('COUNCIL_LAWS')` retourne `'THREAT_HERALD'` si `deadline >= 2 && deadline <= 9`, sinon `'EXPEDITION'`)
  - `src/core/battle.ts` (modifié : `applyRetinueCasualties` proportionnel aux unités militaires ; `resolveOffensiveCampaign` ne crédite aucun quota cumulé avec le butin et plafonne les soldats capturés au headroom militaire avec excédent déversé vers `freeSerfs` ; `resolveDefensiveClash` avec salvage défensif sur victoire, pillage 30–50% préservant la dette signée, perte de province sans plancher menant à défaite `conquest` si $\le 0$, massacre de 100% de l'armée, pertes civiles 15–25%, +20 Unrest ; `generateCampaignTarget` déterministe avec marge 0.45, fausse comptabilité et embuscade ; `performScoutReroll` sacrifiant 1 scout sur le flux `'combat'` ; `resolveScheduledThreat` acceptant tribut bloquant et levée en masse)
  - `src/core/engine.ts` (modifié : horloge bornée `stepDt = Math.min(dt, 100 - state.deadlineTimeSeconds)`, temps avancé immédiatement avant toute bascule ; `consumedDt` exposé dans `TickResult` ; audit différé `pendingDeadlineAudit` si fin de cycle hors `ACTIVE_CYCLE` ; déclenchement déterministe de `SURPRISE_RAID` à chaque tranche de 10s en D3+ avec probabilité $p$ sur le flux `'events'` ; garde d'offre lombarde `provinces >= 2` ; avertissement intermédiaire à 50s calculé selon la règle 2-sur-3 ; `evaluateDeadlineAudit` comparant `grossApRate >= quota.apRate`, défaite immédiate en D10 sans strike et Royal Censure confisquant 50% d'AP positive uniquement)
  - `src/core/commands.ts` (modifié : transition inter-deadlines initialisant automatiquement `currentThreatPower` et `currentThreatTributeAp` à l'entrée dans `THREAT_HERALD`, et générant `currentTarget` à l'entrée dans `EXPEDITION` ; `SELECT_THREAT_RESPONSE` lisant directement ces champs sans repli et bloquant en cas de trésor insuffisant pour le tribut ; `LAUNCH_ATTACK` gérant les embuscades, fausses écritures, biomes et plafond de 2 campagnes ; `RESOLVE_RAID_DEFENSE` défendant à 50% du quota militaire avec bastions et salvage ; `handleResumeGovernance` rejetant si `deadline >= 10`)
  - `src/core/modifiers.ts` (modifié : isolation des instances dans `TickStatCache` via référence d'état `stateRef`)
  - `src/__tests__/unit/balance.spec.ts` (modifié : assertion du coût de tribut alignée sur `Math.round(20 * quota.apRate)`)
  - `src/__tests__/unit/phases.spec.ts` (modifié : matrice mise à jour à 11 phases $\times$ 21 commandes et séquence du héraut D2–D9)
  - `src/__tests__/unit/military_threats_clock.spec.ts` (nouveau : 20 tests unitaires validant l'intégralité des 11 critères d'acceptation et les recommandations du relecteur)
  - `src/__tests__/simulation/botRunner.ts` & `src/__tests__/simulation/archetypeBots.spec.ts` (modifiés : suppression des `console.log` dans `src/` et correction de la syntaxe de sélection de menace)

---

## 1. Actions Réalisées

1. **Effondrement Défensif Dévastateur & Préservation de Dette (`battle.ts`)** :
   - Le pillage déduit `lostAp = Math.round(Math.max(0, state.ap) * apLossFraction)` puis `state.ap -= lostAp` sans `Math.max(0, …)` final, préservant scrupuleusement les dettes négatives (ex. -800 AP reste -800 AP).
   - Perte d'une province sans plancher ; si `state.provinces <= 0`, bascule immédiate vers `defeatReason = 'conquest'` et `phase = 'RUN_DEFEAT'`.
   - Massacre de 100% des unités d'ordre militaire (`soldier`, `man_at_arms`, etc.), pertes civiles de 15% à 25% via `applyPopulationLoss`, et $+20$ d'Unrest via `addUnrest`.

2. **Plafond Militaire, Butin de Campagne & Salvage Défensif (Arbitrages 1.0 §9–10)** :
   - Campagnes offensives : le butin en AP ne crédite ni `cumulativeApThisDeadline` ni `totalCumulativeAp` (l'audit évalue uniquement le flux régulier).
   - Les soldats capturés sont plafonnés à la marge militaire restante (`milHeadroom = Math.max(0, orderCaps.military - currentMil)`) ; 100% de l'excédent rejoint `freeSerfs` et l'invariant $\text{TotalPopulation} = \text{FreeSerfs} + \sum \text{Units}$ est préservé.
   - Victoires défensives : attribution d'un salvage de champ de bataille $\text{round}(0.25 \times \text{TributeCost} \times \text{Roll}(0.8, 1.2))$ tiré sur le flux `'combat'` et crédité à `state.ap` sans impacter les compteurs d'audit.

3. **Héraut des Menaces à D+1 & 8 Menaces en Run Complet (Arbitrage 1.0 §5)** :
   - `getNextInterDeadlinePhase('COUNCIL_LAWS', deadline)` active le héraut de D2 à D9 inclusivement (8 menaces au total ciblant les deadlines 3 à 10).
   - À l'entrée en `THREAT_HERALD`, `state.currentThreatPower` et `state.currentThreatTributeAp` sont automatiquement calculés à partir du quota $d+1$.
   - `SELECT_THREAT_RESPONSE` lit directement ces champs sans repli `'||'`.

4. **Tribut Bloquant & Levée en Masse (§8.2)** :
   - Si `state.ap < currentThreatTributeAp`, `SELECT_THREAT_RESPONSE` avec `'tribute'` est rejeté avec `success: false` et conserve l'état en phase `THREAT_HERALD`.
   - La levée en masse applique 5% de pertes civiles via `applyPopulationLoss` et $+30$ Unrest via `addUnrest` ; la transition vers la phase suivante est conditionnée par `!state.isGameOver`.

5. **Horloge de Tick Bornée & Dérive Temporelle (Anomalie 18)** :
   - `stepDt = Math.min(dt, Math.max(0, 100 - state.deadlineTimeSeconds))`.
   - Les compteurs `deadlineTimeSeconds` et `totalElapsedSeconds` sont avancés immédiatement au début du tick, avant toute transition de phase (révolution, raid, offre lombarde).
   - `consumedDt = stepDt` est exposé dans `TickResult`.
   - Si une deadline arrive à échéance pendant une phase de crise (hors `ACTIVE_CYCLE`), `state.pendingDeadlineAudit = true` est armé et l'audit est exécuté dès le retour en `ACTIVE_CYCLE` sans intégration économique supplémentaire.

6. **Expéditions, Cibles Déterministes & Brouillard de Guerre (§7.1 & §7.3)** :
   - Génération déterministe de `currentTarget` sur le flux `'combat'` à l'entrée en expédition : marge d'incertitude 0.45, biome, type de butin, fausse comptabilité (15% de chance, butin réduit de 60–80%) et embuscade (10% de chance, puissance ennemie +25%).
   - `RECON_PATROL` sacrifie 1 scout (`units.scout -= 1`, `totalPopulation -= 1`) et génère une nouvelle cible sur le flux `'combat'`.
   - Limite stricte de 2 campagnes par phase d'expédition (`campaignsLaunchedThisDeadline < 2`), avec régénération de cible après la 1ʳᵉ campagne et transition automatique vers `AWAIT_RESUME` à la 2ᵉ.

7. **Raids Surprises Spontanés (`SURPRISE_RAID`, §8.3)** :
   - En `ACTIVE_CYCLE`, dès D3+, si cooldown de 60s respecté et franchissement d'une tranche de 10s de deadline : tirage de probabilité $p$ sur le flux `'events'`.
   - Bascule immédiate vers `'SURPRISE_RAID'`.
   - `RESOLVE_RAID_DEFENSE` calcule la puissance de raid à 50% du quota militaire, prend en compte la défense passive des bastions de `provinceBiomes`, résout le combat avec salvage et retourne en `ACTIVE_CYCLE` si `!state.isGameOver`.

8. **Quotas en Débit Brut (`apRate`), Censure & Deadline 10 (§1.2 & §1.3)** :
   - Quotas renommés en `apRate` dans `balance.generated.ts` et `balance.ts` avec la table provisoire recalibrée `[5, 12, 22, 35, 55, 85, 130, 195, 285, 420]` AP/s.
   - `evaluateDeadlineAudit` évalue `grossApRate >= quota.apRate` via `calculateGrossApRate(state, config).total`. Un trésor gonflé (même à 50 000 AP) échoue sans débit de production, tandis qu'une dette négative avec un débit suffisant réussit.
   - Échec en Deadline 10 ou avec 1 strike existant $\to$ défaite immédiate `defeatReason = 'quota_failure'`.
   - Royal Censure : confisque 50% de l'AP positive uniquement (`if (state.ap > 0) state.ap -= state.ap * 0.5`) et retire la dernière entrée de `provinceBiomes`.
   - Avertissement à 50s : calcule `interimWarningOnTrack` selon la règle 2-sur-3 (AP, Pop, Militaire).
   - `RESUME_GOVERNANCE` rejette au-delà de Deadline 10.

9. **Prêt Lombard (Arbitrage 1.0 §11)** :
   - Dans `tick()`, la phase bascule en `'LOMBARD_OFFER'` uniquement si `state.lombardBailoutAvailable && state.provinces >= 2`. À 1 province, l'offre n'est pas présentée et la banqueroute intervient à l'épuisement du compte à rebours.

---

## 2. Vérification & Revue Indépendante

- **Suite de tests unitaires** : 156/156 tests passés sans régression (`vitest run`).
- **Nouveau fichier de test** : `src/__tests__/unit/military_threats_clock.spec.ts` (20 tests exhaustifs validant tous les cas limites et invariants).
- **Zéro `console.log` dans `src/`**.
- **Typage & Linters** :
  - `npx vue-tsc --build` : 0 erreur.
  - `npx oxlint .` : 0 warning, 0 erreur.
  - `npx eslint .` : 0 warning, 0 erreur.
- **Revue Indépendante** : Sous-agent `research` (Task 1.6 Reviewer) — rapport :
  - Invariants : **CONFORME** (population §3.1, trésor signé, révolution immédiate, déterminisme par `rngStreams`).
  - Actions techniques : **CONFORME**.
  - Intégration des 6 recommandations du relecteur :
    1. Assertion de `clash.unrestDelta === 20` et `state.unrest` $+20$ lors d'un effondrement défensif ;
    2. Test de saturation du plafond militaire où 100% des soldats capturés rejoignent `freeSerfs` ;
    3. Test d'intégration de la transition `COUNCIL_LAWS` $\to$ `THREAT_HERALD` initialisant automatiquement `currentThreatPower` et `currentThreatTributeAp` aux quotas de D3 ;
    4. Assertion de `state.interimWarningOnTrack` à 50s selon la règle 2-sur-3 ;
    5. Test du rejet de `RESUME_GOVERNANCE` avec `state.deadline = 10` ;
    6. Test de l'armement et de la résolution de `pendingDeadlineAudit` lors d'une transition de crise franchissant les 100s.
