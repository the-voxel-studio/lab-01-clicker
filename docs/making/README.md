# Design & Build Journal of the Core Engine (`docs/making/`)

This document records the work done during the first implementation pass of the Core engine (`src/core/`), the balance data (`src/data/`), and the test foundation (`src/__tests__/`) of **The Grand Audit (Lord Clicker)**, together with the audit diagnosis that led to the Technical Remediation Plan (archived outside the repository).

---

## 1. Initial Context & Problem Statement

When the initial audit compared the existing prototype with the reference specifications (`docs/GUIDE.md`, `docs/GAME_RULES.md`, `docs/PLAN.md`), several structural gaps were found:

1. **Missing key modules**:
   - No deterministic pseudo-random generator (`prng.ts`).
   - No module for asymmetric combat resolution (`battle.ts`).
   - No replay journal (`replay.ts`) and no state hash function.
   - No Base64 export/import module and no typed migrations (`migrations.ts`).
2. **Divergences in the economic engine (`engine.ts` & `commands.ts`)**:
   - Universal modifiers not wired to several derived statistics.
   - Omission of the 20% fiscal boycott penalty from 50 Unrest.
   - Risk of serf overexploitation between tax collectors (`collector`) and farmers general (`farmer_general`).
   - The simulation kept accumulating resources outside the `ACTIVE_CYCLE` phase.
3. **Duplicated formulas in `src/data/balance.ts`**:
   - `src/data/balance.ts` duplicated some formulas from `src/core/formulas.ts`.

---

## 2. Summary of the First-Pass Work ("What Is Actually in Place")

### 2.1. Core Modules Created (`src/core/`)

| File | Implemented Features | Identified Limits to Fix |
|---|---|---|
| [`src/core/prng.ts`](../../src/core/prng.ts) | Deterministic 32-bit Mulberry32 generator (`next()`, `nextBetween(min, max)`, `nextInt(min, max)`, `getState()`, `setState()`). | `prngState` not stored in `GameState` (ephemeral `new PRNG(...)` instances created on the fly); `this.state += 0x6d2b79f5` not truncated to 32 bits (`>>> 0`). |
| [`src/core/battle.ts`](../../src/core/battle.ts) | Asymmetric formula (offensive friction -10%, fortification +20%), *razor-thin* rule ($1.00 \le R \le 1.05$ without province gain), loot variety, scout mortality (`performScoutReroll`). | Losses applied only to `soldier` (sparing `man_at_arms` and officers); no `currentTarget` (fog of war, false ledgers, ambushes not wired); tribute non-blocking when AP is insufficient. |
| [`src/core/replay.ts`](../../src/core/replay.ts) | `ReplayJournal` structure timestamped by `timeSeconds` and FNV-1a hash `getStateHash()`. | Infinite loop as soon as a run passes $t = 100\text{s}$ (`AUDIT_ASSESSMENT`) or `LOMBARD_OFFER`, because `totalElapsedSeconds` freezes outside `ACTIVE_CYCLE`; partial hash ignoring units, serfs and modifiers. |
| [`src/core/migrations.ts`](../../src/core/migrations.ts) | Base64 export/import with the `GRA-v1:` prefix and the type guard `isSerializedSavePayload` without `any`. | Empty `MIGRATIONS` registry (initial `v1`); no rejection of future versions (`schemaVersion > CURRENT_SCHEMA_VERSION`) and shallow validation of the `state` sub-properties. |

### 2.2. Engine Corrections & Foundations (`engine.ts`, `commands.ts`, `modifiers.ts`, `formulas.ts`)

- **`composeStat` composition pipeline** ([`src/core/modifiers.ts`](../../src/core/modifiers.ts)):  
  Implementation of the order `add` $\to$ `addPct` $\to$ `mul` $\to$ `set` and of the dynamic resolvers typed by `ResolverKey`.
- **Fiscal boycott penalty & shared serf pool** ([`src/core/engine.ts`](../../src/core/engine.ts)):  
  Application of the $0.8$ multiplier on the capitation tax when `state.unrest >= 50`, and strict sharing of the `freeSerfs` pool between `farmer_general` and `collector`.
- **Simulation freeze outside `ACTIVE_CYCLE`** ([`src/core/engine.ts`](../../src/core/engine.ts)):  
  `tick()` returns immediately if `state.phase !== 'ACTIVE_CYCLE'`, which in particular pauses the bankruptcy countdown during `LOMBARD_OFFER`.
- **Commands & phase permissions** ([`src/core/phases.ts`](../../src/core/phases.ts), [`src/core/commands.ts`](../../src/core/commands.ts)):  
  `ALLOWED_COMMANDS_BY_PHASE` table and an `assertCommandAllowed(state.phase, command)` check before execution.

### 2.3. Organization of the Test Suite (`src/__tests__/`)

