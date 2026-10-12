# The Grand Audit – Game Systems & Balance Specifications

This document defines the comprehensive game systems, unit tiers, mathematical scaling laws, single-clash battle mechanics, law discovery pipelines, demographic pools, emergency edicts, and scoring mechanics for **The Grand Audit**.

---

## 1. Core Structure & Equilibrium Principles

### 1.1 The Ten Deadlines
- A run spans **10 deadlines** lasting **100 seconds** of active game time each (~16.6 minutes total active time).
- Time pauses automatically during **Law Drafts**, **Steward Events**, and **Battle Resolutions**.
- **The Two-Out-Of-Three Rule:** At each deadline inspection, the Crown evaluates three metrics:
  1. **Administrative Power (AP):** Cumulative gross AP produced during the deadline interval.
  2. **Total Population:** Current living population across all provinces at the moment of inspection.
  3. **Military Power:** Total active military combat power at the moment of inspection.
- The player must satisfy at least **2 out of 3 criteria** to pass.

### 1.2 The Single Royal Pardon (Yellow Card Grace Rule)
Failing a quota early in a run shouldn't arbitrarily kill a good attempt without a chance for redemption:
- **One Strike Permitted:** The first time a deadline is failed (fewer than 2 out of 3 quotas met), the King issues a **Royal Censure**:
  - The Crown forcibly confiscates **1 Province** and **50% of the player's current AP treasury** as an imperial fine.
  - **The Hard Province Floor Rule:** Fines and bailouts (Royal Censure, Lombard Loan) enforce a **strict floor of 1 province**. The Crown never strips the sovereign's last seat; only military conquest can seize the last province.
  - The run continues into the next deadline.
- **Second Failure:** Immediate public execution of the Lord (Game Over).

### 1.3 Mid-Deadline Interim Inspection (50-Second Warning)
At exactly the **50-second mark** of each 100-second deadline, the Steward provides an interim fiscal audit:
- If on track to satisfy $\ge 2$ criteria: Displays a green commendation badge (*"The Crown shall be pleased, Sire"*).
- If on track to fail $\ge 2$ criteria: Triggers a subtle audio alert and a pulsing red warning banner (*"Disaster looms! Quotas lagging. Mobilize or raise revenues immediately!"*).

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

- **Second 0 (No passive income):** 1 click = **1 AP**. In 15 clicks, the player recruits their first Scribe.
- **Mid-game (Gross income = 100 AP/s):** 1 click = $1 + 3.5 = \mathbf{4.5\text{ AP}}$. Clicking 4 times/sec yields **18 AP/s** (~18% of realm production).
- **Late-game (Gross income = 10,000 AP/s):** 1 click = $1 + 350 = \mathbf{351\text{ AP}}$.

### 2.2 Critical Stamps (Imperial Wax Seal)
- **5% Critical Chance:** Every click has a 1-in-20 chance to trigger an Imperial Seal.
- **Effect:** Delivers **3× Click Value**, triggering an accented wax-stamp audio crunch (`metalClick.ogg`) and a burst of gold seal visual particles.

### 2.3 The Lord's Privilege (Paperwork Mitigation)
Because a click is a direct executive decree bearing the sovereign's personal seal, it bypasses the sluggish lower bureaucracy:
- Clicks suffer **only 50% of the bureaucratic inertia penalty** ($\text{Effective Paperwork} = 0.5 \times \text{NetPaperwork}$).
- Even when paperwork reaches 80% friction, manual clicking remains viable to squeeze out critical AP before an audit buzzer.

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
 │ • Peasants    │               │ • Scribes     │               │ • Soldiers    │
 │ • Artisans    │               │ • Supervisors │               │ • Officers    │
 │ • Clergy      │               │ • Archivists  │               │ • Quarterm'rs │
 │ • Notables    │               │ • Collectors  │               │ • Scouts      │
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
1. **Institutional Maturity:** Reached at least **Deadline 4**.
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

---

## 5. Bulk Purchasing Multipliers (1x, 10x, 50x, 100x)

To support rapid mid-to-late game scaling without repetitive clicking, bulk purchasing modes unlock progressively.

