# The Grand Audit: Game Systems & Balance Specifications

This document defines the comprehensive game systems, unit tiers, mathematical scaling laws, single-clash battle mechanics, law discovery pipelines, demographic pools, emergency edicts, and scoring mechanics for **The Grand Audit**.

---

## 1. Core Structure & Equilibrium Principles

### 1.1 The Ten Deadlines
- A run spans **10 deadlines** lasting **100 seconds** of active game time each (~16.6 minutes total active time).
- Time pauses automatically during **Law Drafts**, **Steward Events**, and **Battle Resolutions**.
- **The Two-Out-Of-Three Rule:** At each deadline inspection, the Crown evaluates three metrics:
  1. **Administrative Power (AP Rate):** Instantaneous gross AP production rate in AP/s evaluated at the moment of inspection (`ApRateQuota`). Defined as `calculateGrossApRate(state).total` (unit baseline production, poll tax, order multipliers, crisis penalties like boycott/rebellion, and `gross_ap_rate` modifiers, prior to bureaucratic paperwork friction and upkeep). Capital transfers (edicts, loans, plunder, salvage) and manual clicks do not count toward this quota rate.
  2. **Total Population:** Current living population across all provinces at the moment of inspection.
  3. **Military Power:** Total active military combat power at the moment of inspection.
- The player must satisfy at least **2 out of 3 criteria** to pass.
- **Deferred Inspection:** If the 100-second mark is reached during a surprise raid or a Lombard offer, the inspection waits for that crisis and is evaluated the moment it resolves (`RESOLVE_RAID_DEFENSE`, `ACCEPT_LOMBARD_LOAN` or `REFUSE_LOMBARD_LOAN`), before any other command applies.

### 1.2 The Single Royal Pardon (Yellow Card Grace Rule)
Failing a quota early in a run shouldn't arbitrarily kill a good attempt without a chance for redemption:
- **One Strike Permitted (Deadlines 1 to 9):** The first time a deadline is failed (fewer than 2 out of 3 quotas met) prior to Deadline 10, the King issues a **Royal Censure**:
  - The Crown forcibly confiscates **1 Province** (the last acquired province in LIFO order) and **50% of the player's positive AP treasury** ($\text{Fine} = 0.50 \times \max(0, \text{AP})$) as an imperial fine. Debt (negative AP) is never halved or erased.
  - **The Hard Province Floor Rule:** Fines and bailouts (Royal Censure, Lombard Loan) enforce a **strict floor of 1 province**. The Crown never strips the sovereign's last seat through administrative censure. However, this floor **does not protect against military conquest**: a defensive collapse in battle when holding only 1 province seizes that final province and immediately triggers defeat by conquest (`conquest`).
  - The run continues into the next deadline.
- **Second Failure or Final Inspection (Deadline 10) Failure:** Failing a second audit, or failing the **Deadline 10 Grand Audit** even with zero prior strikes, results in immediate public execution of the Lord (Game Over, `quota_failure`).
- **Forfeited Pardon:** after The Auditor's Nephew choice B (§9), the Royal Censure is not available at the next audit only: failing it is a `quota_failure` defeat even with zero strikes.

### 1.3 Mid-Deadline Interim Inspection (50-Second Warning)
At exactly the **50-second mark** of each 100-second deadline, the Steward computes a deterministic interim projection (`interimWarningOnTrack: boolean`):
- **Projection Criteria:**
  1. *Current Gross AP Rate:* $\text{GrossAP/s}_{50\text{s}} \ge \text{ApRateQuota}$ (the instantaneous gross AP rate at $t = 50\text{s}$ is directly compared to `ApRateQuota`, without extrapolation).
  2. *Current Population:* $\text{TotalPopulation}_{50\text{s}} \ge \text{PopQuota}$
  3. *Current Military Power:* $\text{MilitaryPower}_{50\text{s}} \ge \text{MilitaryQuota}$
- **If on track ($\ge 2$ criteria met):** Sets `interimWarningOnTrack = true` and displays a green commendation badge (*"The Crown shall be pleased, Sire"*).
- **If lagging ($< 2$ criteria met):** Sets `interimWarningOnTrack = false`, triggers a subtle audio alert, and flashes a pulsing red warning banner (*"Disaster looms! Quotas lagging. Mobilize or raise revenues immediately!"*).

### 1.4 Dual-Tier Geometric Scaling Principle (Anti-Stall Economy)
In an incremental game, if costs scale exponentially with a steep exponent while yields scale linearly, the game grinds to a halt.
- **Dual-Tier Cost Scaling:** Unit purchase prices scale on distinct geometric curves:
  - **Tier I Units:** $\text{Cost}_I(n) = \text{BaseCost} \times 1.07^n$
  - **Tier II Units:** $\text{Cost}_{II}(n) = \text{BaseCost} \times 1.05^n$
- **Amortization Balance:** With ratio $1.07$, Scribe payback remains reasonable through early/mid game: 163s at $n=25$, 320s at $n=35$, 449s at $n=40$. Beyond $n \approx 35-40$, Scribe payback escalates (reaching 884s at $n=50$). Tier II Clerks ($1.05$ ratio, +4.0 AP/s for 100 base cost) act as a genuine escape hatch when Tier I unit prices rise.
- **Yield & Synergy Scaling:**
  - **Tier I units** provide flat baseline output.
  - **Tier II units** provide 6× to 8× baseline output per head with ongoing AP upkeep.
  - **Special Collector Roles** share a finite serf pool non-quadratically without floor: $\text{Output} = \text{Rate} \times \min(n, \text{FreeSerfs}/100)$ (continuous ratio prevents an early-game 0 AP/s dead end when free serfs $< 100$).

---

## 2. The Primary Click: "Affixing the Royal Seal"

Clicking is not a trivial button press; it represents the Lord personally stamping executive decrees. It serves as an early-game bootstrap and a late-game emergency clutch tool.

### 2.1 Click Power Scaling Formula
$$\text{ClickValue} = \Big[ 1 + \max\big(0, \text{Gross AP/s} \times 0.035\big) \Big] \times \text{SealMultiplier}$$

- **Second 0 (No passive income):** 1 click = **1 AP**. With the realm's starting treasury of 50 AP (`STARTING_AP = 50`), the player can recruit their first Scribes immediately.
- **Mid-game (Gross income = 100 AP/s):** 1 click = $1 + 3.5 = \mathbf{4.5\text{ AP}}$. Clicking 4 times/sec yields **18 AP/s** (~18% of realm production).
- **Late-game (Gross income = 10,000 AP/s):** 1 click = $1 + 350 = \mathbf{351\text{ AP}}$.

### 2.2 Critical Stamps (Imperial Wax Seal)
- **5% Critical Chance:** Every click has a 1-in-20 chance to trigger an Imperial Seal.
- **Effect:** Delivers **3× Click Value**, triggering an accented wax-stamp audio crunch (`metalClick.ogg`) and a burst of gold seal visual particles.

### 2.3 The Lord's Privilege (Paperwork Mitigation)
Because a click is a direct executive decree bearing the sovereign's personal seal, it bypasses the sluggish lower bureaucracy:
- Clicks suffer **only 50% of the bureaucratic inertia penalty** ($\text{Effective Paperwork} = 0.5 \times \text{NetPaperwork}$).
- Even when paperwork reaches 80% friction, manual clicking remains viable as an economic bootstrap and emergency treasury liquidity tool (though clicks do not contribute to the instantaneous Gross AP Rate inspection quota).

### 2.4 Ergonomic Click Ceiling (Token Bucket)
- **Ergonomic Limit:** To protect player hand comfort without arbitrary barriers, an engine **token bucket** regulates maximum click registration to **12 tokens per second**.
- **Deterministic Tick Refill:** The bucket refills via the engine's injected delta-time tick loop (never `Date.now()`), guaranteeing reproducible bot simulations and speedrun verification.
- Excess clicks beyond 12/s display a subtle inkwell tooltip: *"The ink on your previous decree has not yet dried..."*.

---

## 3. Demographic Pool & Direct Population Consumption

Population represents a finite physical pool of living subjects rather than an abstract counter.

