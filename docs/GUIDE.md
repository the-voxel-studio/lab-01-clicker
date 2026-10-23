# The Grand Audit (Le Grand Audit) – Technical & Game Design Guide

> **Master Reference & Technical Specification Guide**  
> Feudal Roguelike Bureaucratic Incremental Game. 100% offline, self-contained single-page application compiled into a standalone `dist/index.html`.

---

## Table of Contents

1. [High-Level Architecture & Tech Stack](#1-high-level-architecture--tech-stack)
2. [Core Loop & Run Structure](#2-core-loop--run-structure)
3. [Economic Formulas & Scaling Mathematics](#3-economic-formulas--scaling-mathematics)
4. [The Demographic Engine & Dynamic Caps](#4-the-demographic-engine--dynamic-caps)
5. [The Three Orders & 24 Feudal Units](#5-the-three-orders--24-feudal-units)
6. [The 30 Imperial Laws (Exhaustive Catalog)](#6-the-30-imperial-laws-exhaustive-catalog)
7. [The 20 Steward Dilemmas (Exhaustive Catalog)](#7-the-20-steward-dilemmas-exhaustive-catalog)
8. [The Crown Threats Catalog (Deadlines 3 to 10)](#8-the-crown-threats-catalog-deadlines-3-to-10)
9. [Enemy Factions & Reactive Traits (Player-State Influenced)](#9-enemy-factions--reactive-traits-player-state-influenced)
10. [Tactical Battles, Reconnaissance & Province Biomes](#10-tactical-battles-reconnaissance--province-biomes)
11. [Crisis Mechanics & Emergency Edicts](#11-crisis-mechanics--emergency-edicts)
12. [Meta-Progression (The National Archives) & Royal Feats](#12-meta-progression-the-national-archives--royal-feats)
13. [Web Audio Engine Architecture](#13-web-audio-engine-architecture)
14. [Asset Pipeline (Icons, Typography & Audio)](#14-asset-pipeline-icons-typography--audio)
15. [Automated Headless Simulation Bots (Vitest)](#15-automated-headless-simulation-bots-vitest)

---

## 1. High-Level Architecture & Tech Stack

### 1.1 Technology Stack
- **Framework & Runtime:** Vue 3 (Composition API, `<script setup lang="ts">`).
- **State Layer:** Pinia (stores act strictly as reactive bridges between engine and UI).
- **Core Engine:** Pure TypeScript (`src/core/`), completely isolated from the DOM, browser window, and Vue reactivity.
- **Styling:** Tailwind CSS with a feudal ink-and-parchment theme (`bg-fief-bg`, `text-royal-gold`, `wax-red`, `peasant-green`).
- **Bundler:** Vite with `vite-plugin-singlefile`, compiling all scripts, stylesheets, inlined SVGs, and base64/WOFF fonts into a single offline `dist/index.html`.
- **Testing Suite:**
  - **Vitest:** Headless unit tests, numerical model validation, and automated archetype simulation bots.
  - **Playwright:** End-to-end multi-browser test coverage (Firefox, Chromium, WebKit).

### 1.2 Strict Separation of Concerns (Core vs UI)
```
┌─────────────────────────────────────────────────────────────┐
│                       Vue 3 UI Layer                        │
│  (src/components/, src/App.vue - Presentation & User Input) │
└──────────────────────────────┬──────────────────────────────┘
                               │ Dispatches Actions / Reads Computed State
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Pinia Bridge Store                       │
│    (src/stores/game.ts - Shallow Reactivity, Persistence)   │
└──────────────────────────────┬──────────────────────────────┘
                               │ Ticks fixed-step delta-time (20 Hz)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Pure TypeScript Core Engine                 │
│         (src/core/ - State Mutations, PRNG, Formulas)       │
└─────────────────────────────────────────────────────────────┘
```

- **English-Only Codebase:** All code files, interfaces, variable names, unit tests, and commit messages are strictly in English.
- **TSDoc Standard:** Every function, mathematical formula, and data contract declares formal TSDoc documentation.
- **Single Responsibility:** UI components stay strictly under 200 lines, delegating calculations to `src/core/`.

---

## 2. Core Loop & Run Structure

### 2.1 The Ten Deadlines
- A run spans **10 deadlines** lasting **100 seconds** of active game time each (~16.6 minutes active play).
- Time pauses automatically during **Council Phases** (Law selections, Steward Dilemmas, and Tactical Battles).
- **The Two-Out-Of-Three Rule:** At each deadline inspection, the Crown evaluates three criteria:
  1. **Administrative Power (AP Rate):** Instantaneous gross AP production rate in AP/s evaluated at the moment of inspection (`ApRateQuota`). Defined as `calculateGrossApRate(state).total` (unit baseline production, poll tax, order multipliers, crisis penalties like boycott/rebellion, and `gross_ap_rate` modifiers, prior to paperwork drag and upkeep). Capital transfers (edicts, loans, plunder, salvage) and manual clicks do not count toward this quota rate.
  2. **Total Population:** Living population across all provinces at the instant of inspection.
  3. **Military Power:** Total active military power at the instant of inspection.
- The player must satisfy at least **2 out of 3 criteria** to pass.

#### 2.2 Calibrated Quota Matrix Across All 10 Deadlines
> [!NOTE]
> **Matrix Status: Provisional (recalibrated by the Task 3.2 solver) (`src/data/balance.generated.ts`).**  
> The quotas below match `DEADLINE_QUOTAS` in `src/data/balance.generated.ts`. On the AP axis, the quota represents the **instantaneous gross AP rate (AP/s)** at audit inspection. Quotas are calibrated by the headless simulation and balance script (`scripts/generate-balance-report.ts`) via the coupled formula $\text{Quota}_k = c \times \text{MedianGreedyBotScore}_k$. The coefficient $c$ is solved algorithmically by the script until the greedy bot (evaluating balanced utility across AP, Population, and Military) stabilizes strictly within the target band of **35% – 65% win rate**.

| Deadline | Gross AP Rate Quota (AP/s) | Total Population | Military Combat Power | Unlocks & Key Milestones |
| :---: | :---: | :---: | :---: | :--- |
| **1** | 5 AP/s | 180 Pop | 12 Power | Clicks, Scribes, Peasants, Tax Slider, FTUE Tutorial |
| **2** | 12 AP/s | 300 Pop | 22 Power | Supervisors, Archivists, Artisans, Clergy, First Law |
| **3** | 22 AP/s | 450 Pop | 30 Power | Soldiers, Collectors, First Threat, 10× Bulk Buy |
| **4** | 35 AP/s | 600 Pop | 40 Power | Tier II Patents, Sergeants, Scouts, Civil Colonisation |
| **5** | 55 AP/s | 780 Pop | 55 Power | All Tier II roles accessible, 2× Fast-Forward toggle |
| **6** | 85 AP/s | 980 Pop | 75 Power | 50× Bulk Buy, Escalated threats |
| **7** | 130 AP/s | 1,200 Pop | 105 Power | High-level threats, severe paperwork pressure |
| **8** | 195 AP/s | 1,480 Pop | 140 Power | 100× Bulk Buy (Peasants & Scribes), Imperial Invasions |
| **9** | 285 AP/s | 1,800 Pop | 180 Power | Penultimate Crown Audit, Grand Host armies |
| **10** | 420 AP/s | 2,200 Pop | 230 Power | **The Grand Audit Final Inspection (Victory)** |

### 2.3 The Royal Pardon (Yellow Card Grace Rule)
- **One Strike Permitted (Deadlines 1 to 9):** The first time a player meets fewer than 2 out of 3 quotas at a deadline prior to Deadline 10, the Crown issues a **Royal Censure**:
  - The Crown forcibly confiscates **1 Province** (the last acquired province in LIFO order) and **50% of the player's positive AP treasury** ($\text{Fine} = 0.50 \times \max(0, \text{AP})$). Debt (negative AP) is never halved or erased.
  - **The Hard Province Floor Rule:** Fines and bailouts (Royal Censure, Lombard Loan) enforce a **hard floor of 1 province**. The Crown never strips the player's final sovereign seat through administrative censure. However, this floor **does not protect against foreign military conquest**: a defensive collapse in battle when holding only 1 province seizes that final province and immediately triggers defeat by conquest (`conquest`).
  - The run continues into the next deadline.
- **Second Failure or Final Inspection (Deadline 10) Failure:** A second quota failure—or failing the **Deadline 10 Grand Audit** even with zero prior strikes—results in immediate royal execution (Game Over, `quota_failure`).

### 2.4 Mid-Deadline Audit Warning (50-Second Mark)
- At exactly $t = 50\text{ s}$ of each deadline, a deterministic interim projection (`interimWarningOnTrack: boolean`) checks:
  1. $\text{GrossAP/s}_{50\text{s}} \ge \text{ApRateQuota}$ (the instantaneous gross AP rate at $t = 50\text{s}$ is directly compared to `ApRateQuota`, without extrapolation)
  2. $\text{TotalPopulation}_{50\text{s}} \ge \text{PopQuota}$
  3. $\text{MilitaryPower}_{50\text{s}} \ge \text{MilitaryQuota}$
- If $\ge 2$ criteria are met, `interimWarningOnTrack = true` (green commendation). If $< 2$ criteria are met, `interimWarningOnTrack = false` and an alert banner flashes (*"Quotas lagging! Mobilize resources immediately!"*) with an audio cue.

### 2.5 Victory & Defeat Conditions
- **Victory:** Pass Deadline 10 (The Grand Audit). The score counts a *victory* for every offensive campaign won with $R \ge 1.00$ (razor-thin margin included) and every repelled defensive clash.
- **Defeat Modes:**
  1. *Quota Failure:* Failing 2 out of 3 quotas for a second time, or failing Deadline 10 (even with 0 strikes).
  2. *Peasant Revolution:* Unrest reaches 100% at any moment in any phase (instant defeat, `revolution`).
  3. *Bankruptcy:* Net AP negative for 30 consecutive seconds without recovery.
  4. *Invasion / Conquest:* Losing the last province to foreign military conquest (0 provinces remaining, `conquest`).

---

## 3. Economic Formulas & Scaling Mathematics

### 3.1 The Royal Seal Click ("Affixing Decrees")
$$\text{ClickValue} = \Big[ 1 + \max\big(0, \text{Gross AP/s} \times 0.035\big) \Big] \times \text{SealMultiplier}$$
- **Starting Setup & Economics:** At second 0 (no passive income), 1 click = **1 AP**. With the starting treasury of 50 AP (`STARTING_AP = 50`), the player can recruit their first Scribes immediately.
- **Critical Stamp:** 5% chance on each click to trigger an Imperial Seal delivering **$3\times$ Click Value**.
- **The Lord's Privilege:** Manual clicks bypass 50% of paperwork inertia ($\text{Friction} = 0.5 \times \text{Paperwork}$). Clicks serve as an economic bootstrap and emergency treasury liquidity tool, but do not contribute to the instantaneous Gross AP Rate inspection quota.
- **Ergonomic Click Ceiling (Token Bucket):**
  - Designed as an ergonomic comfort safeguard, implemented via an engine **token bucket** of **12 tokens per second**.
  - Tokens are refilled strictly through the engine's injected delta-time tick loop (not `Date.now()`), ensuring pure determinism in tests and bot simulations.

### 3.2 Dual-Tier Geometric Cost Scaling & Bulk Modes
To prevent runaway exponential costs while preserving linear yields, unit costs use separate geometric ratios for each tier:
- **Tier I Units:** Scale at ratio **$1.07$** per unit owned: $\text{Cost}_I(n) = \text{Base} \times 1.07^n$.
- **Tier II Units:** Scale at ratio **$1.05$** per unit owned: $\text{Cost}_{II}(n) = \text{Base} \times 1.05^n$.

*Amortization Balance:* With ratio $1.07$, Scribe payback period remains viable through early and mid run: at $n=25$, cost is $\approx 81$ AP (payback 163s); at $n=35$, cost is $\approx 160$ AP (payback 320s); at $n=40$, cost is $\approx 225$ AP (payback 449s). Beyond $n \approx 35-40$, Tier I Scribes hit an amortization ceiling (payback reaches 884s at $n=50$). Tier II Clerks (ratio $1.05$, yielding +4.0 AP/s for 100 base cost) act as the necessary escape hatch when Tier I costs rise.

**Bulk Purchasing Formulas & Ceilings:**
To purchase $K$ units at current count $n$ with ratio $r \in \{1.07, 1.05\}$:
$$\text{TotalCost}(n, K, r) = \text{BaseCost} \times r^n \times \frac{r^K - 1}{r - 1}$$

Bulk modes define the **maximum allowable purchase quantity** in a single order:
- **1× Mode:** Available from game start (maximum purchase: 1).
- **10× Mode:** Unlocks at Deadline 3 (or Total Population $\ge 250$). Maximum purchase: $\le 10$.
- **50× Mode:** Unlocks at Deadline 6 (or Total Population $\ge 1,000$). Maximum purchase: $\le 50$.
- **100× Mode:** Unlocks at Deadline 8, **restricted to high-volume low-cost roles (Peasants and Scribes)**. Maximum purchase: $\le 100$.

Any integer quantity from 1 to the current unlocked maximum bulk size is valid. Arbitrary quantities above the maximum (e.g., 99 in Deadline 1) are rejected.
- **Buy Max:** Computes maximum affordable $K = \min\big(\text{AffordableByAP}, \lfloor\text{FreeSerfs}\rfloor, \lfloor\text{OrderHeadroom}\rfloor, \text{MaxBulkSize}\big)$.

### 3.3 Bureaucratic Inertia (Paperwork Formula)
$$\text{Size} = \sum (\text{Tier I} \times 1 + \text{Tier II} \times 2) + 0.5 \times \text{Soldiers} + 10 \times \text{Provinces}$$
$$\text{RawPaperwork} = \frac{\text{Size}}{\text{Size} + 220}$$
$$\text{NetPaperwork} = \text{RawPaperwork} \times (1 - \text{ArchivistReduction})$$
$$\text{Net AP/s} = \text{Gross AP/s} \times (1 - \text{NetPaperwork}) - \text{TotalUpkeep}$$

---

## 4. The Demographic Engine & Dynamic Caps

### 4.1 Demographic Balance Equation
$$\text{Total Population} = \text{Free Serfs} + \sum \text{People Roles} + \sum \text{Administrators} + \sum \text{Soldiers}$$
- **Direct Deduction:** Every recruited administrator or soldier converts 1 Free Serf.
- **Poll Tax Base:** Only Free Serfs pay the direct poll tax ($0.02\text{ AP/s} \times \text{TaxRate}$).
- **Permanent Casualties:** Combat losses permanently reduce Total Population.

### 4.2 Housing Capacity & Civil Colonisation
$$\text{BaseCap} = 250 \times \text{Provinces} \quad (\text{Starting capacity: } 3 \text{ provinces} = 750)$$
$$\text{MaxPopulation} = \text{BaseCap} \times \big[1 + (0.015 \times \text{Notables}) + (0.06 \times \text{Barons}) + \text{Modifiers}\big]$$

- **The Civil Colonisation Route:** To allow Bureaucrat players to expand without an army, players can peacefully colonise wilderness provinces via executive decree:
  $$\text{ColonisationCost}(k) = 1500 \times 2^k \text{ AP}$$
  *(where $k$ is the number of previously colonised provinces).*

- **Dynamic Order Caps:**
  - Total Administration Allocation: $\le 15\% \times \text{MaxPopulation}$.
  - Total Military Allocation: $\le 12\% \times \text{MaxPopulation}$.
  - Total Specialized People Allocation: $\le 25\% \times \text{MaxPopulation}$.

### 4.3 Proportional Logistic Growth
Rather than slow sub-linear additions, population follows a true proportional logistic curve:
$$\text{Growth/s} = r \times \text{TotalPopulation} \times \left(1 - \frac{\text{TotalPopulation}}{\text{MaxPopulation}}\right) \times \text{FiscalFactor}$$
- **Base Rate parameter:** $r_0 = 0.005$ ($0.5\%/\text{s}$), declared as a central pacing parameter in `src/data/balance.ts`.
- **Peasants & Farmers Modulation:** Each Peasant adds $+0.0005$ to $r$; each Farmer adds $+0.003$ to $r$.
- **Fiscal Factor:** $\text{FiscalFactor} = \max\left(0.1, 1 - \frac{\max(0, \text{TaxRate} - 25)}{50}\right)$.

---

## 5. The Three Orders & 24 Feudal Units

### 5.1 Tier II Access Rules (Royal Patents)
Unlocking Tier II units within an Order requires:
1. Reached at least **Deadline 4**.
2. Maintaining at least **12 active Tier I units** in that Order.
3. Purchasing the royal charter (one-time AP fee):
   - *The People:* **Charter of Urban Franchises** (500 AP).
   - *Administration:* **Chancery Letters Patent** (600 AP).
   - *The Military:* **Edict of Feudal Chivalry** (700 AP).

### 5.2 The People (Demographic Engine)
| Role | Tier | UnitId | Base Cost (r) | Upkeep | Effect |
| :--- | :---: | :--- | :---: | :---: | :--- |
| **Producer** | I | `peasant` | 20 AP (1.07) | 0 AP/s | +0.05% to logistic growth parameter $r$. |
| **Producer** | II | `farmer` | 120 AP (1.05) | 0.10 AP/s | +0.30% to logistic growth parameter $r$. |
| **Multiplier** | I | `artisan` | 60 AP (1.07) | 0 AP/s | +0.5% tax revenue efficiency. |
| **Multiplier** | II | `guild` | 300 AP (1.05) | 0.30 AP/s | +3.5% tax efficiency; +1% AP from plunder. |
| **Reducer** | I | `clergy` | 50 AP (1.07) | 0 AP/s | -0.02 Unrest/s continuous pacification. |
| **Reducer** | II | `prelate` | 250 AP (1.05) | 0.50 AP/s | -0.15 Unrest/s pacification; -20% tax unrest. |
| **Special** | I | `notable` | 150 AP (1.07) | 0 AP/s | +1.5% to housing capacity and all order caps. |
| **Special** | II | `baron` | 800 AP (1.05) | 2.00 AP/s | +6.0% to housing capacity and all order caps. |

### 5.3 The Administration (Fiscal & Bureaucratic Engine)
| Role | Tier | UnitId | Base Cost (r) | Upkeep | Effect |
| :--- | :---: | :--- | :---: | :---: | :--- |
| **Producer** | I | `scribe` | 15 AP (1.07) | 0 AP/s | +0.50 gross AP/s. |
| **Producer** | II | `clerk` | 100 AP (1.05) | 0.50 AP/s | +4.00 gross AP/s (counts double in paperwork size). |
| **Multiplier** | I | `supervisor` | 80 AP (1.07) | 0 AP/s | +2.0% production to all Scribes & Clerks. |
| **Multiplier** | II | `provincial_steward` | 400 AP (1.05) | 1.00 AP/s | +9.0% production to all Scribes & Clerks. |
| **Reducer** | I | `archivist` | 70 AP (1.07) | 0 AP/s | -1.5% to total paperwork inertia index. |
| **Reducer** | II | `audit_chamber` | 350 AP (1.05) | 1.00 AP/s | -6.5% to paperwork; +10s bankruptcy grace timer. |
| **Special** | I | `collector` | 120 AP (1.07) | 0 AP/s | +0.80 AP/s per covered 100 free serfs (non-quadratic). |
| **Special** | II | `farmer_general` | 600 AP (1.05) | 2.00 AP/s | +4.50 AP/s per covered 100 free serfs (non-quadratic). |

*Continuous Non-Quadratic Special Collector Yield:*  
Instead of multiplying units by the entire serf population, collectors share a finite pool of free serfs without an integer floor (preventing early-game stalls when free serfs < 100):
$$\text{CollectorOutput} = \text{YieldRate} \times \min\left(n, \frac{\text{FreeSerfs}}{100}\right)$$

### 5.4 The Military (Force, Reconnaissance & Expansion)
| Role | Tier | UnitId | Base Cost (r) | Upkeep | Effect |
| :--- | :---: | :--- | :---: | :---: | :--- |
| **Producer** | I | `soldier` | 25 AP (1.07) | 0.30 AP/s | +1.0 Military Power. |
| **Producer** | II | `man_at_arms` | 150 AP (1.05) | 1.50 AP/s | +7.0 Military Power; +0.5 province defense. |
| **Multiplier** | I | `sergeant` | 100 AP (1.07) | 0 AP/s | +1.5% military power; +2% campaign loot. |
| **Multiplier** | II | `captain` | 500 AP (1.05) | 1.00 AP/s | +7.0% military power; reduces combat casualties by 5%. |
| **Reducer** | I | `quartermaster` | 90 AP (1.07) | 0 AP/s | -1.5% total military upkeep cost. |
| **Reducer** | II | `grand_marshal` | 450 AP (1.05) | 1.00 AP/s | -7.0% total military upkeep cost. |
| **Special** | I | `scout` | 110 AP (1.07) | 0.10 AP/s | Narrows enemy power uncertainty by 12 points. |
| **Special** | II | `spymaster` | 550 AP (1.05) | 2.00 AP/s | Narrows uncertainty by 30 points; reveals ambushes & false loot. |

---

## 6. The 30 Imperial Laws (Exhaustive Catalog)

During the Inter-Deadline Council phase, the player receives 3 cards (1 from the Chancellor, 1 from the Prelate, 1 from the Marshal). The player may enact 1 law (max 5 active slots) or reject all for +1 Archive Point.

### 6.1 The Chancellor's Decrees (Administration & Treasury – 10 Laws)
1. **Royal Scriptorium:** +50% Scribe gross AP production | +20% paperwork inertia.
2. **General Cadastre:** -25% paperwork inertia | +2.0 AP/s maintenance upkeep per owned province.
3. **Exceptional Tithe:** +80% gross AP production until the next audit | +30 immediate Unrest at that audit, then the law is repealed and frees its slot.
4. **Single Window Bureaucracy:** Archivists reduce paperwork at double efficiency | Supervisors production multiplier cut by 50%.
5. **Stamp Duty Monopoly:** Executive clicks generate +100% more AP | Free serf tax yield reduced by -15%.
6. **Crown Trade Monopolies:** +25% gross AP output across all sources | All Tier I unit recruitment costs increased by +25%.
7. **Chancery Red Tape:** Bankruptcy grace countdown extended from 30s to 50s | Base paperwork inertia increased by +15%.
8. **Corvée Exemption Tax:** +30% tax revenue efficiency | Peasant demographic growth reduced by -25% (logistic growth rate r x0.75).
9. **Auditors' Inquisition:** Audit Chamber units grant double paperwork mitigation | Generates +15 Unrest at each deadline audit.
10. **Imperial Bond Floating:** Instantly grants +3,000 AP treasury | Siphons -10% gross AP/s continuously to service imperial debt.

### 6.2 The Prelate's Ordinances (The People & Church – 10 Laws)
1. **Census Edict:** +25% maximum population capacity | Administration order cap reduced by 20%.
2. **Holy Days & Vigils:** -0.20 Unrest/s continuous pacification | -10% AP production across all sources.
3. **Primogeniture Decrees:** +20% province population capacity | Base demographic growth rate reduced by -20%.
4. **Grand Kermesse:** -25 Unrest immediately upon enactment | Costs 40 seconds of current net AP income (nothing when net income is not positive; refused when AP is below the cost).
5. **Sanctuary Rights:** Prevents soldier desertions when Unrest is below 90% only (desertions resume at 90%–99%) | Military unit recruit costs increased by +30%.
6. **Monastic Granaries:** +0.08 pop growth/s per 100 free serfs | Free serfs evade 10% of baseline poll taxes.
7. **Tithe Commutation:** Village Priests and Prelates have zero ongoing upkeep | Total realm tax revenue efficiency reduced by -10%.
8. **Sumptuary Edicts:** -15% civil upkeep across all People units | Click critical stamp probability reduced by 50%.
9. **Parish Relief Registers:** Completely prevents demographic stagnation during housing overcrowding | Consumes -5% gross AP/s.
10. **Papal Concordat:** -40% base Unrest generation | 1 active law slot is permanently pledged to the Holy See (cannot be replaced).

### 6.3 The Marshal's Mandates (The Military & War – 10 Laws)
1. **Standing Garrisons:** 60% of upcoming threat power is automatically absorbed | Total military upkeep increased by +30%.
2. **Merit Pay:** -30% total military upkeep costs | Only takes effect if the realm holds $\le 3$ provinces.
3. **Sanctioned Plunder:** Campaign battle loot value multiplied by $1.5\times$ | Each campaign battle causes +15 immediate Unrest.
4. **Officer Academies:** Sergeants and War Captains grant double combat power multipliers | Foot Soldier recruitment cost +20%.
5. **Feudal Retinue Levy:** Instantly recruits 15 Men-at-Arms | Consumes 15 Free Serfs and causes +20 immediate Unrest.
6. **Scorched Earth Doctrines:** Ambush probability on tactical campaigns reduced to 0% | Conquered provinces yield 50% less initial loot.
7. **Vanguard Drills:** Player battle roll bounds raised from $[0.92, 1.08]$ to $[1.05, 1.20]$ | Soldier casualties in battle increased by +15%.
8. **Guerrilla Border Watch:** Border Stronghold defensive traits provide double value | Passive military upkeep increased by +10%.
9. **Mercenary Capitulation:** Men-at-Arms can be recruited with AP without consuming Free Serfs | Their ongoing upkeep is doubled ($3.0\text{ AP/s}$).
10. **Marshal's Carte Blanche:** +25% total Military Power across the realm | Chancellor law cards cannot be enacted while it is active (the council still drafts them).

---

## 7. The 20 Steward Dilemmas (Exhaustive Catalog)

Occurs once at the conclusion of each deadline. The Steward speaks with a deferential, cynical feudal tongue. All choices with AP costs require `state.ap >= cost`; unaffordable choices are strictly rejected without advancing phase. Negative AP represents debt; no mechanic resets negative AP to zero.

### 1. The Taxable Windows
- **Trigger:** Gross income $> 150\text{ AP/s}$.
- **Narrative:** *"Sire, the peasants build wide casements to bask in God's light. Surely such illumination belongs to the Crown?"*
- **Choice A:** Tax the panes (+15% Tax Revenue, +15 Unrest).
- **Choice B:** Forbid the tax, letting them have their light (-10 Unrest, gain +1 Archive Point).

### 2. The Scribe Who Counted Too Much
- **Trigger:** Previous deadline passed with $< 15\%$ safety margin on Gross AP Rate ($\text{GrossAP/s} / \text{ApRateQuota} < 1.15$).
- **Narrative:** *"A miserable clerk has uncovered three ledgers of missing grain, Sire. He threatens to report to the King's Auditor unless given a velvet doublet."*
- **Choice A:** Promote him to Royal Clerk (+1 Royal Clerk, +0.5 AP/s upkeep).
- **Choice B:** Discard his ledgers in the moat (-5% paperwork, +10 Unrest).

### 3. The Princely Cousin
- **Trigger:** Military upkeep $> 35\%$ of total AP income.
- **Narrative:** *"Your cousin the Duke arrives with forty unwashed retainers and demands imperial board, Sire."*
- **Choice A:** Pay him a lavish stipend (-500 AP, -15 Unrest).
- **Choice B:** Send him to garrison the frontier (-10% military upkeep, +15% threat power next deadline).

### 4. The Great Archive Fire
- **Trigger:** Net paperwork $> 45\%$.
- **Narrative:** *"A candle overturned in the western chancery! Decades of tax disputes and unpaid wages are reduced to cinders!"*
- **Choice A:** Let them burn! (-20% paperwork, +20 Unrest from angry guilds).
- **Choice B:** Hire scribes to copy surviving parchments (-400 AP, -5% paperwork, 0 Unrest).

### 5. The Cabinet Scarcity
- **Trigger:** Previous deadline surpassed quotas by $> 200\%$ on Gross AP Rate ($\text{GrossAP/s} / \text{ApRateQuota} > 3.0$).
- **Narrative:** *"We produce parchment so rapidly our carpenters lack oak for filing chests. Scrolls pile in the hallways."*
- **Choice A:** Commission iron vaults (-600 AP, +10% administrative output).
- **Choice B:** Burn older archives (-1 Archive Point, gain +800 AP immediately).

### 6. The Peasant Salt Boycott
- **Trigger:** Unrest $> 50\%$.
- **Narrative:** *"The serfs threaten to withhold salt deliveries unless the gabelle tax is alleviated."*
- **Choice A:** Send the watch to seize salt stores (+400 AP, +20 Unrest).
- **Choice B:** Concede a salt holiday (-25% tax revenue for 30s, -25 Unrest).

### 7. The Runaway Serfs
- **Trigger:** Free Serfs $< 15\%$ of Total Population.
- **Narrative:** *"Sire, our fields are barren of hands. The serfs flee our recruiters into neighboring baronies."*
- **Choice A:** Issue warrant for manhunt (+50 Free Serfs, +25 Unrest, costs 200 AP).
- **Choice B:** Grant land tenures (-10% tax efficiency, +0.10 base pop growth/s).

### 8. The Wandering Troubadours
- **Trigger:** Deadline $\ge 3$, Unrest $< 35\%$.
- **Narrative:** *"Minstrels sing ballads of your generosity in the market square. The rabble is quite enchanted."*
- **Choice A:** Shower them with coins (-200 AP, -15 Unrest, +1 Archive Point).
- **Choice B:** Conscript them into the messenger corps (+2 Scribes for free).

### 9. The False Relic Merchant
- **Trigger:** Village Priests or High Prelates owned $\ge 5$.
- **Narrative:** *"A Venetian merchant peddles the alleged left femur of Saint Jude. The clergy swoons."*
- **Choice A:** Purchase the bone for the abbey (-450 AP, -20 Unrest, +5% Prelate efficiency).
- **Choice B:** Expose him as a fraud (+150 AP seized, +10 Unrest among gullible flock).

### 10. The Foreign Envoy's Bribe
- **Trigger:** Controlled Provinces $\ge 4$.
- **Narrative:** *"An ambassador from Burgundy slips a heavy purse onto your desk with polite compliments."*
- **Choice A:** Accept the purse (+1,200 AP, +15 Unrest if word leaks).
- **Choice B:** Expel the envoy honorably (+1 Archive Point, -10 Unrest).

### 11. The Rotting Grain Silos
- **Trigger:** Realm controls at least 1 Farmlands province.
- **Narrative:** *"Dampness has seized the imperial granaries. A third of the grain rots."*
- **Choice A:** Distribute the damp grain to peasants (-30 Population to flux, saves treasury).
- **Choice B:** Dump the grain and buy emergency flour (-350 AP, population preserved).

### 12. The Deserting Mercenaries
- **Trigger:** AP treasury $\le 0$ or Bankruptcy countdown active.
- **Narrative:** *"The sword-for-hire companies stand outside your hall banging pommels against iron pots. They demand their gold!"*
- **Choice A:** Melt down reliquaries (+400 AP, +15 Unrest).
- **Choice B:** Disband 10 Foot Soldiers (lose soldiers, cancels bankruptcy timer).

### 13. The Ghost Scribes
- **Trigger:** Total Scribes $\ge 20$.
- **Narrative:** *"An audit reveals twelve deceased scribes have been drawing weekly wages for three years."*
- **Choice A:** Recover wages from surviving family (+500 AP, +15 Unrest).
- **Choice B:** Reallocate payroll to active supervisors (+10% Supervisor output).

### 14. The Inquisitor's Demand
- **Trigger:** Unrest $\ge 70\%$.
- **Narrative:** *"The Grand Inquisitor demands three hundred heretics be burned to cleanse the realm of spiritual pestilence."*
- **Choice A:** Hand over unruly serfs (-25 Population, -30 Unrest).
- **Choice B:** Deny the Inquisitor (+10 Unrest, gain +2 Archive Points for courage).

### 15. The Auditor's Nephew
- **Trigger:** Deadline $\ge 5$.
- **Narrative:** *"The King's Chief Auditor sends a letter recommending his dull-witted nephew for a lucrative provincial post."*
- **Choice A:** Make him a Crown Bailiff (+1 Supervisor, the Crown Bailiff has no unit of its own, +15% paperwork).
- **Choice B:** Send him a polite refusal (Royal Pardon forfeited at the next audit only: a failed audit there is a `quota_failure` defeat even with 0 strikes; +1 Archive Point).

### 16. The Smugglers' Cove
- **Trigger:** Realm controls at least 1 Trade Hub province.
- **Narrative:** *"A network of smugglers offers a cut of luxury silks if customs officers look away."*
- **Choice A:** Take the 20% cut (+15% gross AP income, +10 Unrest).
- **Choice B:** Hang the ringleaders (+15 Military Power, +1 Archive Point).

### 17. The Boundary Stone Dispute
- **Trigger:** Deadline $\ge 4$.
- **Narrative:** *"Two neighboring squires have come to blows over thirty yards of ditch."*
- **Choice A:** Seize the disputed land for the Crown (+50 housing capacity, +10 Unrest).
- **Choice B:** Impose a heavy judicial arbitration fee (+400 AP, -5 Unrest).

### 18. The Crown's Forced Loan
- **Trigger:** Current AP Treasury $> 5,000\text{ AP}$.
- **Narrative:** *"His Majesty has heard of your bulging chests and 'requests' a patriotic loan for his foreign wars."*
- **Choice A:** Comply gladly (-2,000 AP, the three quotas of the next audit reduced by 15%).
- **Choice B:** Plead poverty and hide gold (-15% gross AP for 30s in accounting tricks).

### 19. The Mutinous Quartermaster
- **Trigger:** Total military units $\ge 25$.
- **Narrative:** *"A quartermaster was caught selling imperial spears to forest bandits."*
- **Choice A:** Hang him publicly (-1 Quartermaster, -10 Unrest).
- **Choice B:** Blackmail him into double bookkeeping (+300 AP, +5% military upkeep).

### 20. The Astrologer's Comet
- **Trigger:** Deadline 8 or 9.
- **Narrative:** *"A fiery comet streaks across the night sky. The people wail, predicting the doom of dynasties."*
- **Choice A:** Declare it a sign of imperial victory (+10% military power for deadline, +10 Unrest).
- **Choice B:** Fund mass intercession prayers (-500 AP, -25 Unrest).

---

## 8. The Crown Threats Catalog (Deadlines 3 to 10)

Crown threats activate commencing after the Deadline 2 audit. During the Inter-Deadline Council phase following deadline $d$ ($2 \le d \le 9$), the Threat Herald reveals and resolves the upcoming threat for deadline **$d+1$**:
$$\text{BaseThreatPower} = 0.80 \times \text{MilitaryQuota}_{d+1}, \quad \text{TributeCost} = 20 \times \text{ApRateQuota}_{d+1}$$

#### 8.1 Threat Matrix & Spontaneous Surprise Raids ("Attaques par surprise")
The realm faces two distinct vectors of military hostility:
1. **Scheduled Crown Threats (Deadlines 3 to 10):** Official imperial audits and major feudal incursions heralded during the Inter-Deadline Council phase for deadline $d+1$.
2. **Spontaneous Surprise Raids (`SURPRISE_RAID`):** Independent border marauders, rebel barons, or foreign mercenaries may launch surprise raids during `ACTIVE_CYCLE` starting at **Deadline 3**:
   - *Check Interval & Probability:* Evaluated every **10 seconds** of active cycle time via persisted `prngState`. Base chance **2%**, doubled ($\times 2$) if `ap > 2000`, $+2\%$ if `militaryPower < 0.50 * MilitaryQuota`, $+2\%$ if `unrest > 60`.
   - *Hard Caps & Cooldown:* Maximum **1 surprise raid per deadline**, minimum **60-second cooldown** between raids. Raid power equals **$0.50 \times \text{MilitaryQuota}$**.
> [!NOTE]
> **Values derived from `src/data/balance.generated.ts`.**  
> Base threat power ($0.80 \times \text{MilitaryQuota}_{d+1}$) and tribute ($20 \times \text{ApRateQuota}_{d+1}$) are dynamically computed by the engine via `getThreatPower()` and `getThreatTributeAp()` from active quotas and are not hardcoded. The figures below match `balance.generated.ts`.

| Threat Deadline | Scheduled Threat | Faction | Base Power (80% Mil Quota) | Tribute (20s Gross AP Rate) | Failure Penalty (Defensive Collapse) |
| :---: | :--- | :--- | :---: | :---: | :--- |
| **3** | *Border Raiders & Deserters* | Outlaw Bandits | 24 | 440 AP | 1 Province, 100% Army dead, 15-25% Pop, 30-50% AP |
| **4** | *The Rebellious Marches Baron* | Feudal Dissidents | 32 | 700 AP | 1 Province, 100% Army dead, 15-25% Pop, 30-50% AP |
| **5** | *Nomadic Steppe Horde* | Steppe Raiders | 44 | 1,100 AP | 1 Province, 100% Army dead, 15-25% Pop, 30-50% AP |
| **6** | *The Renegade Free Companies* | Mercenary Armies | 60 | 1,700 AP | 1 Province, 100% Army dead, 15-25% Pop, 30-50% AP |
| **7** | *The Holy League Crusade* | Religious Zealots | 84 | 2,600 AP | 1 Province, 100% Army dead, 15-25% Pop, 30-50% AP |
| **8** | *The Pretender Duke's Vanguard* | Rebel Nobility | 112 | 3,900 AP | 1 Province, 100% Army dead, 15-25% Pop, 30-50% AP |
| **9** | *The Grand Inquisitorial Armada* | Imperial Church | 144 | 5,700 AP | 1 Province, 100% Army dead, 15-25% Pop, 30-50% AP |
| **10** | *The Royal Auditor's Iron Host* | Crown Imperial Army | 184 | 8,400 AP | 1 Province, 100% Army dead, 15-25% Pop, 30-50% AP |

### 8.2 The Three Responses to Scheduled Threats
1. **Defend with Armed Forces (`defense`):** Resolves via the generalized battle system where the player acts as **Defender** (+20% fortification bonus + Stronghold defense).
2. **Pay Crown Tribute (`tribute`):** Costs $20 \times \text{ApRateQuota}_{d+1}$ in gold treasury. Bypasses combat entirely. **Requires `state.ap >= TributeCost`; if unaffordable, the command is strictly rejected (`success: false`) and the phase remains `THREAT_HERALD`**—the player must select `defense` or `levy`.
3. **Levy en Masse (`levy`):** Always available regardless of AP. Mobilizes **10% of Total Population** as emergency militia. Repels the threat, but causes **+30 immediate Unrest** (via `addUnrest`; if Unrest reaches 100, revolution defeat triggers immediately and is never overwritten) and **5% population casualties** (preserving the §4.1 Population Balance Equation via demographic mutation helper).

---

## 9. Enemy Factions & Subtle State Adaptations

Factions are nuanced and dynamically adapt their tactical behavior to the player's governance state:

```
┌────────────────────────────────────────────────────────┐
│                   PLAYER REALM STATE                   │
│   • Huge Military?      • High Treasury (>2k AP)?      │
│   • Low Armies / High Pop? • High Unrest (>60%)?       │
└───────────────────────────┬────────────────────────────┘
                            │ Evaluates State
                            ▼
┌────────────────────────────────────────────────────────┐
│               REACTIVE ENEMY TRAIT ADAPTATION          │
│   • Armored Veterans (+10% Enemy Combat Power)         │
│   • Mercenary Greed (+25% Tribute / Plunder)           │
│   • Heretic Agitators (+Defection / Unrest)            │
│   • Siege Sappers (Targets Province Defense)           │
└────────────────────────────────────────────────────────┘
```

### 9.1 Faction Archetypes & Behavior
1. **Outlaw Bandits & Marauders:**
   - *Behavior:* Frequent surprise raids against undefended lands. Plunder targets granaries and serfs.
   - *Victory Loot:* Liberated captives yield **Population (+Free Serfs)** rather than gold.
   - *Reactive Trait:* If player has $< 10$ soldiers, bandits inflict +15% civilian casualties.
2. **Rebel Barons & Armored Knights:**
   - *Behavior:* Field disciplined armored retinues.
   - *Victory Loot:* Yields captured martial equipment and surrendered **Soldiers**.
   - *Reactive Trait:* If player army is large ($\ge 1.2 \times \text{Quota}$), enemy fields *Armored Veterans* (+10% combat power).
3. **Free Company Mercenaries:**
   - *Behavior:* Attracted by overflowing coffers.
   - *Victory Loot:* Hefty chests of minted coin (**High AP**).
   - *Reactive Trait:* Tribute demand increases by +25% (the doubling of surprise raid probability when `ap > 2000` is governed uniformly by the general raid rule in §8.1/§8.3, without duplicate doubling).
4. **Holy League Zealots:**
   - *Behavior:* Fanatical inquisitors seeking heretics.
   - *Victory Loot:* Pious converts (**Population**) and sacred relics.
   - *Reactive Trait:* If player Unrest $> 60\%$, zealots trigger *Religious Defection* (+15 Unrest and soldier desertion).
5. **Steppe Horsemen:**
   - *Behavior:* Lightning-fast cavalry raids; scout uncertainty margin is doubled ($\pm 30\%$).
6. **Imperial Crown Legions:**
   - *Behavior:* Professional host with siege sappers; threaten 2 provinces if defensive collapse occurs.

---

## 10. Generalized Asymmetric Battle System (Attacker vs Defender)

All armed engagements—voluntary campaigns, scheduled threats, and spontaneous surprise raids—follow a unified, asymmetric combat engine:

$$\text{AttackerEffectivePower} = \text{AttackerForce} \times (1 - \text{SiegeFriction [10\%]}) \times \text{Roll}(0.92, 1.08)$$
$$\text{DefenderEffectivePower} = \big(\text{DefenderForce} \times (1 + \text{FortificationBonus [20\%]}) + \text{StrongholdDefense}\big) \times \text{Roll}(0.95, 1.10)$$

$$\text{ClashRatio} = \frac{\text{AttackerEffectivePower}}{\text{DefenderEffectivePower}}$$

### 10.1 Offensive Campaigns (Player is the Attacker)
- Initiated voluntarily by the player between deadlines (up to 2 campaigns per interval).
- Player commits troops and incurs the **Attacker's Siege Friction (-10%)**, while the enemy enjoys defensive fortifications.
- **Estimated Loot Variance & Diverse Loot Types:**
  - Previewed plunder has an estimation variance of approximately **$\pm 20\%$**.
  - **Loot is not solely AP:**
    - *Treasury Plunder:* Pure AP ($\pm 20\%$). Credited strictly to `state.ap`; does not modify Gross AP Rate or increment quota tracking counters.
    - *Captive Serf Liberation:* Grants **Population** (+25 to +75 Free Serfs) instead of AP!
    - *Mercenary Garrison Capitulation:* Grants **Trained Soldiers** (+5 to +15 Soldiers) liberated into service up to military order cap headroom ($\text{OrderCap} - \text{CurrentMilitary}$). Any surplus beyond the headroom joins the Free Serfs pool (and `totalPopulation`), strictly preserving the §4.1 demographic balance equation.
    - *Mixed War Spoils:* A balanced blend (e.g., 50% AP, 30% Population, 20% Soldiers).
- **Offensive Outcome Matrix ($R = \frac{\text{PlayerAttackingPower}}{\text{EnemyDefendingPower}}$):**
  - **Decisive Victory ($R \ge 1.40$):** Province Captured! Loot $120\%$, light casualties (8-12%), -5 Unrest.
  - **Clear Victory ($1.05 < R < 1.40$):** Province Captured! Full loot $100\%$, moderate casualties (20-30%), 0 Unrest.
  - **Razor-Thin Victory ("Victoire sur le fil", $1.00 \le R \le 1.05$ – within 5% of defeat):** **NO PROVINCE CAPTURED!** The army barely survived the assault; too bloodied and exhausted to occupy territory. Receives 50% loot, heavy casualties (45-55%), +5 Unrest.
  - **Pyrrhic Standoff ($0.80 \le R < 1.00$):** Defeat. No province, no loot, 70-80% casualties, +15 Unrest.
  - **Crushing Defeat ($R < 0.80$):** Defeat. No province, **100% of committed soldiers killed**, +25 Unrest.

### 10.2 Defensive Battles (Surprise Raids & Threats – Player is Defender)
- The player is attacked in their realm: Gains the **Defender's Fortification Bonus (+20%)** plus any passive **Border Stronghold Defense (+12 flat)** and **Man-at-Arms garrison bonus (+0.5 flat per Man-at-Arms)**.
- **If the Player Wins:** Enemy repelled! Minor casualties (10%, mitigated by Captains) distributed proportionally across `soldier` and `man_at_arms`. Awards defensive salvage plunder:
  $$\text{SalvageAP} = \text{round}\big(0.25 \times \text{TributeCost}_{\text{repelled threat}} \times \text{Roll}(0.8, 1.2)\big)$$
  *(where $\text{TributeCost}_{\text{repelled threat}}$ corresponds to deadline $d+1$ for a Threat Herald encounter, and the current deadline for a `SURPRISE_RAID`)*, credited directly to treasury `state.ap`, and -5 Unrest.
- **If the Player LOSES in Defense (Devastating Defensive Collapse):**
  1. **1 Province Permanently Lost:** Enemy captures a province (removing the last acquired province in LIFO order). **No province floor applies to battle defeat**: if the realm holds only 1 province, it is lost, immediately triggering defeat by conquest (`conquest`).
  2. **Entire Army Annihilated:** **100% of the active military forces are slaughtered** in the breach and deducted from `totalPopulation`.
  3. **Civilian Massacre & Enslavement:** **15% to 25% of living population slaughtered or abducted** (deducted from `freeSerfs` first, then civil/admin units if needed to preserve the §4.1 Population Balance Equation).
  4. **Treasury Pillaged:** **30% to 50% of current positive AP treasury looted** ($\text{lostAp} = \text{round}(\max(0, \text{ap}) \times \text{frac})$ deducted as $\text{state.ap} -= \text{lostAp}$; existing debt is never reset or erased).
  5. **Immediate Overcrowding Crisis & Demographic Bleed:**
     - With one fewer province, housing capacity drops: $\text{MaxPop}_{\text{new}} = 250 \times (\text{Provinces} - 1) \times \text{CapMultiplier}$.
     - If living population exceeds the new capacity ($\text{TotalPop} > \text{MaxPop}_{\text{new}}$), **Overcrowding Bleed** activates:
       - Population growth frozen to 0.
       - Excess population continuously dies or flees at a rate of $-2.5 \text{ pop/s}$ (preserving the §4.1 Population Balance Equation).
       - Generates **$+0.10\text{ Unrest/s}$ per 50 excess inhabitants** ($\text{OvercrowdingUnrest/s} = \min\big(1.0, 0.10 \times \frac{\text{TotalPop} - \text{MaxPop}}{50}\big)$, capped at **$+1.0\text{ Unrest/s}$**) until population drops to capacity or the player reconquers a province!
  6. **Unrest Surge:** Inflicts $+20$ immediate Unrest (via `addUnrest`; if Unrest reaches 100, revolution defeat triggers immediately).

### 10.3 Infinite Scout Reroll (Recon Patrols)
- When scouting offensive campaign targets (`currentTarget` in `GameState`), pressing **"Send Recon Patrol"** (`RECON_PATROL`) rerolls the target using the persisted `rngStreams.combat` stream.
- **Mortality Rule:** Exactly **1 Scout dies permanently** per reroll, deducted from Total Population.

### 10.4 Province Biomes & Mechanical Traits
Captured provinces permanently grant unique realm-wide bonuses:
- **Heartland (Cœur du Domaine):** Neutral starting and colonised biome: capacity multiplier $\times 1.0$ (250 capacity), $\Delta r = 0$, no defense bonus, no paperwork reduction.
- **Arable Plains (Farmlands):** Housing capacity multiplier **$\times 1.5$** ($375$ capacity) and **$\Delta r = +0.001$** ($+0.1\%/\text{s}$ to base logistic growth).
- **Trade Hub (Market):** **+15% total tax revenue efficiency** across the realm.
- **Border Stronghold (Military):** **+12 passive military defense** automatically added to all defensive battles.
- **Marshes & Forests (Wilderness):** **-5% paperwork inertia**, but housing capacity multiplier **$\times 0.8$** ($200$ capacity).

- **Biome Distribution & Lifecycle:** The 3 starting provinces are `heartland` (preserving 750 starting capacity). Civil colonisation always creates a `heartland` province. Conquered provinces inherit the specific biome of `currentTarget`. Province loss (Royal Censure, Lombard Loan, Defensive Collapse) removes the **last acquired province** (LIFO order).

---

## 11. Crisis Mechanics & Emergency Edicts

### 11.1 Non-Linear Unrest Thresholds & Dual-Stat Composition
- **0% – 49% (Tranquility):** Normal governance.
- **50% – 74% (Fiscal Boycott):** Peasants refuse collectors $\rightarrow$ **-20% Tax Revenue** (cumulative across 50%–99%).
- **75% – 89% (Strife & Desertion):** Growth frozen to 0; **1 Foot Soldier (`soldier`) deserts every 15s** (if 0 `soldier` remain, **1 Man-at-Arms (`man_at_arms`) deserts every 30s**; officers and scouts do not desert). Cumulative from 75% to 99%. Persisted in `GameState.desertionTimer` (reset to 0 when no eligible units exist or Unrest drops below 75%).
- **90% – 99% (Urban Rebellion):** Scribe/Clerk gross AP output cut by **50%**. Strife desertion, demographic freeze, and fiscal boycott remain active!
- **100% (Total Revolution):** Realm collapses $\rightarrow$ **Instant Defeat (`revolution`)** at any moment in any phase. Transitions `phase` to `RUN_DEFEAT` (never overwritten).
- **Cumulative Desertion & Sanctuary Rights:** Desertion applies across 75%–99% Unrest. The *Sanctuary Rights* law (§6.2 #5) suppresses desertion **strictly below 90% Unrest** (desertions resume at 90%–99%).
- **Dual-Stat Unrest Composition:** Positive unrest sources (`unrest_generation`) and pacification sources (`unrest_pacification`) are composed separately before computing $\Delta\text{Unrest/s} = \text{ComposedGeneration} - \text{ComposedPacification}$.

### 11.2 Emergency Edicts (Executive Last Resorts)
Subject to **at most 1 edict per deadline**, **+50% escalating penalty per prior use**, and **zero AP quota credit** (audits evaluate instantaneous Gross AP Rate):
1. **The Forced Tithe (`forced_tithe`):** Instant seizure of 30 seconds of poll tax income into `state.ap` | **$+35 \times (1 + 0.5k)$ immediate Unrest** (via `addUnrest`) and **20s demographic growth freeze**.
2. **Church Seizure (`church_seizure`):** Max 2 uses per run. Instantly awards **$\max(300, 25 \times \text{Gross AP/s})$ AP** to `state.ap` | Clergy/Prelate pacification cut by **50% (`unrest_pacification` $\times 0.5$) for $60 \times (1 + 0.5k)$ seconds** plus **$+10 \times (1 + 0.5k)$ immediate Unrest** (via `addUnrest`).
3. **The Grand Festival (`grand_festival`):** Instantly removes **-20 Unrest** (via `addUnrest(state, -20)`) | Costs and deducts **$\max(100, 0.20 \times \max(0, \text{state.ap}), 30 \times \text{Gross AP/s})$ AP**. Strictly rejected if `state.ap < cost` (debt is never erased).

### 11.3 Bankruptcy & The Lombard Loan
- When net AP is negative, a 30-second countdown initiates.
- At **20 seconds**, if the realm controls **at least 2 provinces** (`provinces >= 2`) and the bailout is unused, the **Lombard Bailout** is offered: Cede **1 Province** permanently (LIFO order) in exchange for an immediate infusion of **2,000 AP** into treasury `state.ap` (capital transfer; does not alter gross AP rate). Permitted strictly once per run. If holding only 1 province, the offer is not presented and the countdown continues to bankruptcy.

---

## 12. Meta-Progression (The National Archives) & Royal Feats

### 12.1 Archive Perks (Persistent Crown Charters)
Archive points earned during a run (passed deadlines, law rejections, dilemmas) are added to the persistent archive when the run is concluded, then invested permanently:
| Perk | Cost | Permanent Effect |
| :--- | :---: | :--- |
| **Starting Treasury** | 1 pt | Start every run with +150 AP. |
| **Ancient Cadastre** | 2 pts | Base paperwork inertia reduced by -5%. |
| **Charter of Liberties** | 2 pts | Starting Unrest reduced by -8 points. |
| **Standing Vanguard** | 3 pts | Start every run with 25 Foot Soldiers. |
| **Primogeniture Decrees** | 4 pts | +8% to all civil and administrative caps. |
| **Spymaster Network** | 5 pts | Scout uncertainty margin narrowed by 12 points base. |
| **Royal Chronicle** | 6 pts | Displays quota thresholds for the next 2 upcoming deadlines (stat `quota_foresight_deadlines`, read through `getForesightQuotas`). |
| **Sixth Law Slot** | 10 pts | Unlocks a permanent 6th active law slot. |

### 12.2 Royal Feats (Achievements)
Unlocking each feat awards **+0.5 Archive Points**, once per feat across all runs:
1. **Royal Pacifist:** Win a run without recruiting a single military unit.
2. **Scout Butcher:** Sacrifice $\ge 20$ scouts in recon rerolls across a single run.
3. **Fiscal Paradise:** Win maintaining tax rate $\le 15\%$ at all times.
4. **Iron Bailout:** Win a run after accepting the Lombard Bailout (offered at the 20-second mark of the bankruptcy countdown).
5. **Crœsus of the Realm:** Produce $> 1,000,000$ cumulative AP in a single run.
6. **The Six Seals:** Enact and maintain 6 active laws simultaneously.
7. **Unyielding Governance:** Win a run with zero strikes (no Royal Pardon used).
8. **Imperial Barony:** Control $\ge 8$ provinces simultaneously.

---

## 13. Web Audio Engine Architecture

Follows [`AUDIO_BEST_PRACTICES.md`](./AUDIO_BEST_PRACTICES.md):
- **Web Audio API Graph:** Global `AudioContext` routing through Master, SFX, and Music gain buses.
- **Autoplay Lifecycle:** Silent unlock on the first `pointerdown` or `keydown`.
- **Anti-Fatigue & Polyphony:**
  - Hard limit of 3-4 concurrent voices per SFX key with automatic voice stealing.
  - Cooldown throttling of 40–50ms between identical trigger calls.
  - Pitch randomization of $\pm 5\%$ on every click to prevent acoustic fatigue.
- **Soundtrack Streaming:** Dynamic HTML5 audio streaming from `dist/soundtrack/` (`Angevin B.mp3`, `Folk Round.mp3`, `Minstrel Guild.mp3`, `Pippin the Hunchback.mp3`) with cross-fading.

---

## 14. Asset Pipeline (Icons, Typography & Audio)

Follows [`ASSETS.md`](./ASSETS.md):
- **Icons:** Curated typed SVG dictionary covering all 24 units, 4 counselors, 4 defeats, 8 archives, threats, and UI controls in `src/data/icons.ts`. Backgrounds removed, `fill="currentColor"`. Rendered via `<GameIcon name="..." />`.
- **Typography:** WOFF compressed fonts in `assets/fonts/`:
  - `MedievalSharp-Regular.woff`: Headers, banners, deadline titles.
  - `IMFellEnglish-Regular.woff` & `IMFellEnglish-Italic.woff`: Body, ledgers, narrative dialogues.
- **Single-File Bundling:** Fonts and critical SFX inlined into `dist/index.html` via `vite-plugin-singlefile`.

---

## 15. Automated Simulation Bots & Economic Balance Testing

Balancing is validated objectively via automated headless bots in `src/__tests__/simulation/archetypeBots.spec.ts`:

### 15.1 The Three Bot Tiers (Skill Gradient Testing)
The simulation tests game fairness across three distinct player skill levels:
1. **Random Noise Bot:** Selects arbitrary purchases and laws without economic heuristics. Expected Win Rate: **< 5%**.
2. **Greedy ROI Bot (Baseline Human):** Calculates immediate payback time (amortization seconds) balancing a composite utility function (AP, Population, Military power). Expected Win Rate: **35% – 65%**.
3. **Archetype Expert Bot:** Implements specialized builds (pure bureaucratic taxation with civil colonisation, or aggressive military conquest). Expected Win Rate: **> 65%**.

### 15.2 Reference Bot Quota Generation Script
Quotas are not guessed or hardcoded arbitrarily. They are derived directly from the median performance of the Greedy ROI Bot over multiple fixed seeds:
$$\text{Quota}_k = c \times \text{MedianGreedyBotScore}_k$$

On the AP axis, the bot's score evaluated at audit $k$ is the **instantaneous Gross AP Rate (AP/s)**.
The scaling coefficient $c$ is not arbitrarily fixed at 0.8; it is an unknown variable solved algorithmically by the script `scripts/generate-balance-report.ts` via bisection until the greedy bot (evaluating balanced utility across AP, Population, and Military) stabilizes strictly within the target band of **35% – 65% win rate**.

### 15.3 Dominance & Sensitivity Metrics
- **Dominance Detection (Per Archetype):** Tracks unit purchase distributions. Beyond Deadline 3 (after the opening phase where Scribes and Peasants naturally dominate), if any unit is purchased 0 times across 1,000 runs, or if a single unit exceeds 60% of total expenditure within a given archetype build, tests alert for rebalancing.
- **Sensitivity Testing:** Variates core balance parameters (such as $r_0$ growth rate, cost scaling $1.07/1.05$, or tax multipliers) by $\pm 10\%$ to verify that win rates do not swing catastrophically.

---

## 16. The Universal Modifier & Effect Engine

To prevent scattered `if` statements and conflicting game state mutations across laws, perks, edicts, and faction traits, all modifiers are funneled through a unified contract:

```typescript
export type ModifierOp = 'add' | 'addPct' | 'mul' | 'set'

export interface Modifier {
  id?: string
  source: string          // e.g. 'law:cadastre', 'faction:veterans'
  stat: StatKey           // e.g. 'gross_ap_rate', 'paperwork_friction'
  op: ModifierOp          // 'add' -> 'addPct' -> 'mul' -> 'set'
  value: number
  appliedAt?: number      // Application timestamp in seconds or tick
  expiresAt?: number      // Expiration timestamp in seconds
  resolverKey?: ResolverKey // Strongly typed literal union identifier (e.g. 'max_3_provinces')
  scope?: ModifierScope   // { order?, tier?, unitId? }: units targeted by unit_upkeep, recruit_cost, unit_output (order only on order_cap)
  untilNextAudit?: true   // Active until the next audit (counts for it), removed right after it whatever its outcome
}

export type Effect =
  | { type: 'stat_modifier'; modifier: Modifier }
  | { type: 'instant_resource'; resource: 'ap' | 'population' | 'unrest' | 'provinces' | 'archive_points'; amount: number }
  | { type: 'grant_units'; unitId: UnitId; count: number }
  | { type: 'rule_flag'; flag: RuleFlag } // recorded once in GameState.ruleFlags, read through hasRule
  | { type: 'ap_cost_income_seconds'; seconds: number } // costs seconds x max(0, net AP/s)
```

### 16.1 Dynamic Conditional Modifiers
For laws and perks featuring dynamic conditions (e.g. *"only if holding $\le 3$ provinces"* or *"+2 AP/s per owned province"*), the `Modifier` contract remains strictly JSON-serializable without embedding closures or serialized functions.  
A strongly typed `ResolverKey` literal union points to a pure function registry in `src/data/balance.ts` with signature:
```typescript
export type DynamicModifierResolver = (
  state: Readonly<RawEvaluationState>,
  mod: Readonly<Modifier>
) => { active: boolean; value: number } | number
```
**Safety Safeguards:**
1. **Literal Union Typing:** `ResolverKey` is typed as a literal union (`'per_province' | 'per_100_free_serfs' | 'per_clergy' | 'max_3_provinces' | 'unrest_at_least_30'`), never an arbitrary `string`.
2. **Cycle Prevention:** Resolvers only read the raw state (`state.provinces`, `state.units.clergy`, `state.unrest`, etc.) and are strictly forbidden from invoking `getStat` or recursive evaluators.

### 16.2 Fixed Composition Order & Per-Tick Stat Caching
When evaluating any stat via `composeStat(baseValue, modifiers, state)`:
1. Start with the canonical base value from `src/data/balance.ts`.
2. Sum all applicable `add` modifiers: $\text{Base}' = \text{Base} + \sum \text{Add}$.
3. Factor in percentage additions: $\text{Base}'' = \text{Base}' \times (1 + \sum \text{AddPct})$.
4. Multiply by all applicable `mul` modifiers: $\text{Base}''' = \text{Base}'' \times \prod \text{Mul}$.
5. If any active `set` modifier exists, override: $\text{Val} = \text{SetValue}$ (latest timestamp).

**Per-Tick Caching:**
Because `composeStat` is called dozens of times per second for UI tooltips and HUD breakdowns, evaluations are cached per tick index via `TickStatCache`. Recalculations are completely bypassed when the tick index and active modifiers have not changed.

---

## 17. Versioned Save State & Migration Pipeline

To guarantee that save files remain backwards-compatible across development updates:

```typescript
export interface SerializedSavePayload {
  schemaVersion: number    // e.g. 1, 2, 3
  timestamp: number
  state: GameState
  archive?: ArchiveData    // present from schema 5 on
}
```

### 17.1 Sequential Migration Chain
- Migrations are declared as an ordered pipeline `migrations: Record<number, (old: unknown) => unknown>`.
- Types are validated strictly with runtime type guards, with **zero `any`**.
- When loading a save payload with `schemaVersion < CURRENT_SCHEMA_VERSION`, the engine runs migrations sequentially ($v_1 \to v_2 \to v_3$) before mounting the state.
- Save fixtures for every legacy schema version are stored in `src/__tests__/__fixtures__/saves/` and verified in unit tests.

---

## 18. Phased Delivery Roadmap: V1 (Headless Engine & Simulation) vs V2 (Playability & Presentation)

To guarantee absolute economic balance, bulletproof state transitions, and high-performance headless testing, the project is structured in two non-overlapping phases:

### V1: Full Headless Engine & Simulation

> [!IMPORTANT]
> **Strict Architecture Boundary: Zero user interface (UI) development will be undertaken before Validation Gate E is verified and frozen.**

- **Validation Gate A – Core Economy, 24 Units & Minimal Run Validation:**
  - Fundamental mathematical formulas in `src/core/formulas.ts` & `src/data/balance.ts`.
  - Complete 24-unit catalog (`src/data/units.ts`) integrated in Gate A.
  - Complete Tiers I and II (ratios 1.07 and 1.05).
  - Universal modifiers (`add`, `addPct`, `mul`, `set`) and 4 Province Biomes.
  - Minimal run core: state factory, unconstrained economic command dispatch, tick integration loop, tax promulgation delay (8s), unrest model, and 2-out-of-3 deadline quota audit.
  - Greedy ROI Bot v0 and provisional coefficient $c$ solver on pure economy (without laws or dilemmas).
  - **Pass Criteria:** Quotas generated in `src/data/balance.generated.ts`, target win rate band of 35% – 65% reached by greedy bot, zero deadline cliffs.
- **Validation Gate B – Complete Run Loop, State Machine & Determinism:**
  - Configurable simulation step loop (20 Hz in UI, 1–2 Hz in headless simulation) with step-size invariance testing ($\Delta t = 0.05\text{s}$ vs $0.5\text{s}$ vs $1.0\text{s}$, AP output delta $< 1-2\%$, outcome match $\ge 99\%$).
  - Complete `RunPhase` finite state machine (`AUDIT_ASSESSMENT`, `COUNCIL_DILEMMA`, `COUNCIL_LAWS`, `THREAT_HERALD`, `EXPEDITION`, `AWAIT_RESUME`, `ACTIVE_CYCLE`, `SURPRISE_RAID`, `LOMBARD_OFFER`, `COMBAT_RESOLUTION`, `RUN_VICTORY`, `RUN_DEFEAT`) and phase permissions table (`phases.ts`). `LOMBARD_OFFER` pauses the 30-second bankruptcy countdown.
  - Interim warning materialized via state flag (`interimWarningShown: boolean` at $t=50\text{s}$) without phase interruption.
  - Single dispatch API `dispatch(Command)`.
  - Replayable journal `{ seed: number, entries: Array<{ timeSeconds: number, command: Command }> }` indexed by game seconds (not tick count) and end-to-end determinism testing ("same journal and step size $\implies$ identical state hash").
  - Versioned save system with sequential typed migrations (`unknown`, zero `any`).
- **Validation Gate C – Asymmetric Combat & Dynamic Threats:**
  - Asymmetric tactical combat model (Attacker -10% friction vs Defender +20% fortification).
  - Razor-thin victory rule ($\le 5\%$ victory margin $\to$ no province awarded).
  - Dynamically calculated threats and tributes ($0.80 \times \text{MilitaryQuota}_{d+1}$ and $20 \times \text{ApRateQuota}_{d+1}$ via `getThreatPower()` and `getThreatTributeAp()`).
  - Reactive surprise border raids and adaptive enemy factions.
  - Province floor rule (hard floor = 1 province) on royal fines and Lombard bailouts (does not protect against battle collapse; 0 provinces triggers `conquest` defeat).
- **Validation Gate D – Complete Narrative & System Content:**
  - 30 laws without serialized functions supporting dynamic conditions via `resolverKey` (`laws.ts`), 20 steward dilemmas (`dilemmas.ts`), 4 biomes (`biomes.ts`), 3 emergency edicts (`edicts.ts`), 8 archive charters (`archives.ts`), 8 feats (`feats.ts`).
- **Validation Gate E – Full Simulation, Final Calibration & Freeze:**
  - Strict test suite decoupling: `npm run test:unit` (fast unit tests) and `npm run test:sim` (long simulation runs).
  - Simulation optimizations: 0.5–1.0s integration steps, in-place state mutation (no tick-by-tick cloning), `worker_threads` parallelization.
  - 3 autonomous bots: Random Noise (< 5% win rate), Greedy ROI (35% – 65% win rate), Archetype Experts (> 65% win rate).
  - Calibration of coefficient $c$ on 200 fixed seeds, verified over 1,000 runs in `scripts/generate-balance-report.ts`.
  - Dominance testing per archetype (no unit $> 60\%$ of expenditure after Deadline 3).
  - Interactive command-line REPL (`scripts/repl.ts`).
  - **CORE ENGINE CODE FREEZE.**

### V2: Playability & Presentation (UI, Audio & Packaging)
- **Pinia Integration:** Reactive stores bridging to core engine (`game.ts`, `archives.ts`, `settings.ts`).
- **Web Audio API Engine:** Master/SFX/Music buses, polyphony limit (3-4 voices), event throttling (40ms), pitch variance $\pm 5\%$, soundtrack cross-fading.
- **Modular Presentation Components (< 200 lines):** Accessible HUD gauges with explicit textual badges `[✓ SATISFIED]` / `[✗ DEFICIT]`, decree buttons with particle bursts, modals for laws, dilemmas, and combat clashes.
- **Contextual FTUE Tutorial:** Progressive onboarding overlays during the initial run.
- **Playwright End-to-End Tests:** Cross-browser validation of the complete gameplay loop.
- **Single-File Distribution:** Standalone `dist/index.html` build via `vite-plugin-singlefile`.

