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

> [!WARNING]
> **Audit Remediation Notice:** Tasks previously marked `[x]` that contained integration gaps, unimplemented secondary rules, or test shortcuts have been reopened as `[ ]` below with explicit `[x]` (done) vs `[ ]` (to fix) sub-checklists. See [`docs/plan/README.md`](./plan/README.md) for the step-by-step technical remediation specification.
>
> **Numbering:** the "Task X.Y" items below are grouped by Gate and do **not** map one-to-one to the "Tâche X.Y" items of `docs/plan/README.md` (e.g. Task 1.6 here = Greedy bot, Tâche 1.6 there = combat). `docs/plan/README.md` is the execution reference; its **Tâche 1.0** (rule arbitrations in `GAME_RULES.md` / `GUIDE.md`) must be completed before any code change.

#### Préalable : Tâche 1.0 du Plan de Remédiation (`docs/plan/README.md`)
- [x] **Tâche 1.0 : Arbitrages de Règles & Alignement Documentaire (`GAME_RULES.md`, `GUIDE.md`, `PLAN.md`)**
  - [x] 1. Révolution immédiate (§6.5) : défaite instantanée dès Unrest = 100 dans toute phase.
  - [x] 2. Désertion cumulative (§6.5) : s'applique de 75% à 99% d'Unrest ; Sanctuary Rights sous 90% uniquement.
  - [x] 3. Quota d'AP en débit brut instantané (AP/s, `ApRateQuota`) à l'inspection ; clics et transferts de capital exclus.
  - [x] 4. Trésor signé : aucune remise à zéro des dettes (`ap < 0`), solvabilité requise pour tout choix coûteux.
  - [x] 5. Héraut des menaces (§8) : après l'audit $d$ ($2 \le d \le 9$), annonce et résout la menace de $d+1$ ; tribute = $20 \times \text{ApRateQuota}_{d+1}$.
  - [x] 6. Conquête (§1.2, §7.4.2) : le plancher de 1 province ne protège pas en cas d'effondrement militaire (défaite `conquest` à 0 province).
  - [x] 7. Biome neutre de départ : biome `heartland` (3 provinces de départ = 750 de capacité) ; perte de province en LIFO.
  - [x] 8. Achats en vrac (§5.1, §5.3) : tailles maximales d'achat (1, 10, 50, 100) ; validation de toute quantité entière $\le$ max ; Buy Max borné par la taille max.
  - [x] 9. Salvage défensif (§7.4.2) : formule de récupération $\text{round}(0.25 \times \text{TributeCost} \times \text{Roll}(0.8, 1.2))$ créditée à `state.ap`.
  - [x] 10. Butin de soldats (§7.4.1) : soldats capturés au-delà du plafond militaire reversés aux serfs libres.
  - [x] 11. Prêt lombard (§14.4) : conditionné à `provinces >= 2`.
  - [x] 12. Raids & Mercenaires (§7.5 vs §8.3) : doublement si AP > 2000 généralisé en §8.3 ; Mercenaires = tribut +25% uniquement.
  - [x] 13. Clic d'amorçage (§2.1, §17) : 50 AP de départ pour le 1er Scribe ; tutoriel axé sur le débit de production.
  - [x] 14. Format de sauvegarde (§18) : préfixe `GRA-v1:` stable pour le format d'encodage ; `schemaVersion` dans le payload pour le schéma.
  - [x] 15. Alignement `PLAN.md` et renvoi vers `docs/plan/README.md`.