```
                    ┌─────────────────────────────────────────┐
                    │            TOTAL POPULATION             │
                    └────────────────────┬────────────────────┘
         ┌───────────────────────────────┼───────────────────────────────┐
         ▼                               ▼                               ▼
 ┌───────────────┐               ┌───────────────┐               ┌───────────────┐
 │   THE PEOPLE  │               │ ADMINISTRATION│               │  THE MILITARY │
 ├───────────────┤               ├───────────────┤               ├───────────────┤
 │ - Peasants    │               │ - Scribes     │               │ - Soldiers    │
 │ - Artisans    │               │ - Supervisors │               │ - Officers    │
 │ - Clergy      │               │ - Archivists  │               │ - Quarterm'rs │
 │ - Notables    │               │ - Collectors  │               │ - Scouts      │
 └───────┬───────┘               └───────┬───────┘               └───────┬───────┘
         │                               │                               │
         └───────────────────────┬───────┴───────────────────────────────┘
                                 ▼
                     ┌───────────────────────┐
                     │   FREE SERFS (TAXED)  │
                     └───────────────────────┘
```

### 3.1 The Population Balance Equation
$$\text{Total Population} = \text{Free Serfs} + \sum \text{People Specialists} + \sum \text{Administrators} + \sum \text{Soldiers}$$

1. **Direct Deduction on Recruitment:** Recruiting 1 Administrator or 1 Soldier subtracts exactly **1 from Free Serfs**.
2. **Tax Revenue Impact:** Only Free Serfs pay the baseline poll tax. Recruiting an army or expanding the bureaucracy directly shrinks your fiscal base and lowers Tax Collector yields.
3. **Permanent Combat Casualties:** When soldiers or scouts die in battle, **they are permanently deducted from Total Population**, creating demographic scars that can jeopardize upcoming deadline quotas.

---

## 4. Unit Classes, Roles & Tiers

The realm is divided into **three Orders**, each with **four distinct roles** spanning **two tiers** (24 total unit types).

### 4.1 Tier II Access Rules (Royal Charters)
Tier II units cannot be purchased at the start. Unlocking Tier II roles for an Order requires meeting **three cumulative prerequisites**:
1. **Institutional Maturity:** Reached at least **Deadline 3**.
2. **Order Mastery:** Maintaining at least **12 active Tier I units** within that Order.
3. **Royal Patent Purchase (One-time AP fee):**
   - *The People:* **Charter of Urban Franchises** (500 AP).
   - *Administration:* **Chancery Letters Patent** (600 AP).
   - *The Military:* **Edict of Feudal Chivalry** (700 AP).

### 4.2 The People (Demographic Engine)
| Role | Tier | UnitId | Base Cost (r) | Upkeep | Effect |
| :--- | :---: | :--- | :---: | :--- | :--- |
| **Producer** | I | `peasant` | 20 AP (1.07) | 0 AP/s | +0.05% to logistic growth parameter $r$. |
| **Producer** | II | `farmer` | 120 AP (1.05) | 0.10 AP/s | +0.30% to logistic growth parameter $r$. |
| **Multiplier** | I | `artisan` | 60 AP (1.07) | 0 AP/s | +0.5% tax revenue efficiency across all taxpayers. |
| **Multiplier** | II | `guild` | 300 AP (1.05) | 0.30 AP/s | +3.5% tax revenue efficiency; +1% AP from plunder. |
| **Reducer** | I | `clergy` | 50 AP (1.07) | 0 AP/s | -0.02 Unrest/s continuous pacification. |
| **Reducer** | II | `prelate` | 250 AP (1.05) | 0.50 AP/s | -0.15 Unrest/s pacification; reduces tax unrest by 20%. |
| **Special** | I | `notable` | 150 AP (1.07) | 0 AP/s | +1.5% to population housing capacity and all order caps. |
| **Special** | II | `baron` | 800 AP (1.05) | 2.00 AP/s | +6.0% to population housing capacity and all order caps. |

### 4.3 The Administration (Fiscal & Power Engine)
| Role | Tier | UnitId | Base Cost (r) | Upkeep | Effect |
| :--- | :---: | :--- | :---: | :--- | :--- |
| **Producer** | I | `scribe` | 15 AP (1.07) | 0 AP/s | +0.50 gross AP/s. |
| **Producer** | II | `clerk` | 100 AP (1.05) | 0.50 AP/s | +4.00 gross AP/s (counts double in paperwork calculation). |
| **Multiplier** | I | `supervisor` | 80 AP (1.07) | 0 AP/s | +2.0% production to all Scribes & Clerks. |
| **Multiplier** | II | `provincial_steward` | 400 AP (1.05) | 1.00 AP/s | +9.0% production to all Scribes & Clerks. |
| **Reducer** | I | `archivist` | 70 AP (1.07) | 0 AP/s | -1.5% to total bureaucracy index. |
| **Reducer** | II | `audit_chamber` | 350 AP (1.05) | 1.00 AP/s | -6.5% to total bureaucracy index; +10s to bankruptcy grace timer. |
| **Special** | I | `collector` | 120 AP (1.07) | 0 AP/s | +0.80 AP/s per covered 100 free serfs (non-quadratic). |
| **Special** | II | `farmer_general` | 600 AP (1.05) | 2.00 AP/s | +4.50 AP/s per covered 100 free serfs (non-quadratic). |

*Continuous Non-Quadratic Collector Yield:*
$$\text{Output} = \text{YieldRate} \times \min\left(n, \frac{\text{FreeSerfs}}{100}\right)$$

The Farmers-General cover free serfs first; the Collectors share the serfs they leave.

### 4.4 The Military (Force, Reconnaissance & Expansion)
| Role | Tier | UnitId | Base Cost (r) | Upkeep | Effect |
| :--- | :---: | :--- | :---: | :--- | :--- |
| **Producer** | I | `soldier` | 25 AP (1.07) | 0.30 AP/s | +1.0 Military Power. |
| **Producer** | II | `man_at_arms` | 150 AP (1.05) | 1.50 AP/s | +7.0 Military Power; +0.5 province defense. |
| **Multiplier** | I | `sergeant` | 100 AP (1.07) | 0 AP/s | +1.5% military power; +2% battle loot value. |
| **Multiplier** | II | `captain` | 500 AP (1.05) | 1.00 AP/s | +7.0% military power; reduces combat casualties by 5%. |
| **Reducer** | I | `quartermaster` | 90 AP (1.07) | 0 AP/s | -1.5% total military upkeep cost. |
| **Reducer** | II | `grand_marshal` | 450 AP (1.05) | 1.00 AP/s | -7.0% total military upkeep cost. |
| **Special** | I | `scout` | 110 AP (1.07) | 0.10 AP/s | Narrows enemy power uncertainty by 12 points; risk of casualty. |
| **Special** | II | `spymaster` | 550 AP (1.05) | 2.00 AP/s | Narrows uncertainty by 30 points; reveals deception & false loot. |

The Quartermaster and Grand Marshal discounts together never cut military upkeep below 20% of its base.

---

## 5. Bulk Purchasing Multipliers (1x, 10x, 50x, 100x)

To support rapid mid-to-late game scaling without repetitive clicking, bulk purchasing modes unlock progressively.

### 5.1 Unlock Milestones & Scope
The bulk purchasing modes define the **maximum allowable purchase quantity** in a single order:
- **1× Mode:** Available from game start (maximum purchase: 1).
- **10× Mode:** Unlocks at **Deadline 3** (or when Total Population $\ge 250$). Maximum purchase: $\le 10$.
- **50× Mode:** Unlocks at **Deadline 6** (or when Total Population $\ge 1,000$). Maximum purchase: $\le 50$.
- **100× Mode:** Unlocks at **Deadline 8**, **restricted strictly to high-volume low-cost roles (Peasants and Scribes)**. Maximum purchase: $\le 100$.

Any integer quantity from 1 up to the current unlocked maximum bulk size is valid. Arbitrary quantities exceeding the unlocked maximum (e.g. requesting 99 in Deadline 1) are strictly rejected.

### 5.2 Exact Geometric Sum Formula
Because unit price scales as $\text{Cost}(n) = \text{Base} \times r^n$ with $r \in \{1.07, 1.05\}$, purchasing $K$ units starting at current owned count $n$ costs:
$$\text{TotalCost}(n, K, r) = \sum_{i=0}^{K-1} \text{BaseCost} \times r^{n+i} = \text{BaseCost} \times r^n \times \frac{r^K - 1}{r - 1}$$

### 5.3 Hard Constraints on Bulk Purchases
The engine checks limiting ceilings before executing a bulk order:
1. **Available Free Population:** $K \le \text{Free Serfs}$.
2. **Order Cap Headroom:** $K \le \text{OrderCap} - \text{CurrentOrderCount}$.
3. **Maximum Bulk Size:** $K \le \text{MaxBulkSize}$.
If the player cannot afford or house all $K$ units, the UI offers a **"Buy Max"** button that computes the highest valid $K = \min\big(\text{AffordableByAP}, \lfloor\text{FreeSerfs}\rfloor, \lfloor\text{OrderHeadroom}\rfloor, \text{MaxBulkSize}\big)$.