```
src/__tests__/
├── App.spec.ts                  # Mounting of the root Vue component
├── simulation/
│   ├── botRunner.ts             # Headless simulation runner
│   └── archetypeBots.spec.ts    # Tests of the 3 bots (reduced initial sample)
└── unit/
    ├── balance.spec.ts          # Constants, 24 units, biomes, threats
    ├── battle.spec.ts           # Asymmetric combat, friction, loot, scouts
    ├── engine.spec.ts           # Tick loop, 2-out-of-3 rule, bankruptcy, pardon
    ├── formulas.spec.ts         # Pure mathematics (costs, Buy Max, taxes)
    ├── migrations.spec.ts       # Base64 export/import GRA-v1:
    ├── modifiers.spec.ts        # Pipeline add -> addPct -> mul -> set
    ├── phases.spec.ts           # Inter-deadline transitions and permissions
    └── replay.spec.ts           # Reproducibility over 1 deadline (< 100s)
```

---

## 3. Lessons from the Cross-Audit (Documentation vs Code)

The deep audit of commit `f1d74fd` revealed why several validations seemed to pass while the engine still showed critical gaps relative to `GAME_RULES.md` and `PLAN.md`:

1. **Artificial bias in the Greedy Bot calibration (`seed % 2`)**:
   - In `botRunner.ts`, the cap on Barons bought by the Greedy Bot depended on the parity of the seed (`const maxBarons = state.seed % 2 === 0 ? 5 : 4`). Since 4 Barons capped the population below the Deadline 10 quota (2,152 < 2,200) and 5 Barons placed it above (2,242 > 2,200), the win rate of ~50% only reflected the proportion of even seeds, and not a true ROI computation nor a bisection solver for the coefficient $c$.
2. **Exploits on Emergency Edicts & Tribute**:
   - The edicts (`forced_tithe`, `church_seizure`, `grand_festival`) could be executed in a loop within the same tick, with no cooldown or limit, artificially inflating the AP quota.
   - Choosing to pay the tribute (`SELECT_THREAT_RESPONSE: 'tribute'`) without the required AP returned `success: false` but still advanced the phase out of `THREAT_HERALD`, cancelling the threat for free.
3. **Demographic Invariant & Incomplete Mechanics**:
   - The equation $\text{TotalPopulation} = \text{FreeSerfs} + \sum \text{Units}$ could be broken during overpopulation bleeds, defensive collapses, mass levies and `grant_units`.
   - Several rules of `GAME_RULES.md` (desertion at 75 to 89% Unrest, separation of `unrest_generation` / `unrest_pacification`, purge of `expiresAt`, immediate defeat on failure at Deadline 10, the `DISBAND_UNIT` command, side effects of Tier I/II units, surprise raids from D3, catalogs of the 30 laws and 20 dilemmas) remained to be implemented.

---

## 4. Current State & Next Step

| Technical Check | Status |
|---|:---:|
| **Type Checking (`vue-tsc --build`)** | ✅ 0 errors |
| **Linting (`oxlint` + `eslint`)** | ✅ 0 warnings, 0 errors |
| **Current Unit Tests (`npm run test:unit`)** | ✅ 156/156 |
| **Overall status of the V1 phase (Gates A to E)** | ✅ **Calibrated and frozen at Gate E, pending the final review** |

The V1 engine is calibrated and frozen at Gate E, pending the final review. All the remediation work on the Core engine, the Gate D data and the simulation suite is recorded in the remediation plans summarized in section 6 below, and reflected in [`docs/PLAN.md`](../PLAN.md). The next phase is V2 (UI), which starts once the final V1 review is complete.

---

## 5. Remediation Task Log

### Task 1.0: Rule Arbitrations & Documentation Alignment (`GAME_RULES.md`, `GUIDE.md`, `PLAN.md`)
- **Date**: 2026-10-13
- **Files modified**: `docs/GAME_RULES.md`, `docs/GUIDE.md`, `docs/PLAN.md`, `docs/making/README.md`
- **Content**: Recording and strict harmonization of the 14 arbitrations of the remediation plan:
  1. Immediate revolution at Unrest = 100 in any phase (not overwritten by later transitions).
  2. Cumulative desertion from 75% to 99% Unrest; *Sanctuary Rights* removes desertion below 90% only.
  3. AP quota as an instant gross debit (AP/s, `ApRateQuota`) at inspection; clicks and transfers excluded.
  4. Signed treasury: no reset of debt, solvency required for any costly choice (explicit exception: `DISBAND_UNIT` §14.1 allowed without AP, with +2 Unrest per unpaid unit).
  5. Threat herald: after audit $d$ ($2 \le d \le 9$), announces and resolves threat $d+1$; tribute = $20 \times \text{ApRateQuota}_{d+1}$ ($4 \times$ from deadline 8).
  6. Defeat by conquest: the 1-province floor does not protect against a military collapse (`conquest` defeat at 0 provinces).
  7. Neutral starting biome: `heartland` biome (3 starting provinces = 750 capacity); province loss in LIFO order.
  8. Bulk purchases: tiers as maximum purchase sizes (1, 10, 50, 100); validation of any integer quantity $\le$ max; Buy Max bounded by the maximum size.
  9. Defensive salvage: recovery formula $\text{round}(0.25 \times \text{TributeCost}_{\text{repelled threat}} \times \text{Roll}(0.8, 1.2))$ (d+1 for the herald, current deadline for a surprise raid) credited to `state.ap`.
  10. Soldier loot: soldiers captured beyond the military cap are returned to free serfs.
  11. Lombard loan: conditioned on `provinces >= 2`.
  12. Raids & Mercenaries: doubling if AP > 2000 generalized in §8.3; Mercenaries = tribute +25% only.
  13. Bootstrap click: 50 starting AP to recruit the first Scribe immediately; tutorial focused on the production rate.
  14. Save format: stable `GRA-v1:` prefix for the encoding format; `schemaVersion` in the payload for the schema.
  15. `PLAN.md` updated with the Task 1.0 checklist and a reminder of the numbering convention.