#### Gate A: Core Economy, 24 Units & Minimal Run Validation
- [ ] **Task 1.1: Master Balance Single Source of Truth (`src/data/balance.ts` & `src/data/balance.generated.ts`) [V1]**
  - [x] Centralize base constants, dual-tier geometric scaling ratios ($1.07$ / $1.05$), logistic growth $r_0 = 0.005$, base housing $250$/province, colonisation cost ($1500 \times 2^k$), continuous collector yields (`freeSerfs / 100`), biome multipliers, and dynamic threat helpers.
  - [x] Replace `'unrest_growth'` in `StatKey` with dual `'unrest_generation' | 'unrest_pacification'` to prevent sign inversion on multiplicative modifiers (`GAME_RULES.md §6.5`).
  - [x] Add `DISBAND_UNIT` command contract and allow it in `ACTIVE_CYCLE` and `AWAIT_RESUME`.
  - [x] Eliminate the circular import between `src/data/balance.ts` and `src/core/{formulas,modifiers}.ts` by moving engine types (`Command`, `RunPhase`, `Effect`, `Modifier`) to `src/core/types.ts`.
  - [x] Introduce an injectable `EngineConfig` (`balance` constants + `quotas`, default `DEFAULT_ENGINE_CONFIG`, never serialized) passed to `tick`, `dispatch` and `evaluateDeadlineAudit`, so the Gate E solver and sensitivity tests can vary quotas, $r_0$, cost ratios and poll tax without rewriting source files.
  - [x] Add the neutral `heartland` biome to `BiomeId` / `BIOMES_DATA` (no bonus) so the 3 starting provinces keep the 750 starting capacity.
  - [x] Tested in `src/__tests__/unit/balance.spec.ts` (including strict quota monotonicity across Deadlines 1–10).
- [ ] **Task 1.2: 24 Units Catalog & Secondary Role Mechanics (`src/data/balance.ts` - `UNITS_DATA`) [V1]**
  - [x] Declare all 24 unit definitions (8 People, 8 Administration, 8 Military across Tier I & Tier II) in `UNITS_DATA`.
  - [ ] Wire all secondary unit mechanics specified in `GAME_RULES.md §4`:
    - `prelate`: $-20\%$ tax unrest generation per Prelate (capped at $-80\%$).
    - `audit_chamber`: $+10\text{s}$ per unit to bankruptcy grace countdown ceiling.
    - `captain`: $-5\%$ combat casualty rate per Captain (down to minimum floor).
    - `sergeant`: $+2\%$ campaign battle loot value per Sergeant.
    - `guild`: $+1\%$ AP from campaign plunder per Guild.
    - `man_at_arms`: $+0.5$ flat passive defense per Man-at-Arms in defensive battles.
    - `scout` & `spymaster`: $-12$ and $-30$ percentage points to enemy power fog-of-war uncertainty margin $M$ (floor $\pm 5\%$), plus `spymaster >= 1` revealing `isFalseLedger` and `isAmbush`.
- [ ] **Task 1.3: Core Mathematical Models & Ergonomic Clicker (`src/core/formulas.ts`) [V1]**
  - [x] Implement deterministic **Token Bucket clicker** (12 tokens/sec refilled via injected tick delta-time).
  - [x] Implement dual-tier geometric cost scaling, logistic growth, civil colonisation cost ($1500 \times 2^k$), continuous collector yield, and paperwork inertia ($S=220$).
  - [x] Fix `calculateMaxAffordableUnits` to `Math.floor(freeSerfs)` and `Math.floor(orderHeadroom)` so Buy Max never returns fractional unit counts when `freeSerfs` is non-integer.
  - [x] Implement proportional overcrowding unrest formula from `GAME_RULES.md §14.3`: $+0.10\text{ Unrest/s}$ per 50 excess inhabitants, capped at $+1.0\text{ Unrest/s}$.
  - [x] Implement `getMaxBulkSize(deadline, totalPopulation, def)` returning the **maximum** allowed purchase count (`GAME_RULES.md §5.1`: 1, then $\le 10$ at D3 or $\ge 250$ Pop, $\le 50$ at D6 or $\ge 1,000$ Pop, $\le 100$ at D8 for `peasant` and `scribe` only); `BUY_UNIT` rejects any `count` above it (not only exact 10/50/100) and Buy Max is capped by it.
  - [x] Fix the Buy Max rounding gap: decrement $K$ while `calculateUnitCost(unitId, n, K) > availableAp` so a Buy Max count is always accepted by `BUY_UNIT`.
