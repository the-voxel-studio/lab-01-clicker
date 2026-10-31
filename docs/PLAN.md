# The Grand Audit (Le Grand Audit): Product Roadmap

> **Product Roadmap: Phases, Gates & Architecture**  
> Phased roadmap for implementing the complete game from decoupled headless engine core to automated bot simulations, UI components, audio, and single-file distribution.

---

## 1. Project Overview & Strategy

- **Current State:** The repository contains the complete visual design system, typography, audio assets, a curated typed SVG icon dictionary (`src/data/icons.ts`), and an exploratory UX prototype sandbox (`GameMockup.vue`, 1998 lines).
- **Architecture Strategy:** The project is strictly divided into two distinct development phases:
  - **V1 (Complete Headless Engine & Simulation):** Pure TypeScript engine (`src/core/`), master balance single source of truth (`src/data/balance.ts`), generated quotas (`src/data/balance.generated.ts`), 24 units in Gate A (`UNITS_DATA`), minimal run core in Gate A, versioned migrations (`zero any`), single dispatch command API (`dispatch(Command)`), finite state machine (`RunPhase`), 3 automated bot tiers with dynamic quota derivation ($c \times \text{MedianBot}$), sensitivity tests, and a CLI REPL.
  - **V2 (Playability & Presentation):** Pinia stores, Web Audio API engine, modular Vue 3 presentation components (< 200 lines), FTUE contextual tutorial, Playwright E2E tests, and single-file build (`dist/index.html`).
- **Prototyping Clarification:** The existing `GameMockup.vue` serves solely as a visual design proof-of-concept and UX ergonomics sandbox. In Phase V2, it will be retired and decomposed into clean, modular atomic components (< 200 lines each) connected to Pinia stores.
- **Strict Quality Rule:** **Zero production game UI components (`src/components/game/`) or store bindings will be implemented before the headless engine core (`src/core/`) is verified and frozen.**

---

## 2. Directory Structure Roadmap

