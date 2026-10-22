# Documentation Directory (`docs/`)

This directory contains technical guides, system design specifications, balance documentation, and implementation roadmaps for **The Grand Audit**.

---

## Documents Index

1. **[Master Technical & Game Design Guide](./GUIDE.md)**
   * **The definitive master reference guide:** All game systems, the 30 laws, the 20 steward dilemmas, the crown threats catalog, reactive enemy traits, economic curves, logistic demographic growth, Web Audio API engine, and asset pipelines.

2. **[Implementation Roadmap & Plan](./PLAN.md)**
   * **Scoped implementation roadmap:** Phased delivery architecture: V1 Headless Engine & Simulation (Validation Gates A to E) and V2 Playability & Presentation, pure TypeScript core engine (`src/core/`), universal modifier system, versioned save migrations, automated 3-tier bot simulations, and modular presentation components.

3. **[Game Systems & Rules](./GAME_RULES.md)**
   * In-depth balance specifications: Dual-tier scaling ($1.07 / 1.05$), logistic population growth ($r_0 = 0.005$), civil colonisation, non-quadratic collectors, single-clash tactical battles with scout risks, false loot mechanics, emergency edicts, and scoring formulas.

4. **[Vue & TypeScript Standards](./VUE_BEST_PRACTICES.md)**
   * Mandatory patterns, anti-god-component rules, English-only code conventions, TSDoc requirements, and Vitest/Playwright testing standards.

5. **[Audio Engine Best Practices](./AUDIO_BEST_PRACTICES.md)**
   * Web Audio API architecture, autoplay unlocking, bus routing, voice stealing, and asset weight optimization for single-file builds.

6. **[Asset Integration & Style Guide](./ASSETS.md)**
   * Integration pipeline for curated Game-Icons.net SVGs, local WOFF fonts, and soundtrack streaming.

7. **[Archived Initial PoC Design Document](./archive/GDD_POC_OBSOLETE.md) [OBSOLETE]**
   * *Archived:* Initial early draft of the PoC concept. Superseded by `GUIDE.md`, `GAME_RULES.md`, and the single source of truth [`src/data/balance.ts`](../src/data/balance.ts).

8. **[Making-of: Core Engine Overhaul & Calibration](./making/README.md)**
   * **Engineering & Architecture Journal:** Detailed post-mortem and rationale of the Core engine overhaul, newly implemented systems (PRNG, battle, replay, migrations), bug resolutions (ANOM-01 to ANOM-15), full test matrix, and 3-tier bot simulation balance calibration.