- [ ] **Task 1.4: Universal Modifier Engine (`src/core/modifiers.ts`) [V1]**
  - [x] Implement `composeStat(statKey, baseValue, modifiers, rawState)` supporting `add`, `addPct`, `mul`, `set` and strongly typed `ResolverKey`.
  - [x] Remove legacy untyped dual-signature overload from `composeStat` (always require `statKey: StatKey`).
  - [x] Purge expired temporary modifiers (`mod.expiresAt !== undefined && mod.expiresAt <= state.totalElapsedSeconds`) at the start of every `tick()`.
  - [x] Instantiate and wire `TickStatCache` into `engine.ts` / stat queries.
  - [x] Fix `applyEffect` for `grant_units` (and `instant_resource: 'population'`) so the §3.1 Population Balance Equation (`totalPopulation === freeSerfs + sum(units)`) is strictly preserved.
  - [x] Remove the `Math.max(0, …)` clamp on `instant_resource: 'ap'` (it erased debt and made unaffordable costs free) and stop crediting effect AP to the AP quota; costs are validated upstream by `canAffordEffects`.
- [ ] **Task 1.5: Minimal Run Core Engine (`src/core/state.ts`, `src/core/commands.ts`, `src/core/engine.ts`) [V1]**
  - [x] Initial state factory (50 AP, 100 Pop, 3 Provinces = 750 Cap, 25% Tax, 10 Unrest) and basic tick loop.
  - [x] Enforce the §3.1 **Population Balance Equation** (`totalPopulation === freeSerfs + sum(units)`) across overcrowding bleed, defensive collapse, levy en masse, and unit grants via a shared demographic mutation helper.
  - [x] Wire dual `unrest_generation` and `unrest_pacification` composition in `tick()`.
  - [x] Route every Unrest mutation through `addUnrest(state, delta)` (`src/core/mutations.ts`) so reaching 100 triggers the `revolution` defeat immediately in any phase (instant spikes were previously cancelled by pacification on the next tick), and never overwrite `RUN_DEFEAT` with a later phase transition.
  - [x] Implement cumulative military desertion from 75% to 99% Unrest (1 `soldier` every 15s, or 1 `man_at_arms` every 30s if 0 `soldier` remain; *Sanctuary Rights* only blocks it below 90%), resetting the persisted `desertionTimer` when no eligible unit exists.
  - [x] Advance the deadline clock by the integrated step before any mid-tick phase switch (`LOMBARD_OFFER`, `SURPRISE_RAID`, defeat), defer the audit with `pendingDeadlineAudit` if needed, and expose `consumedDt` in `TickResult`.
  - [x] Only offer `LOMBARD_OFFER` when `provinces >= 2`.
  - [x] Extract shared `calculateGrossApRate(state)`, `calculateNetPaperwork(state)`, and `calculateMaxPopulation(state)` helpers so `STAMP_DOCUMENT`, `BUY_UNIT`, and `tick()` evaluate identical composed stats.
  - [x] Fix `SET_TAX_RATE`: validate `Number.isFinite(rate)`, apply **downward** tax adjustments (`targetRate <= currentRate`) **immediately** (0s delay), and apply the 8s promulgation delay only to **upward** adjustments (`GAME_RULES.md §14.2`).
  - [x] Validate all command inputs: reject `dt <= 0` or `!Number.isFinite(dt)` in `TICK`, reject non-integer `count` in `BUY_UNIT`, remove exploitable `isCritical` override from `STAMP_DOCUMENT` (use the persisted `rngStreams.click` stream), and return `{ success: false }` on unhandled commands.
  - [x] Fix `evaluateDeadlineAudit`: failing **Deadline 10** causes immediate defeat (`quota_failure`) even with 0 strikes; Royal Censure fine applies only to positive AP ($0.50 \times \max(0, \text{ap})$).
  - [x] **AP quota as an instantaneous gross rate:** rename `DeadlineQuota.ap` to `apRate` (AP/s) and evaluate `apMet = calculateGrossApRate(state).total >= quota.apRate` at inspection (clicks and capital transfers no longer count). Provisional quotas `5, 12, 22, 35, 55, 85, 130, 195, 285, 420` AP/s (= former cumulative quota / 100) until the Gate E solver; tribute becomes $20 \times \text{ApRateQuota}$ (same amounts as the §8.1 table).
  - [x] Compute `interimWarningOnTrack: boolean` at $t = 50\text{s}$ using the 2-out-of-3 rule (`GAME_RULES.md §1.3`), comparing the current gross AP rate to `apRate`.
  - [x] Enforce all **Emergency Edict safeguards** (`GAME_RULES.md §11`): max 1 edict per deadline, $+50\%$ escalating penalty per prior use, zero AP quota credit, 20s pop growth freeze on `forced_tithe`, max 2 uses per run & $\max(300, 25 \times \text{Gross AP/s})$ & `unrest_pacification` $\times 0.5$ + 10 Unrest on `church_seizure`, and $\max(100, 0.20 \times \text{ap}, 30 \times \text{Gross AP/s})$ cost check on `grand_festival`.
  - [x] Implement `DISBAND_UNIT` command (`GAME_RULES.md §14.1`: return to `freeSerfs`, $50\%$ base cost severance, $+2$ Unrest per unpaid unit if AP insufficient, $+15$ Unrest mutiny spike if $>10\%$ military disbanded within 10s).
  - [ ] Fix `RESTART_RUN` to reset all state properties (`clickTokens`, `rngStreams`, threat fields, timers, counters), make `runId` deterministic from `seed`, and preserve `dt` overflow across the 100s deadline boundary.
