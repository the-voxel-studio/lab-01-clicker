# Vue.js Development Best Practices & Coding Standards

This document establishes the architecture patterns, coding conventions, performance guidelines, error handling strategies, and testing workflows for this project.

---

## 1. Core Principles & Philosophy

1. **Strict Language Rule:** All code, identifiers, types, interfaces, files, commit messages, and comments MUST be written in **English only**. No French in code.
2. **Concise Logic & Mandatory Docstrings:**
   - Avoid verbose text walls in code comments. Focus on non-obvious logic, mathematical formulas, and state side-effects.
   - **Every** function, interface, type, store action, and game formula must have a clean TSDoc/JSDoc block.
3. **Decoupled Architecture (Engine vs UI):**
   - The game engine logic (`src/core/`) must remain **pure TypeScript** with zero dependencies on Vue, DOM, or browser APIs (except `performance.now()` for delta-time).
   - Vue components (`src/ui/`) act strictly as a presentation and user-input layer.

---

## 2. Component Architecture & Anti-Patterns

### 2.1 The Anti-"God-Component" Rule
- **Single Responsibility Principle (SRP):** A single component must never manage game calculation, layout, audio, modales, and state manipulation at the same time.
- **Component File Size Budget:** Any SFC exceeding 200 lines of template/script is a candidate for splitting into smaller atomic components.
- **Dedicated Domain Components:**
  - `<OrderSection>` delegates to `<RoleCard>`, which delegates to `<RoleActionButton>`.
  - Modals (`<EventModal>`, `<LawModal>`, `<BattleModal>`) are rendered via dedicated wrapper state, not embedded directly within `<App.vue>`.

### 2.2 Script Setup & Composition API Standards
- Always use `<script setup lang="ts">`.
- Group script contents in this exact order:
  1. Imports (Vue, Pinia stores, core engine, sub-components, types)
  2. Type definitions & interfaces local to the component
  3. `defineProps` and `defineEmits` (strictly typed with TypeScript syntax)
  4. Pinia store instances
  5. Component state (`ref`, `computed`)
  6. Methods and event handlers
  7. Lifecycle hooks (`onMounted`, `onUnmounted`)

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import type { OrderType } from '@/core/types'

/** Component property contract. */
interface Props {
  /** The target order identifier to render. */
  orderType: OrderType
  /** Whether user interactions are currently locked. */
  isLocked?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isLocked: false,
})

const emit = defineEmits<{
  /** Emitted when an order action is triggered. */
  (e: 'select', orderType: OrderType): void
}>()

const store = useGameStore()
const currentQuota = computed(() => store.getQuotaForOrder(props.orderType))
</script>
```

---

## 3. State Management (Pinia & Pure Engine Bridge)

- **Separation of Concerns:**
  - **`src/core/` (Pure Engine):** Holds state mutations, numerical formulas, and simulation loops.
  - **`src/stores/` (Pinia):** Holds reactive references, delegates mutations to the core engine, handles tick subscriptions, and triggers local storage persistence.
- **Shallow Reactivity for Heavy Engine Objects:**
  - Game state objects with high update frequency (ticks at 60 FPS or 20 Hz) should avoid deep proxy wrapping overhead. Use `shallowRef` or keep engine calculation raw, exposing only UI-critical values reactively.

---

## 4. Performance Optimizations for Incremental Browser Games

1. **Decoupled Tick Rate vs Render Rate:**
   - Run the simulation loop at a fixed step (e.g., 10 or 20 ticks/second) using delta-time.
   - Synchronize UI renders using `requestAnimationFrame`, updating only displayed interpolation numbers.
2. **Computed Caching:**
   - Never compute heavy calculations (e.g., bureaucracy multipliers, total military power) inside templates. Always memoize with `computed()`.
3. **Template Directives (`v-show` vs `v-if`):**
   - Use `v-show` for modals and tabs that toggle repeatedly during a single session (prevents remount overhead).
   - Use `v-if` only for rare branches (such as the End Game / Victory Screen).
4. **Single-File Bundling Constraints:**
   - Inlining SVGs, fonts, and scripts into a single `index.html` requires tree-shaking:
   - Import only required icons from `assets/icons/`. Do not wildcard-import thousands of unused SVGs.

---

## 5. Console Error Handling & Resilience

1. **Global Vue Error Handler:**
   - Trap rendering errors in `main.ts` using `app.config.errorHandler`.
   - Prevent silent crashes; log structured error payloads into a local diagnostic store without polluting the user experience.
2. **Window & Promise Catchers:**
   - Capture uncaught promises (`window.addEventListener('unhandledrejection')`) and runtime exceptions (`window.addEventListener('error')`).
3. **Safe Storage Deserialization:**
   - When loading save states from `localStorage`, always validate schemas and version signatures. Fall back gracefully to initial default state on corruption instead of throwing unhandled exceptions.

---

## 6. Testing Strategy & Browser Matrix (Vitest & Playwright)

Because the game is contained in a single offline HTML bundle, tests are structured into two lean, high-value tiers:

### 6.1 Unit & Headless Engine Tests (Vitest)
- **Scope:** 100% focused on `src/core/` and `src/data/`.
- **Target:**
  - Game formulas (`calculateBureaucracy`, `calculateNetAdministrativePower`, `calculateRevoltPressure`).
  - Victory/defeat condition checks.
  - Headless simulation bots (ensuring balance curves allow winning without deadlocks).
  - Fast component unit tests using `@vue/test-utils` where isolated rendering verification is required.

### 6.2 Browser Integration & E2E Testing (Playwright)
- **Scope:** Real-browser rendering, input interactions, local storage persistence, and verifying the compiled `dist/index.html` bundle.
- **Browser targeting:** Multi-browser test runners including explicit Firefox targets.

#### Command Matrix
```bash
# Run pure engine unit tests
npm run test:unit

# Run unit tests in watch mode
npm run test:unit:watch

# Run Playwright tests on Firefox specifically
npm run test:e2e:firefox

# Run Playwright tests on Chromium
npm run test:e2e:chromium

# Run full cross-browser test suite
npm run test:e2e

# Open interactive Playwright UI runner
npm run test:e2e:ui
```

---

## 7. Documentation Standards (TSDoc)

Every function and interface must declare its intent, parameters, and return value.

```typescript
/**
 * Calculates net administrative power generated during a given time slice.
 *
 * @param grossProduction - Cumulative raw production from scribes and taxes.
 * @param bureaucracyRatio - Current administrative inertia percentage [0, 1].
 * @param totalUpkeep - Ongoing upkeep cost per second across all active roles.
 * @returns The net administrative power gained (can be negative during bankruptcies).
 */
export function calculateNetPower(
  grossProduction: number,
  bureaucracyRatio: number,
  totalUpkeep: number
): number {
  return grossProduction * (1 - bureaucracyRatio) - totalUpkeep
}
```
