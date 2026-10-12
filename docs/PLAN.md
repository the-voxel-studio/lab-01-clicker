# The Grand Audit (Le Grand Audit) – Implementation Roadmap & Plan

> **Engineering Plan & Implementation Task Matrix**  
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
│   ├── plan/
│   │   └── README.md                      # Technical remediation & QA roadmap
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
│   │   └── engine.ts                      # Delta-time simulation loop (20 Hz in UI, 1-2 Hz in sim) & auditor
│   ├── data/                              # MASTER BALANCE & GAME CATALOGS
│   │   ├── balance.ts                     # Single source of truth for economics, curves & constants
│   │   ├── balance.generated.ts           # Auto-generated calibrated deadline quotas
│   │   ├── icons.ts                       # Curated typed SVGs dictionary
│   │   ├── units.ts                       # 24 unit definitions across 3 orders & 2 tiers [Gate A]
│   │   ├── laws.ts                        # 30 laws (10 Chancellor, 10 Prelate, 10 Marshal) [Gate D]
│   │   ├── dilemmas.ts                    # 20 Steward dilemmas with triggers & multi-choice outcomes [Gate D]
│   │   ├── threats.ts                     # Crown threats (Deadlines 3-10) & reactive factions [Gate D]
│   │   ├── biomes.ts                      # 4 province biomes (Farmlands, Trade, Stronghold, Wilderness) [Gate D]
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
│           ├── botRunner.ts               # In-place mutating fast simulation engine
│           └── archetypeBots.spec.ts      # Automated bot balance & sensitivity simulations [V1]
```

---

## 3. Two-Phase Delivery Architecture (V1 vs V2)

```
========================================================================================
PHASE V1: COMPLETE ENGINE, HEADLESS & SIMULATION (Gates A through E)
[Strict Rule: Zero UI / presentation component dev until Gate E is complete & frozen]
========================================================================================
Gate A: Core Economy, 24 Units & Minimal Run Validation
   │     • Formulas, Modifiers, Tiers I & II, Biomes, 24-Unit Catalog (src/data/units.ts)
   │     • Minimal Run Core: state factory, unconstrained economic dispatch, tick integration,
   │       tax promulgation delay (8s), unrest model, 2-out-of-3 deadline quota audit
   │     • Greedy ROI Bot v0 & provisional c solver on pure economy (no laws/dilemmas)
   │     • Exit Criterion: Quotas generated, 35–65% win rate band reached, zero deadline cliffs
   ▼
Gate B: Complete Run Loop, State Machine & Determinism
   │     • Configurable tick (20 Hz UI, 1-2 Hz headless sim) & step-invariance testing (Δt = 0.05 vs 0.5 vs 1.0s)
   │     • Complete RunPhase FSM (6 inter-deadline steps + active cycle + crises)
   │     • LOMBARD_OFFER with bankruptcy timer paused during this phase
   │     • In-run interimWarningShown state flag at t = 50s without phase interruption
   │     • Single command dispatch API dispatch(Command) & phase permissions table
   │     • Replay journal { seed, entries: [{ timeSeconds, command }] } indexed by game seconds
   │     • Versioned save system with sequential typed migrations (unknown, zero any)
   ▼
Gate C: Asymmetric Combat & Dynamic Threats
   │     • Asymmetric combat model (Attacker -10% friction vs Defender +20% fortification)
   │     • Razor-thin victory rule (≤ 5% margin → no province awarded), Province Floor = 1
   │     • Dynamic threats & tributes calculated on the fly (0.8 mil quota, 0.2 AP quota)
   │     • Reactive surprise border raids & adaptive factions
   ▼
Gate D: Complete Narrative & System Content (30 Laws, 20 Dilemmas, Biomes, Edicts, Charters)
   │     • Dynamic conditional modifiers via strongly typed ResolverKey (zero serialized functions)
   │     • grant_units and archive_points effect evaluators
   ▼
Gate E: Full Simulation, Final Calibration & Engine Freeze
   │     • 3 Autonomous Bots: Random (< 5%), Greedy ROI (35–65%), Archetype Experts (> 65%)
   │     • Final c calibration on 200 fixed seeds, validation on 1,000 runs
   │     • Dominance test suite per archetype build (after Deadline 3)
   │     • Sensitivity analysis ±10%, interactive CLI REPL
   ▼  [CORE ENGINE CODE FROZEN & VERIFIED]