### 5.1 Unlock Milestones & Scope
- **1× Mode:** Available from game start.
- **10× Mode:** Unlocks at **Deadline 3** (or when Total Population $\ge 250$).
- **50× Mode:** Unlocks at **Deadline 6** (or when Total Population $\ge 1,000$).
- **100× Mode:** Unlocks at **Deadline 8**, **restricted strictly to high-volume low-cost roles (Peasants and Scribes)**.

### 5.2 Exact Geometric Sum Formula
Because unit price scales as $\text{Cost}(n) = \text{Base} \times r^n$ with $r \in \{1.07, 1.05\}$, purchasing $K$ units starting at current owned count $n$ costs:
$$\text{TotalCost}(n, K, r) = \sum_{i=0}^{K-1} \text{BaseCost} \times r^{n+i} = \text{BaseCost} \times r^n \times \frac{r^K - 1}{r - 1}$$

### 5.3 Hard Constraints on Bulk Purchases
The engine checks two limiting ceilings before executing a bulk order:
1. **Available Free Population:** $K \le \text{Free Serfs}$.
2. **Order Cap Headroom:** $K \le \text{OrderCap} - \text{CurrentOrderCount}$.
If the player cannot afford or house all $K$ units, the UI offers a **"Buy Max"** button that computes the highest valid $K$.

---

## 6. Demographics, Bureaucracy & Unrest Mechanics

### 6.1 Population Housing Capacity & Civil Colonisation
$$\text{BaseCap} = 250 \times \text{Provinces} \quad (\text{Starting Capacity: } 3 \text{ Provinces} = 750)$$
$$\text{CapMultiplier} = 1 + (0.015 \times \text{Notables}) + (0.06 \times \text{Barons}) + \text{Modifiers}$$
$$\text{MaxPopulation} = \text{BaseCap} \times \text{CapMultiplier}$$

- **The Civil Colonisation Route:** To empower Bureaucrat players without forcing reliance on the military, players can establish new frontier provinces through peaceful civil colonisation:
  $$\text{ColonisationCost}(k) = 1500 \times 2^k \text{ AP}$$
  *(where $k$ is the number of provinces colonised).*

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

### 6.5 Unrest Threshold Stages (Non-Linear Penalties)
Rather than a passive bar that only kills at 100%, Unrest acts as an escalating crisis with direct economic fallout:

| Unrest Level | Realm Status | Immediate Effect |
| :---: | :--- | :--- |
| **0% – 49%** | **Tranquility** | Normal governance; no penalties. |
| **50% – 74%** | **Fiscal Boycott** | Peasants refuse tax collectors $\rightarrow$ **-20% Tax Revenue**. |
| **75% – 89%** | **Strife & Desertion** | Population growth frozen to 0; **1 soldier deserts every 15 seconds**. |
| **90% – 99%** | **Urban Rebellion** | Chanceries besieged $\rightarrow$ **Scribe/Clerk gross AP output cut by 50%**. |
| **100%** | **Total Revolution** | The realm collapses in anarchy. **Instant Defeat**. |

---

## 7. Tactical Battles, Reconnaissance & Province Biomes

Battles are **instant tactical wagers** governed by reconnaissance, risk allocation, and fog of war.

### 7.1 Infinite Scout Reroll (Reconnaissance Patrols)
- Between deadlines, the player is presented with a prospective target province.
- **The Reroll Mechanism:** If the player dislikes the target (e.g. enemy too strong, unwanted biome, suspected false loot), they may press **"Send Recon Patrol"** to reroll the target.
- **THE PATROL MORTALITY COST:**
  - The player may reroll **infinitely as long as they possess active Scouts**.
  - **Exactly 1 Scout dies on each reroll** (slain by enemy sentries during deep reconnaissance).
  - This death is deducted permanently from the realm's Total Population.
  - If Scouts reach 0, the reroll button is disabled.

### 7.2 Province Biomes & Feudal Traits
Captured provinces permanently bestow unique systemic modifiers to the realm:

| Biome | Name | Mechanical Trait |
| :--- | :--- | :--- |
| **Farmlands** | **Arable Plains** | Housing capacity **$\times 1.5$** (375 cap) and **$\Delta r = +0.001$** (+0.1%/s base pop growth). |
| **Market** | **Trade Hub** | **+15% total tax revenue efficiency** across the entire realm. |
| **Military** | **Border Stronghold** | **+12 passive military defense** automatically added to defensive battles. |
| **Wilderness**| **Marshes & Forests**| **-5% paperwork inertia**, but housing capacity **$\times 0.8$** (200 cap). |