---

## 6. Demographics, Bureaucracy & Unrest Mechanics

### 6.1 Population Housing Capacity & Civil Colonisation
$$\text{BaseCap} = 250 \times \text{Provinces} \quad (\text{Starting Capacity: } 3 \text{ Provinces} = 750)$$
$$\text{CapMultiplier} = 1 + (0.015 \times \text{Notables}) + (0.06 \times \text{Barons}) + \text{Modifiers}$$
$$\text{MaxPopulation} = \text{BaseCap} \times \text{CapMultiplier}$$

- **Starting Provinces & Biomes:** The realm begins with **3 neutral Heartland provinces** (`heartland`), ensuring starting housing capacity is exactly 750 ($3 \times 250$) with no initial bonus or penalty.
- **The Civil Colonisation Route:** To empower Bureaucrat players without forcing reliance on the military, players can establish new frontier provinces through peaceful civil colonisation:
  $$\text{ColonisationCost}(k) = 1500 \times 2^k \text{ AP}$$
  *(where $k$ is the number of provinces colonised).* Colonised provinces are always assigned the neutral **Heartland** biome.
- **Province Loss Order (LIFO):** Whenever a province is lost (Royal Censure, Lombard Loan, Defensive Collapse), the **last acquired province is removed** (LIFO stack order).

### 6.2 Proportional Logistic Population Growth
Rather than slow sub-linear additions, population expands on a true logistic curve:
$$\text{Growth/s} = r \times \text{TotalPopulation} \times \left(1 - \frac{\text{TotalPopulation}}{\text{MaxPopulation}}\right) \times \text{FiscalFactor}$$
- **Base Rate parameter:** $r_0 = 0.005$ ($0.5\%/\text{s}$), declared as a central pacing parameter in `src/data/balance.ts`.
- **Peasant & Farmer Tuning:** Each Peasant adds $+0.0005$ to $r$; each Farmer adds $+0.003$ to $r$.
- **Fiscal Factor:** $\text{FiscalFactor} = \max\left(0.1, 1 - \frac{\max(0, \text{TaxRate} - 25)}{50}\right)$.

### 6.3 Dynamic Order Caps
Role caps are pegged dynamically to living population:
- **Total Administration Allocation:** $\le 15\% \times \text{MaxPopulation}$
- **Total Military Allocation:** $\le 12\% \times \text{MaxPopulation}$
- **Total Specialized People Allocation:** $\le 25\% \times \text{MaxPopulation}$

### 6.4 Bureaucratic Inertia (Paperwork Formula)
$$\text{Size} = \sum (\text{Tier I} \times 1 + \text{Tier II} \times 2) + 0.5 \times \text{Soldiers} + 10 \times \text{Provinces}$$
$$\text{RawPaperwork} = \frac{\text{Size}}{\text{Size} + 220}$$
$$\text{NetPaperwork} = \text{RawPaperwork} \times (1 - \text{ArchivistReduction})$$
$$\text{Net AP/s} = \text{Gross AP/s} \times (1 - \text{NetPaperwork}) - \text{TotalUpkeep}$$

### 6.5 Unrest Threshold Stages (Non-Linear Penalties) & Dual-Stat Composition
Rather than a passive bar that only kills at 100%, Unrest acts as an escalating crisis with direct economic fallout:

| Unrest Level | Realm Status | Immediate Effect |
| :---: | :--- | :--- |
| **0% to 49%** | **Tranquility** | Normal governance; no penalties. |
| **50% to 74%** | **Fiscal Boycott** | Peasants refuse tax collectors $\rightarrow$ **-20% Tax Revenue** (cumulative across 50% to 99%). |
| **75% to 89%** | **Strife & Desertion** | Population growth frozen to 0; **1 Foot Soldier (`soldier`) deserts every 15s** (if 0 `soldier` remain, **1 Man-at-Arms (`man_at_arms`) deserts every 30s**; officers and scouts do not desert). Desertion is cumulative from 75% to 99%. Persisted in `GameState.desertionTimer` (reset to 0 if no eligible units exist or Unrest drops below 75%). |
| **90% to 99%** | **Urban Rebellion** | Chanceries besieged $\rightarrow$ **Scribe/Clerk gross AP output cut by 50%**. Strife desertion, demographic freeze, and fiscal boycott remain active! |
| **100%** | **Total Revolution** | The realm collapses in anarchy. **Instant Defeat (`revolution`)** at any moment (continuous increase or instant spike, in any phase). |

- **Cumulative Penalties & Desertion:** Penalties accumulate across escalating stages: fiscal boycott remains active from 50% to 99%, and military desertion applies across both the 75% to 89% (`strife_desertion`) and 90% to 99% (`urban_rebellion`) stages. The *Sanctuary Rights* law (§10.2) suppresses desertion **strictly below 90% Unrest** (desertions resume if Unrest reaches 90% to 99%).
- **Immediate Revolution:** Reaching 100% Unrest at any point in any phase (via continuous tick generation or instant spike from edicts, fiscal shock, campaign defeat, or levy en masse) immediately triggers the `revolution` defeat and transitions `phase` to `RUN_DEFEAT`. Subsequent phase transitions can never overwrite `RUN_DEFEAT`.
- **Dual-Stat Unrest Composition (`unrest_generation` vs `unrest_pacification`):**
  To prevent multiplicative modifiers from inverting sign when pacification exceeds generation, positive unrest sources and negative pacification sources are composed separately via `composeStat` before subtraction:
  - **Base Unrest Generation:** $\text{TaxUnrest} = \max\big(0, \frac{\text{TaxRate} - 25}{10} \times 0.05\big) \times \max(0.20, 1 - 0.20 \times \text{Prelates})$, plus overcrowding unrest (§14.3). Passed through `composeStat('unrest_generation', baseGen, ...)`.
  - **Base Unrest Pacification:** $\text{BasePacification} = 0.02 \times \text{Clergy} + 0.15 \times \text{Prelates}$. Passed through `composeStat('unrest_pacification', basePac, ...)`.
  - **Net Unrest Delta/s:** $\Delta\text{Unrest/s} = \text{ComposedGeneration} - \text{ComposedPacification}$.

---

## 7. Tactical Battles, Reconnaissance & Province Biomes

Battles are **instant tactical wagers** governed by reconnaissance, risk allocation, and fog of war.

### 7.1 Infinite Scout Reroll (Reconnaissance Patrols) & Target State
- During a reign, `GameState` holds a generated prospective campaign target (`currentTarget`: real enemy power, perceived power band, biome, loot type, and hidden `isFalseLedger` / `isAmbush` flags). A target is generated when the reign starts, when governance resumes and after each campaign. `LAUNCH_ATTACK` and `RECON_PATROL` are allowed in `ACTIVE_CYCLE` and `AWAIT_RESUME`, with no count limit, while the clock keeps running; letters block them.
- **Target Generation:** A target's power is 0.7 to 1.1 times the Military Quota of the current deadline (at least 15). Its biome is one of the four non-Heartland biomes, and its faction (§7.5) sets the loot type: Outlaws and Zealots yield Population, Rebel Barons Soldiers, Mercenaries AP, the other factions a random type among AP, Population, Soldiers and Mixed.
- **The Reroll Mechanism (`RECON_PATROL`):** If the player dislikes the target (e.g. enemy too strong, unwanted biome, suspected false loot), they may press **"Send Recon Patrol"** to generate a fresh target using the persisted `prngState`.
- **THE PATROL MORTALITY COST:**
  - The player may reroll **infinitely as long as they possess active Scouts**.
  - **Exactly 1 Scout dies on each reroll** (slain by enemy sentries during deep reconnaissance).
  - This death is deducted permanently from the realm's Total Population.
  - If Scouts reach 0, the reroll command is rejected and the button is disabled.

### 7.2 Province Biomes & Feudal Traits
Captured and starting provinces permanently bestow unique systemic modifiers to the realm:

| Biome | Name | Mechanical Trait |
| :--- | :--- | :--- |
| **Heartland** | **Heartland** | **Neutral starting & colonised biome**: capacity multiplier $\times 1.0$ (250 cap), $\Delta r = 0$, no defense bonus, no paperwork reduction. |
| **Farmlands** | **Arable Plains** | Housing capacity **$\times 1.5$** (375 cap) and **$\Delta r = +0.001$** (+0.1%/s base pop growth). |
| **Market** | **Trade Hub** | **+15% total tax revenue efficiency** across the entire realm. |
| **Military** | **Border Stronghold** | **+12 passive military defense** automatically added to defensive battles. |
| **Wilderness**| **Marshes & Forests**| **-5% paperwork inertia**, but housing capacity **$\times 0.8$** (200 cap). |