```
lab-01-clicker/
├── docs/                                  # All project documentation
│   ├── GUIDE.md                           # Master technical & game systems guide
│   ├── PLAN.md                            # This implementation roadmap
│   ├── GAME_RULES.md                      # Game balance and systems specifications
│   ├── archive/
│   │   └── GDD_POC_OBSOLETE.md            # Archived legacy PoC design document
│   ├── VUE_BEST_PRACTICES.md              # Frontend architecture standards
│   ├── AUDIO_BEST_PRACTICES.md            # Web Audio API architecture
│   ├── ASSETS.md                          # SVG, font, and audio packaging
│   ├── making/
│   │   └── README.md                      # Engineering post-mortem & overhaul journal
│   └── INDEX.md                           # Documentation directory index
├── scripts/                               # CLI & BALANCE AUTOMATION TOOLS
│   ├── repl.ts                            # Interactive command-line REPL for the headless engine
│   └── generate-balance-report.ts         # Automated bot balance report, quota solver & sensitivity analysis
├── src/
│   ├── core/                              # PURE TYPESCRIPT HEADLESS ENGINE (Zero Vue/DOM)
│   │   ├── types.ts                       # Domain types, interfaces, enums
│   │   ├── modifiers.ts                   # Universal modifier engine, dynamic resolvers & composeStat
│   │   ├── commands.ts                    # Single command dispatch API (dispatch(Command))
│   │   ├── phases.ts                      # RunPhase state machine & command permissions
│   │   ├── prng.ts                        # Mulberry32 deterministic PRNG
│   │   ├── formulas.ts                    # Math models (clicks, bulk cost, paperwork, unrest)
│   │   ├── state.ts                       # State factory, save serializer, Base64 import/export
│   │   ├── migrations.ts                  # Strictly typed save migrations (unknown, zero any)
│   │   ├── battle.ts                      # Tactical campaign resolver, fog of war, scout rerolls
│   │   ├── config.ts                      # Injectable EngineConfig (balance constants and quotas)
│   │   ├── replay.ts                      # Replay journal and state hash
│   │   ├── mutations.ts                   # Unrest, defeat and population loss helpers
│   │   ├── rules.ts                       # Typed rule flags
│   │   ├── provinces.ts                   # Province list and housing base
│   │   ├── archives.ts                    # Meta-progression: perks, feats award, run conclusion
│   │   ├── validation.ts                  # Save state validation
│   │   └── engine.ts                      # Delta-time simulation loop (20 Hz in UI, 1-2 Hz in sim) & auditor
│   ├── data/                              # MASTER BALANCE & GAME CATALOGS
│   │   ├── balance.ts                     # Single source of truth for economics, curves, constants & the 24 unit definitions (UNITS_DATA)
│   │   ├── balance.generated.ts           # Auto-generated calibrated deadline quotas
│   │   ├── icons.ts                       # Curated typed SVGs dictionary
│   │   ├── laws.ts                        # 30 laws (10 Chancellor, 10 Prelate, 10 Marshal) [Gate D]
│   │   ├── dilemmas.ts                    # 20 Steward dilemmas with triggers & multi-choice outcomes [Gate D]
│   │   ├── threats.ts                     # Crown threats (Deadlines 3-10) & reactive factions [Gate D]
│   │   ├── biomes.ts                      # 5 province biomes (Heartland, Farmlands, Trade Hub, Stronghold, Wilderness) [Gate D]
│   │   ├── edicts.ts                      # 3 emergency executive edicts [Gate D]
│   │   ├── archives.ts                    # 8 persistent National Archive perks [Gate D]
│   │   └── feats.ts                       # 8 royal achievements [Gate D]
│   ├── audio/                             # WEB AUDIO API ENGINE [V2]
│   │   ├── audioContext.ts                # Autoplay unlock lifecycle & visibility pause
│   │   ├── audioGraph.ts                  # Master, SFX, and Music sub-mix buses
│   │   └── soundManager.ts                # Voice stealing, pitch variance (±5%), soundtrack cross-fade
│   ├── stores/                            # PINIA REACTIVE BRIDGE [V2]
│   │   ├── game.ts                        # Main game store bridging UI to src/core/engine.ts
│   │   ├── archives.ts                    # Meta-progression store (persistent in localStorage)
│   │   └── settings.ts                    # Audio volume, font mode, fast-forward toggles
│   ├── components/                        # ATOMIC PRESENTATION COMPONENTS [V2] (< 200 lines each)
│   │   ├── common/
│   │   │   ├── GameIcon.vue               # Typed SVG icon renderer
│   │   │   ├── AudioToggle.vue            # Sound mute and volume slider
│   │   │   └── FontToggle.vue             # Grimoire vs Modern Ledger font switch
│   │   ├── layout/
│   │   │   ├── GameHeader.vue             # Top bar: Deadline banner, timer, pause & 2x toggle
│   │   │   ├── QuotaBar.vue               # 3 Crown quota tracks with accessible badges
│   │   │   ├── DiscontentMeter.vue        # Unrest gauge & escalation status
│   │   │   └── BottomNavigation.vue       # Orders, Ledger, Laws, Archives tabs
│   │   ├── ledger/
│   │   │   ├── RoyalSealButton.vue        # Click decree stamping with wax seal particles
│   │   │   ├── TreasuryReadout.vue        # AP treasury, net AP/s, upkeep breakdown
│   │   │   ├── TaxSlider.vue              # Tax slider with 8s promulgation delay
│   │   │   └── EmergencyEdicts.vue        # Forced Tithe, Church Seizure, Grand Festival
│   │   ├── orders/
│   │   │   ├── OrderTabs.vue              # The People, Administration, The Military selector
│   │   │   ├── BulkBuySelector.vue        # 1x, 10x, 50x, 100x, Buy Max toggles
│   │   │   ├── RoleCard.vue               # Atomic unit card with cost, upkeep, head count
│   │   │   └── TierPatentBanner.vue       # Royal patent purchase banner for Tier II unlock
│   │   ├── modals/
│   │   │   ├── CouncilLawModal.vue        # 3 law cards selection or Reject All
│   │   │   ├── StewardDilemmaModal.vue    # Interactive narrative dilemma modal
│   │   │   ├── ThreatHeraldModal.vue      # Threat announcement & 3 response options
│   │   │   ├── TacticalBattleModal.vue    # Campaign planning, scout rerolls, clash outcome
│   │   │   ├── LombardLoanModal.vue       # Urgent bankruptcy bailout modal
│   │   │   ├── AuditVerdictModal.vue      # End of deadline results & royal censure
│   │   │   └── GameOverModal.vue          # Victory / Defeat screen with dynastic title
│   │   └── archives/
│   │       ├── ArchivePerksList.vue       # Persistent meta-progression perk tree
│   │       └── FeatsList.vue              # 8 achievements showcase
│   └── __tests__/
│       ├── unit/                          # Unit tests for core formulas & state [V1]
│       │   ├── formulas.spec.ts           # Math formulas (costs, yield, paperwork, unrest)
│       │   ├── battle.spec.ts             # Battle clash resolver & scout mortality
│       │   ├── modifiers.spec.ts          # Universal modifier composition & expiration
│       │   ├── phases.spec.ts             # State machine & phase command permissions
│       │   ├── replay.spec.ts             # Full deterministic replay journal validation
│       │   ├── migrations.spec.ts         # Strictly typed save migrations
│       │   └── engine.spec.ts             # Delta-time tick loop, commands & state transitions
│       └── simulation/
│           ├── botRunner.ts               # Entry point of the simulation runner and the bots (bots/)
│           ├── archetypeBots.spec.ts      # Bot skill gradient and Greedy win rate band [V1]
│           ├── sensitivity.{growth,tax,tier1,tier2}.spec.ts  # +/-10% sensitivity of the Greedy win rate, shared body sensitivitySuite.ts [V1]
│           ├── dominanceSuite.ts          # Shared dominance checks (spending share, role coverage)
│           ├── dominance.bureaucrat.spec.ts / dominance.conqueror.spec.ts  # Per archetype dominance [V1]
│           └── stepSize.spec.ts           # Step size invariance on 20 Greedy runs [V1]
```

---

## 3. Two-Phase Delivery Architecture (V1 vs V2)