- [ ] **Task 1.6: Early Economic Validation (Greedy ROI Bot v0 & Provisional $c$ Solver) (`scripts/generate-balance-report.ts`) [V1]**
  - [ ] Implement genuine Greedy ROI Bot evaluating marginal payback across AP, Population, and Military without the `state.seed % 2` parity shortcut.
  - [ ] Run bisection solver on coefficient $c$ over 200 fixed seeds and generate `src/data/balance.generated.ts`.

#### Gate B: Complete Run Loop, State Machine & Determinism
- [x] **Task 1.7: Deterministic PRNG (`src/core/prng.ts` & `src/core/state.ts`) [V1]**
  - [x] Implement Mulberry32 algorithm with `next()`, `nextBetween()`, `nextInt()`, `getState()`, `setState()`.
  - [x] Ensure `this.state = (this.state + 0x6d2b79f5) >>> 0` stays unsigned 32-bit in `prng.ts`.
  - [x] Persist independent PRNG streams `rngStreams: Record<'click' | 'combat' | 'events' | 'council', number>` in `GameState` (seeded via `deriveStreamSeed(seed, stream)`) and route all random rolls through `withStatePrng(state, stream, fn)`, so clicking cannot shift raid or battle outcomes.
- [x] **Task 1.8: RunPhase State Machine & Command Permissions (`src/core/phases.ts`) [V1]**
  - [x] Implement `RunPhase` union, inter-deadline progression (`getNextInterDeadlinePhase`), and `assertCommandAllowed(phase, command)` tested in `src/__tests__/unit/phases.spec.ts`.
  - [x] Add `DISBAND_UNIT` to `ACTIVE_CYCLE` and `AWAIT_RESUME` in `ALLOWED_COMMANDS_BY_PHASE`.
  - [x] Wire `SURPRISE_RAID` transitions from `tick()` and clean up or wire `COMBAT_RESOLUTION`.
- [x] **Task 1.9: Constrained Command Dispatch API (`src/core/commands.ts`) [V1]**
  - [x] Enforce phase permissions via `assertCommandAllowed(state.phase, command)`.
  - [x] Fix `SELECT_THREAT_RESPONSE`: if `'tribute'` fails (`state.ap < tributeAp`), do **not** advance `state.phase` out of `THREAT_HERALD` (`GAME_RULES.md §8.2`).
  - [x] Allow up to 2 voluntary campaigns in `EXPEDITION` (`campaignsLaunchedThisDeadline < 2`) before transitioning to `AWAIT_RESUME`.
  - [x] Guard `RESUME_GOVERNANCE` so `deadline` never exceeds 10.
  - [x] Fix the Threat Herald off-by-one: after the audit of deadline $d$ ($2 \le d \le 9$), announce and resolve the threat of deadline $d+1$ (populating `currentThreatPower` / `currentThreatTributeAp`), so all 8 threats D3–D10 are reachable.
  - [x] Return `{ success: false }` for orphan commands (`RESOLVE_COMBAT`) and remove or wire `COMBAT_RESOLUTION`.