- **Biome Distribution & Lifecycle:** The 3 starting provinces are `heartland` (preserving the 750 starting capacity). Civil colonisation always yields a `heartland` province. Conquered provinces inherit the specific biome of `currentTarget`. When a province is lost (Royal Censure, Lombard Loan, Defensive Collapse), the **last acquired province is removed** (LIFO stack order).

### 7.3 Fog of War & Treachery
- **Uncertainty Margin:** Scouts report a band of width $2M \times P_{\text{real}}$ that always contains the real power at a random position: $[\max(0, P_{\text{real}} (1 - 2Mt)), P_{\text{real}} (1 + 2M(1 - t))]$ with $t$ drawn uniformly in $[0, 1)$ on the `combat` stream, so the band midpoint does not reveal the real power. The lower edge is floored at 0, which narrows the band (it can only go below 0 when $2Mt > 1$, which the doubled Steppe Horsemen margin allows); the upper edge is not capped (Base $M = \pm 45\%$). Each Scout narrows $M$ by 12 percentage points and each Spymaster by 30 percentage points, down to a minimum floor of $\pm 5\%$.
- **False Ledger (15% base chance):** Actual loot is **60% to 80% lower** than promised (enemy burned stores).
- **Ambush (10% base chance):** Enemy force is **25% stronger** than the highest scout estimate (`perceivedMax`, the upper edge of the perceived band).
- **Spymasters (Tier II):** Having $\ge 1$ active Spymaster detects and flags False Ledgers and Ambushes beforehand on `currentTarget`.

### 7.4 Generalized Asymmetric Combat Model (Attacker vs Defender)
All combat encounters (offensive campaigns, scheduled crown threats, and spontaneous surprise raids) follow a unified asymmetric resolution model:

$$\text{AttackerPower} = \text{Force}_{\text{att}} \times (1 - \text{SiegeFriction [10\%]}) \times \text{Roll}(0.92, 1.08)$$
$$\text{DefenderPower} = \big(\text{Force}_{\text{def}} \times (1 + \text{FortificationBonus [20\%]}) + \text{StrongholdDefense}\big) \times \text{Roll}(0.95, 1.10)$$

$$\text{CombatRatio} = \frac{\text{AttackerPower}}{\text{DefenderPower}}$$

#### 7.4.1 Offensive Campaigns (Player as Attacker)
- Player initiates the attack voluntarily; incurs the **Attacker's Siege Friction (-10%)**, while defending enemies enjoy fortification bonuses.
- **Loot Variance & Diverse Loot Types:**
  - Previewed spoils have an inherent estimation variance of approximately **$\pm 20\%$**. Base loot is **10 seconds of the AP rate quota** of the current deadline (D6, 275 AP/s: 2,750 AP), before outcome, variance and modifiers.
  - Spoils are **not limited to AP**:
    - *Treasury Plunder:* Pure AP ($\pm 20\%$). Credited strictly to `state.ap`; does not modify Gross AP Rate or increment quota tracking counters.
    - *Captive Serf Liberation:* Awards **Living Population** (+25 to +75 Free Serfs) instead of AP!
    - *Mercenary Garrison Capitulation:* Awards **Trained Soldiers** (+5 to +15 Soldiers) liberated into the player's ranks up to the military order cap headroom ($\text{OrderCap} - \text{CurrentMilitary}$). Any surplus beyond the headroom joins the Free Serfs pool (and `totalPopulation`), strictly preserving the §3.1 demographic balance.
    - *Mixed War Spoils:* A hybrid combination (e.g., 50% AP, 30% Population, 20% Soldiers).
- **Offensive Outcome Matrix ($R = \frac{\text{PlayerAttackingPower}}{\text{EnemyDefendingPower}}$):**

| Ratio ($R$) | Outcome | Province Awarded | Loot Yield | Unrest Impact |
| :---: | :--- | :---: | :---: | :---: |
| $\ge 1.40$ | **Decisive Victory** | **Captured** | 120% | -5 (Triumphant) |
| $1.05 < R < 1.40$ | **Clear Victory** | **Captured** | 100% | 0 |
| $1.00 \le R \le 1.05$ | **Razor-Thin Margin Victory** | **NONE** | 50% | +5 (Bloodied) |
| $0.80 \le R < 1.00$ | **Pyrrhic Standoff** | None | 0% | +15 (Humiliated) |
| $< 0.80$ | **Crushing Defeat** | None | 0% | +25 (Panic) |

*(Note on the Razor-Thin Rule: If victory is achieved within a $\le 5\%$ margin above parity, the surviving vanguard is too bloodied and exhausted to secure and occupy enemy territory. No province is awarded).*

- **Soldier Casualties:** A continuous curve of the clash ratio, linear between these points, flat outside them, then a roll of ±0.02 clamped to [0, 1], before Captains and other modifiers. The tiers still decide the province, loot and unrest.

| Ratio ($R$) | $\le 0.8$ | 0.9 | 1.0 | 1.2 | $\ge 1.4$ |
| :---: | :---: | :---: | :---: | :---: | :---: |
| Soldiers lost | 100% | 75% | 50% | 25% | 10% |
- **The Crown's Surcharge:** One conquered province per audit is free. Each further one raises `crownSurchargeSteps` by one, and all three quotas become $\text{quota} \times \text{quota\_requirement} \times (1 + \text{CONQUEST\_SURCHARGE\_STEP} \times \text{steps})$, at once and for the rest of the reign, even if the province is lost. `conquestsThisAudit` resets when an audit is evaluated, so a war of the open resume counts towards the audit ahead. Colonising raises nothing, and threat, raid and target force do not move.

#### 7.4.2 Defensive Battles (Surprise Raids & Crown Invasions, Player as Defender)
- The player is attacked on sovereign soil: Receives the **Defender's Fortification Bonus (+20%)** plus any passive **Border Stronghold Defense (+12 flat)** and **Man-at-Arms garrison bonus (+0.5 flat per Man-at-Arms)**.
- **Victory:** Invaders repelled! Light casualties (10%, mitigated by Captains) distributed proportionally across `soldier` and `man_at_arms`. Awards defensive salvage plunder:
  $$\text{SalvageAP} = \text{round}\big(0.25 \times \text{TributeCost}_{\text{repelled threat}} \times \text{Roll}(0.8, 1.2)\big)$$
  *(where $\text{TributeCost}_{\text{repelled threat}}$ corresponds to deadline $d+1$ for a Threat Herald encounter, and the current deadline for a `SURPRISE_RAID`)*, credited directly to treasury `state.ap`, and -5 Unrest.
- **Defensive Collapse (Defeat):**
  1. **1 Province Permanently Lost:** Invaders seize a province (removing the last acquired province in LIFO order). **No province floor applies to battle defeat**: if the realm holds only 1 province, it is lost, immediately triggering defeat by conquest (`conquest`).
  2. **Entire Army Annihilated:** **100% of the active military garrison (`soldier`, `man_at_arms`, `sergeant`, `captain`, `quartermaster`, `grand_marshal`, `scout`, `spymaster`) is killed in the breach** and deducted from `totalPopulation`.
  3. **Civilian Massacre & Enslavement:** **15% to 25% of the remaining total population slaughtered or captured** (deducted from `freeSerfs` first, then civil/admin units if needed to preserve the §3.1 Population Balance Equation).
  4. **Treasury Pillaged:** **30% to 50% of current positive AP treasury looted** ($\text{lostAp} = \text{round}(\max(0, \text{ap}) \times \text{frac})$ deducted as $\text{state.ap} -= \text{lostAp}$; existing debt is never reset or erased).
  5. **Overcrowding & Demographic Bleed:**
     - With one fewer province, housing capacity drops: $\text{MaxPop} = 250 \times (\text{Provinces} - 1) \times \text{CapMultiplier}$.
     - If living population exceeds capacity, **Demographic Bleed** triggers: Growth stops, and excess citizens continuously die or flee over time ($-2.5\text{ pop/s}$) until population returns under capacity or the player reconquers a province!
  6. **Unrest Surge:** Causes $+20$ immediate Unrest (via `addUnrest`; if Unrest reaches 100, revolution defeat is triggered immediately).

---

### 7.5 Enemy Factions & Subtle State Adaptations
Enemy threats and tactical campaign targets belong to thematic feudal factions with subtle state-reactive traits:

1. **Outlaw Bandits & Marauders:**
   - Frequent surprise raids against poorly defended lands. Loot yields rescued captive serfs (**Population**).
   - *Reactive Trait:* If player possesses $< 10$ soldiers, bandits inflict +15% civilian casualties.
2. **Rebel Barons & Armored Knights:**
   - Field disciplined armored retinues. Victory yields surrendered **Soldiers**.
   - *Reactive Trait:* If player maintains a huge army ($\text{Military} \ge 1.2 \times \text{Quota}$), enemies deploy *Armored Veterans* (+10% combat power).
3. **Free Company Mercenaries:**
   - Attracted by gold. Victory yields heavy **AP**.
   - *Reactive Trait:* Tribute demand increases by +25% (the doubling of surprise raid probability when `ap > 2000` is governed uniformly by the general raid rule in §8.3, without duplicate doubling).
4. **Holy League Zealots:**
   - Religious fanatics attacking during high unrest. Victory yields converts (**Population**).
   - *Reactive Trait:* If player Unrest is $> 60\%$, zealots trigger *Religious Defection* (+15 Unrest and one soldier desertion per 10 soldiers), applied when the threat is faced by defense or levy.
5. **Steppe Horsemen:**
   - Lightning cavalry raids; scout uncertainty margin is doubled (base $\pm 45\%$ becomes $\pm 90\%$, 5% floor).
6. **Imperial Crown Legions:**
   - Imperial siege host; threaten 2 provinces if defensive collapse occurs.

---

## 8. The Inter-Deadline Council Phase & Threat Matrix

At the 100-second mark of each deadline, game time pauses completely. The game advances through a strict **5-step sequence**:
1. **Crown Audit Verdict:** Emissaries inspect the 3 metrics. Grants an Imperial Gold Seal or issues a Royal Censure fine.
2. **Steward Dilemma:** An interactive narrative decision triggering choices based on the realm's current condition. The step is skipped when no dilemma qualifies or none has an affordable choice.
3. **Council of Laws:** The Prelate, Chancellor, and Marshal offer 3 law cards. Player enacts 1 or rejects all (+1 Archive).
4. **Threat Herald (Deadlines 2 to 9):** Announces and resolves the upcoming scheduled threat for deadline **$d+1$** (commencing after the Deadline 2 audit for Threat 3, through after the Deadline 9 audit for Threat 10).
5. **"Resume Governance" CTA:** Time stands still and the realm stays open: the player may buy and go to war, then presses the button to start the next 100-second cycle.

### 8.1 Crown Threats Matrix (Deadlines 3 to 10)
> [!NOTE]
> **Values derived from `src/data/balance.generated.ts`.**  
> Base threat power ($0.80 \times \text{MilitaryQuota}_{d+1}$) and tribute ($20 \times \text{ApRateQuota}_{d+1}$, $4 \times$ from deadline 8) are dynamically computed by the engine via `getThreatPower()`, `getThreatTributeSeconds()` and `getThreatTributeAp()` from the active quotas of deadline $d+1$ and are not hardcoded. The figures below match the current calibrated table in `balance.generated.ts`.

After audit $d$ ($2 \le d \le 9$), the Threat Herald announces the threat of deadline **$d+1$**.
Base Threat Power equals **80% of the Military Quota** for deadline $d+1$, while the Tribute demand equals **20 seconds of the Gross AP Rate Quota** for deadline $d+1$, and **4 seconds** from deadline 8 (`THREAT_TRIBUTE_LATE_FIRST_DEADLINE`, so the late tributes stay payable):
$$\text{BaseThreatPower} = 0.80 \times \text{MilitaryQuota}_{d+1}, \quad \text{TributeCost} = s_{d+1} \times \text{ApRateQuota}_{d+1}, \quad s_k = 20 \text{ if } k < 8, \text{ else } 4$$
The defensive salvage (§7.4.2) reads the same tribute rule, at the raid's own deadline for a surprise raid.

| Threat Deadline | Threat Title | Faction | Base Power | 3 Responses Available |
| :---: | :--- | :--- | :---: | :--- |
| **3** | *Border Raiders & Deserters* | Outlaws | 22 | Combat / 660 AP Tribute / Levy (+30 Unrest) |
| **4** | *The Rebellious Marches Baron* | Rebel Barons | 43 | Combat / 1,400 AP Tribute / Levy (+30 Unrest) |
| **5** | *Nomadic Steppe Horde* | Steppe Horsemen | 83 | Combat / 2,980 AP Tribute / Levy (+30 Unrest) |
| **6** | *The Renegade Free Companies* | Free Company Mercenaries | 158 | Combat / 5,500 AP Tribute / Levy (+30 Unrest) |
| **7** | *The Holy League Crusade* | Holy League Zealots | 298 | Combat / 10,140 AP Tribute / Levy (+30 Unrest) |
| **8** | *The Pretender Duke's Vanguard* | Rebel Barons | 566 | Combat / 3,740 AP Tribute / Levy (+30 Unrest) |
| **9** | *The Grand Inquisitorial Armada* | Holy League Zealots | 1,073 | Combat / 6,896 AP Tribute / Levy (+30 Unrest) |
| **10** | *The Royal Auditor's Iron Host* | Imperial Crown Legions | 2,034 | Combat / 12,720 AP Tribute / Levy (+30 Unrest) |

The figures are the base values. The faction trait (§7.5) adjusts them when the threat is announced: Rebel Barons add 10% power against a large army, and Mercenaries ask 25% more tribute (6,875 AP at deadline 6).

### 8.2 Threat Response Validation & Resolution Rules
1. **Armed Defense (`defense`):** Resolves via `resolveDefensiveClash` where the player acts as Defender (+20% fortification bonus + Stronghold defense).
2. **Pay Crown Tribute (`tribute`):** Requires `state.ap >= TributeCost`. **If the player lacks sufficient AP (`state.ap < TributeCost`), the `SELECT_THREAT_RESPONSE` command is strictly rejected (`success: false`) and the phase remains `THREAT_HERALD`**; the player cannot bypass combat without paying or mobilizing.
3. **Levy en Masse (`levy`):** Always available regardless of AP. Repels the threat automatically at the cost of **5% of Total Population as casualties** (preserving the §3.1 Population Balance Equation via demographic mutation helper) and **+30 immediate Unrest** (applied via `addUnrest`; if Unrest reaches 100, `RUN_DEFEAT` triggers immediately and is never overwritten).

### 8.3 Spontaneous Surprise Raids (`SURPRISE_RAID`)
- **Activation:** Active starting at **Deadline 3** during `ACTIVE_CYCLE`.
- **Check Interval & Probability:** Evaluated every **10 seconds** of active cycle time using the persisted `prngState`:
  - Base probability: **2%** per 10s check.
  - If `state.ap > 2000`: the base probability is **doubled ($\times 2$)**; the additions below are not doubled.
  - If `militaryPower < 0.50 * MilitaryQuota`: **$+2\%$** probability.
  - If `state.unrest > 60`: **$+2\%$** probability.
- **Hard Caps & Cooldown:** At most **1 surprise raid per deadline**, with a **minimum 60-second cooldown** since the last raid.
- **Raid Power:** $\text{RaidPower} = 0.50 \times \text{MilitaryQuota}$ of the current deadline. Transitions `state.phase` to `'SURPRISE_RAID'` until resolved via `RESOLVE_RAID_DEFENSE`.

---

## 9. Reactive Steward Dilemmas (20 Events)

Occurs once at the end of each deadline, responding dynamically to player state. All choices involving AP costs require `state.ap >= cost`; unaffordable choices are strictly rejected without changing phase. Negative AP represents debt; no mechanic resets negative AP to zero.