- **Status**: ✅ Validated by the user (documentation corrections integrated)

### Task 1.1: Architectural Cleanup, Persistent PRNG Streams (`rngStreams`) & Injectable Configuration (`EngineConfig`)
- **Date**: 2026-10-13
- **Files modified & created**: `src/core/prng.ts`, `src/core/types.ts`, `src/core/phases.ts`, `src/core/config.ts`, `src/data/balance.ts`, `src/core/state.ts`, `src/core/formulas.ts`, `src/core/engine.ts`, `src/core/commands.ts`, `src/core/battle.ts`, `src/__tests__/unit/prng.spec.ts`, `src/__tests__/unit/config.spec.ts`, `src/__tests__/unit/balance.spec.ts`
- **Content**:
  1. Breaking of the import cycle between `src/data/` and `src/core/`: types moved to `src/core/types.ts` and `src/core/phases.ts`; circular re-exports of formulas and modifiers removed from `balance.ts`.
  2. Strict 32-bit truncation of Mulberry32 in `prng.ts` via `(this.state + 0x6d2b79f5) >>> 0`.
  3. Isolated and persistent PRNG streams `RngStream` ('click' | 'combat' | 'events' | 'council'), `deriveStreamSeed` by 32-bit FNV-1a hashing, and the helper `withStatePrng`. All ad hoc `new PRNG(...)` calls in `src/core/` were purged.
  4. Injectable configuration `EngineConfig` and `DEFAULT_ENGINE_CONFIG` in `src/core/config.ts`. Injected into `tick`, `dispatch`, `evaluateDeadlineAudit`, `calculateUnitCost`, `calculateMaxAffordableUnits`. Decoupled `TAX_POLL_RATE`, `BASE_POP_GROWTH_RATE_R`, `OVERCROWDING_*`, `SERFS_PER_COLLECTOR`, `PROVINCE_MIN_FLOOR_FOR_FINES`.
  5. Fully deterministic initialization of `GameState` without `Math.random` or `Date.now` (`runId = run_${seed}`). Extended with 18 new fields, with 3 starting `heartland` provinces (capacity 750).
  6. Complete reset on `RESTART_RUN` and deep copy in `cloneGameState`.
- **Tests added**: 14 new tests (`src/__tests__/unit/prng.spec.ts` and `src/__tests__/unit/config.spec.ts`, extension of `balance.spec.ts`), 70/70 unit tests green (+ 5/5 bot simulation tests).
- **Correction patch: strict and exhaustive decoupling of EngineConfig (2026-10-14)**:
  1. Admitted and explicitly documented exception in `src/core/config.ts`: `createInitialGameState` in `state.ts`.
  2. Strict decoupling of all remaining constants in `src/core/`:
     - `src/core/formulas.ts`: `calculateLogisticGrowth` (`BASE_POP_GROWTH_RATE_R`, `STARTING_TAX_RATE`), `calculateHousingCapacity` (`BASE_HOUSING_PER_PROVINCE`), `calculateColonisationCost` (`COLONISATION_*`), `calculateCollectorYield` (`SERFS_PER_COLLECTOR`), `calculatePaperworkFriction` (`BUREAUCRACY_SCALE_S`), `calculateClickValue` (`CLICK_CRITICAL_MULTIPLIER`), `refillTokenBucket` (`CLICK_MAX_TOKENS_PER_SECOND`).
     - `src/core/commands.ts`: `handleBuyUnit`, `handleUnlockPatent` (`PATENT_*`), `handleSetTaxRate` (`TAX_SHOCK_*`, `TAX_PROMULGATION_DELAY_SECONDS`), `handleStampDocument` (`TAX_POLL_RATE`, `CLICK_*`), `handleColoniseProvince`, `handleEnactEdict` (`TAX_POLL_RATE`), `handleAcceptLombardLoan` (`PROVINCE_MIN_FLOOR_FOR_FINES`), and `SELECT_THREAT_RESPONSE` (`config.quotas`).
     - `src/core/battle.ts`: `calculateAttackerPower` (`ATTACKER_SIEGE_FRICTION`), `calculateDefenderPower` (`DEFENDER_FORTIFICATION_BONUS`, `BORDER_STRONGHOLD_DEFENSE_FLAT`), `resolveDefensiveClash` (`PROVINCE_MIN_FLOOR_FOR_FINES`), `resolveOffensiveCampaign`, `resolveScheduledThreat`.
     - `src/core/engine.ts`: systematic propagation of `config` to the formulas called in `tick()`.
  3. Guard and consistency tests added in `src/__tests__/unit/config.spec.ts`:
     - Static guard test: verifies that no occurrence of `BALANCE.` or `DEADLINE_QUOTAS` appears in `src/core/` outside `config.ts` and `state.ts`.
     - Consistency test: verifies that overriding `SERFS_PER_COLLECTOR` in `EngineConfig` immediately affects the collector yield in `tick()`.