========================================================================================
PHASE V2: PLAYABILITY & PRESENTATION
========================================================================================
   • Pinia integration (reactive stores bridging to engine.ts)
   • Web Audio API engine (Master/SFX/Music buses, polyphony limit, streaming)
   • Modular Vue 3 components (< 200 lines) & accessible HUD gauges
   • Contextual FTUE progressive onboarding
   • Playwright E2E cross-browser tests
   • Standalone single-file bundle (dist/index.html)
```

---

## 4. Detailed Implementation Tasks

### Phase V1: Headless Engine Core & Systems (`src/core/`)

#### Gate A: Core Economy, 24 Units & Minimal Run Validation
- [x] **Task 1.1: Master Balance Single Source of Truth (`src/data/balance.ts` & `src/data/balance.generated.ts`) [V1]**
  - Centralize all constants, dual-tier geometric scaling ratios ($1.07$ / $1.05$), logistic growth $r_0 = 0.005$, base housing $250$/province, colonisation cost ($1500 \times 2^k$), continuous collector yields (`freeSerfs / 100` without floor), biome multipliers ($\times 1.5, \times 0.8$), dynamic threat formulas, and universal modifier contracts.
  - Fully tested in `src/__tests__/balance.spec.ts`.
- [x] **Task 1.2: 24 Units Catalog (`src/data/balance.ts` - `UNITS_DATA`) [V1]**
  - Implement complete 24 units definitions (8 People, 8 Administration, 8 Military across Tier I & Tier II) directly in Gate A.
  - Consolidated into master single source of truth `UNITS_DATA`.
- [x] **Task 1.3: Core Mathematical Models & Ergonomic Clicker (`src/core/formulas.ts`) [V1]**
  - Implement deterministic **Token Bucket clicker** (12 tokens/sec refilled via injected tick delta-time).
  - Implement dual-tier geometric cost scaling & bulk purchasing sums (1x, 10x, 50x, 100x restricted to Peasants & Scribes, Buy Max).
  - Implement proportional logistic growth: $\text{Growth/s} = r \times \text{Pop} \times (1 - \text{Pop}/\text{Max}) \times \text{FiscalFactor}$ with $r_0 = 0.005$.
  - Implement Civil Colonisation cost: $1500 \times 2^k\text{ AP}$.
  - Implement continuous non-quadratic collector yield: $\text{Rate} \times \min(n, \text{FreeSerfs}/100)$.
  - Implement bureaucratic paperwork inertia formula with $S=220$.
- [x] **Task 1.4: Universal Modifier Engine (`src/core/modifiers.ts`) [V1]**
  - Implement `composeStat(baseValue, modifiers, state)` supporting `add`, `addPct`, `mul`, `set`.
  - Strongly type `resolverKey` as a literal union `ResolverKey` (`'law:isolationism' | 'law:provincial_tithe' | ...`).
  - Resolvers inspect raw state only (`state.provinces`, `state.unrest`, etc.) and are strictly forbidden from calling `getStat` to avoid recursion cycles.
  - Cache stat evaluations per tick index via `TickStatCache` to eliminate redundant recalculation during high-frequency calls.
  - Implement `Effect` evaluator supporting `stat_modifier`, `instant_resource` (including `archive_points`), `grant_units`, and `rule_flag`.
- [x] **Task 1.5: Minimal Run Core Engine (`src/core/state.ts`, `src/core/commands.ts`, `src/core/engine.ts`) [V1]**
  - Initial state factory (50 AP, 100 Pop, 3 Provinces = 750 Cap, 25% Tax, 10 Unrest).
  - Unconstrained economic command dispatcher (`BUY_UNIT`, `SET_TAX_RATE`, `STAMP_DOCUMENT`, `COLONISE_PROVINCE`, `TICK`).
  - Simulation tick integration: tax promulgation delay (8s), unrest growth model, and 2-out-of-3 deadline quota audit.
- [ ] **Task 1.6: Early Economic Validation (Greedy ROI Bot v0 & Provisional $c$ Solver) (`scripts/generate-balance-report.ts`) [V1]**
  - Implement stripped-down v0 Greedy ROI Bot evaluating economic purchases alone without laws or dilemmas.
  - Run bisection solver on provisional coefficient $c$ over 200 fixed seeds.
  - **Gate A Exit Criteria:** Quotas generated in `src/data/balance.generated.ts`, v0 greedy bot achieves 35%–65% win rate on economy alone, and curve displays smooth progression with no cliffs between deadlines.

#### Gate B: Complete Run Loop, State Machine & Determinism
- [ ] **Task 1.7: Deterministic PRNG (`src/core/prng.ts`) [V1]**
  - Implement Mulberry32 algorithm with seed initialization and serializable state.
- [x] **Task 1.8: RunPhase State Machine & Command Permissions (`src/core/phases.ts`) [V1]**
  - Implement complete `RunPhase` covering the 6 inter-deadline steps (`AUDIT_ASSESSMENT`, `COUNCIL_DILEMMA`, `COUNCIL_LAWS`, `THREAT_HERALD`, `EXPEDITION`, `AWAIT_RESUME`), active cycle (`ACTIVE_CYCLE`), and crisis states (`SURPRISE_RAID`, `LOMBARD_OFFER`, `COMBAT_RESOLUTION`, `RUN_VICTORY`, `RUN_DEFEAT`).
  - `LOMBARD_OFFER` pauses the 30-second bankruptcy countdown.
  - Implement `ALLOWED_COMMANDS_BY_PHASE` and `assertCommandAllowed(phase, command)`.
  - Mid-deadline interim warning represented as an in-run state flag (`interimWarningShown: boolean` at $t=50\text{s}$) rather than a blocking phase.
  - Fully tested in `src/__tests__/phases.spec.ts`.
- [x] **Task 1.9: Constrained Command Dispatch API (`src/core/commands.ts`) [V1]**
  - Enforce phase permissions via `assertCommandAllowed(state.phase, command)`.
- [ ] **Task 1.10: Versioned Save State & Typed Migrations (`src/core/migrations.ts`) [V1]**
  - Sequential migrations pipeline `migrations: Record<number, (old: unknown) => unknown>` with runtime validation and **zero `any`**.
  - Base64 clipboard export/import with integrity prefix `GRA-v1:`.
- [ ] **Task 1.11: Replay Journal & Step-Size Invariance Test (`src/__tests__/unit/replay.spec.ts`) [V1]**
  - Implement replay journal `{ seed: number, entries: Array<{ timeSeconds: number, command: Command }> }` indexed by game seconds (not tick count).
  - Determinism test: asserting identical journal and step size produces identical final state hash (`getStateHash(state)`).
  - Step-size invariance test: replaying identical journal at $\Delta t = 0.05\text{s}$, $0.5\text{s}$, and $1.0\text{s}$ yields AP output delta $< 1-2\%$ and identical win/loss outcome on $\ge 99\%$ of runs.

#### Gate C: Asymmetric Combat & Dynamic Threats
- [ ] **Task 1.12: Generalized Asymmetric Combat Engine (`src/core/battle.ts`) [V1]**
  - Asymmetric formula: Attacker siege friction (-10%) vs Defender fortification bonus (+20% + Border Stronghold defense).
  - Offensive campaigns with $\pm 20\%$ loot variance and diverse loot types (AP, Free Serfs, Soldiers, Mixed).
  - Enforce the **Razor-Thin Victory Rule** ($1.00 \le R \le 1.05$): **no province awarded** due to exhausted vanguard.
  - Defensive battle resolution: Repelled salvage vs Defensive Collapse (1 Province lost, 100% army killed, 15-25% pop lost, 30-50% AP looted).
  - Enforce province floor rule: Fines and bailouts enforce a hard minimum floor of 1 province.
  - Spontaneous surprise raids triggered by player state ($> 2,000$ AP, low army, high unrest $> 60\%$), transitioning into `SURPRISE_RAID`.
  - Overcrowding Demographic Bleed when living population exceeds capacity after province loss ($250 \times (\text{Provinces} - 1)$).
  - Dynamic threat calculation: Power = $0.8 \times \text{MilitaryQuota}$, Tribute = $0.2 \times \text{ApQuota}$ evaluated dynamically via `getThreatPower()` and `getThreatTributeAp()`.

#### Gate D: Complete Narrative Content, Laws & Events
- [ ] **Task 2.1: 30 Laws Catalog (`src/data/laws.ts`) [V1]**
  - 10 Chancellor laws (Administration), 10 Prelate laws (The People), 10 Marshal laws (The Military).
  - Pure `Modifier` payloads with typed `resolverKey` for dynamic conditions (e.g. `law:isolationism`). Zero serialized functions.
- [ ] **Task 2.2: 20 Steward Dilemmas (`src/data/dilemmas.ts`) [V1]**
  - 20 narrative dilemmas with dynamic state triggers and multi-choice payloads.
- [ ] **Task 2.3: Threats, Reactive Factions & Province Biomes (`src/data/`) [V1]**
  - `threats.ts`: 8 Crown threat narratives and 6 reactive factions.
  - `biomes.ts`: 4 province biomes (Farmlands, Trade Hub, Stronghold, Wilderness).
  - `edicts.ts`: 3 emergency edicts (Forced Tithe, Church Seizure, Grand Festival).
  - `archives.ts`: 8 persistent meta-progression perks.
  - `feats.ts`: 8 royal achievements.

#### Gate E: Full Simulation, Final Calibration & Engine Freeze
- [ ] **Task 3.1: High-Speed Headless Bot Runner (`src/__tests__/simulation/botRunner.ts`) [V1]**
  - Optimized simulation runner: in-place state mutation (no tick-by-tick cloning), bot decisions executed every 1 second of game time, parallelized execution with Node `worker_threads`.
  - Decoupled from `npm run test:unit` via dedicated script `npm run test:sim`.
- [ ] **Task 3.2: Three-Tier Bot Implementations [V1]**
  - **Random Noise Bot:** Arbitrary purchases. Assert win rate **< 5%**.
  - **Greedy ROI Bot (Baseline Human):** Payback period prioritization with multi-metric utility score (AP, Pop, Military). Assert win rate **35% – 65%**.
  - **Archetype Expert Bots:** Specialized Bureaucrat and Conqueror bots. Assert win rate **> 65%**.
- [ ] **Task 3.3: Quota Derivation & Balance Report Script (`scripts/generate-balance-report.ts`) [V1]**
  - Automated script calibrating coefficient $c$ across **200 fixed seeds** (same seeds across bisection iterations for deterministic convergence), then validating on 1,000 runs.
  - Writes calibrated quotas into `src/data/balance.generated.ts` with "do not edit" banner.
  - A unit test verifies that regenerating against existing calibration yields an identical file.
  - Generates sensitivity report across $\pm 10\%$ parameter variations.
- [ ] **Task 3.4: Dominance Test Suite per Archetype (`src/__tests__/simulation/archetypeBots.spec.ts`) [V1]**
  - Asserts all units are purchased across 1,000 runs and no single unit exceeds 60% of total expenditure within a given archetype build **after Deadline 3**.
- [ ] **Task 3.5: CLI REPL Tool (`scripts/repl.ts`) [V1]**
  - Interactive terminal REPL to play, test, and debug runs headlessly via CLI commands.
- [ ] **Task 3.6: Engine Validation Gate E Freeze [V1]**
  - Validate all tests pass, freeze engine interfaces, and sign off for UI implementation.

---

### Phase V2: Playability, UI & Presentation

#### Phase 4: Pinia State Stores & Audio Engine
- [ ] **Task 4.1: Web Audio Manager (`src/audio/`) [V2]**
  - Autoplay silent unlock on first user gesture; visibility auto-pause.
  - Sub-mix buses (Master, SFX, Music) with volume management.
  - Voice stealing (3-4 concurrent voices per key), cooldown throttling (40ms), pitch variance ($\pm 5\%$).
  - Dynamic streaming for public soundtracks (`Angevin B.mp3`, `Folk Round.mp3`, etc.) with cross-fading.
- [ ] **Task 4.2: Game Store (`src/stores/game.ts`) [V2]**
  - Reactive bridge linking Vue UI to `src/core/engine.ts`.
  - Expose computed getters (`currentAp`, `currentPop`, `unrest`, `activeLaws`, `quotas`).
  - Bridge UI user actions into `dispatch(command)`.
  - Auto-save to `localStorage` (`grand_audit_save`) on deadline completion.
- [ ] **Task 4.3: Meta-Progression & Settings Stores (`src/stores/`) [V2]**
  - `archives.ts`: Persistent archive points, purchased perks with free respec.
  - `settings.ts`: Font toggle (Grimoire vs Modern), volume sliders, 2x fast-forward mode.

#### Phase 5: Modular UI Presentation Components (`src/components/game/`)
- [ ] **Task 5.1: Layout & Header Components [V2]**
  - `<GameHeader.vue>`: Deadline indicator, 100s circular timer, pause & 2x buttons.
  - `<QuotaBar.vue>`: 3 Crown metric gauges with accessible `[✓ SATISFIED]` / `[✗ DEFICIT]` badges.
  - `<DiscontentMeter.vue>`: Unrest bar with crisis stage labels (Tranquility to Revolution).
  - `<BottomNavigation.vue>`: Tabs for Orders, Ledger, Laws, Archives.
- [ ] **Task 5.2: Ledger & Executive Actions [V2]**
  - `<RoyalSealButton.vue>`: Primary click stamp button with critical wax seal particles.
  - `<TreasuryReadout.vue>`: AP treasury, gross income, paperwork drag %, net AP/s.
  - `<TaxSlider.vue>`: 0% to 60% tax slider with 8s promulgation delay and unrest warning.
  - `<EmergencyEdicts.vue>`: 3 emergency buttons (Forced Tithe, Church Seizure, Grand Festival).
- [ ] **Task 5.3: Orders & Unit Recruitment [V2]**
  - `<OrderTabs.vue>`: Sub-tabs for The People, Administration, The Military.
  - `<BulkBuySelector.vue>`: 1x, 10x, 50x, 100x and Buy Max buttons.
  - `<RoleCard.vue>`: Single unit card (< 150 lines) with dynamic geometric cost and headroom checks.
  - `<TierPatentBanner.vue>`: Tier II unlock charter purchase CTA.
- [ ] **Task 5.4: Modals & Dialogs [V2]**
  - `<CouncilLawModal.vue>`: 3 law cards presentation + Reject All (+1 Archive).
  - `<StewardDilemmaModal.vue>`: Narrative steward dialog box with choices A/B/C.
  - `<ThreatHeraldModal.vue>`: Deadline threat announcement and 3 response options.
  - `<TacticalBattleModal.vue>`: Campaign target preview, scout reroll with mortality, clash animation.
  - `<LombardLoanModal.vue>`: Emergency 20-second bankruptcy bailout popup.
  - `<AuditVerdictModal.vue>`: End of deadline results & royal censure.
  - `<GameOverModal.vue>`: Victory / Defeat screen with dynastic nobility title and score breakdown.
- [ ] **Task 5.5: First-Time User Experience (FTUE) [V2]**
  - Progressive onboarding during Deadline 1 introducing click decrees, Scribe recruitment, and tax governance.
- [ ] **Task 5.6: Refactor `<App.vue>` [V2]**
  - Replace monolithic showcase mockup with modular production game layout.

#### Phase 6: Verification & Standalone Distribution
- [ ] **Task 6.1: Full Test Suite (`npm run test:unit`) [V2]**
  - Unit tests for all mathematical models, battle outcomes, and persistence serialization.
  - Automated bot simulations verifying skill gradient and balance stability.
- [ ] **Task 6.2: End-to-End Playwright Tests (`npm run test:e2e`) [V2]**
  - Cross-browser testing (Firefox, Chromium) validating full run loop, onboarding, and defeat modes.
- [ ] **Task 6.3: Single-File Production Build (`npm run build`) [V2]**
  - Build standalone `dist/index.html` via `vite-plugin-singlefile`.
  - Confirm inlined fonts, SVGs, and audio packaging adhere to size budgets.