1. **The Taxable Windows** (Gross income $> 150\text{ AP/s}$): A) Tax panes (+15% Tax, +15 Unrest) | B) Forbid tax (-10 Unrest, +1 Archive).
2. **The Scribe Who Counted Too Much** (Gross AP Rate at the last audit under 115% of its quota: $\text{GrossAP/s} / \text{ApRateQuota} < 1.15$): A) Promote to Clerk (+1 Clerk, +0.5 AP/s upkeep) | B) Discard ledgers in moat (-5% paperwork, +10 Unrest).
3. **The Princely Cousin** (Military upkeep $> 35\%$ of the Gross AP Rate, constant `PRINCELY_COUSIN_UPKEEP_SHARE` = 0.35): A) Pay stipend (-500 AP, -15 Unrest) | B) Post to frontier (-10% military upkeep, +15% threat power).
4. **The Great Archive Fire** (Paperwork $> 45\%$): A) Let them burn! (-20% paperwork, +20 Unrest) | B) Hire scribes to copy (-400 AP, -5% paperwork).
5. **The Cabinet Scarcity** (Passed quota by $> 200\%$ on Gross AP Rate: $\text{GrossAP/s} / \text{ApRateQuota} > 3.0$): A) Commission iron vaults (-600 AP, +10% Admin output) | B) Burn older records (-1 Archive, +800 AP).
6. **The Peasant Salt Boycott** (Unrest $> 50\%$): A) Seize salt stores (+400 AP, +20 Unrest) | B) Concede salt holiday (-25% taxes for 30s, -25 Unrest).
7. **The Runaway Serfs** (Free Serfs $< 15\%$ of population): A) Hunt fugitives (+50 Free Serfs, +25 Unrest, costs 200 AP) | B) Grant tenures (-10% tax efficiency, +0.10 base pop growth/s).
8. **The Wandering Troubadours** (Deadline $\ge 3$, Unrest $< 35\%$): A) Shower with gold (-200 AP, -15 Unrest, +1 Archive) | B) Conscript into messenger corps (+2 Scribes free).
9. **The False Relic Merchant** (Priests/Prelates $\ge 5$): A) Purchase bone for abbey (-450 AP, -20 Unrest, +5% Prelate efficiency) | B) Expose fraud (+150 AP seized, +10 Unrest).
10. **The Foreign Envoy's Bribe** (Provinces $\ge 4$): A) Accept gold (+1,200 AP, +15 Unrest) | B) Expel envoy (+1 Archive, -10 Unrest).
11. **The Rotting Grain Silos** (Farmlands held): A) Feed to peasants (-30 Pop, saves coin) | B) Buy emergency grain (-350 AP, population saved).
12. **The Deserting Mercenaries** (AP $\le 0$ / Bankruptcy countdown): A) Melt reliquaries (+400 AP, +15 Unrest) | B) Disband 10 Soldiers (restarts the bankruptcy countdown from its full grace; it restarts again if AP stays at or below 0 with negative net AP).
13. **The Ghost Scribes** (Scribes $\ge 20$): A) Claw back wages (+500 AP, +15 Unrest) | B) Reallocate to supervisors (+10% Supervisor output).
14. **The Inquisitor's Demand** (Unrest $\ge 70\%$): A) Hand over heretics (-25 Pop, -30 Unrest) | B) Deny Church (+10 Unrest, +2 Archives).
15. **The Auditor's Nephew** (Deadline $\ge 5$): A) Appoint Crown Bailiff (+1 Supervisor, the Bailiff has no unit of its own, +15% paperwork) | B) Refuse post (Royal Pardon forfeited at the next audit only: a failed audit there is a `quota_failure` defeat even with 0 strikes; +1 Archive).
16. **The Smugglers' Cove** (Trade Hub held): A) Take 20% cut (+15% gross AP, +10 Unrest) | B) Hang ringleaders (+15 Military Power, +1 Archive).
17. **The Boundary Dispute** (Deadline $\ge 4$): A) Annex land for Crown (+50 housing capacity, +10 Unrest) | B) Arbitrate for fee (+400 AP, -5 Unrest).
18. **The Crown's Forced Loan** (Treasury $> 5,000\text{ AP}$): A) Pay loan (-2,000 AP, the three quotas of the next audit -15%) | B) Hide coin (-15% gross AP for 30s).
19. **The Mutinous Quartermaster** (Soldiers, Men-at-Arms, Sergeants and Captains together $\ge 25$): A) Hang publicly (-1 Quartermaster, -10 Unrest) | B) Enforce double bookkeeping (+300 AP, +5% military upkeep).
20. **The Astrologer's Comet** (Deadline 8 or 9): A) Imperial sign (+10% military power, +10 Unrest) | B) Mass prayers (-500 AP, -25 Unrest).

---

## 10. The 30 Imperial Laws (Full Pool)

Players choose 1 card per Council phase (up to 5 active slots) or reject all for +1 Archive Point.

### 10.1 The Chancellor (Administration & Fiscal)
1. **Royal Scriptorium:** +50% Scribe AP output | +20% paperwork.
2. **General Cadastre:** -25% paperwork | +2.0 AP/s upkeep per province.
3. **Exceptional Tithe:** +80% gross AP output until the next audit | +30 Unrest at that audit, then the law is repealed (it leaves its slot).
4. **Single Window Bureaucracy:** Archivists grant double reduction | Supervisors -50% efficiency.
5. **Stamp Duty Monopoly:** Clicks yield +100% AP | Free serf tax yield -15%.
6. **Crown Monopolies:** +25% gross AP output | Tier I unit recruit cost +25%.
7. **Chancery Red Tape:** Bankruptcy grace extended to 50s | Base paperwork +15%.
8. **Corvée Exemption Tax:** +30% tax efficiency | Peasant pop growth -25% (logistic growth rate r x0.75).
9. **Auditors' Inquisition:** Audit Chamber grants double reduction | +15 Unrest at each audit.
10. **Imperial Bond Floating:** +3,000 AP instantly | -10% gross AP/s debt service.

### 10.2 The Prelate (The People & Church)
1. **Census Edict:** +25% pop capacity | Admin order cap reduced by 20%.
2. **Holy Days & Vigils:** -0.20 Unrest/s pacification | -10% AP output.
3. **Primogeniture Decrees:** +20% province pop capacity | -20% demographic growth.
4. **Grand Kermesse:** -25 Unrest immediately | Costs 40 s of the current net AP income (nothing when net income is not positive; refused when AP is below the cost).
5. **Sanctuary Rights:** Prevents soldier desertion below 90% Unrest only (desertions resume at 90% to 99% Unrest) | Military recruit costs +30%.
6. **Monastic Granaries:** +0.08 pop growth/s per 100 serfs | 10% poll tax evasion.
7. **Tithe Commutation:** Priests and Prelates have zero upkeep | Tax efficiency -10%.
8. **Sumptuary Edicts:** -15% civil upkeep | Click critical chance -50%.
9. **Parish Relief Registers:** No demographic freeze during overcrowding | -5% gross AP/s.
10. **Papal Concordat:** -40% base Unrest generation | 1 active law slot permanently pledged to Holy See.

