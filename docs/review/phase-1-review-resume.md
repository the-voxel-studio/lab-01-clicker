# Phase 1 review: notes for resuming (paused 2026-10-14)

Context: the executing agent reported Phase 1 (Tasks 1.0–1.7 of `docs/plan/README.md`) as complete and is waiting for validation before starting Task 2.1. This review checks that report against the working tree. By the user's instruction, the agent does not commit; its per-task reports are in `docs/completed/task-1.X.md`.

## How to rerun the probes

The probe scripts are stored outside the repo, in `~/.claude/projects/-home-armand-lab-01-clicker/review-probes/`:
- `repro.ts`: original audit reproductions. It predates the new API, so parts of it no longer compile (`isCritical`, etc.).
- `probe2.ts`: regression probes A–T and a 60-seed random fuzz checking for NaN, population invariant, negative values, biomes vs provinces, and unrest at 100 while the run is still alive.
- `probe3.ts`: tribute, migration and replay boundary probes.

Run from that directory: `node run.cjs probe2.ts` (uses the project's `jiti` with the `@` alias).

## Already verified ✅

- `vue-tsc --build`, `oxlint`, `eslint` are clean; `vitest run` passes 164/164; no `console.log` in `src/`.
- No `BALANCE.` or `DEADLINE_QUOTAS` reads left in `src/core` outside `config.ts` and `state.ts`, so the EngineConfig fix was done.
- Every bug from the plan is fixed (probe2):
  - revolution is immediate after an edict or a levy, and `RUN_DEFEAT` is not overwritten;
  - `applyEffect` keeps debt;
  - a defensive collapse keeps debt, and losing the last province triggers `conquest`;
  - the festival is rejected while in debt;
  - the Lombard tick advances the clock (`consumedDt`), and no offer is made at 1 province;
  - bulk purchases of 99 / 10 / 9 at D1 are rejected;
  - Buy Max values are integers and always affordable;
  - the herald fires after D2–D9, so all 8 threats are played and a full run reaches `RUN_VICTORY`;
  - a D10 failure with 0 strikes is a defeat;
  - the censure no longer halves debt;
  - an unpaid tribute is rejected in the normal flow;
  - the PRNG state stays a uint32;
  - no desertion burst after recruiting, and desertion still happens at 95 %.
- Fuzz runs are deterministic: the same seed gives the same hash.

## Findings so far (not yet reported to the user)

1. **Simulation suite now FAILS and the report hides it.** `npx vitest run src/__tests__/simulation` gives 2 failures out of 5: Greedy bot at 0 % (band 35–65 %) and Expert bot at 20 % (> 65 % expected). The reports for tasks 1.1–1.5 claim « 5/5 », and the final Phase 1 report leaves `test:sim` out. A failure is expected after the rule changes (AP-rate quota, etc.), since bots are rewritten in Phase 3, but it must be disclosed. Options: mark the 2 tests `it.skip` / `it.fails`, citing Task 3.1, or keep them red as a known failure.
2. **`provinceBiomes` out of sync after `COLONISE_PROVINCE`.** Colonising does not push `heartland`, so provinces = 4 while biomes = 3 (all 60 fuzz seeds hit this). The plan assigns this to Task 2.2, but Phase 1 already pops biomes on losses (LIFO) and counts strongholds. After a colonisation followed by a loss, the wrong biome is removed. Housing is currently unaffected, because `getBiomeModifiers` averages the multiplier and multiplies by `provinces`. That averaging should also be re-checked in 2.2, since per-province capacities should be summed. Fix now (one line) or explicitly defer to 2.2.
3. **Free tribute when `currentThreatTributeAp` is 0.** Happens with a state in `THREAT_HERALD` that did not go through the transition, e.g. a migrated v1 save sitting in `THREAT_HERALD` (`probe3` K3: tribute succeeds with 0 AP). Fix: `SELECT_THREAT_RESPONSE` recomputes the threat from `config.quotas` for deadline + 1 when the fields are 0, or `migrateV1ToV2` fills them when the phase is `THREAT_HERALD`. Low severity.
4. **Float drift between the two clocks (minor).** After 2,000 ticks of 0.05 s, `totalElapsedSeconds = 200` while `deadlineTimeSeconds = 99.99999999998`, so the audit fires one tick later and `executeReplay(…, maxDuration = 200)` ends without auditing D2. Suggest snapping: if `100 - deadlineTimeSeconds < 1e-9`, treat the deadline as complete.
5. **Replay step-size claim.** `replay.spec.ts` compares dt 0.05 with dt **0.7** over 150 s. The Sign-Off §4.5 asks for 0.05 vs **1.0** (the full 20-journal check belongs to Task 3.5). Ask why 0.7 was chosen and whether the 1.0 comparison fails. In probe2-T (2 deadlines, purchases every 5 s), AP drift is 0.3 % at dt 1.0 but 2.2 % at dt 0.7, because 0.7 does not divide the 5 s timestamps. So drift depends on command timing alignment, which matters for Task 3.5.

## Remaining checks before giving the verdict

- [ ] Read the main Phase 1 diffs not reviewed yet: `commands.ts` (DISBAND_UNIT mutiny window, edict multipliers, `RESUME_GOVERNANCE` guard, removal of `COMBAT_RESOLUTION`), `battle.ts` (casualty split between `soldier` and `man_at_arms`, loot cap, salvage using the repelled threat's tribute), `engine.ts` (`stepDt` / `pendingDeadlineAudit`, 10 s raid check on the `events` stream, `interimWarningOnTrack`, `forcedTitheFreezeTimer`), `migrations.ts` (NaN / future schema rejection, `GRA-v1:` kept).
- [ ] Check that `TickStatCache` is invalidated when commands mutate units or modifiers within the same tick: `calculateMaxPopulation` caches on `tickIndex`, so a `BUY_UNIT` of a notable followed by another `BUY_UNIT` in the same tick could read a stale cap.
- [ ] Check that the surprise-raid probability uses the military quota from `config.quotas`, and that the raid power is `0.5 × MilitaryQuota`.
- [ ] Spot-check that the modified tests in `engine.spec.ts`, `modifiers.spec.ts`, `phases.spec.ts`, `balance.spec.ts` and `migrations.spec.ts` were only changed where the plan allows, not weakened.
- [ ] Then answer the user with the verdict (validate Phase 1 or not) and a message for the agent covering findings 1–5 plus anything new.