```
========================================================================================
PHASE V1: COMPLETE ENGINE, HEADLESS & SIMULATION (Gates A through E)
[Strict Rule: Zero UI / presentation component dev until Gate E is complete & frozen]
========================================================================================
Gate A: Core Economy, 24 Units & Minimal Run Validation
   │     - Formulas, Modifiers, Tiers I & II, Biomes, 24-Unit Catalog (src/data/units.ts)
   │     - Minimal Run Core: state factory, unconstrained economic dispatch, tick integration,
   │       tax promulgation delay (8s), unrest model, 2-out-of-3 deadline quota audit
   │     - Greedy ROI Bot v0 & provisional c solver on pure economy (no laws/dilemmas)
   │     - Exit Criterion: Quotas generated, 35-65% win rate band reached, zero deadline cliffs
   ▼
Gate B: Complete Run Loop, State Machine & Determinism
   │     - Configurable tick (20 Hz UI, 1-2 Hz headless sim) & step-invariance testing (Δt = 0.05 vs 0.5 vs 1.0s)
   │     - Complete RunPhase FSM (6 inter-deadline steps + active cycle + crises)
   │     - LOMBARD_OFFER with bankruptcy timer paused during this phase
   │     - In-run interimWarningShown state flag at t = 50s without phase interruption
   │     - Single command dispatch API dispatch(Command) & phase permissions table
   │     - Replay journal { seed, entries: [{ timeSeconds, command }] } indexed by game seconds
   │     - Versioned save system with sequential typed migrations (unknown, zero any)
   ▼
Gate C: Asymmetric Combat & Dynamic Threats
   │     - Asymmetric combat model (Attacker -10% friction vs Defender +20% fortification)
   │     - Razor-thin victory rule (≤ 5% margin to no province awarded), Province Floor = 1
   │     - Dynamic threats & tributes calculated on the fly (0.8 mil quota, 0.2 AP quota)
   │     - Reactive surprise border raids & adaptive factions
   ▼
Gate D: Complete Narrative & System Content (30 Laws, 20 Dilemmas, Biomes, Edicts, Charters)
   │     - Dynamic conditional modifiers via strongly typed ResolverKey (zero serialized functions)
   │     - grant_units and archive_points effect evaluators
   ▼
Gate E: Full Simulation, Final Calibration & Engine Freeze
   │     - 3 Autonomous Bots: Random (< 5%), Greedy ROI (35-65%), Archetype Experts (> 65%)
   │     - Final c calibration on 200 fixed seeds, validation on 100 seeds
   │     - Dominance test suite per archetype build (after Deadline 3)
   │     - Sensitivity analysis ±10%, interactive CLI REPL
   ▼  [CORE ENGINE CODE FROZEN & VERIFIED]
========================================================================================
PHASE V2: PLAYABILITY & PRESENTATION
========================================================================================
   - Pinia integration (reactive stores bridging to engine.ts)
   - Web Audio API engine (Master/SFX/Music buses, polyphony limit, streaming)
   - Modular Vue 3 components (< 200 lines) & accessible HUD gauges
   - Contextual FTUE progressive onboarding
   - Playwright E2E cross-browser tests
   - Standalone single-file bundle (dist/index.html)
```

---

## 4. Detailed Deliverables

### Phase V1: Headless Engine Core & Systems (`src/core/`)

#### Gate A: Core Economy, 24 Units & Minimal Run Validation
- **Task 1.1: Master Balance Single Source of Truth (`src/data/balance.ts` & `src/data/balance.generated.ts`) [V1]**
  - Centralize base constants, dual-tier geometric scaling ratios ($1.07$ / $1.05$), logistic growth $r_0 = 0.005$, base housing $250$/province, colonisation cost ($1500 \times 2^k$), continuous collector yields (`freeSerfs / 100`), biome multipliers, and dynamic threat helpers.
  - Expose unrest as dual `'unrest_generation' | 'unrest_pacification'` stat keys to prevent sign inversion on multiplicative modifiers (`GAME_RULES.md §6.5`).
  - Define a `DISBAND_UNIT` command contract, allowed in `ACTIVE_CYCLE` and `AWAIT_RESUME`.
  - Keep engine types (`Command`, `RunPhase`, `Effect`, `Modifier`) in `src/core/types.ts` so that `src/data/balance.ts` and `src/core/{formulas,modifiers}.ts` have no circular import.
  - Provide an injectable `EngineConfig` (`balance` constants + `quotas`, default `DEFAULT_ENGINE_CONFIG`, never serialized) passed to `tick`, `dispatch` and `evaluateDeadlineAudit`, so the Gate E solver and sensitivity tests can vary quotas, $r_0$, cost ratios and poll tax without rewriting source files.
  - Include the neutral `heartland` biome in `BiomeId` / `BIOMES_DATA` (no bonus) so the 3 starting provinces keep the 750 starting capacity.
  - Test in `src/__tests__/unit/balance.spec.ts`, including strict quota monotonicity across Deadlines 1-10.
- **Task 1.2: 24 Units Catalog & Secondary Role Mechanics (`src/data/balance.ts` - `UNITS_DATA`) [V1]**
  - Declare all 24 unit definitions (8 People, 8 Administration, 8 Military across Tier I & Tier II) in `UNITS_DATA`.
  - Wire all secondary unit mechanics specified in `GAME_RULES.md §4`:
    - `prelate`: $-20\%$ tax unrest generation per Prelate (capped at $-80\%$).
    - `audit_chamber`: $+10\text{s}$ per unit to bankruptcy grace countdown ceiling.
    - `captain`: $-5\%$ combat casualty rate per Captain (down to minimum floor).
    - `sergeant`: $+2\%$ campaign battle loot value per Sergeant.
    - `guild`: $+1\%$ AP from campaign plunder per Guild.
    - `man_at_arms`: $+0.5$ flat passive defense per Man-at-Arms in defensive battles.
    - `scout` & `spymaster`: $-12$ and $-30$ percentage points to enemy power fog-of-war uncertainty margin $M$ (floor $\pm 5\%$), plus `spymaster >= 1` revealing `isFalseLedger` and `isAmbush`.