### 10.3 The Marshal (The Military & War)
1. **Standing Garrisons:** 60% of threat power absorbed | Military upkeep +30%.
2. **Merit Pay:** -30% military upkeep | Only effective if holding $\le 3$ provinces.
3. **Sanctioned Plunder:** Battle loot $\times 1.5$ | +15 Unrest per campaign battle.
4. **Officer Academies:** Sergeants and Captains count double | Soldier cost +20%.
5. **Feudal Retinue Levy:** +15 Men-at-Arms recruited instantly | Costs 15 Free Serfs and +20 Unrest.
6. **Scorched Earth:** Ambush probability 0% | Conquered provinces yield 50% less loot.
7. **Vanguard Drills:** Combat roll raised to $[1.05, 1.20]$ (the player's roll, attacking or defending) | Battle casualties +15%.
8. **Guerrilla Border Watch:** Border Strongholds grant double defense | Military upkeep +10%.
9. **Mercenary Capitulation:** Hire Men-at-Arms with AP without consuming Serfs | Upkeep doubled ($3.0\text{ AP/s}$).
10. **Marshal's Carte Blanche:** +25% Military Power | Chancellor laws cannot be enacted (the council still drafts them).

## 11. The Lord's Emergency Edicts (Last Resort Buttons)

When facing imminent bankruptcy or revolution during `ACTIVE_CYCLE`, the Lord can trigger three emergency executive orders. To preserve their role as desperate survival jokers rather than spammable quota sources, all three edicts obey strict systemic safeguards:

- **One Edict per Deadline Limit:** At most **1 emergency edict** (across all three types) may be enacted per deadline (`lastEdictDeadline < state.deadline`).
- **Escalating Run Penalties (+50% per prior use):** Each subsequent enactment of the same edict during a run increases its penalty by $+50\%$ ($\text{Multiplier}_k = 1 + 0.5 \times k$, where $k$ is the prior use count of that edict in `edictUsageCounts`).
- **Zero Quota Credit:** Emergency AP seizures (`forced_tithe`, `church_seizure`) are capital transfers into treasury `state.ap`. Because audits evaluate instantaneous Gross AP Rate, one-off capital transfers do not affect the AP quota. They also never increment `totalCumulativeAp` (which tracks continuous economic production and clicks only).

1. **The Forced Tithe (`forced_tithe`):** Instant seizure of grain and coin from serfs.
   - **Gain:** Instantly adds **30 seconds of current poll tax income** to `state.ap`.
   - **Penalty:** Causes **$+35 \times (1 + 0.5 \times k)$ immediate Unrest** (via `addUnrest`) and **freezes demographic population growth for 20 seconds** (`forcedTitheFreezeTimer = 20`).
2. **Church Seizure (`church_seizure`):** Confiscating church gold and reliquaries.
   - **Usage Cap:** Limited to **at most 2 uses per run**.
   - **Gain:** Instantly awards **$\max(300, 25 \times \text{Gross AP/s})$ AP** to `state.ap`.
   - **Penalty:** Cuts Clergy and Prelate pacification output by **50% (`unrest_pacification` $\times 0.5$) for $60 \times (1 + 0.5 \times k)$ seconds**, and inflicts **$+10 \times (1 + 0.5 \times k)$ immediate Unrest** (via `addUnrest`).
3. **The Grand Festival (`grand_festival`):** Opening wine cellars and funding public feasts.
   - **Gain:** Instantly removes **-20 Unrest** (via `addUnrest(state, -20)`).
   - **Cost:** Requires and deducts **$\max(100, 0.20 \times \max(0, \text{state.ap}), 30 \times \text{Gross AP/s})$ AP**. Strictly rejected if `state.ap < cost` (the cost is always $\ge 100$ AP and cannot be negative; debt is never erased).

---

## 12. Time Manipulation & Control

- **Manual Pause:** Available at any time via the UI or `Spacebar` to allow unhurried examination of tooltips, ledgers, and unit balances without losing quota time.
- **2× Fast-Forward:** Unlocked at **Deadline 5** for experienced players who have stabilized their economy and wish to speed up passive accumulation.

---

## 13. Run Scoring & Dynastic Titles

Upon victory (or defeat), the Crown compiles the sovereign's historical ledger:

### 13.1 Score Formula
$$\text{Score} = (\text{Total AP Produced} \times 0.01) + (\text{Max Population} \times 2) + (\text{Provinces} \times 500) + (\text{Victories} \times 200) - (\text{Strikes} \times 1000)$$

*(Note: "Total AP Produced" equals `totalCumulativeAp`, which records continuous economic production and manual clicks, strictly excluding capital transfers such as edicts, loans, plunder, and salvage. "Victories" equals `victoriesCount`: every offensive campaign won with $R \ge 1.00$, razor-thin margin included, and every repelled defensive clash).*

### 13.2 Dynastic Nobility Titles
- **"Grand Treasurer of the Crown":** Won with $> 60\%$ of total score derived from Administration.
- **"The Bloodied Conqueror":** Won with $\ge 8$ provinces captured.
- **"Father of the Nation":** Won with $\ge 4,000$ population and zero serf losses to starvation.
- **"Universal Sovereign":** Any other victory.
- **"Bankrupt Beggar":** Defeated via fiscal bankruptcy.
- **"The Fallen Tyrant":** Defeated via peasant revolution.
- **"The Subjugated Vassal":** Defeated via conquest.
- **"The Disgraced Regent":** Defeated via quota failure.

Victory titles are checked in this order and the first match wins: Bloodied Conqueror, Father of the Nation, Grand Treasurer, Universal Sovereign.

---

## 14. Realm Friction, Disband & Emergency Systems

### 14.1 Demobilization & Unit Disband (`DISBAND_UNIT`)
Players can dismiss units during `ACTIVE_CYCLE` or `AWAIT_RESUME` to cut ongoing upkeep or reduce bureaucratic inertia:
1. **Return to Serfdom:** Disbanded units return immediately to the **Free Serf pool** (`freeSerfs += count`, keeping `totalPopulation` invariant).
2. **Severance Pay & Unpaid Veterans Penalty:** Dismissing a unit costs **50% of its base AP cost** ($0.50 \times \text{BaseCost}$) in immediate severance pay. If `state.ap` cannot cover a unit's severance, disbanding is still permitted: severance is paid for as many whole units as the positive AP covers, and each unpaid unit inflicts **+2 immediate Unrest** (*Unpaid Veterans*).
3. **Mutiny Risk:** Disbanding more than **10% of total active military forces within a 10-second rolling window** (tracked in `GameState`) causes an instant **+15 Unrest** penalty.

### 14.2 Tax Shock & Promulgation Inertia (Anti-Exploit)
The tax rate is a whole percentage from 0 to 60.
1. **8-Second Upward Promulgation Delay:** Any **upward** tax rate adjustment (`targetRate > currentRate`) requires 8 seconds of elapsed game time to take effect. **Downward** adjustments (`targetRate <= currentRate`) take effect **immediately** (0s delay) and cancel any pending upward promulgation.
2. **Tax Shock Penalty:** Raising taxes by more than **15 percentage points in a single adjustment** (`targetRate - currentRate > 15`) causes an immediate **+20 Unrest spike**.

### 14.3 Housing Crisis & Overcrowding
1. If provinces are lost, living population can temporarily exceed $\text{MaxPopulation}$.
2. **Demographic Stagnation & Bleed:** Population growth immediately drops to **0**, and excess inhabitants die or flee at **$2.5\text{ pop/s}$** (deducted from `totalPopulation` and `freeSerfs` first, then active units if `freeSerfs == 0` so the §3.1 Population Balance Equation is strictly preserved).
3. **Plague & Squall:** Overcrowding generates **+0.10 Unrest/s per 50 excess inhabitants** (proportional: $\text{OvercrowdingUnrest/s} = \min\big(1.0, 0.10 \times \frac{\text{TotalPop} - \text{MaxPop}}{50}\big)$, capped at **$+1.0\text{ Unrest/s}$**).

### 14.4 Emergency Bankruptcy Bailout (The Lombard Offer)
The bankruptcy countdown (30 seconds, +10 per Audit Chamber, +20 under Chancery Red Tape) runs only while `state.ap <= 0` and net AP is negative, and it resets whenever `state.ap` is above 0.

1. At **20 seconds** of the 30-second bankruptcy countdown, if the realm possesses **at least 2 provinces** (`provinces >= 2`) and the bailout has not yet been used, the game enters the `LOMBARD_OFFER` phase where an urgent Crown emissary offers the **Lombard Bailout**. If the player holds only 1 province, the offer is not presented and the countdown continues uninterrupted to bankruptcy.
2. **Countdown Pause:** The 30-second bankruptcy countdown is paused while the player considers the offer in the `LOMBARD_OFFER` phase.
3. **Terms:** The realm permanently cedes **1 Province** (the last acquired province in LIFO order) in exchange for an immediate infusion of **2,000 AP** into treasury `state.ap` (as a capital transfer, it does not alter the Gross AP Rate). The bankruptcy countdown is restored to its full grace (30 seconds plus Audit Chamber and Chancery Red Tape bonuses).
4. **Usage:** Permitted **strictly once per run**; refusing the offer also uses it up.
5. **Rejection:** Refusing the offer returns the game to `ACTIVE_CYCLE` and resumes the bankruptcy countdown from the 20-second mark.

---

## 15. Meta-Progression: The National Archives

Archive Points earned during runs can be invested permanently into Crown Charters. Players may **freely reset and redistribute points** between runs.

- **Run points versus archive points:** `state.archivePoints` counts only the points earned during the current run (passed deadlines, rejected law drafts, dilemma choices). They may go negative when a dilemma spends more points than the run has earned so far. When the run is concluded (`concludeRun`), they are added to the persistent `ArchiveData.points`, together with +0.5 per feat unlocked for the first time (§19); the archive total never drops below 0. A run is concluded once: concluding it again awards nothing.
- **Perks:** investing costs the perk's points; a reset refunds every invested perk. Perk effects apply only to a run started from the archive (`startRun`); a bare `RESTART_RUN` starts with no perk and 0 run points.

| Perk | Cost | Permanent Effect |
| :--- | :---: | :--- |
| **Starting Treasury** | 1 pt | Start every run with +150 AP. |
| **Ancient Cadastre** | 2 pts | Base paperwork reduced by -5%. |
| **Charter of Liberties** | 2 pts | Starting Unrest reduced by -8 points. |
| **Standing Vanguard** | 3 pts | Start every run with 25 Foot Soldiers. |
| **Primogeniture Decrees** | 4 pts | +8% to all civil and administration caps. |
| **Spymaster Network** | 5 pts | Scout uncertainty margin narrowed by 12 points base. |
| **Royal Chronicle** | 6 pts | Displays quota thresholds for the next 2 upcoming deadlines (engine: stat `quota_foresight_deadlines` +2, read through `getForesightQuotas`; from the current deadline during active play, from the next one between deadlines, scaled by the quota requirement). |
| **Sixth Law Slot** | 10 pts | Unlocks a permanent 6th active law slot. |

---

## 16. Engine Specifications: Persistence, Focus Pause & Seeded RNG

1. **Auto-Save Frequency:** The full serialized JSON `GameState` is flushed to `localStorage` under `grand_audit_save` upon the conclusion of each deadline and after each law/battle resolution.
2. **Window Focus Auto-Pause:** When the browser tab loses focus (`document.visibilitychange` or `window.onblur`), the delta-time game loop immediately halts.
3. **Deterministic PRNG:** Random events, card drafts, and battle variances utilize a seeded pseudorandom number generator (PRNG, Mulberry32 algorithm). The run seed is displayed in the settings panel to enable reproducible speedruns and tournament play.

---

## 17. Onboarding Protocol & First-Time User Experience (FTUE)

To prevent cognitive overload while preserving discovery, the Steward guides new players through four concise milestones during **Deadline 1**:

1. **Step 1: Executive Mandate**: The Steward flashes: *"Sire, the Crown inspects in 100 seconds! Affix your seal to raise emergency gold."* (Prompts 15 manual clicks).
2. **Step 2: Bureaucratic Automation**: At 15 AP: *"Splendid. Hire your first Scribe to automate record-keeping and passive revenues."* (Highlights Scribe card).
3. **Step 3: The Fiscal Balance**: At 35 seconds: *"Adjust the tax slider. High taxes enrich the treasury but stir peasant unrest."* (Highlights Tax Slider).
4. **Step 4: Crown Quota Review**: At 70 seconds: *"Review the three Crown banners above. Note that the AP quota inspects our gross production rate (AP/s), not accumulated treasury. We must satisfy at least two criteria to survive."*
- **Opt-Out:** A clean *"Skip Tutorial"* button allows veteran players to disable all FTUE callouts permanently.

---

## 18. Save State Export / Import & Portability

To ensure run preservation across cache purges, devices, and browser sessions:

1. **Export Mechanism:**
   - Serializes current active `GameState` and accumulated `ArchiveData` into a compact JSON string: `{ schemaVersion, timestamp, state, archive }`.
   - Encodes the payload as a Base64 string prefixed with an encoding format header: `GRA-v1:<base64-payload>`.
   - The `GRA-v1:` prefix designates the envelope encoding format version and remains stable across versions. State schema versioning is managed inside the JSON payload via `schemaVersion: number` (e.g. 1, 2, ...), allowing sequential schema migrations upon import.
   - Copies directly to the user's clipboard in 1 click.
2. **Import Mechanism:**
   - Opens an import text modal.
   - Validates the `GRA-v1:` prefix and verifies `schemaVersion <= CURRENT_SCHEMA_VERSION`.
   - Applies sequential schema migrations (`1 -> 2`, etc.) to restore the state cleanly without requiring a page reload.
   - A save older than schema 5 carries no archive: it receives an empty archive holding the save's former `archivePoints`, and its run points restart at 0. The archive is validated on import (finite points >= 0, known and unique perk and feat ids).

---

## 19. Royal Feats & Achievements System

Eight thematic achievements incentivize exploring diverse playstyles. Each unlocked achievement permanently awards **+0.5 Archive Points** toward meta-progression, once per feat across all runs, when the run that unlocks it is concluded (§15). "Simultaneously" means at any moment of the run (the engine tracks the run peaks of active laws and provinces). Iron Bailout is a victory after accepting the Lombard Bailout, which is only offered at the 20-second mark of the bankruptcy countdown (§14.4):

| Feat | Title | Condition | Reward |
| :---: | :--- | :--- | :---: |
| 1 | **Royal Pacifist** | Win a run without recruiting a single military unit. | +0.5 Archive Pt |
| 2 | **Scout Butcher** | Sacrifice $\ge 20$ scouts in reconnaissance rerolls across a single run. | +0.5 Archive Pt |
| 3 | **Fiscal Paradise** | Win a run maintaining tax rate $\le 15\%$ at all times. | +0.5 Archive Pt |
| 4 | **Iron Bailout** | Win a run after accepting the Lombard Bailout (§14.4). | +0.5 Archive Pt |
| 5 | **Crœsus of the Realm** | Produce $> 1,000,000$ cumulative AP in a single run. | +0.5 Archive Pt |
| 6 | **The Six Seals** | Enact and maintain 6 active laws simultaneously. | +0.5 Archive Pt |
| 7 | **Unyielding Governance** | Win a run with zero strikes (no Royal Pardon used). | +0.5 Archive Pt |
| 8 | **Imperial Barony** | Control $\ge 8$ provinces simultaneously. | +0.5 Archive Pt |

---

## 20. Accessibility & Visual Presentation Toggles

1. **Typography Mode (High Legibility):**
   - A header toggle switches between **"Grimoire Styling"** (`MedievalSharp` / `IM Fell English`) and **"Modern Ledger"** (system clean sans-serif font).
   - Ensures readability on high-density mobile screens or for users with visual impairments.
2. **Accessible Quota Badges:**
   - Quota completion states never rely solely on green/red color perception.
   - Every threshold displays explicit iconographic indicators: `[yes SATISFIED]` or `[✗ DEFICIT]` with high-contrast borders.

---

## 21. Automated Simulation Bots & Skill Gradient Verification

To guarantee that the game tests actual player skill rather than arbitrary bot performance:
1. **Three Distinct Bot Tiers (Skill Gradient):**
   - *Random Noise Bot:* Makes random purchases without ROI calculation. Expected Win Rate: **< 5%**.
   - *Greedy ROI Bot (Baseline Human):* Calculates immediate payback time (amortization seconds) and purchases highest efficiency. Expected Win Rate: **35% to 65%**.
   - *Archetype Expert Bot:* Plays optimized archetype strategies (civil colonisation bureaucrat or aggressive plunder conqueror). Expected Win Rate: **> 65%**.
2. **Dynamic Quota Generation:**
   - Quotas are derived objectively from the median of the quota blind Greedy variant, played under relaxed quotas over multiple fixed seeds:
     $$\text{Quota}_1 = \lfloor \text{MedianBotScore}_1 \rfloor, \quad \text{Quota}_k = c \times w_k \times \text{MedianBotScore}_k \ (k \ge 2), \quad w = (0.9, 0.95, 1, 1, \dots)$$
   - The opening deadlines have almost no spread across seeds, so a full $c$ turns them into a cliff: deadline 1 is pinned to the floor of its medians (all three axes pass for a median player) and deadlines 2 and 3 take a lighter share of $c$.
   - From deadline 5, the medians of each axis are replaced by the least squares fit of their logarithm over deadlines 5 to 10 (a constant growth factor per axis), because the late medians sit between a take off mode and a stall mode and jumped (population $\times 3.2$ from D8 to D9 before the fit).
   - On the AP axis, the bot's score evaluated at audit $k$ is the **instantaneous Gross AP Rate (AP/s)**.
   - Current table: $c = 1.0875$, medians over the 200 calibration seeds 10001 to 10200, win rates measured on the 100 validation seeds 20001 to 20100 (Random 0%, Greedy 54%, Bureaucrat 100%, Conqueror 76%). The Random bot is also asserted on 20 seeds and each expert bot on 20 seeds.
   - The scaling coefficient $c$ is not arbitrarily fixed at 0.8; it is an unknown variable determined algorithmically by the calibration solver script (`scripts/generate-balance-report.ts`) via bisection until the quota aware Greedy ROI Bot (the bisection target, on validation seeds) stabilizes strictly within the target win rate band of **35% to 65%**.
3. **Dominance & Sensitivity Testing:**
   - *Dominance:* Beyond Deadline 3 (after the opening phase where Scribes and Peasants naturally dominate), asserts across 200 runs per archetype (seeds 50001 to 50200) that every unit role of the catalog is purchased at least once, and no single unit exceeds 60% of the spending after 300 s within a given archetype build.
   - *Sensitivity:* Modulates $r_0$, the two cost ratios and the poll tax rate (`TAX_POLL_RATE`) by $\pm 10\%$, one at a time, over 100 seeds (40001 to 40100), and asserts that the Greedy win rate stays within 0.20 of the baseline; cost ratios are modulated on their growth part ($r - 1$). Baseline 0.44 with the current table; every variant stays inside the band (worst gap 0.13, tier I cost ratio growth $\times 0.9$: 0.57; $\times 1.1$: 0.36).