- [x] **Task 1.10: Versioned Save State & Typed Migrations (`src/core/migrations.ts`) [V1]**
  - [x] Base64 clipboard export/import with integrity prefix `GRA-v1:` and zero `any`.
  - [x] Reject future save schemas (`schemaVersion > CURRENT_SCHEMA_VERSION`) and validate core `GameState` properties against `NaN` / malformed types.
  - [x] Bump `CURRENT_SCHEMA_VERSION` to `2` and implement sequential migration `1 -> 2` populating all new `GameState` fields from `v1-save.json`, verified in `src/__tests__/unit/migrations.spec.ts`.
- [ ] **Task 1.11: Replay Journal & Step-Size Invariance Test (`src/core/replay.ts` & `src/__tests__/unit/replay.spec.ts`) [V1]**
  - [x] Redesign `ReplayJournal` execution so commands dispatched during paused inter-deadline/crisis phases (`AUDIT_ASSESSMENT`, `COUNCIL_DILEMMA`, `COUNCIL_LAWS`, `THREAT_HERALD`, `EXPEDITION`, `AWAIT_RESUME`, `LOMBARD_OFFER`, `SURPRISE_RAID`) execute deterministically without causing an infinite loop when `totalElapsedSeconds` is frozen.
  - [x] Expand `getStateHash(state)` to hash `freeSerfs`, `taxRate`, `units`, `activeLaws`, `activeModifiers`, `phase`, and all `rngStreams`.
  - [ ] Validate determinism and step-size invariance ($\Delta t = 0.05\text{s}$, $0.5\text{s}$, $1.0\text{s}$) across 20 complete multi-deadline run journals.

#### Gate C: Asymmetric Combat & Dynamic Threats
- [ ] **Task 1.12: Generalized Asymmetric Combat Engine (`src/core/battle.ts`) [V1]**
  - [x] Asymmetric formula (-10% attacker friction vs +20% defender fortification), Razor-Thin Victory rule ($1.00 \le R \le 1.05 \to$ no province), diverse loot types, and province floor rule (= 1).
  - [x] Unify all military power evaluations across `engine.ts`, `commands.ts`, and `battle.ts` via `calculateMilitaryPower(state)`.
  - [x] Distribute combat casualties proportionally across `soldier` and `man_at_arms` (with `captain` $-5\%$ mitigation) in offensive and defensive battles; annihilate 100% of all military units on Defensive Collapse while preserving the §3.1 Population Balance Equation.
  - [x] Implement prospective `currentTarget` state with Fog of War uncertainty band $M$, `isFalseLedger` (15%), `isAmbush` (10%), Spymaster detection, and `RECON_PATROL` target rerolling via the `rngStreams.combat` stream.
  - [x] Trigger `SURPRISE_RAID` in `tick()` following `GAME_RULES.md §8.3` (D3+, every 10s, 2% base chance, $\times 2$ if AP $> 2000$, $+2\%$ if Mil $< 50\%$ quota, $+2\%$ if Unrest $> 60$, max 1/deadline, 60s cooldown, power $= 0.50 \times \text{MilitaryQuota}$).
  - [ ] Credit `stronghold` biome ($+12$ flat defense) and `man_at_arms` ($+0.5$ flat defense) in `calculateDefenderPower`.
  - [x] Defensive Collapse: pillage only positive AP and never clamp the result to 0 (debt was erased), and remove the province floor so losing the last province triggers the `conquest` defeat.
  - [x] Cap captured `soldiers` loot to the military order headroom (excess becomes free serfs), add the defensive-victory salvage loot (§7.4.2), and stop crediting campaign loot to the AP quota.

#### Gate D: Complete Narrative Content, Laws & Events
- [ ] **Task 2.1: 30 Laws Catalog (`src/data/laws.ts`) [V1]**
  - [ ] Implement 10 Chancellor laws, 10 Prelate laws, and 10 Marshal laws (`GAME_RULES.md §10`) with pure `Effect` / `Modifier` payloads and typed `ResolverKey` entries.
  - [ ] Wire deterministic 3-card law draft (1 per order) on entering `COUNCIL_LAWS` and validate `ENACT_LAW` against the current draft and active law slot cap (5, or 6 with archive perk).