### 7.3 Fog of War & Treachery
- **Uncertainty Margin:** Enemy power sits within $P_{\text{real}} \times [1 - M, 1 + M]$ (Base $M = \pm 45\%$). Scouts narrow it to $\pm 5\%$.
- **False Ledger (15% base chance):** Actual loot is **60% to 80% lower** than promised (enemy burned stores).
- **Ambush (10% base chance):** Enemy force is **25% stronger** than the highest scout estimate.
- **Spymasters (Tier II):** Detect and flag False Ledgers and Ambushes beforehand in the UI.

### 7.4 Generalized Asymmetric Combat Model (Attacker vs Defender)
All combat encounters (offensive campaigns, scheduled crown threats, and spontaneous surprise raids) follow a unified asymmetric resolution model:

$$\text{AttackerPower} = \text{Force}_{\text{att}} \times (1 - \text{SiegeFriction [10\%]}) \times \text{Roll}(0.92, 1.08)$$
$$\text{DefenderPower} = \big(\text{Force}_{\text{def}} \times (1 + \text{FortificationBonus [20\%]}) + \text{StrongholdDefense}\big) \times \text{Roll}(0.95, 1.10)$$

$$\text{CombatRatio} = \frac{\text{AttackerPower}}{\text{DefenderPower}}$$

#### 7.4.1 Offensive Campaigns (Player as Attacker)
- Player initiates the attack voluntarily; incurs the **Attacker's Siege Friction (-10%)**, while defending enemies enjoy fortification bonuses.
- **Loot Variance & Diverse Loot Types:**
  - Previewed spoils have an inherent estimation variance of approximately **$\pm 20\%$**.
  - Spoils are **not limited to AP**:
    - *Treasury Plunder:* Pure AP ($\pm 20\%$).
    - *Captive Serf Liberation:* Awards **Living Population** (+25 to +75 Free Serfs) instead of AP!
    - *Mercenary Garrison Capitulation:* Awards **Trained Soldiers** (+5 to +15 Soldiers) liberated into the player's ranks!
    - *Mixed War Spoils:* A hybrid combination (e.g., 50% AP, 30% Population, 20% Soldiers).
- **Offensive Outcome Matrix ($R = \frac{\text{PlayerAttackingPower}}{\text{EnemyDefendingPower}}$):**

| Ratio ($R$) | Outcome | Province Awarded | Loot Yield | Soldier Casualties | Unrest Impact |
| :---: | :--- | :---: | :---: | :---: | :---: |
| $\ge 1.40$ | **Decisive Victory** | **Captured** | 120% | 8% – 12% | -5 (Triumphant) |
| $1.05 < R < 1.40$ | **Clear Victory** | **Captured** | 100% | 20% – 30% | 0 |
| $1.00 \le R \le 1.05$ | **Razor-Thin Margin Victory** | **NONE** | 50% | 45% – 55% | +5 (Bloodied) |
| $0.80 \le R < 1.00$ | **Pyrrhic Standoff** | None | 0% | 70% – 80% | +15 (Humiliated) |
| $< 0.80$ | **Crushing Defeat** | None | 0% | **100% committed lost** | +25 (Panic) |

*(Note on the Razor-Thin Rule: If victory is achieved within a $\le 5\%$ margin above parity, the surviving vanguard is too bloodied and exhausted to secure and occupy enemy territory. No province is awarded).*

