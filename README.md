# The Grand Audit (Le Grand Audit)

> Roguelike bureaucratic incremental management game. 100% offline, self-contained single-page application compiled into a single `index.html`.

---

## 1. Project Overview

**The Grand Audit** puts the player in the role of a feudal lord facing ten consecutive inspections from the Crown. At each deadline, the player must demonstrate stability across at least **two out of three orders**:
1. **The People** (Demographics, tax base, civil caps)
2. **Administration** (Administrative Power generation, paperwork mitigation)
3. **The Military** (Armed strength, threat defense, tactical campaigns)

Runs last 15 to 20 minutes, featuring deterministic pause periods for Crown laws, steward events, and tactical risk wagers.

---

## 2. Documentation Directory (`docs/`)

All project specifications, architecture guidelines, and engineering roadmaps are maintained in [`docs/`](./docs/):

| Document | Description |
| :--- | :--- |
| **[Master Technical & Game Design Guide](./docs/GUIDE.md)** | **Definitive master guide:** All 30 laws, 20 steward dilemmas, threats catalog, enemy factions & reactive traits, complete mathematical formulas, and audio architecture. |
| **[Implementation Roadmap & Plan](./docs/PLAN.md)** | **Implementation plan:** Phased task checklist from pure TS engine (`src/core/`), data catalogs, headless bot simulation test suite, Pinia stores, and Vue components. |
| **[Game Systems & Rules](./docs/GAME_RULES.md)** | Unit tiers, dual-tier scaling ($1.07 / 1.05$), logistic demographic growth, civil colonisation, non-quadratic collectors, and tactical battles. |
| **[Vue.js Best Practices & Standards](./docs/VUE_BEST_PRACTICES.md)** | Architecture patterns, performance guidelines, TSDoc standards, error handling, and component separation rules. |
| **[Audio Engine Best Practices](./docs/AUDIO_BEST_PRACTICES.md)** | Web Audio API architecture, autoplay unlocking, polyphony control, voice stealing, and asset weight optimization. |
| **[Asset Pipeline & Typography](./docs/ASSETS.md)** | Integration guide for curated Game-Icons.net SVGs, local WOFF fonts, and soundtrack streaming. |
| **[Single Source of Truth (`balance.ts`)](./src/data/balance.ts)** | Master TypeScript balance file containing all canonical constants, unit definitions, scaling curves, and modifier contracts. |
| **[Archived Early PoC Document](./docs/archive/GDD_POC_OBSOLETE.md)** | *[Obsolete / Archived]* Initial early draft of the PoC concept. |
| **[Documentation Directory Index](./docs/INDEX.md)** | Index of all documentation resources. |

---

## 3. Tech Stack & Architecture

- **Runtime & UI Framework:** Vue 3 (Composition API, `<script setup lang="ts">`)
- **State Management:** Pinia
- **Styling:** Tailwind CSS (Medieval parchment & ink palette, Voxel Lab `#F60887` royal wax accent, responsive UI)
- **Engine Core:** Pure TypeScript (`src/core/`), completely decoupled from DOM and Vue reactivity
- **Single-File Bundler:** Vite + `vite-plugin-singlefile` (compiles scripts, styles, SVGs, and fonts into one standalone `dist/index.html`)
- **Unit Testing:** Vitest (runs math formulas & headless simulation bots)
- **Component & Integration Testing:** Playwright (Cross-browser testing across Firefox, Chromium, WebKit)

---

## 4. Development Workflow & Commands

### Prerequisites
- Node.js `^22.18.0` or `>=24.12.0` (the `engines` field of `package.json`)
- npm >= 10.x

### Commands

```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Build production single-file bundle (dist/index.html)
npm run build

# Preview production build
npm run preview

# Lint code and detect errors
npm run lint

# Format code with Prettier
npm run format
```

### Testing Commands Matrix (Vitest & Playwright)

```bash
# Run pure engine unit tests with Vitest
npm run test:unit

# Run unit tests in watch mode
npm run test:unit:watch

# Run Playwright E2E & Browser tests targeting Firefox specifically
npm run test:e2e:firefox

# Run Playwright tests targeting Chromium
npm run test:e2e:chromium

# Run full multi-browser test suite (Firefox, Chromium, WebKit)
npm run test:e2e

# Open interactive Playwright UI runner
npm run test:e2e:ui
```

---

## 5. Coding & Documentation Standards

- **Language:** **English only** across all code files, variable names, interfaces, store actions, comments, and commit messages. No French in source code.
- **Concise Logic & TSDoc:**
  - Avoid text walls in comments.
  - Every function, data structure, type, and mathematical model must declare a formal TSDoc block specifying purpose, parameters, and return types.
- **No God-Components:** Keep UI components focused on visual presentation and user inputs. Delegate all mathematical mutations to `src/core/`.