- [ ] **Task 2.2: 20 Steward Dilemmas (`src/data/dilemmas.ts`) [V1]**
  - [ ] Implement 20 narrative dilemmas (`GAME_RULES.md §9`) with state trigger predicates and multi-choice `Effect[]` outcomes, wired into `COUNCIL_DILEMMA` and `RESOLVE_DILEMMA`.
- [ ] **Task 2.3: Threats, Reactive Factions, Province Biomes, Archives, Feats & Scoring (`src/data/`) [V1]**
  - [ ] `threats.ts`: 8 Crown threat definitions (D3–D10) and 6 reactive factions (`GAME_RULES.md §7.5` & `§8.1`).
  - [ ] `biomes.ts`: Track `provinceBiomes: BiomeId[]` in `GameState` (starting with `['heartland', 'heartland', 'heartland']` to keep the 750 starting capacity; colonisation adds `heartland`, conquest adds the target biome, province losses remove the last acquired entry; applying Farmlands $\times 1.5$ cap & $+0.001 r$, Trade Hub $+15\%$ tax efficiency, Stronghold $+12$ defense, Wilderness $-5\%$ paperwork & $\times 0.8$ cap).
  - [ ] `edicts.ts`, `archives.ts` (8 perks), `feats.ts` (8 achievements), and run score / dynastic title calculator (`GAME_RULES.md §13`).

#### Gate E: Full Simulation, Final Calibration & Engine Freeze
- [ ] **Task 3.1: High-Speed Headless Bot Runner (`src/__tests__/simulation/botRunner.ts`) [V1]**
  - [x] Fast in-place simulation loop decoupled via `npm run test:sim`.
  - [ ] Support `balanceOverrides` parameter injection for true sensitivity testing, track post-Deadline 3 (`t > 300s`) unit expenditures, and remove debug `console.log` statements.
- [ ] **Task 3.2: Three-Tier Bot Implementations [V1]**
  - [ ] **Random Noise Bot:** Arbitrary purchases, laws, and dilemma choices. Assert win rate **< 5%** over 100 seeds.
  - [ ] **Greedy ROI Bot (Baseline Human):** Remove `state.seed % 2 === 0 ? 5 : 4` hack; implement genuine marginal ROI payback scoring across AP, Pop, and Military with PRNG noise. Assert win rate **35% – 65%** over 100 seeds.
  - [ ] **Archetype Expert Bots:** Specialized Bureaucrat (civil colonisation + admin synergies) and Conqueror (military campaigns + plunder) bots enacting synergistic laws and launching calculated expeditions. Assert win rate **> 65%** over 100 seeds.
- [ ] **Task 3.3: Quota Derivation & Balance Report Script (`scripts/generate-balance-report.ts`) [V1]**
  - [ ] Implement algorithmic bisection solver calibrating $c$ across **200 fixed seeds** on the Greedy ROI Bot (AP axis = median gross AP rate at each audit), validating on 1,000 runs, and writing `src/data/balance.generated.ts`.
  - [ ] Add unit test verifying strict quota monotonicity and file non-regression.
- [ ] **Task 3.4: Dominance Test Suite per Archetype (`src/__tests__/simulation/archetypeBots.spec.ts`) [V1]**
  - [ ] Assert across 100+ runs (combining Bureaucrat and Conqueror archetypes) that every unit in `UNITS_DATA` is purchased $> 0$ times and no single unit exceeds 60% of expenditure **after Deadline 3 ($t > 300\text{s}$)**.
- [ ] **Task 3.5: True Sensitivity Analysis ($\pm 10\%$) & CLI REPL Tool (`scripts/repl.ts`) [V1]**
  - [ ] Perturb $r_0$, cost ratios ($1.07/1.05$), and poll tax rate by $\pm 10\%$ (via `EngineConfig`) across 50+ seeds per profile in `archetypeBots.spec.ts` and assert win rates remain bounded without catastrophic collapse.
  - [ ] Implement interactive terminal REPL (`scripts/repl.ts`) to inspect and play headless runs via CLI.
- [ ] **Task 3.6: Engine Validation Gate E Freeze [V1]**
  - [ ] Validate all unit tests, invariant checks, replay step-size invariance, and 100-seed bot simulations pass with 0 warnings/errors before unlocking Phase V2 UI work.

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