#### 7.4.2 Defensive Battles (Surprise Raids & Crown Invasions – Player as Defender)
- The player is attacked on sovereign soil: Receives the **Defender's Fortification Bonus (+20%)** plus any passive **Border Stronghold Defense (+12 flat)**.
- **Victory:** Invaders repelled! Light casualties (5-15%), defensive salvage loot (+AP or captured recruits), -5 Unrest.
- **Defensive Collapse (Defeat):**
  1. **1 Province Permanently Lost:** Invaders seize a province, destroying its infrastructure stack.
  2. **Entire Army Annihilated:** **100% of the active military garrison is killed in the breach**.
  3. **Civilian Massacre & Enslavement:** **15% to 25% of Total Population slaughtered or captured**.
  4. **Treasury Pillaged:** **30% to 50% of current AP treasury looted**.
  5. **Overcrowding & Demographic Bleed:**
     - With one fewer province, housing capacity drops: $\text{MaxPop} = 250 \times (\text{Provinces} - 1) \times \text{CapMultiplier}$.
     - If living population exceeds capacity, **Demographic Bleed** triggers: Growth stops, and excess citizens continuously die or flee over time ($-2\text{ to } -4\text{ pop/s}$) until population returns under capacity or the player reconquers a province!

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
   - *Reactive Trait:* If player AP treasury exceeds $> 2,000\text{ AP}$, surprise raid chance doubles and tribute demand increases by +25%.
4. **Holy League Zealots:**
   - Religious fanatics attacking during high unrest. Victory yields converts (**Population**).
   - *Reactive Trait:* If player Unrest is $> 60\%$, zealots trigger *Religious Defection* (+15 Unrest and soldier desertions).
5. **Steppe Horsemen:**
   - Lightning cavalry raids; scout uncertainty margin is doubled ($\pm 30\%$).
6. **Imperial Crown Legions:**
   - Imperial siege host; threaten 2 provinces if defensive collapse occurs.

---

## 8. The Inter-Deadline Council Phase & Threat Matrix

At the 100-second mark of each deadline, game time pauses completely. The game advances through a strict **6-step sequence**:
1. **Crown Audit Verdict:** Emissaries inspect the 3 metrics. Grants an Imperial Gold Seal or issues a Royal Censure fine.
2. **Steward Dilemma:** An interactive narrative decision triggering choices based on the realm's current condition.
3. **Council of Laws:** The Prelate, Chancellor, and Marshal offer 3 law cards. Player enacts 1 or rejects all (+1 Archive).
4. **Threat Herald:** The upcoming threat for the next deadline is revealed (commencing Deadline 3).
5. **Expeditionary Phase:** Optional window to launch 0, 1, or 2 military campaigns (with scout rerolls).
6. **"Resume Governance" CTA:** Player manually presses the button to unpause time and start the next 100-second cycle.

### 8.1 Crown Threats Matrix (Deadlines 3 to 10)
> [!NOTE]
> **Values derived from the provisional quota matrix.**  
> Base threat power ($0.8 \times \text{MilitaryQuota}$) and tribute ($0.2 \times \text{ApQuota}$) are dynamically computed by the engine via `getThreatPower()` and `getThreatTributeAp()` from active quotas and are not hardcoded. The figures below illustrate the current provisional table.

Base Threat Power equals **80% of the Military Quota** for that deadline, while the Tribute demand equals **20% of the current Deadline AP Quota**:
$$\text{BaseThreatPower} = 0.80 \times \text{MilitaryQuota}, \quad \text{TributeCost} = 0.20 \times \text{ApQuota}$$

| Deadline | Threat Title | Faction | Base Power | 3 Responses Available |
| :---: | :--- | :--- | :---: | :--- |
| **3** | *Border Raiders & Deserters* | Outlaws | 36 | Combat / 560 AP Tribute / 10% Pop Levy (+30 Unrest) |
| **4** | *The Rebellious Marches Baron* | Dissident Barons | 60 | Combat / 1,100 AP Tribute / 10% Pop Levy (+30 Unrest) |
| **5** | *Nomadic Steppe Horde* | Steppe Horsemen | 92 | Combat / 2,000 AP Tribute / 10% Pop Levy (+30 Unrest) |
| **6** | *The Renegade Free Companies* | Mercenaries | 132 | Combat / 3,600 AP Tribute / 10% Pop Levy (+30 Unrest) |
| **7** | *The Holy League Crusade* | Holy Zealots | 180 | Combat / 6,400 AP Tribute / 10% Pop Levy (+30 Unrest) |
| **8** | *The Pretender Duke's Vanguard* | Rebel Nobility | 232 | Combat / 11,000 AP Tribute / 10% Pop Levy (+30 Unrest) |
| **9** | *The Grand Inquisitorial Armada* | Imperial Church | 280 | Combat / 19,000 AP Tribute / 10% Pop Levy (+30 Unrest) |
| **10** | *The Royal Auditor's Iron Host* | Imperial Army | 336 | Combat / 32,000 AP Tribute / 10% Pop Levy (+30 Unrest) |