- **Task 1.3: Core Mathematical Models & Ergonomic Clicker (`src/core/formulas.ts`) [V1]**
  - Deterministic **Token Bucket clicker** (12 tokens/sec refilled via injected tick delta-time).
  - Dual-tier geometric cost scaling, logistic growth, civil colonisation cost ($1500 \times 2^k$), continuous collector yield, and paperwork inertia ($S=220$).
  - `calculateMaxAffordableUnits` uses `Math.floor(freeSerfs)` and `Math.floor(orderHeadroom)` so Buy Max never returns fractional unit counts.
  - Proportional overcrowding unrest formula from `GAME_RULES.md §14.3`: $+0.10\text{ Unrest/s}$ per 50 excess inhabitants, capped at $+1.0\text{ Unrest/s}$.
  - `getMaxBulkSize(deadline, totalPopulation, def)` returns the **maximum** allowed purchase count (`GAME_RULES.md §5.1`: 1, then $\le 10$ at D3 or $\ge 250$ Pop, $\le 50$ at D6 or $\ge 1,000$ Pop, $\le 100$ at D8 for `peasant` and `scribe` only); `BUY_UNIT` rejects any `count` above it and Buy Max is capped by it.
  - A Buy Max count is always accepted by `BUY_UNIT`: decrement $K$ while `calculateUnitCost(unitId, n, K) > availableAp`.
- **Task 1.4: Universal Modifier Engine (`src/core/modifiers.ts`) [V1]**
  - `composeStat(statKey, baseValue, modifiers, rawState)` supports `add`, `addPct`, `mul`, `set` and strongly typed `ResolverKey`, and always requires `statKey: StatKey`.
  - Purge expired temporary modifiers (`mod.expiresAt !== undefined && mod.expiresAt <= state.totalElapsedSeconds`) at the start of every `tick()`.
  - `applyEffect` for `grant_units` (and `instant_resource: 'population'`) strictly preserves the §3.1 Population Balance Equation (`totalPopulation === freeSerfs + sum(units)`).
  - `instant_resource: 'ap'` is never clamped to 0 (debt is preserved and unaffordable costs are never free), and effect AP is not credited to the AP quota; costs are validated upstream by `canAffordEffects`.
- **Task 1.5: Minimal Run Core Engine (`src/core/state.ts`, `src/core/commands.ts`, `src/core/engine.ts`) [V1]**
  - Initial state factory (50 AP, 100 Pop, 3 Provinces = 750 Cap, 25% Tax, 10 Unrest) and basic tick loop.
  - Enforce the §3.1 **Population Balance Equation** (`totalPopulation === freeSerfs + sum(units)`) across overcrowding bleed, defensive collapse, levy en masse, and unit grants via a shared demographic mutation helper.
  - Compose dual `unrest_generation` and `unrest_pacification` in `tick()`.
  - Route every Unrest mutation through `addUnrest(state, delta)` (`src/core/mutations.ts`) so reaching 100 triggers the `revolution` defeat immediately in any phase, and never overwrite `RUN_DEFEAT` with a later phase transition.
  - Cumulative military desertion from 75% to 99% Unrest (1 `soldier` every 15s, or 1 `man_at_arms` every 30s if 0 `soldier` remain; *Sanctuary Rights* only blocks it below 90%), resetting the persisted `desertionTimer` when no eligible unit exists.
  - Advance the deadline clock by the integrated step before any mid-tick phase switch (`LOMBARD_OFFER`, `SURPRISE_RAID`, defeat), defer the audit with `pendingDeadlineAudit` if needed, and expose `consumedDt` in `TickResult`.
  - Only offer `LOMBARD_OFFER` when `provinces >= 2`.
  - Share `calculateGrossApRate(state)`, `calculateNetPaperwork(state)`, and `calculateMaxPopulation(state)` helpers so `STAMP_DOCUMENT`, `BUY_UNIT`, and `tick()` evaluate identical composed stats.
  - `SET_TAX_RATE` validates `Number.isFinite(rate)`, applies **downward** adjustments (`targetRate <= currentRate`) **immediately** (0s delay), and applies the 8s promulgation delay only to **upward** adjustments (`GAME_RULES.md §14.2`).
  - Validate all command inputs: reject `dt <= 0` or `!Number.isFinite(dt)` in `TICK`, reject non-integer `count` in `BUY_UNIT`, expose no `isCritical` override on `STAMP_DOCUMENT` (use the persisted `rngStreams.click` stream), and return `{ success: false }` on unhandled commands.
  - `evaluateDeadlineAudit`: failing **Deadline 10** causes immediate defeat (`quota_failure`) even with 0 strikes; Royal Censure fine applies only to positive AP ($0.50 \times \max(0, \text{ap})$).
  - **AP quota as an instantaneous gross rate:** `DeadlineQuota.apRate` (AP/s) is evaluated as `apMet = calculateGrossApRate(state).total >= quota.apRate` at inspection (clicks and capital transfers do not count). The quotas are the solver table of `balance.generated.ts` (AP/s `11, 21, 33, 57, 149, 275, 507, 935, 1724, 3180` since the balance follow ups); tribute is $20 \times \text{ApRateQuota}$, $4 \times$ from deadline 8 (same amounts as the GAME_RULES §8.1 table).
  - Compute `interimWarningOnTrack: boolean` at $t = 50\text{s}$ using the 2-out-of-3 rule (`GAME_RULES.md §1.3`), comparing the current gross AP rate to `apRate`.
  - Enforce all **Emergency Edict safeguards** (`GAME_RULES.md §11`): max 1 edict per deadline, $+50\%$ escalating penalty per prior use, zero AP quota credit, 20s pop growth freeze on `forced_tithe`, max 2 uses per run & $\max(300, 25 \times \text{Gross AP/s})$ & `unrest_pacification` $\times 0.5$ + 10 Unrest on `church_seizure`, and $\max(100, 0.20 \times \text{ap}, 30 \times \text{Gross AP/s})$ cost check on `grand_festival`.
  - `DISBAND_UNIT` command (`GAME_RULES.md §14.1`): return to `freeSerfs`, $50\%$ base cost severance, $+2$ Unrest per unpaid unit if AP insufficient, $+15$ Unrest mutiny spike if $>10\%$ military disbanded within 10s.
  - `RESTART_RUN` resets all state properties (`clickTokens`, `rngStreams`, threat fields, timers, counters), derives `runId` deterministically from `seed`, and preserves `dt` overflow across the 100s deadline boundary.