- **Independent review**: critical review carried out. Strict decoupling verified: compliant, with no constant leak outside the admitted exceptions.
- **Status**: ✅ Completed & validated (compliant with the remediation plan).

### Task 1.2: Dual Composition of Unrest, Immediate Revolution, `expiresAt` Purge
- **Date**: 2026-10-14
- **Files modified & created**: `src/core/types.ts`, `src/core/mutations.ts`, `src/core/modifiers.ts`, `src/core/engine.ts`, `src/core/commands.ts`, `src/core/battle.ts`, `src/__tests__/unit/mutations.spec.ts`, `src/__tests__/unit/modifiers.spec.ts`
- **Content**:
  1. Split of `StatKey`: `'unrest_growth'` replaced by `'unrest_generation' | 'unrest_pacification'`, preventing any sign inversion during multiplicative reductions of pacification.
  2. Removal of the 3-argument overload of `composeStat` in `modifiers.ts`, which now systematically requires the stat key.
  3. Creation of `src/core/mutations.ts` with `triggerDefeat(state, reason)` (idempotent, sanctuarized) and `addUnrest(state, delta, config)` bounded to $[0, 100]$, with an immediate `revolution` defeat at 100.
  4. Exhaustive replacement of all direct mutations of `state.unrest` by calls to `addUnrest` (tax shocks, edicts, military resolutions, mass levy, simulation steps, instant effects).
  5. Sanctuarization of the defeat state in `dispatchCommand`: all post-action phase transitions are conditioned by `if (!state.isGameOver)`.
  6. Purge of expired modifiers at the very beginning of `tick()` (`mod.expiresAt > state.totalElapsedSeconds`).
  7. Separation of the generation and pacification of Unrest in `tick()`, computed separately via `composeStat` and summed in `addUnrest((composedGen - composedPac) * dt)`.
- **Tests added**: 6 tests in `src/__tests__/unit/mutations.spec.ts` (clamp, immediate revolution, regressions forced_tithe + 10 clergy and mass levy in THREAT_HERALD, dual composition, `expiresAt` purge). Rewrite of the tests at L40-44 of `modifiers.spec.ts`.
- **Independent review**: review carried out. All criteria, invariants and rules validated as COMPLIANT.
- **Status**: ✅ Completed & validated.

### Task 1.3: Demographic Invariant (§3.1), Signed Treasury, Overpopulation (§14.3) & Military Desertion (§6.5)
- **Date**: 2026-10-14
- **Files modified & created**: `src/core/types.ts`, `src/core/mutations.ts`, `src/core/engine.ts`, `src/core/modifiers.ts`, `src/core/battle.ts`, `src/__tests__/unit/demographics.spec.ts`, `src/__tests__/unit/modifiers.spec.ts`, `src/__tests__/unit/engine.spec.ts`
- **Content**:
  1. Demographic invariant helper `applyPopulationLoss(state, loss, isStarvation)` in `src/core/mutations.ts`: first deducts from `freeSerfs`, then cascades onto units following `POPULATION_LOSS_CASCADE_ORDER` (Tier I civilian -> Tier II civilian -> Tier I military -> Tier II military), reconciles `state.totalPopulation = state.freeSerfs + sum(units)`, and increments `starvationLosses` if `isStarvation`.
  2. Overpopulation (§14.3) in `src/core/engine.ts`: demographic bleed routed through `applyPopulationLoss(state, bleed, true)`, and a proportional Unrest $\min(1.0, 0.10 \times \frac{\text{initialExcessPop}}{50})$ integrated into `baseUnrestGen`.
  3. Cumulative military desertion (§6.5, arbitration 1.0 §2): active as soon as Unrest $\ge 75$ (except below 90% if `law:sanctuary_rights`), consumes 1 `soldier` every 15s or 1 `man_at_arms` every 30s, resets the timer to 0 without an eligible army or when desertion is inactive, and decrements `totalPopulation` and the deserting unit.
  4. Signed treasury and correction of `applyEffect` in `src/core/modifiers.ts`: removal of the `Math.max(0)` clamp on AP (debts preserved without undue quota credit), `grant_units` consumes `freeSerfs` or increments `totalPopulation` if `external: true`, negative `instant_resource: 'population'` routed through `applyPopulationLoss`.
  5. Securing of battles in `src/core/battle.ts`: defensive collapse and mass levy routed through `applyPopulationLoss`.