Failure to answer a threat permanently costs **1 Province** and **15% of the living population**.

---

## 9. Reactive Steward Dilemmas (20 Events)

Occurs once at the end of each deadline, responding dynamically to player state:

1. **The Taxable Windows** (Gross income $> 150\text{ AP/s}$): A) Tax panes (+15% Tax, +15 Unrest) | B) Forbid tax (-10 Unrest, +1 Archive).
2. **The Scribe Who Counted Too Much** (Passed quota by $< 15\%$): A) Promote to Clerk (+1 Clerk, +0.5 AP/s upkeep) | B) Discard ledgers in moat (-5% paperwork, +10 Unrest).
3. **The Princely Cousin** (Military upkeep $> 35\%$ of income): A) Pay stipend (-500 AP, -15 Unrest) | B) Post to frontier (-10% military upkeep, +15% threat power).
4. **The Great Archive Fire** (Paperwork $> 45\%$): A) Let them burn! (-20% paperwork, +20 Unrest) | B) Hire scribes to copy (-400 AP, -5% paperwork).
5. **The Cabinet Scarcity** (Passed quota by $> 200\%$): A) Commission iron vaults (-600 AP, +10% Admin output) | B) Burn older records (-1 Archive, +800 AP).
6. **The Peasant Salt Boycott** (Unrest $> 50\%$): A) Seize salt stores (+400 AP, +20 Unrest) | B) Concede salt holiday (-25% taxes for 30s, -25 Unrest).
7. **The Runaway Serfs** (Free Serfs $< 15\%$ of population): A) Hunt fugitives (+50 Free Serfs, +25 Unrest, costs 200 AP) | B) Grant tenures (-10% tax efficiency, +0.10 base pop growth/s).
8. **The Wandering Troubadours** (Deadline $\ge 3$, Unrest $< 35\%$): A) Shower with gold (-200 AP, -15 Unrest, +1 Archive) | B) Conscript into messenger corps (+2 Scribes free).
9. **The False Relic Merchant** (Priests/Prelates $\ge 5$): A) Purchase bone for abbey (-450 AP, -20 Unrest, +5% Prelate efficiency) | B) Expose fraud (+150 AP seized, +10 Unrest).
10. **The Foreign Envoy's Bribe** (Provinces $\ge 4$): A) Accept gold (+1,200 AP, +15 Unrest) | B) Expel envoy (+1 Archive, -10 Unrest).
11. **The Rotting Grain Silos** (Farmlands held): A) Feed to peasants (-30 Pop, saves coin) | B) Buy emergency grain (-350 AP, population saved).
12. **The Deserting Mercenaries** (AP $\le 0$ / Bankruptcy countdown): A) Melt reliquaries (+400 AP, +15 Unrest) | B) Disband 10 Soldiers (cancels bankruptcy).
13. **The Ghost Scribes** (Scribes $\ge 20$): A) Claw back wages (+500 AP, +15 Unrest) | B) Reallocate to supervisors (+10% Supervisor output).
14. **The Inquisitor's Demand** (Unrest $\ge 70\%$): A) Hand over heretics (-25 Pop, -30 Unrest) | B) Deny Church (+10 Unrest, +2 Archives).
15. **The Auditor's Nephew** (Deadline $\ge 5$): A) Appoint Crown Bailiff (+1 Bailiff, +15% paperwork) | B) Refuse post (-1 strike safety margin, +1 Archive).
16. **The Smugglers' Cove** (Trade Hub held): A) Take 20% cut (+15% gross AP, +10 Unrest) | B) Hang ringleaders (+15 Military Power, +1 Archive).
17. **The Boundary Dispute** (Deadline $\ge 4$): A) Annex land for Crown (+50 housing capacity, +10 Unrest) | B) Arbitrate for fee (+400 AP, -5 Unrest).
18. **The Crown's Forced Loan** (Treasury $> 5,000\text{ AP}$): A) Pay loan (-2,000 AP, next quota -15%) | B) Hide coin (-15% gross AP for 30s).
19. **The Mutinous Quartermaster** (Military units $\ge 25$): A) Hang publicly (-1 Quartermaster, -10 Unrest) | B) Enforce double bookkeeping (+300 AP, +5% military upkeep).
20. **The Astrologer's Comet** (Deadline 8 or 9): A) Imperial sign (+10% military power, +10 Unrest) | B) Mass prayers (-500 AP, -25 Unrest).