- **Task 1.6: Early Economic Validation (Greedy ROI Bot v0 & Provisional $c$ Solver) (`scripts/generate-balance-report.ts`) [V1]**
  - Greedy ROI Bot evaluates marginal payback across AP, Population, and Military, with no seed parity shortcut.
  - Run a bisection solver on coefficient $c$ over 200 fixed seeds and generate `src/data/balance.generated.ts`.

#### Gate B: Complete Run Loop, State Machine & Determinism
- **Task 1.7: Deterministic PRNG (`src/core/prng.ts` & `src/core/state.ts`) [V1]**
  - Mulberry32 algorithm with `next()`, `nextBetween()`, `nextInt()`, `getState()`, `setState()`.
  - `this.state = (this.state + 0x6d2b79f5) >>> 0` stays unsigned 32-bit in `prng.ts`.
  - Persist independent PRNG streams `rngStreams: Record<'click' | 'combat' | 'events' | 'council', number>` in `GameState` (seeded via `deriveStreamSeed(seed, stream)`) and route all random rolls through `withStatePrng(state, stream, fn)`, so clicking cannot shift raid or battle outcomes.
- **Task 1.8: RunPhase State Machine & Command Permissions (`src/core/phases.ts`) [V1]**
  - `RunPhase` union, inter-deadline progression (`getNextInterDeadlinePhase`), and `assertCommandAllowed(phase, command)`, tested in `src/__tests__/unit/phases.spec.ts`.
  - `DISBAND_UNIT` is allowed in `ACTIVE_CYCLE` and `AWAIT_RESUME` in `ALLOWED_COMMANDS_BY_PHASE`.
  - `SURPRISE_RAID` transitions are wired from `tick()`, and `COMBAT_RESOLUTION` was removed.
- **Task 1.9: Constrained Command Dispatch API (`src/core/commands.ts`) [V1]**
  - Enforce phase permissions via `assertCommandAllowed(state.phase, command)`.
  - `SELECT_THREAT_RESPONSE`: if `'tribute'` fails (`state.ap < tributeAp`), `state.phase` does not advance out of `THREAT_HERALD` (`GAME_RULES.md §8.2`).
  - Allow up to 2 voluntary campaigns in `EXPEDITION` (`campaignsLaunchedThisDeadline < 2`) before transitioning to `AWAIT_RESUME`.
  - `RESUME_GOVERNANCE` never lets `deadline` exceed 10.
  - Threat Herald: after the audit of deadline $d$ ($2 \le d \le 9$), announce and resolve the threat of deadline $d+1$ (populating `currentThreatPower` / `currentThreatTributeAp`), so all 8 threats D3-D10 are reachable.
  - Return `{ success: false }` for orphan commands (`RESOLVE_COMBAT`).
- **Task 1.10: Versioned Save State & Typed Migrations (`src/core/migrations.ts`) [V1]**
  - Base64 clipboard export/import with integrity prefix `GRA-v1:` and zero `any`.
  - Reject future save schemas (`schemaVersion > CURRENT_SCHEMA_VERSION`) and validate core `GameState` properties against `NaN` / malformed types.
  - `CURRENT_SCHEMA_VERSION` is `5`, with sequential migrations `1 -> 2 -> 3 -> 4 -> 5` (the first populates all new `GameState` fields from `v1-save.json`), verified in `src/__tests__/unit/migrations.spec.ts`.