- **Tests added**: 16 new tests in `src/__tests__/unit/demographics.spec.ts`, 93/93 unit tests green (+ 5/5 bot simulation tests).
- **Independent review**: review carried out. COMPLIANT status on all 6 criteria and actions.
- **Status**: ✅ Completed & validated.

### Task 1.4: Emergency Edict Safeguards (§11), Demobilization (DISBAND_UNIT, §14.1) & Dynamic Taxation (§14.2)
- **Date**: 2026-10-14
- **Files modified & created**: `src/core/types.ts`, `src/core/phases.ts`, `src/core/engine.ts`, `src/core/commands.ts`, `src/__tests__/unit/phases.spec.ts`, `src/__tests__/unit/engine.spec.ts`, `src/__tests__/unit/edicts_disband.spec.ts`
- **Content**:
  1. Emergency edicts (`handleEnactEdict`, GAME_RULES §11):
     - Enforces at most one emergency edict per deadline (`state.lastEdictDeadline === state.deadline`).
     - Unrest and duration penalties increasing by $+50\%$ per prior use ($\text{mult} = 1 + 0.5 \times k$).
     - `forced_tithe`: adds $30 \times \text{pollTax}$ without touching the AP quotas, $+35 \times \text{mult}$ Unrest, and a 20s demographic freeze (`forcedTitheFreezeTimer = 20`, blocking `canGrow`).
     - `church_seizure`: strictly capped at 2 uses per run, adds $\max(300, 25 \times \text{Gross AP/s})$ without quota credit, a 50% pacification reduction expiring after $60 \times \text{mult}$ seconds, and $+10 \times \text{mult}$ Unrest.
     - `grand_festival`: dynamic cost $\max(100, 0.20 \times \max(0, \text{state.ap}), 30 \times \text{Gross AP/s})$, strict rejection if `state.ap < cost` (protects against erasing debt), and a pacification of $-20$ Unrest.
     - Counters and edict status updated only on success.
  2. Demobilization (`DISBAND_UNIT`, GAME_RULES §14.1):
     - Command `{ type: 'DISBAND_UNIT'; unitId: UnitId; count: number }` allowed in `ACTIVE_CYCLE` and `AWAIT_RESUME`.
     - Severance indemnity at $50\%$ of the base cost paid from the positive treasury; in case of insolvency, the discharge succeeds without blocking but inflicts $+2$ Unrest per unpaid unit.
     - One-for-one transfer to free serfs, strictly preserving the demographic invariant.
     - Military mutiny risk: if the volume demobilized over 10s exceeds $10\%$ of the active army before discharge, $+15$ Unrest (mutiny) and reset of the sliding history.
  3. Dynamic taxation (`handleSetTaxRate`, GAME_RULES §14.2):
     - Rejection of non-finite rates (`NaN`, infinity).
     - Decrease or maintenance applied immediately with no promulgation delay, cancelling any pending increase.
     - Increase with an 8s promulgation delay and a tax shock of $+20$ Unrest if the increase exceeds 15 points.
  4. Rewrite of the existing tests: `engine.spec.ts` L191 to 208 split into 4 distinct tests per deadline, plus a test for the rejection of a 2nd edict.
- **Tests added**: 12 new unit tests in `src/__tests__/unit/edicts_disband.spec.ts`, 124/124 unit tests green (+ 5/5 bot simulation tests).
- **Independent review**: review carried out. COMPLIANT status on all technical points and acceptance criteria.
- **Status**: ✅ Completed & validated.

### Task 1.5: Strict Input Validation (§1.5), Click Harmonization, Bulk Ceiling (§5.1), Buy Max & Order Caps
- **Date**: 2026-10-14
- **Files modified & created**: `src/core/types.ts`, `src/core/formulas.ts`, `src/core/engine.ts`, `src/core/commands.ts`, `src/__tests__/unit/validation_bulk.spec.ts`
- **Content**:
  1. Removal of the optional flag `isCritical?: boolean` from `STAMP_DOCUMENT` (`types.ts`). Critical roll purely deterministic through `withStatePrng(state, 'click', ...)` on the dedicated stream `state.rngStreams.click`.
  2. Wiring of `calculateGrossApRate` and `calculateNetPaperwork` in `handleStampDocument`: real-time gross production, `click_power` seal bonus, and a royal 50% mitigation of the net paperwork friction.
  3. Bulk purchase caps (`getMaxBulkSize`, GAME_RULES §5.1, arbitration 1.0 §8): tiers 1x (default), 10x (D3+ or Pop 250+), 50x (D6+ or Pop 1000+), 100x (D8+ and `allowsBulk100`). Strict rejection in `handleBuyUnit` if `count > maxBulk`.
  4. Revision of `calculateMaxAffordableUnits` (GAME_RULES §5.3): takes the `maxBulkSize` cap into account, `Math.floor` on `freeSerfs` and `orderHeadroom`, and a floating-point rounding compensation loop guaranteeing the universal property that `BUY_UNIT(affordable)` is always valid.
  5. Strict command validation (§1.5): `TICK` requires `dt > 0` and finite; `BUY_UNIT` requires `count` to be a positive integer; `dispatch` returns `{ success: false, error: 'Unsupported command' }` for unhandled commands instead of silently ignoring them.
  6. Harmonization of the engine helpers: export of `calculateMaxPopulation`, `calculateNetPaperwork`, `getBiomeModifiers` and `calculateGrossApRate` from `engine.ts`; `BUY_UNIT` and `tick()` strictly share the same capacity and friction calculations.