---

## 10. The 30 Imperial Laws (Full Pool)

Players choose 1 card per Council phase (up to 5 active slots) or reject all for +1 Archive Point.

### 10.1 The Chancellor (Administration & Fiscal)
1. **Royal Scriptorium:** +50% Scribe AP output | +20% paperwork.
2. **General Cadastre:** -25% paperwork | +2.0 AP/s upkeep per province.
3. **Exceptional Tithe:** +80% AP output during deadline | +30 Unrest upon audit.
4. **Single Window Bureaucracy:** Archivists grant double reduction | Supervisors -50% efficiency.
5. **Stamp Duty Monopoly:** Clicks yield +100% AP | Free serf tax yield -15%.
6. **Crown Monopolies:** +25% gross AP output | Tier I unit recruit cost +25%.
7. **Chancery Red Tape:** Bankruptcy grace extended to 50s | Base paperwork +15%.
8. **Corvée Exemption Tax:** +30% tax efficiency | Peasant pop growth -25%.
9. **Auditors' Inquisition:** Audit Chamber grants double reduction | +15 Unrest at each audit.
10. **Imperial Bond Floating:** +3,000 AP instantly | -10% gross AP/s debt service.

### 10.2 The Prelate (The People & Church)
1. **Census Edict:** +25% pop capacity | Admin order cap reduced by 20%.
2. **Holy Days & Vigils:** -0.20 Unrest/s pacification | -10% AP output.
3. **Primogeniture Decrees:** +20% province pop capacity | -20% demographic growth.
4. **Grand Kermesse:** -25 Unrest immediately | Costs 40s net AP income.
5. **Sanctuary Rights:** Prevents soldier desertion below 90% Unrest | Military recruit costs +30%.
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
7. **Vanguard Drills:** Combat roll raised to $[1.05, 1.20]$ | Battle casualties +15%.
8. **Guerrilla Border Watch:** Border Strongholds grant double defense | Military upkeep +10%.
9. **Mercenary Capitulation:** Hire Men-at-Arms with AP without consuming Serfs | Upkeep doubled ($3.0\text{ AP/s}$).
10. **Marshal's Carte Blanche:** +25% Military Power | Chancellor laws cost double AP.

## 11. The Lord's Emergency Edicts (Last Resort Buttons)

When facing imminent bankruptcy or revolution, the Lord can trigger three emergency executive orders:

1. **The Forced Tithe:** Instant seizure of grain and coin from serfs.
   - **Gain:** Instantly adds **30 seconds of current tax income**.
   - **Penalty:** Causes **+35 immediate Unrest**.
2. **Church Seizure:** Confiscating church gold and reliquaries.
   - **Gain:** Instantly awards **+500 AP**.
   - **Penalty:** Clergy and Prelate pacification output cut by **50% for 60 seconds**.
3. **The Grand Festival:** Opening wine cellars and funding public feasts.
   - **Gain:** Instantly removes **-20 Unrest**.
   - **Penalty:** Costs **20% of current AP treasury**.

---

## 12. Time Manipulation & Control

- **Manual Pause:** Available at any time via the UI or `Spacebar` to allow unhurried examination of tooltips, ledgers, and unit balances without losing quota time.
- **2× Fast-Forward:** Unlocked at **Deadline 5** for experienced players who have stabilized their economy and wish to speed up passive accumulation.

---

## 13. Run Scoring & Dynastic Titles

Upon victory (or defeat), the Crown compiles the sovereign's historical ledger:

### 13.1 Score Formula
$$\text{Score} = (\text{Total AP Produced} \times 0.01) + (\text{Max Population} \times 2) + (\text{Provinces} \times 500) + (\text{Victories} \times 200) - (\text{Strikes} \times 1000)$$