- **Task 1.11: Replay Journal & Step-Size Invariance Test (`src/core/replay.ts` & `src/__tests__/unit/replay.spec.ts`) [V1]**
  - `ReplayJournal` executes commands dispatched during paused inter-deadline/crisis phases (`AUDIT_ASSESSMENT`, `COUNCIL_DILEMMA`, `COUNCIL_LAWS`, `THREAT_HERALD`, `EXPEDITION`, `AWAIT_RESUME`, `LOMBARD_OFFER`, `SURPRISE_RAID`) deterministically, without an infinite loop when `totalElapsedSeconds` is frozen.
  - `getStateHash(state)` hashes `freeSerfs`, `taxRate`, `units`, `activeLaws`, `activeModifiers`, `phase`, and all `rngStreams`.
  - Validate determinism and step-size invariance ($\Delta t = 0.05\text{s}$, $0.5\text{s}$, $1.0\text{s}$) across 20 complete multi-deadline run journals.

#### Gate C: Asymmetric Combat & Dynamic Threats
- **Task 1.12: Generalized Asymmetric Combat Engine (`src/core/battle.ts`) [V1]**
  - Asymmetric formula (-10% attacker friction vs +20% defender fortification), Razor-Thin Victory rule ($1.00 \le R \le 1.05 \to$ no province), diverse loot types, and province floor rule (= 1).
  - Unify all military power evaluations across `engine.ts`, `commands.ts`, and `battle.ts` via `calculateMilitaryPower(state)`.
  - Distribute combat casualties proportionally across `soldier` and `man_at_arms` (with `captain` $-5\%$ mitigation) in offensive and defensive battles; annihilate 100% of all military units on Defensive Collapse while preserving the §3.1 Population Balance Equation.
  - Prospective `currentTarget` state with Fog of War uncertainty band $M$, `isFalseLedger` (15%), `isAmbush` (10%), Spymaster detection, and `RECON_PATROL` target rerolling via the `rngStreams.combat` stream.
  - Trigger `SURPRISE_RAID` in `tick()` following `GAME_RULES.md §8.3` (D3+, every 10s, 2% base chance, $\times 2$ if AP $> 2000$, $+2\%$ if Mil $< 50\%$ quota, $+2\%$ if Unrest $> 60$, max 1/deadline, 60s cooldown, power $= 0.50 \times \text{MilitaryQuota}$).
  - Credit `stronghold` biome ($+12$ flat defense) and `man_at_arms` ($+0.5$ flat defense) in `calculateDefenderPower`.
  - Defensive Collapse pillages only positive AP and never clamps the result to 0 (debt is preserved), and the province floor does not apply, so losing the last province triggers the `conquest` defeat.
  - Defensive victory salvage (`GAME_RULES.md §7.4.2`): $\text{round}(0.25 \times \text{TributeCost} \times \text{Roll}(0.8, 1.2))$ credited to `state.ap`.
  - Captured `soldiers` loot is capped to the military order headroom (excess becomes free serfs), defensive victories grant salvage loot (§7.4.2), and campaign loot is not credited to the AP quota.

#### Gate D: Complete Narrative Content, Laws & Events
- **Task 2.1: 30 Laws Catalog (`src/data/laws.ts`) [V1]**
  - Implement 10 Chancellor laws, 10 Prelate laws, and 10 Marshal laws (`GAME_RULES.md §10`) with pure `Effect` / `Modifier` payloads and typed `ResolverKey` entries.
  - Wire a deterministic 3-card law draft (1 per order) on entering `COUNCIL_LAWS` and validate `ENACT_LAW` against the current draft and active law slot cap (5, or 6 with archive perk).
- **Task 2.2: 20 Steward Dilemmas (`src/data/dilemmas.ts`) [V1]**
  - Implement 20 narrative dilemmas (`GAME_RULES.md §9`) with state trigger predicates and multi-choice `Effect[]` outcomes, wired into `COUNCIL_DILEMMA` and `RESOLVE_DILEMMA`.
- **Task 2.3: Threats, Reactive Factions, Province Biomes, Archives, Feats & Scoring (`src/data/`) [V1]**
  - `threats.ts`: 8 Crown threat definitions (D3-D10) and 6 reactive factions (`GAME_RULES.md §7.5` & `§8.1`).
  - The Mercenaries faction trait is tribute +25% only; the raid doubling above 2000 AP is governed by the general rule of `GAME_RULES.md §8.3`.
  - `biomes.ts`: Track `provinceBiomes: BiomeId[]` in `GameState` (starting with `['heartland', 'heartland', 'heartland']` to keep the 750 starting capacity; colonisation adds `heartland`, conquest adds the target biome, province losses remove the last acquired entry; applying Farmlands $\times 1.5$ cap & $+0.001 r$, Trade Hub $+15\%$ tax efficiency, Stronghold $+12$ defense, Wilderness $-5\%$ paperwork & $\times 0.8$ cap).
  - `edicts.ts`, `archives.ts` (8 perks), `feats.ts` (8 achievements), and run score / dynastic title calculator (`GAME_RULES.md §13`).