- **Tests added**: 12 new unit tests in `src/__tests__/unit/validation_bulk.spec.ts`, 136/136 unit tests green (+ 5/5 bot simulation tests).
- **Independent review**: review carried out. COMPLIANT status on all acceptance criteria, system invariants and game rules. The critical deterministic case was strengthened following the suggestions of the review.
- **Status**: ✅ Completed & validated.

### Task 1.6: Asymmetric Combat, Bounded Tick Clock, Gross-Rate Quotas (`apRate`), Surprise Raids & Herald D+1
- **Date**: 2026-10-14
- **Files modified & created**: `scripts/generate-balance-report.ts`, `src/data/balance.generated.ts`, `src/data/balance.ts`, `src/core/types.ts`, `src/core/phases.ts`, `src/core/battle.ts`, `src/core/engine.ts`, `src/core/commands.ts`, `src/core/modifiers.ts`, `src/__tests__/unit/balance.spec.ts`, `src/__tests__/unit/phases.spec.ts`, `src/__tests__/unit/military_threats_clock.spec.ts`, `src/__tests__/simulation/botRunner.ts`, `src/__tests__/simulation/archetypeBots.spec.ts`
- **Content**:
  1. Devastating defensive collapse & debt preservation (`battle.ts`): plunder of 30 to 50% preserving the signed debt without a final `Math.max` (e.g. -800 AP stays -800 AP); loss of a province without floor leads to a `conquest` defeat if provinces $\le 0$; 100% of the military order slaughtered; civilian losses of 15 to 25%; $+20$ Unrest.
  2. Military cap, campaign loot & defensive salvage (arbitrations 1.0 §9 to 10): no audit quota credit on campaign loot; captured soldiers capped at the order's military headroom (`orderCaps.military - currentMil`), the excess joining `freeSerfs` to strictly preserve the demographic invariant; defensive salvage on a repelled victory credited to the `'combat'` stream without affecting the audit counters.
  3. Herald of threats at D+1 (arbitration 1.0 §5): activated from D2 to D9 inclusive (8 threats resolved in a run); the transition automatically fills `currentThreatPower` and `currentThreatTributeAp`; direct reading in `SELECT_THREAT_RESPONSE` without an `'||'` fallback.
  4. Blocking tribute & mass levy (§8.2): refusal with `success: false` and no phase transition if `state.ap < currentThreatTributeAp`; mass levy applying 5% civilian losses and $+30$ Unrest, conditioned by `!state.isGameOver`.
  5. Bounded tick clock & time-step drift (anomaly 18): `stepDt = Math.min(dt, 100 - state.deadlineTimeSeconds)`; clock advanced immediately before any phase transition; `consumedDt = stepDt` exposed; arming of `pendingDeadlineAudit` when a deadline is crossed outside `ACTIVE_CYCLE`, executed as soon as the active cycle resumes.
  6. Deterministic expeditions & targets (§7.1, §7.3): deterministic generation of `currentTarget` on the `'combat'` stream with a 0.45 margin, biome, loot, false accounting (15%, -60 to -80% loot) and ambush (10%, +25% enemy strength); `RECON_PATROL` sacrifices 1 scout (`totalPopulation -= 1`); strict limit of 2 campaigns per expedition phase.
  7. Spontaneous surprise raids (`SURPRISE_RAID`, §8.3): deterministic triggering at every 10s step from D3 with a 60s cooldown, according to a probability $p$ on the `'events'` stream; `RESOLVE_RAID_DEFENSE` defending at 50% of the military quota with bastions and salvage.
  8. Instant gross AP-rate quotas (`apRate`, §1.2, §1.3): quotas renamed `apRate` in `balance.generated.ts` and `balance.ts` (`[5, 12, 22, 35, 55, 85, 130, 195, 285, 420]` AP/s); `evaluateDeadlineAudit` comparing `grossApRate >= quota.apRate`; a treasury inflated without debit is rejected; immediate defeat at D10 without strike; Royal Censure confiscating 50% of the positive AP only; warning at 50s according to the 2-out-of-3 rule; guard forbidding `RESUME_GOVERNANCE` beyond Deadline 10.
  9. Lombard loan (arbitration 1.0 §11): conditioned on `provinces >= 2` in `tick()`.
  10. Orphan cleanup: definitive removal of `COMBAT_RESOLUTION` and `RESOLVE_COMBAT`.