### 13.2 Dynastic Nobility Titles
- **"Grand Treasurer of the Crown":** Won with $> 60\%$ of total score derived from Administration.
- **"The Bloodied Conqueror":** Won with $\ge 8$ provinces captured.
- **"Father of the Nation":** Won with $\ge 4,000$ population and zero serf losses to starvation.
- **"Universal Sovereign":** Won with balanced contributions across all three Orders.
- **"Bankrupt Beggar":** Defeated via fiscal bankruptcy.
- **"The Fallen Tyrant":** Defeated via peasant revolution.

---

## 14. Realm Friction, Disband & Emergency Systems

### 14.1 Demobilization & Unit Disband
Players can dismiss units to cut ongoing upkeep or reduce bureaucratic inertia:
1. **Return to Serfdom:** Disbanded units return immediately to the **Free Serf pool**.
2. **Severance Pay:** Dismissing a unit costs **50% of its base AP cost** in immediate severance pay.
3. **Mutiny Risk:** Disbanding more than **10% of total active military forces within 10 seconds** causes an instant **+15 Unrest** penalty.

### 14.2 Tax Shock & Promulgation Inertia (Anti-Exploit)
1. **8-Second Promulgation Delay:** Any upward tax rate adjustment requires 8 seconds of elapsed game time to take full effect.
2. **Tax Shock Penalty:** Raising taxes by more than **15 percentage points in a single adjustment** causes an immediate **+20 Unrest spike**.

### 14.3 Housing Crisis & Overcrowding
1. If provinces are lost, living population can temporarily exceed $\text{MaxPopulation}$.
2. **Demographic Stagnation:** Population growth immediately drops to **0**.
3. **Plague & Squall:** Overcrowding generates **+0.10 Unrest/s per 50 excess inhabitants**.

### 14.4 Emergency Bankruptcy Bailout (The Lombard Offer)
1. At **20 seconds** of the 30-second bankruptcy countdown, the game enters the `LOMBARD_OFFER` phase where an urgent Crown emissary offers the **Lombard Bailout**.
2. **Countdown Pause:** The 30-second bankruptcy countdown is paused while the player considers the offer in the `LOMBARD_OFFER` phase.
3. **Terms:** The realm permanently cedes **1 Province** in exchange for an immediate infusion of **2,000 AP**.
4. **Usage:** Permitted **strictly once per run**.
5. **Rejection:** Refusing the offer returns the game to `ACTIVE_CYCLE` and resumes the bankruptcy countdown from the 20-second mark.

---

## 15. Meta-Progression: The National Archives

Archive Points earned during runs can be invested permanently into Crown Charters. Players may **freely reset and redistribute points** between runs.

| Perk | Cost | Permanent Effect |
| :--- | :---: | :--- |
| **Starting Treasury** | 1 pt | Start every run with +150 AP. |
| **Ancient Cadastre** | 2 pts | Base paperwork reduced by -5%. |
| **Charter of Liberties** | 2 pts | Starting Unrest reduced by -8 points. |
| **Standing Vanguard** | 3 pts | Start every run with 25 Foot Soldiers. |
| **Primogeniture Decrees** | 4 pts | +8% to all civil and administration caps. |
| **Spymaster Network** | 5 pts | Scout uncertainty margin narrowed by 12 points base. |
| **Royal Chronicle** | 6 pts | Displays quota thresholds for the next 2 upcoming deadlines. |
| **Sixth Law Slot** | 10 pts | Unlocks a permanent 6th active law slot. |

---

## 16. Engine Specifications: Persistence, Focus Pause & Seeded RNG

1. **Auto-Save Frequency:** The full serialized JSON `GameState` is flushed to `localStorage` under `grand_audit_save` upon the conclusion of each deadline and after each law/battle resolution.
2. **Window Focus Auto-Pause:** When the browser tab loses focus (`document.visibilitychange` or `window.onblur`), the delta-time game loop immediately halts.
3. **Deterministic PRNG:** Random events, card drafts, and battle variances utilize a seeded pseudorandom number generator (PRNG, Mulberry32 algorithm). The run seed is displayed in the settings panel to enable reproducible speedruns and tournament play.

---

## 17. Onboarding Protocol & First-Time User Experience (FTUE)