#### Gate E: Full Simulation, Final Calibration & Engine Freeze
- **Task 3.1: High-Speed Headless Bot Runner (`src/__tests__/simulation/botRunner.ts`, `bots/runner.ts`) [V1]**
  - Fast in-place simulation loop decoupled via `npm run test:sim`: one `dispatch` loop on a single state, ticking 1 s per bot decision.
  - `runSimulation(strategy, seed, options)` takes an optional `EngineConfig` (`options.config`, which replaces the planned `balanceOverrides`) for sensitivity testing, returns a replayable command journal and the time stamped purchases (`purchases`, `unitExpenditures`) used for the spending after 300 s. The runner and the bots contain no `console.log`.
  - Status: done (`cd4ccd7`).
- **Task 3.2: Three-Tier Bot Implementations [V1]**
  - **Random Noise Bot:** Arbitrary purchases, laws, and dilemma choices. Win rate **< 5%** (asserted on 20 seeds, 0% on the 100 validation seeds).
  - **Greedy ROI Bot (Baseline Human):** Deterministic marginal ROI payback scoring across AP, Pop, and Military, with no seed parity shortcut and no PRNG. Win rate **35% - 65%** asserted on the 100 validation seeds 20001 to 20100 (54% with the current table).
  - **Archetype Expert Bots:** Specialized Bureaucrat (civil colonisation + admin synergies) and Conqueror (military campaigns + plunder, launched from the perceived power band only) bots enacting synergistic laws. Win rate **> 65%** asserted on 20 seeds each (100% and 76% on the 100 validation seeds).
  - Status: done (`cd4ccd7`).
- **Task 3.3: Quota Derivation & Balance Report Script (`scripts/generate-balance-report.ts`) [V1]**
  - Algorithmic bisection solver calibrating $c$ in $[0.3, 1.2]$: medians of a quota blind Greedy variant under relaxed quotas on **200 calibration seeds** (10001 to 10200; AP axis = median gross AP rate at each audit), then the quota aware Greedy ROI bot, the experts and the Random bot are validated on **100 seeds** (20001 to 20100). Writes `src/data/balance.generated.ts` only when the Greedy band and the other win rates hold. Current table: $c = 1.0875$ (deadline 1 at the floor of its medians, $c$ weighted 0.9 and 0.95 at deadlines 2 and 3, log linear fit of the medians from deadline 5). Run with `npm run balance:report -- <report.md>`.
  - Unit tests: strict quota monotonicity and the pinned quota and threat table (`balance.spec.ts`).
  - Status: done (`9d8fe0d`).
- **Task 3.4: Dominance Test Suite per Archetype (`dominanceSuite.ts`, `dominance.bureaucrat.spec.ts`, `dominance.conqueror.spec.ts`) [V1]**
  - Assert across 200 runs per archetype (seeds 50001 to 50200) that every unit role of the catalog is bought at least once per archetype (together the runs buy all 24 units) and that no single unit exceeds 60% of the spending **after 300 s (Deadline 3)**.
  - Status: done (`fc2acdd`).
- **Task 3.5: Sensitivity Analysis ($\pm 10\%$), Step Size Invariance & CLI REPL Tool (`scripts/repl.ts`) [V1]**
  - `sensitivity.growth.spec.ts`, `sensitivity.tax.spec.ts`, `sensitivity.tier1.spec.ts` and `sensitivity.tier2.spec.ts` (one key each, shared body `sensitivitySuite.ts`, parallel under Vitest) scale $r_0$, the two cost ratios and the poll tax rate (`TAX_POLL_RATE`) by $\pm 10\%$ one at a time through `EngineConfig`, over 100 seeds (40001 to 40100), and asserts that the Greedy win rate stays within 0.20 of the baseline. Baseline 0.44 with the current table; every variant stays inside the band (worst gap 0.13, tier I cost ratio growth $\times 0.9$: 0.57; $\times 1.1$: 0.36). Cost ratios are scaled on their growth part ($r - 1$, user decision), because scaling the whole ratio drops it below 1.
  - `stepSize.spec.ts` replays 20 Greedy runs (seeds 30001 to 30020) at $\Delta t = 0.05\text{ s}$ and $1.0\text{ s}$: same phase, deadline, state hash, faithful to the original run.
  - Interactive terminal REPL (`scripts/repl.ts`, `npm run repl`) to inspect and play headless runs via CLI, covered by `repl.spec.ts`.
  - Status: done (`fc2acdd` sensitivity, `ed4bd9e` step size and REPL, `7856ba5` 100 seeds in four files, tier I cost ratio growth $\times 1.1$ known `it.fails` until the post freeze balance pass).
- **Task 3.6: Engine Validation Gate E Freeze [V1]**
  - All unit tests, invariant checks, replay step-size invariance, and 100-seed bot simulations pass with 0 warnings/errors (at the freeze, one known `it.fails`: tier I cost ratio growth $\times 1.1$, closed by the post freeze balance pass) before unlocking Phase V2 UI work.
  - Status: done (`98514e1` docs audit, final review of plan 04).
  - Deferred audit window closed after the freeze: a deferred audit is evaluated as soon as the raid or Lombard offer resolves (`openDeferredDeadlineAudit`), so no command applies between the deadline and the audit.