- **Tests added**: 20 new unit tests in `src/__tests__/unit/military_threats_clock.spec.ts`, 156/156 unit tests green.
- **Independent review**: review carried out. COMPLIANT status on all 10 technical actions, acceptance criteria and invariants. The 6 recommendations for strengthening the reviewer's tests were fully implemented and validated.
- **Status**: ✅ Completed & validated.

### Task 1.7: Multi-Deadline Replay Journal Rework (`replay.ts`) & Sequential Migration `v1 -> v2` (`migrations.ts`)
- **Date**: 2026-10-14
- **Files modified & created**: `src/core/replay.ts`, `src/core/migrations.ts`, `src/__tests__/unit/replay.spec.ts`, `src/__tests__/unit/migrations.spec.ts`
- **Content**:
  1. Elimination of the infinite loop in `executeReplay` (`replay.ts`):
     - Dispatch of inter-deadline and crisis commands allowed as soon as `entry.timeSeconds <= totalElapsedSeconds`, with a prior permission check via `isCommandAllowedInPhase`.
     - Safety net in out-of-cycle phases (`AUDIT_ASSESSMENT`, `COUNCIL_DILEMMA`, etc.): scan of the remaining commands via `sortedEntries.slice(nextEntryIndex).some(...)` and clean exit of the loop (`break`) if no command can get out of the current phase.
     - Immediate dispatch of the unblocking command if it is allowed in the current phase.
  2. Reinjection of the leftover `dt - consumedDt` and invariance of the step across multiple deadlines:
     - Storage of `leftoverDt` when the end-of-deadline truncations occur, with priority reinjection at the first tick after the cycle resumes.
     - Bounding of `stepDt = Math.min(stepDt, maxDurationSeconds - state.totalElapsedSeconds)` to avoid time overruns at the end of a run.
     - Handling of the optional `EngineConfig` parameter passed to `dispatch` and `tick`.
  3. Strengthening of `getStateHash(state)`:
     - The hash strictly includes the 15 required components: `deadline`, `phase`, `ap`, `totalPopulation`, `freeSerfs`, `milPower`, `provinces`, `provinceBiomes.join(',')`, `taxRate`, `unrest`, `strikes`, the 4 `rngStreams` flows, the 24 units sorted (`${id}:${count}`), `activeLaws.join(',')`, and the number of active modifiers.
  4. Sequential migration `v1 -> v2` & strict validation (`migrations.ts`):
     - `CURRENT_SCHEMA_VERSION = 2` and strict preservation of the stable envelope prefix `SAVE_PREFIX = 'GRA-v1:'`.
     - Pipeline `MIGRATIONS[1]` deterministically injecting the 4 `rngStreams` derived from `seed` via `deriveStreamSeed`, `provinceBiomes` (`heartland` $\times$ `provinces`), and all the new default properties of `GameState`.
     - Strict validation on import: rejection of future schemas (`schemaVersion > CURRENT_SCHEMA_VERSION`), of invalid versions (`< 1` or non-integer), and of payloads containing `NaN` or non-finite numbers.
- **Tests added**: 8 new unit tests (5 in `replay.spec.ts`, 3 in `migrations.spec.ts`), 164/164 unit tests green.
- **Independent review**: review carried out. COMPLIANT status on all acceptance criteria, invariants and documentary rules.
- **Status**: ✅ Completed & validated.

---

## 6. Remediation Plans 01 to 04 (2026-10-22 to 2026-10-25)

### Plan 01: Housekeeping (2026-10-22)
- The pending batch of Phase 1 and 2 engine work was committed as `fbf461e`, completing remediation phases 1 and 2 of the headless engine.
- Legacy documents were moved out of the repository (`3c61651`), so that later work starts from a clean base.
- Fast non-fixing checks (`lint:check`, `format:check`, `check`) were added and the simulation suite was bounded (`0654f25`): `test:sim` went from a hang of more than 20 minutes to 1.4 s.
- Prettier was applied once to the whole source tree (`6c53346`, 41 files, formatting only). Its scope is `src/`, `scripts/`, `e2e/` and the root `*.ts` files; Markdown documents are outside it.
- Verification: `npm run check` exits 0 (vue-tsc, oxlint, eslint, prettier, 211/211 vitest tests).

### Plan 02: Engine Integrity (2026-10-22 to 2026-10-23)
- The global tick stat cache was removed (`50ac988`), `composeStat` is called directly, and catalog modifiers are applied as relative time templates (`02184da`).
- Ticks run in whole steps of `FIXED_STEP_SECONDS = 0.05`, with the remainder carried in `tickRemainderSeconds` (`4fb6647`). Reason: forward Euler integration of population growth made results depend on the step size (240.51 vs 240.24 population at t = 205 s between dt 0.05 and 1.0), so the same hash at every step size was impossible. Game time and step-driven timers are snapped to the step grid, so the 8 s tax timer fires and the Lombard offer opens at exactly 20 s.
- Replays split at exact timestamps, with rejected entries reported, and the state hash covers the full state (`4fb6647`).
- Council and save integrity: the council can no longer deadlock, and drafted dilemmas and laws are enforced (`2632efc`, `2e0e241`). Imported saves are validated and migrated to schema 3 (`7cabf92`): absent fields receive defaults, present fields with a wrong shape are rejected.
- Peak population, victories and captured provinces are tracked (`3994dab`); the pause command, the fast-forward unlock and the restart seed derivation were added (`7921611`).
- Housing is rounded exactly (`b30b112`), and provinces and biomes are kept in a single list with a required campaign target biome (`6451c63`, `dfaed88`).