To prevent cognitive overload while preserving discovery, the Steward guides new players through four concise milestones during **Deadline 1**:

1. **Step 1 – Executive Mandate:** The Steward flashes: *"Sire, the Crown inspects in 100 seconds! Affix your seal to raise emergency gold."* (Prompts 15 manual clicks).
2. **Step 2 – Bureaucratic Automation:** At 15 AP: *"Splendid. Hire your first Scribe to automate record-keeping and passive revenues."* (Highlights Scribe card).
3. **Step 3 – The Fiscal Balance:** At 35 seconds: *"Adjust the tax slider. High taxes enrich the treasury but stir peasant unrest."* (Highlights Tax Slider).
4. **Step 4 – Crown Quota Review:** At 70 seconds: *"Review the three Crown banners above. We must satisfy at least two to survive."*
- **Opt-Out:** A clean *"Skip Tutorial"* button allows veteran players to disable all FTUE callouts permanently.

---

## 18. Save State Export / Import & Portability

To ensure run preservation across cache purges, devices, and browser sessions:

1. **Export Mechanism:**
   - Serializes current active `GameState` and accumulated `ArchiveData` into a compact JSON string.
   - Encodes the payload as a Base64 string prefixed with an integrity header: `GRA-v1:<base64-payload>`.
   - Copies directly to the user's clipboard in 1 click.
2. **Import Mechanism:**
   - Opens an import text modal.
   - Validates the `GRA-v1` signature and schema version.
   - Restores the game cleanly without requiring a page reload.

---

## 19. Royal Feats & Achievements System

Eight thematic achievements incentivize exploring diverse playstyles. Each unlocked achievement permanently awards **+0.5 Archive Points** toward meta-progression:

| Feat | Title | Condition | Reward |
| :---: | :--- | :--- | :---: |
| 1 | **Royal Pacifist** | Win a run without recruiting a single military unit. | +0.5 Archive Pt |
| 2 | **Scout Butcher** | Sacrifice $\ge 20$ scouts in reconnaissance rerolls across a single run. | +0.5 Archive Pt |
| 3 | **Fiscal Paradise** | Win a run maintaining tax rate $\le 15\%$ at all times. | +0.5 Archive Pt |
| 4 | **Iron Bailout** | Survive a run after triggering the Lombard Bailout at $\ge 20$ seconds of bankruptcy. | +0.5 Archive Pt |
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
   - Every threshold displays explicit iconographic indicators: `[✓ SATISFIED]` or `[✗ DEFICIT]` with high-contrast borders.

---

## 21. Automated Simulation Bots & Skill Gradient Verification

To guarantee that the game tests actual player skill rather than arbitrary bot performance:
1. **Three Distinct Bot Tiers (Skill Gradient):**
   - *Random Noise Bot:* Makes random purchases without ROI calculation. Expected Win Rate: **< 5%**.
   - *Greedy ROI Bot (Baseline Human):* Calculates immediate payback time (amortization seconds) and purchases highest efficiency. Expected Win Rate: **35% – 65%**.
   - *Archetype Expert Bot:* Plays optimized archetype strategies (civil colonisation bureaucrat or aggressive plunder conqueror). Expected Win Rate: **> 65%**.
2. **Dynamic Quota Generation:**
   - Quotas are derived objectively from the median of the Greedy ROI Bot over multiple fixed seeds:
     $$\text{Quota}_k = c \times \text{MedianBotScore}_k$$
   - The scaling coefficient $c$ is not arbitrarily fixed at 0.8; it is an unknown variable determined algorithmically by the calibration solver script (`scripts/generate-balance-report.ts`) via bisection until the Greedy ROI Bot stabilizes strictly within the target win rate band of **35% – 65%**. The bot's score evaluates balanced utility across AP, Population, and Military.
3. **Dominance & Sensitivity Testing:**
   - *Dominance:* Beyond Deadline 3 (after the opening phase where Scribes and Peasants naturally dominate), asserts that no unit role is purchased 0 times across 1,000 runs, and no single unit exceeds 60% of total expenditure within a given archetype build.
   - *Sensitivity:* Modulates parameters ($r_0$, cost ratios, tax rates) by $\pm 10\%$ to verify that win rates remain stable without sudden catastrophic collapse.