**Follow ups after Gate E (V2 balance and engine):**
- Done after the freeze: the quota table no longer has a cliff at deadline 1 (deadline 1 at the floor of its medians, lighter $c$ at deadlines 2 and 3), the tier I sensitivity variant is back in its band (gap 0.02), and the tributes of threats 8 to 10 ask 4 seconds of the AP rate quota (12,720 AP at deadline 10 with the current table).
- Done after the freeze: the late quotas grow by a constant factor per axis (log linear fit of the deadline 5 to 10 medians: AP $\times 1.84$, population $\times 1.55$ from D6, military $\times 1.90$ per deadline; population D5 is held at D4 + 1 by the strictly increasing rule). Conqueror validation fell from 95% to 76% across the two passes (opening table 6 points, late tribute 5 to 6, late fit 7 to 8); it stays above the 65% floor.
- Rerun the solver (`npm run balance:report`) after any balance change.

---

### Phase V2: Playability, UI & Presentation

#### Phase 4: Pinia State Stores & Audio Engine
- **Task 4.1: Web Audio Manager (`src/audio/`) [V2]**
  - Autoplay silent unlock on first user gesture; visibility auto-pause.
  - Sub-mix buses (Master, SFX, Music) with volume management.
  - Voice stealing (3-4 concurrent voices per key), cooldown throttling (40ms), pitch variance ($\pm 5\%$).
  - Dynamic streaming for public soundtracks (`Angevin B.mp3`, `Folk Round.mp3`, etc.) with cross-fading.
- **Task 4.2: Game Store (`src/stores/game.ts`) [V2]**
  - Reactive bridge linking Vue UI to `src/core/engine.ts`.
  - Expose computed getters (`currentAp`, `currentPop`, `unrest`, `activeLaws`, `quotas`).
  - Bridge UI user actions into `dispatch(command)`.
  - Auto-save to `localStorage` (`grand_audit_save`) on deadline completion.
- **Task 4.3: Meta-Progression & Settings Stores (`src/stores/`) [V2]**
  - `archives.ts`: Persistent archive points, purchased perks with free respec.
  - `settings.ts`: Font toggle (Grimoire vs Modern), volume sliders, 2x fast-forward mode.

#### Phase 5: Modular UI Presentation Components (`src/components/game/`)
- **Task 5.1: Layout & Header Components [V2]**
  - `<GameHeader.vue>`: Deadline indicator, 100s circular timer, pause & 2x buttons.
  - `<QuotaBar.vue>`: 3 Crown metric gauges with accessible `[yes SATISFIED]` / `[✗ DEFICIT]` badges.
  - `<DiscontentMeter.vue>`: Unrest bar with crisis stage labels (Tranquility to Revolution).
  - `<BottomNavigation.vue>`: Tabs for Orders, Ledger, Laws, Archives.
- **Task 5.2: Ledger & Executive Actions [V2]**
  - `<RoyalSealButton.vue>`: Primary click stamp button with critical wax seal particles.
  - `<TreasuryReadout.vue>`: AP treasury, gross income, paperwork drag %, net AP/s.
  - `<TaxSlider.vue>`: 0% to 60% tax slider with 8s promulgation delay and unrest warning.
  - `<EmergencyEdicts.vue>`: 3 emergency buttons (Forced Tithe, Church Seizure, Grand Festival).
- **Task 5.3: Orders & Unit Recruitment [V2]**
  - `<OrderTabs.vue>`: Sub-tabs for The People, Administration, The Military.
  - `<BulkBuySelector.vue>`: 1x, 10x, 50x, 100x and Buy Max buttons.
  - `<RoleCard.vue>`: Single unit card (< 150 lines) with dynamic geometric cost and headroom checks.
  - `<TierPatentBanner.vue>`: Tier II unlock charter purchase CTA.
- **Task 5.4: Modals & Dialogs [V2]**
  - `<CouncilLawModal.vue>`: 3 law cards presentation + Reject All (+1 Archive).
  - `<StewardDilemmaModal.vue>`: Narrative steward dialog box with choices A/B/C.
  - `<ThreatHeraldModal.vue>`: Deadline threat announcement and 3 response options.
  - `<TacticalBattleModal.vue>`: Campaign target preview, scout reroll with mortality, clash animation.
  - `<LombardLoanModal.vue>`: Emergency 20-second bankruptcy bailout popup.
  - `<AuditVerdictModal.vue>`: End of deadline results & royal censure.
  - `<GameOverModal.vue>`: Victory / Defeat screen with dynastic nobility title and score breakdown.
- **Task 5.5: First-Time User Experience (FTUE) [V2]**
  - Progressive onboarding during Deadline 1 introducing click decrees, Scribe recruitment, and tax governance.
  - The 50 starting AP afford the first Scribe (bootstrap click); the tutorial focuses on production rate.
- **Task 5.6: Refactor `<App.vue>` [V2]**
  - Replace monolithic showcase mockup with modular production game layout.

#### Phase 6: Verification & Standalone Distribution
- **Task 6.1: Full Test Suite (`npm run test:unit`) [V2]**
  - Unit tests for all mathematical models, battle outcomes, and persistence serialization.
  - Automated bot simulations verifying skill gradient and balance stability.
- **Task 6.2: End-to-End Playwright Tests (`npm run test:e2e`) [V2]**
  - Cross-browser testing (Firefox, Chromium) validating full run loop, onboarding, and defeat modes.
- **Task 6.3: Single-File Production Build (`npm run build`) [V2]**
  - Build standalone `dist/index.html` via `vite-plugin-singlefile`.
  - Confirm inlined fonts, SVGs, and audio packaging adhere to size budgets.