### Plan 03: Rules Completeness (2026-10-23 to 2026-10-24)
- Timed modifiers stay active for their full duration (`8f8cc03`). Before this fix, a modifier of duration d lasted d minus one step.
- Rule flags are stored as typed state in the game state (`6571def`, schema 4). The archive is split into an export envelope with meta progression, feats award and the edict catalog (`a313357`, schema 5).
- Every law, dilemma choice, faction trait, archive perk, feat and edict now has a measurable effect (`e097995`, `63d6e7e`, `3aab300`, `95ba3bd`, `a313357`), checked by a catalog coverage guard (`dfbc219`) covering 40 dilemma choices, 30 laws and 8 perks. The guard checks that an entry changes something, not that the effect is correct.
- Every engine balance number is read from `EngineConfig` (`293fc8a`, 191 injectability rows).
- The perceived enemy power band no longer centers on the real power (`bf0eb36`): the real power is drawn at a random position inside the band, so it cannot be read from the band's center. The band is floored at 0 (`83fcf6c`, which also applied a missing law upside and corrected the perk caps).
- Verification: `npm run check` passes on 25 files and 666 unit tests; `test:sim` shows 3 passed and 2 expected failures.

### Plan 04: Simulation Freeze
- The law slot count goes through a typed `law_slots` stat (`da26748`). The Sixth Law Slot perk adds one slot instead of a sentinel modifier found by its source string, and `LAW_SLOTS_EXTENDED` is removed.
- The biased bots were replaced by one file per bot: random, greedy ROI, bureaucrat and conqueror (`cd4ccd7`). The seed-based Baron cap is removed, and the bots are guarded against reading the seed, hidden target fields or the game PRNG streams. Modifiers are composed in every cost and cap check.
- Type checking now covers every spec and script (`31594f4`).
- The deadline quotas are derived from a quota-blind Greedy bot through a solver (`9d8fe0d`), replacing the hand-tuned table. Reason: a fixed point on the quota-aware Greedy bot did not converge. The solved coefficient is $c = 1.03125$, bisected on validation seeds; validation win rates are Random 0%, Greedy 56%, Bureaucrat 100%, Conqueror 96%. After the dilemma fixes of `7856ba5` the solver was rerun: $c = 1.0313$, Greedy 57%.
- Sensitivity and dominance suites (`fc2acdd`): the Greedy win rate stays within 0.20 of the 0.40 baseline when the growth rate, the cost ratios or the poll tax rate is scaled by 0.9 or 1.1 (variants 0.30 to 0.58 on 50 seeds). `7856ba5` moved the suite to 100 seeds (40001 to 40100) in four files: baseline 0.49, and the tier I cost ratio growth $\times 1.1$ variant (0.28, gap 0.21) is a known `it.fails` balance follow up. No unit exceeds 60% of the spending after 300 s (largest share 33.6%).
- Step size invariance suite (`ed4bd9e`): 20 full Greedy runs give identical state hashes at dt 0.05 and dt 1.0, and `scripts/repl.ts` (`repl` script) plays one command per stdin line.

### After the Gate E freeze
- A deadline reached during a surprise raid or a Lombard offer is now audited as soon as the crisis resolves, so no command applies between the deadline and the audit; the simulation runner no longer journals a zero time tick for it. Accepting the Lombard loan restores the full composed bankruptcy grace (Audit Chambers, Chancery Red Tape) instead of the base 30 seconds, like the other grace resets. The solver rerun kept $c = 1.0313$ and moved three quota cells by one unit (D4 AP rate 54, D9 population 3,484, D10 population 6,363); validation Greedy 56%, Conqueror 95%.
- Balance pass: a study showed that the opening deadlines have almost no spread across seeds, so a full $c$ turned them into a cliff (a step of 0.005 in $c$ cost the Greedy bot 28 points, every run losing its pardon at deadline 1). Deadline 1 is now the floor of its medians and $c$ is weighted 0.9 and 0.95 at deadlines 2 and 3; lowering the tier I cost ratio instead made the solver fail or the gap worse. The tributes of threats 8 to 10 ask 4 seconds of the AP rate quota instead of 20 (11,744 AP at deadline 10, against 55,680 in the previous table), since a flat cut drained the treasury at the early heralds. Solver: $c = 1.0875$, validation Random 0%, Greedy 55%, Bureaucrat 100%, Conqueror 84%; sensitivity baseline 0.43, worst gap 0.10, and the tier I $\times 1.1$ `it.fails` is removed.
