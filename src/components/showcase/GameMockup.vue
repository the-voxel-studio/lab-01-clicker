<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import GameIcon from '@/components/common/GameIcon.vue'
import { GAME_ICONS, type GameIconKey } from '@/data/icons'

// Sub-tabs navigation
type GameSubTab = 'ledger' | 'orders' | 'laws'
const currentSubTab = ref<GameSubTab>('ledger')

// Orders filter
type OrderType = 'people' | 'admin' | 'military'
const activeOrder = ref<OrderType>('people')

// Interactive Mockup State
const currentAp = ref<number>(845)
const clickBonus = ref<number>(2.4)
const taxRate = ref<number>(25)
const discontent = ref<number>(28)
const clickEffect = ref<boolean>(false)

// Demographic Growth & Hopping State
const currentPop = ref<number>(580)
const popProgress = ref<number>(65)
const isPopHopping = ref<boolean>(false)
const popHopIconKey = ref<string | null>(null)
const recentArrival = ref<string | null>(null)

// Administrative Stamping Cadence State
const adminStampPulse = ref<boolean>(false)

// Particle burst effect interface
interface BurstParticle {
  id: number
  icon: GameIconKey
  dx: number
  dy: number
  rotate: number
  scale: number
}

const particles = ref<BurstParticle[]>([])
let nextParticleId = 0

const allIconKeys = Object.keys(GAME_ICONS) as GameIconKey[]

// Recruitment counts for all 12 roles across both tiers
const units = ref({
  // The People (4 roles)
  peasants: 34,
  farmers: 4,
  artisans: 12,
  guilds: 2,
  clergy: 8,
  prelates: 1,
  notables: 6,
  lords: 1,

  // Administration (4 roles)
  scribes: 22,
  clerks: 5,
  supervisors: 8,
  provincialStewards: 1,
  archivists: 6,
  auditChamber: 1,
  taxCollectors: 9,
  generalFarmers: 1,

  // The Military (4 roles)
  soldiers: 28,
  menAtArms: 4,
  officers: 5,
  captains: 1,
  militaryIntendants: 4,
  quartermasters: 1,
  scouts: 3,
  spies: 1,
})

// Dynamic Order Totals & Caps
const peopleTotal = computed(() =>
  units.value.peasants + units.value.farmers + units.value.artisans + units.value.guilds +
  units.value.clergy + units.value.prelates + units.value.notables + units.value.lords
)
const peopleCap = computed(() => Math.floor(120 * (1 + units.value.notables * 0.01 + units.value.lords * 0.05)))

const adminTotal = computed(() =>
  units.value.scribes + units.value.clerks + units.value.supervisors + units.value.provincialStewards +
  units.value.archivists + units.value.auditChamber + units.value.taxCollectors + units.value.generalFarmers
)
const adminCap = computed(() => Math.floor(80 * (1 + units.value.notables * 0.01 + units.value.lords * 0.05)))

const militaryTotal = computed(() =>
  units.value.soldiers + units.value.menAtArms + units.value.officers + units.value.captains +
  units.value.militaryIntendants + units.value.quartermasters + units.value.scouts + units.value.spies
)
const militaryCap = computed(() => Math.floor(70 * (1 + units.value.notables * 0.01 + units.value.lords * 0.05)))

// Economic calculations
const popGrowthRate = computed(() => {
  return Number((units.value.peasants * 0.02 + units.value.farmers * 0.12).toFixed(2))
})

const peasantsGrowth = computed(() => Number((units.value.peasants * 0.02).toFixed(2)))
const farmersGrowth = computed(() => Number((units.value.farmers * 0.12).toFixed(2)))

const topPopContributor = computed(() => {
  if (farmersGrowth.value >= peasantsGrowth.value) {
    return {
      name: 'Farmers (Tier II)',
      rate: farmersGrowth.value,
      percent: popGrowthRate.value > 0 ? Math.round((farmersGrowth.value / popGrowthRate.value) * 100) : 0,
      efficiency: '+0.12 pop/s each',
      comparison: '6× more efficient per slot than Peasants',
      icon: 'roleFarmer' as GameIconKey,
    }
  } else {
    return {
      name: 'Peasants (Tier I)',
      rate: peasantsGrowth.value,
      percent: popGrowthRate.value > 0 ? Math.round((peasantsGrowth.value / popGrowthRate.value) * 100) : 0,
      efficiency: '+0.02 pop/s each',
      comparison: 'Low 20 AP recruit cost, zero upkeep',
      icon: 'rolePeasant' as GameIconKey,
    }
  }
})

// Military Upkeep & Logistics Intel
const militaryDiscountFactor = computed(() => Math.max(0.4, 1 - (units.value.militaryIntendants * 0.015 + units.value.quartermasters * 0.08)))
const militaryDiscountPercent = computed(() => Math.round((1 - militaryDiscountFactor.value) * 100))

const menAtArmsUpkeep = computed(() => Number((units.value.menAtArms * 1.5 * militaryDiscountFactor.value).toFixed(1)))
const captainsUpkeep = computed(() => Number((units.value.captains * 2.0 * militaryDiscountFactor.value).toFixed(1)))
const spiesUpkeep = computed(() => Number((units.value.spies * 1.0 * militaryDiscountFactor.value).toFixed(1)))
const totalMilitaryUpkeep = computed(() => Number(((units.value.menAtArms * 1.5 + units.value.captains * 2.0 + units.value.spies * 1.0) * militaryDiscountFactor.value).toFixed(1)))

const civilUpkeepTotal = computed(() => {
  const civil = units.value.farmers * 0.1 + units.value.guilds * 0.3 + units.value.prelates * 0.2 + units.value.lords * 0.8 +
                units.value.clerks * 0.5 + units.value.provincialStewards * 1.0 + units.value.auditChamber * 0.6 + units.value.generalFarmers * 1.2
  return Number(civil.toFixed(1))
})

const totalMilitaryForce = computed(() => {
  const base = units.value.soldiers * 1 + units.value.menAtArms * 6
  const mult = 1 + (units.value.officers * 0.015 + units.value.captains * 0.08)
  return Math.round(base * mult)
})

interface MilitaryDrainItem {
  name: string
  unitCost: number
  count: number
  total: number
  icon: GameIconKey
  desc: string
}

const heaviestMilitaryDrain = computed<MilitaryDrainItem>(() => {
  const drains: MilitaryDrainItem[] = [
    { name: 'Men-at-Arms', unitCost: 1.5, count: units.value.menAtArms, total: menAtArmsUpkeep.value, icon: 'roleManAtArms', desc: 'Heavy infantry rations & pay' },
    { name: 'Captains', unitCost: 2.0, count: units.value.captains, total: captainsUpkeep.value, icon: 'roleCaptain', desc: 'Command salaries & retinue' },
    { name: 'Spies', unitCost: 1.0, count: units.value.spies, total: spiesUpkeep.value, icon: 'roleSpy', desc: 'Informant network logistics' },
  ]
  drains.sort((a, b) => b.total - a.total)
  return drains[0] ?? { name: 'None', unitCost: 0, count: 0, total: 0, icon: 'shield', desc: 'No military upkeep' }
})

const scribeOutput = computed(() => Number((units.value.scribes * 0.5 + units.value.clerks * 4.0).toFixed(1)))
const supervisorBonusPercent = computed(() => Math.round((units.value.supervisors * 0.02 + units.value.provincialStewards * 0.10) * 100))
const dragReductionPercent = computed(() => Number((units.value.archivists * 1.5 + units.value.auditChamber * 8.0).toFixed(1)))
const directTaxOutput = computed(() => Number(((units.value.taxCollectors * 0.8 + units.value.generalFarmers * 4.5) * (currentPop.value / 100)).toFixed(1)))

const scribesIncome = computed(() => Number((units.value.scribes * 0.5 * (1 + units.value.supervisors * 0.02 + units.value.provincialStewards * 0.10)).toFixed(1)))
const clerksIncome = computed(() => Number((units.value.clerks * 4.0 * (1 + units.value.supervisors * 0.02 + units.value.provincialStewards * 0.10)).toFixed(1)))
const taxIncome = computed(() => {
  const taxMultiplier = 1 + units.value.artisans * 0.005 + units.value.guilds * 0.025
  const directTax = (units.value.taxCollectors * 0.8 + units.value.generalFarmers * 4.5) * (currentPop.value / 100)
  const popTax = currentPop.value * (taxRate.value / 100) * 0.02 * taxMultiplier
  return Number((popTax + directTax).toFixed(1))
})

const topApContributor = computed(() => {
  const sources = [
    { name: 'Clerks (Tier II)', amount: clerksIncome.value, icon: 'roleClerk' as GameIconKey, rate: '+4.0 AP/s base', note: '8× more productive than Scribes' },
    { name: 'Crown Taxes', amount: taxIncome.value, icon: 'taxRate' as GameIconKey, rate: `${taxRate.value}% tax rate`, note: 'Scales with population' },
    { name: 'Scribes (Tier I)', amount: scribesIncome.value, icon: 'roleScribe' as GameIconKey, rate: '+0.5 AP/s base', note: 'Base chancery foundation' },
  ]
  sources.sort((a, b) => b.amount - a.amount)
  return sources[0] ?? { name: 'None', amount: 0, icon: 'coins' as GameIconKey, rate: '0 AP/s', note: '' }
})

// Passive Synergies & Realm Modifiers
const totalTaxMultiplierPercent = computed(() => {
  return Number((units.value.artisans * 0.5 + units.value.guilds * 2.5).toFixed(1))
})
const taxBonusRevenue = computed(() => {
  const basePopTax = currentPop.value * (taxRate.value / 100) * 0.02
  const bonus = basePopTax * (totalTaxMultiplierPercent.value / 100)
  return Number(bonus.toFixed(1))
})

const totalCapExpansionPercent = computed(() => {
  return Math.round(units.value.notables * 1 + units.value.lords * 5)
})
const bonusPeopleCap = computed(() => peopleCap.value - 120)
const bonusAdminCap = computed(() => adminCap.value - 80)
const bonusMilitaryCap = computed(() => militaryCap.value - 70)

const totalDiscontentSuppression = computed(() => {
  return Number((units.value.clergy * 0.02 + units.value.prelates * 0.10).toFixed(2))
})

const baseCombatForce = computed(() => units.value.soldiers * 1 + units.value.menAtArms * 6)
const officerBonusPercent = computed(() => Number((units.value.officers * 1.5 + units.value.captains * 8.0).toFixed(1)))

const dragSavedAps = computed(() => {
  const gross = grossIncome.value
  const baseDragLoss = gross * (18.2 / 100)
  const currentDragLoss = gross * (bureaucracyPercent.value / 100)
  return Number(Math.max(0, baseDragLoss - currentDragLoss).toFixed(1))
})

const logisticsSavingsAps = computed(() => {
  const undiscountedMilitary = (units.value.menAtArms * 1.5 + units.value.captains * 2.0 + units.value.spies * 1.0)
  return Number(Math.max(0, undiscountedMilitary - totalMilitaryUpkeep.value).toFixed(1))
})
const totalScoutReduction = computed(() => units.value.scouts * 3)

const grossIncome = computed(() => {
  const baseScribes = units.value.scribes * 0.5 + units.value.clerks * 4.0
  const supervisorBonus = 1 + units.value.supervisors * 0.02 + units.value.provincialStewards * 0.10
  const taxMultiplier = 1 + units.value.artisans * 0.005 + units.value.guilds * 0.025
  const directTax = (units.value.taxCollectors * 0.8 + units.value.generalFarmers * 4.5) * (currentPop.value / 100)
  const taxes = currentPop.value * (taxRate.value / 100) * 0.02 * taxMultiplier + directTax
  return Number(((baseScribes * supervisorBonus) + taxes).toFixed(1))
})

const bureaucracyPercent = computed(() => {
  const reduction = units.value.archivists * 1.5 + units.value.auditChamber * 8.0
  const drag = Math.max(5, 18.2 - reduction)
  return Number(drag.toFixed(1))
})

const upkeep = computed(() => {
  return Number((civilUpkeepTotal.value + totalMilitaryUpkeep.value + 8.5).toFixed(1))
})

const netIncome = computed(() => {
  const net = grossIncome.value * (1 - bureaucracyPercent.value / 100) - upkeep.value
  return Number(net.toFixed(1))
})

/**
 * Triggers a cheerful hopping bounce animation when a new citizen arrives.
 */
function triggerPopArrival(message = '+1 Citizen arrived!'): void {
  isPopHopping.value = true
  recentArrival.value = message
  setTimeout(() => {
    isPopHopping.value = false
  }, 600)
  setTimeout(() => {
    if (recentArrival.value === message) {
      recentArrival.value = null
    }
  }, 1800)
}

/**
 * Interactive Action: Ring the village bell to welcome a new settler.
 */
function ringVillageBell(): void {
  if (currentAp.value >= 10) {
    currentAp.value = Number((currentAp.value - 10).toFixed(1))
    currentPop.value++
    popHopIconKey.value = 'peasants'
    triggerPopArrival('Village Bell: +1 Settler joined!')
    setTimeout(() => {
      popHopIconKey.value = null
    }, 600)
  }
}

/**
 * Handles clicks on the main Seal button.
 * Spawns letter/missive particles from behind the seal button that burst outwards
 * randomly to the left, right, top, bottom, or 360 degrees.
 * Also triggers a synchronized mini-admin stamp pulse.
 */
function handleProduceClick(): void {
  currentAp.value = Number((currentAp.value + clickBonus.value).toFixed(1))
  clickEffect.value = true
  adminStampPulse.value = true
  setTimeout(() => {
    clickEffect.value = false
    adminStampPulse.value = false
  }, 160)

  // Spawn 1 to 2 missive particles from behind the seal
  const count = 1 + (Math.random() > 0.5 ? 1 : 0)
  for (let i = 0; i < count; i++) {
    // Pick random icon from the 81 available icons
    const randomIcon = allIconKeys[Math.floor(Math.random() * allIconKeys.length)] ?? 'waxSeal'

    // Generate random trajectory in any direction (360 degrees: up, down, left, right)
    const angle = Math.random() * Math.PI * 2
    const distance = 85 + Math.random() * 105 // 85px to 190px
    const dx = Math.round(Math.cos(angle) * distance)
    const dy = Math.round(Math.sin(angle) * distance)
    const rotate = Math.round((Math.random() - 0.5) * 65)
    const scale = Number((0.9 + Math.random() * 0.4).toFixed(2))

    const particle: BurstParticle = {
      id: nextParticleId++,
      icon: randomIcon,
      dx,
      dy,
      rotate,
      scale,
    }

    particles.value.push(particle)

    // Auto clean-up particle after animation duration
    setTimeout(() => {
      particles.value = particles.value.filter((p) => p.id !== particle.id)
    }, 750)
  }
}

function recruitUnit(type: keyof typeof units.value, cost: number): void {
  if (currentAp.value >= cost) {
    currentAp.value = Number((currentAp.value - cost).toFixed(1))
    units.value[type]++

    // If recruiting from The People, trigger joyful hopping animation
    const peopleUnits: (keyof typeof units.value)[] = ['peasants', 'farmers', 'artisans', 'guilds', 'clergy', 'prelates', 'notables', 'lords']
    if (peopleUnits.includes(type)) {
      currentPop.value++
      popHopIconKey.value = type
      triggerPopArrival(`+1 ${type.charAt(0).toUpperCase() + type.slice(1)} arrived!`)
      setTimeout(() => {
        if (popHopIconKey.value === type) popHopIconKey.value = null
      }, 600)
    }

    // If recruiting from Administration, trigger admin stamp pulse
    const adminUnits: (keyof typeof units.value)[] = ['scribes', 'clerks', 'supervisors', 'provincialStewards', 'archivists', 'auditChamber', 'taxCollectors', 'generalFarmers']
    if (adminUnits.includes(type)) {
      adminStampPulse.value = true
      setTimeout(() => {
        adminStampPulse.value = false
      }, 250)
    }
  }
}

// Background simulation ticker for passive income and demographic growth
let tickerInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  tickerInterval = setInterval(() => {
    // Passive AP accumulation
    if (netIncome.value > 0) {
      currentAp.value = Number((currentAp.value + netIncome.value * 0.5).toFixed(1))
    }

    // Population progress
    popProgress.value += Math.max(10, Math.round(popGrowthRate.value * 12))
    if (popProgress.value >= 100) {
      popProgress.value = 0
      currentPop.value++
      triggerPopArrival()
    }

    // Passive administrative cadence pulse
    adminStampPulse.value = true
    setTimeout(() => {
      adminStampPulse.value = false
    }, 200)
  }, 1200)
})

onUnmounted(() => {
  if (tickerInterval) clearInterval(tickerInterval)
})

// Modal state
const activeModal = ref<'none' | 'law' | 'event' | 'battle'>('none')
</script>

<template>
  <div class="flex flex-col w-full bg-fief-dark text-fief-text select-none">
    <!-- STICKY TOP HUD: Deadline, Timer & Quotas -->
    <header class="bg-fief-card border-b border-fief-border p-3 space-y-2 sticky top-0 z-20 shadow-md">
      <!-- Deadline & Timer Row -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-full bg-wax-red text-royal-gold flex items-center justify-center border border-royal-gold/40 shadow-xs">
            <GameIcon name="crown" class="w-5 h-5" />
          </div>
          <div>
            <div class="flex items-center gap-1.5">
              <span class="text-[10px] font-mono uppercase bg-wax-red px-1.5 py-0.2 rounded text-white font-bold">
                Deadline 3/10
              </span>
              <span class="text-[11px] text-royal-gold font-medieval">Royal Inspection</span>
            </div>
          </div>
        </div>

        <!-- Timer badge -->
        <div class="flex items-center gap-1.5 bg-fief-dark border border-fief-border rounded px-2.5 py-1">
          <GameIcon name="timer" class="w-3.5 h-3.5 text-wax-red animate-pulse" />
          <span class="font-mono text-sm font-bold text-royal-gold leading-none">01:18</span>
        </div>
      </div>

      <!-- The 3 Quotas in Mobile Grid (2 out of 3 Rule) -->
      <div class="grid grid-cols-3 gap-1.5 text-[10px] font-mono">
        <!-- AP Requirement -->
        <div class="bg-fief-dark border border-fief-border rounded p-1.5 flex flex-col justify-between">
          <div class="flex items-center justify-between text-fief-text-muted">
            <span class="flex items-center gap-1"><GameIcon name="adminPower" class="w-3 h-3 text-wax-red" /> AP</span>
            <span>69%</span>
          </div>
          <div class="w-full bg-fief-card h-1.5 rounded-full overflow-hidden my-1">
            <div class="bg-wax-red h-full rounded-full" style="width: 69%"></div>
          </div>
          <div class="text-[9px] text-fief-text-dim text-right">1.9k / 2.8k</div>
        </div>

        <!-- Population Requirement (MET) -->
        <div class="bg-peasant-green/10 border border-peasant-green/40 rounded p-1.5 flex flex-col justify-between">
          <div class="flex items-center justify-between text-peasant-green font-bold">
            <span class="flex items-center gap-1">
              <GameIcon
                name="population"
                :class="['w-3 h-3 transition-transform', isPopHopping ? 'pop-hop-active text-white' : '']"
              />
              People
            </span>
            <span v-if="recentArrival" class="text-[8px] font-mono text-royal-gold animate-pulse truncate max-w-[65px]">{{ recentArrival }}</span>
            <span v-else>✓ Met</span>
          </div>
          <div class="w-full bg-fief-card h-1.5 rounded-full overflow-hidden my-1">
            <div
              class="bg-peasant-green h-full rounded-full transition-all duration-300"
              :style="{ width: Math.min(100, Math.round((currentPop / 550) * 100)) + '%' }"
            ></div>
          </div>
          <div class="text-[9px] text-peasant-green/80 text-right font-mono">{{ currentPop }} / 550</div>
        </div>

        <!-- Military Requirement -->
        <div class="bg-fief-dark border border-fief-border rounded p-1.5 flex flex-col justify-between">
          <div class="flex items-center justify-between text-fief-text-muted">
            <span class="flex items-center gap-1"><GameIcon name="militaryPower" class="w-3 h-3 text-iron-grey" /> Army</span>
            <span>77%</span>
          </div>
          <div class="w-full bg-fief-card h-1.5 rounded-full overflow-hidden my-1">
            <div class="bg-royal-gold h-full rounded-full" style="width: 77%"></div>
          </div>
          <div class="text-[9px] text-fief-text-dim text-right">54 / 70</div>
        </div>
      </div>

      <!-- Discontent Bar -->
      <div class="flex items-center justify-between gap-2 pt-0.5">
        <span class="flex items-center gap-1 text-[10px] text-fief-text-muted font-serif-book">
          <GameIcon name="discontent" class="w-3 h-3 text-wax-red" /> Discontent :
        </span>
        <div class="flex-1 bg-fief-dark h-2 rounded-full overflow-hidden border border-fief-border">
          <div class="bg-gradient-to-r from-royal-gold to-wax-red h-full rounded-full" :style="{ width: discontent + '%' }"></div>
        </div>
        <span class="text-[10px] font-mono text-wax-red font-bold">{{ discontent }}%</span>
      </div>
    </header>

    <!-- MOBILE-FIRST SUB-NAVIGATION -->
    <div class="flex border-b border-fief-border bg-fief-dark px-2 pt-2 gap-1 text-xs font-serif-book">
      <button
        type="button"
        @click="currentSubTab = 'ledger'"
        :class="[
          'flex-1 py-1.5 px-2 rounded-t flex items-center justify-center gap-1 transition-colors cursor-pointer border-t border-x',
          currentSubTab === 'ledger'
            ? 'bg-fief-card border-fief-border text-royal-gold font-bold'
            : 'border-transparent text-fief-text-muted hover:text-fief-text hover:bg-fief-card/40'
        ]"
      >
        <GameIcon name="coins" class="w-3.5 h-3.5" />
        <span>The Ledger</span>
      </button>

      <button
        type="button"
        @click="currentSubTab = 'orders'"
        :class="[
          'flex-1 py-1.5 px-2 rounded-t flex items-center justify-center gap-1 transition-colors cursor-pointer border-t border-x',
          currentSubTab === 'orders'
            ? 'bg-fief-card border-fief-border text-royal-gold font-bold'
            : 'border-transparent text-fief-text-muted hover:text-fief-text hover:bg-fief-card/40'
        ]"
      >
        <GameIcon name="rolePeasant" class="w-3.5 h-3.5" />
        <span>The 3 Orders</span>
      </button>

      <button
        type="button"
        @click="currentSubTab = 'laws'"
        :class="[
          'flex-1 py-1.5 px-2 rounded-t flex items-center justify-center gap-1 transition-colors cursor-pointer border-t border-x',
          currentSubTab === 'laws'
            ? 'bg-fief-card border-fief-border text-royal-gold font-bold'
            : 'border-transparent text-fief-text-muted hover:text-fief-text hover:bg-fief-card/40'
        ]"
      >
        <GameIcon name="lawDecree" class="w-3.5 h-3.5" />
        <span>Crown Laws</span>
      </button>
    </div>

    <!-- MAIN VIEWPORT CONTENT -->
    <div class="flex-1 p-3 space-y-3">
      <!-- 1. TAB: THE LEDGER (Central Production & Big Clicker) -->
      <div v-if="currentSubTab === 'ledger'" class="space-y-3 animate-fade-in">
        <!-- Tactile Seal Clicker Container with Particle Emitters -->
        <div class="bg-fief-card border border-fief-border rounded-lg p-4 flex flex-col items-center text-center shadow-sm relative overflow-hidden">
          <div class="text-[10px] font-mono uppercase tracking-widest text-fief-text-muted">Domain Treasury</div>
          <div class="text-3xl font-medieval text-royal-gold mt-0.5 flex items-center justify-center gap-2">
            <GameIcon name="coins" class="w-7 h-7 text-royal-gold" />
            <span>{{ currentAp }} AP</span>
          </div>

          <!-- Click Button Area with Mini-Admins Tapping & Flying Missive Particles -->
          <div class="relative mt-3 mb-2 w-full flex flex-col items-center justify-center">
            <!-- Chancery Workshop Stage with Mini Administrators Orbiting in the Background -->
            <div class="relative w-full max-w-[320px] h-52 flex items-center justify-center overflow-visible">
              <!-- Orbiting Parchment Compass Ring -->
              <div class="w-48 h-48 rounded-full border border-dashed border-royal-gold/20 absolute pointer-events-none animate-spin-slow"></div>

              <!-- Bureaucratic Ink Pulse Shockwave on Stamping -->
              <div
                class="w-40 h-40 rounded-full border border-wax-red/30 absolute pointer-events-none transition-all duration-200"
                :class="adminStampPulse ? 'scale-115 opacity-80 border-royal-gold' : 'scale-100 opacity-20'"
              ></div>

              <!-- Mini-Admin 1: Royal Scribe (North-West) -->
              <div
                class="absolute top-1 left-1 sm:left-4 z-0 bg-[#181009]/95 border border-royal-gold/30 rounded-md px-2 py-1 shadow-md flex items-center gap-1.5 transition-transform duration-150"
                :class="adminStampPulse ? 'scale-105 border-royal-gold' : ''"
              >
                <GameIcon
                  name="quill"
                  :class="['w-4 h-4 text-royal-gold', adminStampPulse ? 'scale-125 text-white' : 'animate-admin-scribble']"
                />
                <div class="text-left font-mono leading-none">
                  <div class="text-[8px] text-royal-gold font-bold">Scribe</div>
                  <div class="text-[7px] text-fief-text-dim">Inking...</div>
                </div>
              </div>

              <!-- Mini-Admin 2: Chancery Clerk (North-East) -->
              <div
                class="absolute top-1 right-1 sm:right-4 z-0 bg-[#181009]/95 border border-royal-gold/30 rounded-md px-2 py-1 shadow-md flex items-center gap-1.5 transition-transform duration-150"
                :class="adminStampPulse ? 'scale-105 border-wax-red' : ''"
              >
                <GameIcon
                  name="waxSeal"
                  :class="['w-4 h-4 text-wax-red', adminStampPulse ? 'scale-75 translate-y-1 text-royal-gold' : 'animate-admin-stamp']"
                />
                <div class="text-left font-mono leading-none">
                  <div class="text-[8px] text-wax-red font-bold">Clerk</div>
                  <div class="text-[7px] text-fief-text-dim">Stamping</div>
                </div>
              </div>

              <!-- Mini-Admin 3: Chief Supervisor (South-West) -->
              <div
                class="absolute bottom-1 left-1 sm:left-4 z-0 bg-[#181009]/95 border border-royal-gold/30 rounded-md px-2 py-1 shadow-md flex items-center gap-1.5 transition-transform duration-150"
                :class="adminStampPulse ? 'scale-105 border-royal-gold' : ''"
              >
                <GameIcon
                  name="roleSupervisor"
                  :class="['w-4 h-4 text-royal-gold-light', adminStampPulse ? 'scale-115 text-royal-gold' : '']"
                />
                <div class="text-left font-mono leading-none">
                  <div class="text-[8px] text-royal-gold-light font-bold">Supervisor</div>
                  <div class="text-[7px] text-peasant-green">+{{ supervisorBonusPercent }}% AP</div>
                </div>
              </div>

              <!-- Mini-Admin 4: Tax Collector (South-East) -->
              <div
                class="absolute bottom-1 right-1 sm:right-4 z-0 bg-[#181009]/95 border border-royal-gold/30 rounded-md px-2 py-1 shadow-md flex items-center gap-1.5 transition-transform duration-150"
                :class="adminStampPulse ? 'scale-105 border-royal-gold' : ''"
              >
                <GameIcon
                  name="coins"
                  :class="['w-4 h-4 text-royal-gold', adminStampPulse ? 'scale-125' : '']"
                />
                <div class="text-left font-mono leading-none">
                  <div class="text-[8px] text-royal-gold font-bold">Treasurer</div>
                  <div class="text-[7px] text-fief-text-dim">+{{ directTaxOutput }} AP</div>
                </div>
              </div>

              <!-- Missive Particles Container Behind the Seal Button (z-5) -->
              <div class="absolute inset-0 pointer-events-none flex items-center justify-center z-5 overflow-visible">
                <div
                  v-for="p in particles"
                  :key="p.id"
                  class="absolute flex items-center justify-center particle-fly-out"
                  :style="{
                    '--dx': `${p.dx}px`,
                    '--dy': `${p.dy}px`,
                    '--rot': `${p.rotate}deg`,
                    '--scale': p.scale,
                  }"
                >
                  <!-- Sealed Missive / Letter Plaque -->
                  <div class="p-2 rounded-lg bg-[#24170d] border border-royal-gold/80 shadow-2xl flex items-center justify-center">
                    <GameIcon :name="p.icon" class="w-6 h-6 text-royal-gold drop-shadow-md" />
                  </div>
                </div>
              </div>

              <!-- Big Tactile Seal Button (z-10 on top) -->
              <button
                type="button"
                @click="handleProduceClick"
                :class="[
                  'w-36 h-36 rounded-full bg-wax-red active:bg-wax-red-dark text-parchment-50 border-4 border-royal-gold/80 flex flex-col items-center justify-center shadow-2xl transition-transform cursor-pointer select-none relative z-10',
                  clickEffect ? 'scale-90 ring-4 ring-royal-gold/60' : 'hover:scale-105 active:scale-95'
                ]"
              >
                <GameIcon name="waxSeal" class="w-12 h-12 text-royal-gold-light mb-0.5 drop-shadow-md" />
                <span class="font-medieval text-xs font-bold tracking-wider">SEAL DECREE</span>
                <span class="font-mono text-[10px] text-royal-gold-light mt-0.5">+{{ clickBonus }} AP</span>
              </button>
            </div>

            <!-- Global AP Yield Badge & Chancery Cadence Indicator -->
            <div class="mt-2 flex items-center justify-center gap-2 bg-[#1b1008] border border-royal-gold/40 rounded-full px-3 py-1 shadow-inner">
              <div
                class="w-2 h-2 rounded-full transition-transform"
                :class="adminStampPulse ? 'bg-royal-gold scale-150' : 'bg-peasant-green animate-pulse'"
              ></div>
              <span class="text-[10px] font-mono uppercase tracking-wider text-fief-text-muted">Chancery Cadence:</span>
              <span class="font-mono text-xs font-bold text-peasant-green">+{{ netIncome }} AP/s</span>
              <span class="text-[9px] font-mono text-fief-text-dim">({{ grossIncome }} Gross)</span>
            </div>

            <!-- Realm Passive Synergies Quick Bar (Artisans, Notables, Warriors, Clergy) -->
            <div class="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-[9px] font-mono text-fief-text-muted">
              <span class="flex items-center gap-1 bg-[#19110a] px-2 py-0.5 rounded border border-royal-gold/30 text-royal-gold" title="Artisans & Guilds passive tax boost">
                <GameIcon name="roleArtisan" class="w-3 h-3 text-royal-gold" />
                <span>+{{ totalTaxMultiplierPercent }}% Tax (Artisans)</span>
              </span>
              <span class="flex items-center gap-1 bg-[#19110a] px-2 py-0.5 rounded border border-royal-gold/30 text-royal-gold-light" title="Notables & Lords order capacity expansion">
                <GameIcon name="roleNotable" class="w-3 h-3 text-royal-gold-light" />
                <span>+{{ totalCapExpansionPercent }}% Caps (Notables)</span>
              </span>
              <span class="flex items-center gap-1 bg-[#19110a] px-2 py-0.5 rounded border border-royal-gold/30 text-iron-grey" title="Warriors & Officers combat power">
                <GameIcon name="roleSoldier" class="w-3 h-3 text-iron-grey" />
                <span>{{ totalMilitaryForce }} Force (Warriors)</span>
              </span>
              <span class="flex items-center gap-1 bg-[#19110a] px-2 py-0.5 rounded border border-royal-gold/30 text-clergy-purple" title="Clergy & Prelates discontent reduction">
                <GameIcon name="roleClergy" class="w-3 h-3 text-clergy-purple" />
                <span>−{{ totalDiscontentSuppression }}/s Calm (Clergy)</span>
              </span>
            </div>
          </div>

          <!-- Economic Breakdown -->
          <div class="w-full mt-3 bg-fief-dark border border-fief-border rounded-lg p-2.5 text-xs font-serif-book space-y-1.5 text-left">
            <div class="flex justify-between items-center">
              <div>
                <span class="text-fief-text font-bold">Gross Production</span>
                <span class="text-[10px] text-fief-text-muted block font-mono">
                  Scribes & Clerks (+{{ (scribesIncome + clerksIncome).toFixed(1) }} AP/s) • Taxes (+{{ taxIncome }} AP/s)
                </span>
              </div>
              <span class="font-mono font-bold text-peasant-green text-sm">+{{ grossIncome }} AP/s</span>
            </div>

            <div class="flex justify-between items-center pt-1 border-t border-fief-border/50">
              <div>
                <span class="text-fief-text-muted flex items-center gap-1">
                  <GameIcon name="paperwork" class="w-3.5 h-3.5 text-wax-red" /> Bureaucratic Drag
                </span>
                <span class="text-[10px] text-fief-text-dim block font-mono">
                  Base 18.2% − {{ dragReductionPercent }}% reduced by Archivists
                </span>
              </div>
              <span class="font-mono font-bold text-wax-red">−{{ bureaucracyPercent }}%</span>
            </div>

            <div class="flex justify-between items-center pt-1 border-t border-fief-border/50">
              <div>
                <span class="text-fief-text-muted flex items-center gap-1">
                  <GameIcon name="militaryPower" class="w-3.5 h-3.5 text-iron-grey" /> Domain Upkeep
                </span>
                <span class="text-[10px] text-fief-text-dim block font-mono">
                  Army (−{{ totalMilitaryUpkeep }} AP/s) • Civil (−{{ civilUpkeepTotal }} AP/s) • Crown Overhead (−8.5)
                </span>
              </div>
              <span class="font-mono font-bold text-wax-red">−{{ upkeep }} AP/s</span>
            </div>

            <div class="flex justify-between items-center pt-1.5 border-t border-fief-border font-bold">
              <span class="text-fief-text">Net Domain Yield</span>
              <span class="font-mono text-royal-gold text-base">+{{ netIncome }} AP/s</span>
            </div>
          </div>

          <!-- Tax Slider -->
          <div class="w-full mt-3 text-left">
            <div class="flex justify-between items-center text-xs mb-1">
              <span class="font-medieval text-fief-text">Crown Tax Rate</span>
              <span class="font-mono text-royal-gold font-bold">{{ taxRate }}%</span>
            </div>
            <input
              v-model.number="taxRate"
              type="range"
              min="0"
              max="60"
              class="w-full accent-wax-red cursor-pointer"
            />
            <div class="flex justify-between text-[9px] text-fief-text-dim mt-0.5 font-mono">
              <span>0% (Contented)</span>
              <span>30% (Balanced)</span>
              <span>60% (Revolt imminent)</span>
            </div>
          </div>

          <!-- Crown Strategic Intelligence & Domain Audit Card -->
          <div class="w-full mt-3 bg-fief-dark border border-royal-gold/40 rounded-lg p-3 text-left space-y-2 shadow-sm">
            <div class="flex items-center justify-between border-b border-fief-border pb-1.5">
              <div class="flex items-center gap-1.5">
                <GameIcon name="archives" class="w-4 h-4 text-royal-gold" />
                <span class="font-medieval text-xs text-royal-gold font-bold">Crown Strategic Intelligence</span>
              </div>
              <span class="text-[8px] font-mono uppercase bg-royal-gold/15 text-royal-gold px-1.5 py-0.5 rounded border border-royal-gold/30">
                Decision Support
              </span>
            </div>

            <!-- 3 Decision-Critical Strategic Indicators -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <!-- 1. Top Settler Influx Source (The People) -->
              <div class="bg-fief-card border border-peasant-green/30 rounded p-2 flex flex-col justify-between">
                <div class="flex items-center justify-between text-[10px]">
                  <span class="text-peasant-green font-bold flex items-center gap-1">
                    <GameIcon :name="topPopContributor.icon" class="w-3.5 h-3.5 text-peasant-green" /> Top Growth
                  </span>
                  <span class="font-mono text-peasant-green font-bold">{{ topPopContributor.percent }}% share</span>
                </div>
                <div class="my-1">
                  <div class="font-medieval text-xs text-fief-text font-bold">{{ topPopContributor.name }}</div>
                  <div class="text-[9px] font-mono text-fief-text-muted">+{{ topPopContributor.rate }} pop/s ({{ topPopContributor.efficiency }})</div>
                </div>
                <div class="text-[8px] text-fief-text-dim border-t border-fief-border/50 pt-1">
                  {{ topPopContributor.comparison }}
                </div>
              </div>

              <!-- 2. Heaviest Military Upkeep Drain (The Military) -->
              <div class="bg-fief-card border border-wax-red/30 rounded p-2 flex flex-col justify-between">
                <div class="flex items-center justify-between text-[10px]">
                  <span class="text-wax-red font-bold flex items-center gap-1">
                    <GameIcon :name="heaviestMilitaryDrain.icon" class="w-3.5 h-3.5 text-wax-red" /> Heaviest Drain
                  </span>
                  <span class="font-mono text-wax-red font-bold">−{{ heaviestMilitaryDrain.total }} AP/s</span>
                </div>
                <div class="my-1">
                  <div class="font-medieval text-xs text-fief-text font-bold">{{ heaviestMilitaryDrain.name }} (×{{ heaviestMilitaryDrain.count }})</div>
                  <div class="text-[9px] font-mono text-fief-text-muted">Base {{ heaviestMilitaryDrain.unitCost }} AP/s each • {{ heaviestMilitaryDrain.desc }}</div>
                </div>
                <div class="text-[8px] text-peasant-green border-t border-fief-border/50 pt-1 flex justify-between">
                  <span>Supply lines:</span>
                  <span class="font-mono font-bold">−{{ militaryDiscountPercent }}% saved</span>
                </div>
              </div>

              <!-- 3. Top AP Earner (Administration) -->
              <div class="bg-fief-card border border-royal-gold/30 rounded p-2 flex flex-col justify-between">
                <div class="flex items-center justify-between text-[10px]">
                  <span class="text-royal-gold font-bold flex items-center gap-1">
                    <GameIcon :name="topApContributor.icon" class="w-3.5 h-3.5 text-royal-gold" /> Top AP Earner
                  </span>
                  <span class="font-mono text-peasant-green font-bold">+{{ topApContributor.amount }} AP/s</span>
                </div>
                <div class="my-1">
                  <div class="font-medieval text-xs text-fief-text font-bold">{{ topApContributor.name }}</div>
                  <div class="text-[9px] font-mono text-fief-text-muted">{{ topApContributor.rate }} • Supervisors +{{ supervisorBonusPercent }}%</div>
                </div>
                <div class="text-[8px] text-fief-text-dim border-t border-fief-border/50 pt-1">
                  {{ topApContributor.note }}
                </div>
              </div>
            </div>

            <!-- All 6 Passive Domain Synergies & Modifiers (Artisans, Notables, Warriors, Clergy, Archivists, Logistics) -->
            <div class="pt-2 border-t border-fief-border/60 space-y-1.5">
              <div class="flex items-center justify-between">
                <span class="font-medieval text-xs text-royal-gold font-bold flex items-center gap-1.5">
                  <GameIcon name="roleArtisan" class="w-3.5 h-3.5 text-royal-gold" />
                  Passive Domain Synergies & Modifiers
                </span>
                <span class="text-[8px] font-mono uppercase bg-fief-card text-royal-gold px-1.5 py-0.5 rounded border border-fief-border">
                  6 Passive Buffs Active
                </span>
              </div>

              <!-- 6 Passive Pillar Tiles in Mobile Grid -->
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[9px] font-mono">
                <!-- 1. Artisans & Guilds (Passive Tax Multiplier) -->
                <div class="bg-fief-card border border-fief-border rounded p-1.5 flex flex-col justify-between">
                  <div class="flex items-center justify-between">
                    <span class="text-royal-gold font-bold flex items-center gap-1">
                      <GameIcon name="roleArtisan" class="w-3 h-3 text-royal-gold" /> Artisans
                    </span>
                    <span class="text-peasant-green font-bold">+{{ totalTaxMultiplierPercent }}% Tax</span>
                  </div>
                  <div class="text-[8px] text-fief-text-dim mt-1">
                    Adds +{{ taxBonusRevenue }} AP/s in passive trade & workshop duties
                  </div>
                </div>

                <!-- 2. Notables & High Lords (Passive Order Cap Expander) -->
                <div class="bg-fief-card border border-fief-border rounded p-1.5 flex flex-col justify-between">
                  <div class="flex items-center justify-between">
                    <span class="text-royal-gold-light font-bold flex items-center gap-1">
                      <GameIcon name="roleNotable" class="w-3 h-3 text-royal-gold-light" /> Notables
                    </span>
                    <span class="text-royal-gold font-bold">+{{ totalCapExpansionPercent }}% Caps</span>
                  </div>
                  <div class="text-[8px] text-fief-text-dim mt-1">
                    +{{ bonusPeopleCap }} People, +{{ bonusAdminCap }} Admin, +{{ bonusMilitaryCap }} Army cap
                  </div>
                </div>

                <!-- 3. Warriors & Officers (Passive Combat Power & Defense) -->
                <div class="bg-fief-card border border-fief-border rounded p-1.5 flex flex-col justify-between">
                  <div class="flex items-center justify-between">
                    <span class="text-iron-grey font-bold flex items-center gap-1">
                      <GameIcon name="roleSoldier" class="w-3 h-3 text-iron-grey" /> Warriors
                    </span>
                    <span class="text-iron-grey font-bold">{{ totalMilitaryForce }} Power</span>
                  </div>
                  <div class="text-[8px] text-fief-text-dim mt-1">
                    Base {{ baseCombatForce }} force + {{ officerBonusPercent }}% Officer leadership
                  </div>
                </div>

                <!-- 4. Clergy & Prelates (Passive Discontent Calm) -->
                <div class="bg-fief-card border border-fief-border rounded p-1.5 flex flex-col justify-between">
                  <div class="flex items-center justify-between">
                    <span class="text-clergy-purple font-bold flex items-center gap-1">
                      <GameIcon name="roleClergy" class="w-3 h-3 text-clergy-purple" /> Clergy
                    </span>
                    <span class="text-clergy-purple font-bold">−{{ totalDiscontentSuppression }}/s</span>
                  </div>
                  <div class="text-[8px] text-fief-text-dim mt-1">
                    Calms unrest & lowers revolt pressure in parishes
                  </div>
                </div>

                <!-- 5. Archivists & Audit Chamber (Passive Bureaucracy Drag Cut) -->
                <div class="bg-fief-card border border-fief-border rounded p-1.5 flex flex-col justify-between">
                  <div class="flex items-center justify-between">
                    <span class="text-fief-text font-bold flex items-center gap-1">
                      <GameIcon name="roleArchivist" class="w-3 h-3 text-fief-text-muted" /> Archivists
                    </span>
                    <span class="text-peasant-green font-bold">−{{ dragReductionPercent }}% Drag</span>
                  </div>
                  <div class="text-[8px] text-fief-text-dim mt-1">
                    Protects +{{ dragSavedAps }} AP/s from paperwork loss
                  </div>
                </div>

                <!-- 6. Supply Intendants & Scouts (Passive Logistics & Recon) -->
                <div class="bg-fief-card border border-fief-border rounded p-1.5 flex flex-col justify-between">
                  <div class="flex items-center justify-between">
                    <span class="text-royal-gold font-bold flex items-center gap-1">
                      <GameIcon name="roleMilitaryIntendant" class="w-3 h-3 text-royal-gold" /> Logistics
                    </span>
                    <span class="text-peasant-green font-bold">−{{ militaryDiscountPercent }}% Cut</span>
                  </div>
                  <div class="text-[8px] text-fief-text-dim mt-1">
                    Saves −{{ logisticsSavingsAps }} AP/s upkeep • −{{ totalScoutReduction }} threat distance
                  </div>
                </div>
              </div>
            </div>

            <!-- Dynamic Royal Auditor's Counsel -->
            <div class="p-2 bg-royal-gold/10 border-l-2 border-royal-gold rounded text-[10px] flex items-start gap-2">
              <GameIcon name="scrollUnfurled" class="w-4 h-4 text-royal-gold shrink-0 mt-0.5" />
              <div class="text-fief-text font-serif-book leading-tight">
                <strong class="text-royal-gold">Auditor's Advice:</strong>
                <span v-if="heaviestMilitaryDrain.total > 5">
                  Army upkeep is your largest drain (−{{ totalMilitaryUpkeep }} AP/s). Recruit Supply Intendants to discount military rations, or recruit Clerks to bolster gross treasury yield!
                </span>
                <span v-else-if="popGrowthRate < 1.0">
                  Demographic growth is modest (+{{ popGrowthRate }} pop/s). Farmers provide 6× more citizens per cap slot than Peasants.
                </span>
                <span v-else>
                  Realm revenue is flourishing (+{{ netIncome }} AP/s). Invest in the Court of Accounts to wipe out bureaucratic drag (−{{ bureaucracyPercent }}%).
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Quick Modal Launchers -->
        <div class="grid grid-cols-3 gap-2">
          <button
            type="button"
            @click="activeModal = 'law'"
            class="bg-fief-card hover:bg-fief-card-elevated border border-fief-border hover:border-royal-gold rounded p-2 text-center text-[11px] font-serif-book text-fief-text cursor-pointer transition-colors"
          >
            <GameIcon name="lawDecree" class="w-5 h-5 mx-auto text-royal-gold mb-1" />
            <span>Crown Law</span>
          </button>
          <button
            type="button"
            @click="activeModal = 'event'"
            class="bg-fief-card hover:bg-fief-card-elevated border border-fief-border hover:border-wax-red rounded p-2 text-center text-[11px] font-serif-book text-fief-text cursor-pointer transition-colors"
          >
            <GameIcon name="counselorSteward" class="w-5 h-5 mx-auto text-wax-red mb-1" />
            <span>Steward Event</span>
          </button>
          <button
            type="button"
            @click="activeModal = 'battle'"
            class="bg-fief-card hover:bg-fief-card-elevated border border-fief-border hover:border-iron-grey rounded p-2 text-center text-[11px] font-serif-book text-fief-text cursor-pointer transition-colors"
          >
            <GameIcon name="battleCampaign" class="w-5 h-5 mx-auto text-iron-grey mb-1" />
            <span>Battle Wager</span>
          </button>
        </div>
      </div>

      <!-- 2. TAB: THE THREE ORDERS (All 12 Roles & Both Tiers: 24 Units) -->
      <div v-if="currentSubTab === 'orders'" class="space-y-3 animate-fade-in">
        <!-- Order Selector Chips with Reactive Live Totals & Caps -->
        <div class="flex bg-fief-card border border-fief-border rounded p-1 gap-1 text-xs font-serif-book">
          <button
            type="button"
            @click="activeOrder = 'people'"
            :class="[
              'flex-1 py-1 rounded text-center transition-colors cursor-pointer',
              activeOrder === 'people' ? 'bg-peasant-green text-white font-bold' : 'text-fief-text-muted hover:text-fief-text'
            ]"
          >
            The People ({{ peopleTotal }}/{{ peopleCap }})
          </button>
          <button
            type="button"
            @click="activeOrder = 'admin'"
            :class="[
              'flex-1 py-1 rounded text-center transition-colors cursor-pointer',
              activeOrder === 'admin' ? 'bg-wax-red text-white font-bold' : 'text-fief-text-muted hover:text-fief-text'
            ]"
          >
            Admin ({{ adminTotal }}/{{ adminCap }})
          </button>
          <button
            type="button"
            @click="activeOrder = 'military'"
            :class="[
              'flex-1 py-1 rounded text-center transition-colors cursor-pointer',
              activeOrder === 'military' ? 'bg-iron-grey text-white font-bold' : 'text-fief-text-muted hover:text-fief-text'
            ]"
          >
            Military ({{ militaryTotal }}/{{ militaryCap }})
          </button>
        </div>

        <!-- 1. THE PEOPLE (4 Roles, 8 Units) -->
        <div v-if="activeOrder === 'people'" class="space-y-2">
          <!-- Village Hearth & Demographic Influx Card -->
          <div class="p-3 bg-peasant-green/10 border border-peasant-green/40 rounded-lg space-y-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-full bg-peasant-green/20 border border-peasant-green flex items-center justify-center">
                  <GameIcon
                    name="population"
                    :class="['w-5 h-5 text-peasant-green transition-transform', isPopHopping ? 'pop-hop-active text-white' : '']"
                  />
                </div>
                <div>
                  <div class="font-medieval text-xs text-peasant-green font-bold flex items-center gap-1.5">
                    <span>Village Hearth & Migrations</span>
                    <span v-if="recentArrival" class="text-[9px] font-mono text-royal-gold bg-fief-dark px-1.5 py-0.5 rounded border border-royal-gold/40 animate-pulse">
                      {{ recentArrival }}
                    </span>
                  </div>
                  <div class="text-[10px] text-fief-text-muted font-mono">
                    Net Growth: +{{ popGrowthRate }} pop/s • Realm: {{ currentPop }} citizens
                  </div>
                </div>
              </div>

              <!-- Interactive Village Bell Button -->
              <button
                type="button"
                @click="ringVillageBell"
                :disabled="currentAp < 10"
                class="px-2.5 py-1.5 bg-peasant-green hover:bg-peasant-green/80 disabled:opacity-50 text-white rounded text-[10px] font-serif-book font-bold shadow cursor-pointer transition-all active:scale-95 flex items-center gap-1"
                title="Spend 10 AP to welcome a new settler immediately"
              >
                <span>Ring Bell (10 AP)</span>
              </button>
            </div>

            <!-- Influx Progress Bar -->
            <div class="space-y-1">
              <div class="flex justify-between text-[9px] font-mono text-fief-text-muted">
                <span>Next Settler Influx</span>
                <span>{{ popProgress }}%</span>
              </div>
              <div class="w-full bg-fief-dark h-1.5 rounded-full overflow-hidden border border-fief-border">
                <div
                  class="bg-peasant-green h-full rounded-full transition-all duration-300"
                  :style="{ width: popProgress + '%' }"
                ></div>
              </div>
            </div>

            <!-- Demographic Contributors Breakdown -->
            <div class="grid grid-cols-2 gap-1.5 text-[10px] font-mono pt-1">
              <div class="bg-fief-dark border border-fief-border rounded p-1.5 flex justify-between items-center">
                <span class="text-fief-text-muted flex items-center gap-1">
                  <GameIcon name="rolePeasant" class="w-3 h-3 text-peasant-green" /> Peasants:
                </span>
                <span class="text-peasant-green font-bold">+{{ peasantsGrowth }} pop/s</span>
              </div>
              <div class="bg-fief-dark border border-peasant-green/40 rounded p-1.5 flex justify-between items-center">
                <span class="text-fief-text-muted flex items-center gap-1">
                  <GameIcon name="roleFarmer" class="w-3 h-3 text-peasant-green" /> Farmers:
                </span>
                <span class="text-peasant-green font-bold">+{{ farmersGrowth }} pop/s</span>
              </div>
            </div>

            <!-- Strategic Advice on Demographic Growth -->
            <div class="text-[9px] font-serif-book text-fief-text-dim border-t border-fief-border/50 pt-1 flex items-center justify-between">
              <span>Top driver: <strong class="text-peasant-green">{{ topPopContributor.name }}</strong> ({{ topPopContributor.percent }}% share)</span>
              <span class="font-mono text-peasant-green/90">6× slot efficiency for Farmers</span>
            </div>
          </div>

          <!-- Role 1: Growth -->
          <div class="p-2.5 bg-fief-card border border-fief-border rounded flex items-center justify-between">
            <div class="flex items-center gap-2">
              <GameIcon
                name="rolePeasant"
                :class="['w-7 h-7 text-peasant-green transition-transform', isPopHopping && (popHopIconKey === 'peasants' || !popHopIconKey) ? 'pop-hop-active' : '']"
              />
              <div>
                <div class="font-medieval text-xs text-fief-text">Peasants (Tier I)</div>
                <div class="text-[10px] text-fief-text-muted">+0.02 pop/s • Zero upkeep • Total: {{ units.peasants }}</div>
              </div>
            </div>
            <button
              type="button"
              @click="recruitUnit('peasants', 20)"
              class="px-2.5 py-1 bg-fief-dark hover:bg-wax-red text-royal-gold hover:text-white border border-fief-border rounded text-[11px] font-mono cursor-pointer transition-colors"
            >
              +1 (20 AP)
            </button>
          </div>

          <div class="p-2.5 bg-fief-card border border-fief-border rounded flex items-center justify-between">
            <div class="flex items-center gap-2">
              <GameIcon
                name="roleFarmer"
                :class="['w-7 h-7 text-peasant-green transition-transform', isPopHopping && popHopIconKey === 'farmers' ? 'pop-hop-active' : '']"
              />
              <div>
                <div class="font-medieval text-xs text-fief-text flex items-center gap-1.5">
                  <span>Farmers (Tier II)</span>
                  <span class="text-[8px] font-mono text-peasant-green bg-peasant-green/15 px-1 rounded border border-peasant-green/30">Top Influx</span>
                </div>
                <div class="text-[10px] text-fief-text-muted">+0.12 pop/s (6× Peasants), 0.1 upkeep • Total: {{ units.farmers }}</div>
              </div>
            </div>
            <button
              type="button"
              @click="recruitUnit('farmers', 120)"
              class="px-2.5 py-1 bg-fief-dark hover:bg-wax-red text-royal-gold hover:text-white border border-fief-border rounded text-[11px] font-mono cursor-pointer transition-colors"
            >
              +1 (120 AP)
            </button>
          </div>

          <!-- Role 2: Tax Base (Passive Tax Multipliers) -->
          <div class="p-2.5 bg-fief-card border border-fief-border rounded flex items-center justify-between">
            <div class="flex items-center gap-2">
              <GameIcon
                name="roleArtisan"
                :class="['w-7 h-7 text-royal-gold transition-transform', isPopHopping && popHopIconKey === 'artisans' ? 'pop-hop-active' : '']"
              />
              <div>
                <div class="font-medieval text-xs text-fief-text flex items-center gap-1.5">
                  <span>Artisans (Tier I)</span>
                  <span class="text-[8px] font-mono text-royal-gold bg-royal-gold/15 px-1 rounded border border-royal-gold/30">Passive Tax Buff</span>
                </div>
                <div class="text-[10px] text-fief-text-muted">+0.5% taxes each • Zero upkeep • Current: +{{ (units.artisans * 0.5).toFixed(1) }}% rate</div>
              </div>
            </div>
            <button
              type="button"
              @click="recruitUnit('artisans', 60)"
              class="px-2.5 py-1 bg-fief-dark hover:bg-wax-red text-royal-gold hover:text-white border border-fief-border rounded text-[11px] font-mono cursor-pointer transition-colors"
            >
              +1 (60 AP)
            </button>
          </div>

          <div class="p-2.5 bg-fief-card border border-fief-border rounded flex items-center justify-between">
            <div class="flex items-center gap-2">
              <GameIcon
                name="roleGuild"
                :class="['w-7 h-7 text-royal-gold transition-transform', isPopHopping && popHopIconKey === 'guilds' ? 'pop-hop-active' : '']"
              />
              <div>
                <div class="font-medieval text-xs text-fief-text flex items-center gap-1.5">
                  <span>Guild Masters (Tier II)</span>
                  <span class="text-[8px] font-mono text-royal-gold bg-royal-gold/15 px-1 rounded border border-royal-gold/30">+2.5% Tax Multiplier</span>
                </div>
                <div class="text-[10px] text-fief-text-muted">+2.5% taxes each, 0.3 upkeep • Current: +{{ (units.guilds * 2.5).toFixed(1) }}% rate</div>
              </div>
            </div>
            <button
              type="button"
              @click="recruitUnit('guilds', 250)"
              class="px-2.5 py-1 bg-fief-dark hover:bg-wax-red text-royal-gold hover:text-white border border-fief-border rounded text-[11px] font-mono cursor-pointer transition-colors"
            >
              +1 (250 AP)
            </button>
          </div>

          <!-- Role 3: Pacification (Passive Discontent Reduction) -->
          <div class="p-2.5 bg-fief-card border border-fief-border rounded flex items-center justify-between">
            <div class="flex items-center gap-2">
              <GameIcon
                name="roleClergy"
                :class="['w-7 h-7 text-clergy-purple transition-transform', isPopHopping && popHopIconKey === 'clergy' ? 'pop-hop-active' : '']"
              />
              <div>
                <div class="font-medieval text-xs text-fief-text flex items-center gap-1.5">
                  <span>Clergy (Tier I)</span>
                  <span class="text-[8px] font-mono text-clergy-purple bg-clergy-purple/15 px-1 rounded border border-clergy-purple/30">Passive Calm</span>
                </div>
                <div class="text-[10px] text-fief-text-muted">−0.02 discontent/s • Zero upkeep • Current: −{{ (units.clergy * 0.02).toFixed(2) }}/s</div>
              </div>
            </div>
            <button
              type="button"
              @click="recruitUnit('clergy', 50)"
              class="px-2.5 py-1 bg-fief-dark hover:bg-wax-red text-royal-gold hover:text-white border border-fief-border rounded text-[11px] font-mono cursor-pointer transition-colors"
            >
              +1 (50 AP)
            </button>
          </div>

          <div class="p-2.5 bg-fief-card border border-fief-border rounded flex items-center justify-between">
            <div class="flex items-center gap-2">
              <GameIcon
                name="rolePrelate"
                :class="['w-7 h-7 text-clergy-purple transition-transform', isPopHopping && popHopIconKey === 'prelates' ? 'pop-hop-active' : '']"
              />
              <div>
                <div class="font-medieval text-xs text-fief-text flex items-center gap-1.5">
                  <span>Prelates (Tier II)</span>
                  <span class="text-[8px] font-mono text-clergy-purple bg-clergy-purple/15 px-1 rounded border border-clergy-purple/30">Major Pacification</span>
                </div>
                <div class="text-[10px] text-fief-text-muted">−0.10 discontent/s, 0.2 upkeep • Current: −{{ (units.prelates * 0.10).toFixed(2) }}/s</div>
              </div>
            </div>
            <button
              type="button"
              @click="recruitUnit('prelates', 220)"
              class="px-2.5 py-1 bg-fief-dark hover:bg-wax-red text-royal-gold hover:text-white border border-fief-border rounded text-[11px] font-mono cursor-pointer transition-colors"
            >
              +1 (220 AP)
            </button>
          </div>

          <!-- Role 4: Cap Expanders (Passive Order Capacity) -->
          <div class="p-2.5 bg-fief-card border border-fief-border rounded flex items-center justify-between">
            <div class="flex items-center gap-2">
              <GameIcon
                name="roleNotable"
                :class="['w-7 h-7 text-royal-gold-light transition-transform', isPopHopping && popHopIconKey === 'notables' ? 'pop-hop-active' : '']"
              />
              <div>
                <div class="font-medieval text-xs text-fief-text flex items-center gap-1.5">
                  <span>Notables (Tier I)</span>
                  <span class="text-[8px] font-mono text-royal-gold-light bg-royal-gold-light/15 px-1 rounded border border-royal-gold-light/30">Passive Cap Expander</span>
                </div>
                <div class="text-[10px] text-fief-text-muted">+1% caps on all 3 orders • Zero upkeep • Current: +{{ units.notables }}% caps</div>
              </div>
            </div>
            <button
              type="button"
              @click="recruitUnit('notables', 150)"
              class="px-2.5 py-1 bg-fief-dark hover:bg-wax-red text-royal-gold hover:text-white border border-fief-border rounded text-[11px] font-mono cursor-pointer transition-colors"
            >
              +1 (150 AP)
            </button>
          </div>

          <div class="p-2.5 bg-fief-card border border-fief-border rounded flex items-center justify-between">
            <div class="flex items-center gap-2">
              <GameIcon
                name="roleLord"
                :class="['w-7 h-7 text-royal-gold-light transition-transform', isPopHopping && popHopIconKey === 'lords' ? 'pop-hop-active' : '']"
              />
              <div>
                <div class="font-medieval text-xs text-fief-text flex items-center gap-1.5">
                  <span>High Lords (Tier II)</span>
                  <span class="text-[8px] font-mono text-royal-gold-light bg-royal-gold-light/15 px-1 rounded border border-royal-gold-light/30">+5% Grand Cap Expander</span>
                </div>
                <div class="text-[10px] text-fief-text-muted">+5% caps on all orders, 0.8 upkeep • Current: +{{ units.lords * 5 }}% caps</div>
              </div>
            </div>
            <button
              type="button"
              @click="recruitUnit('lords', 500)"
              class="px-2.5 py-1 bg-fief-dark hover:bg-wax-red text-royal-gold hover:text-white border border-fief-border rounded text-[11px] font-mono cursor-pointer transition-colors"
            >
              +1 (500 AP)
            </button>
          </div>
        </div>

        <!-- 2. ADMINISTRATION (4 Roles, 8 Units) -->
        <div v-if="activeOrder === 'admin'" class="space-y-2">
          <!-- Royal Chancery Cadence Card -->
          <div class="p-3 bg-wax-red/10 border border-wax-red/40 rounded-lg space-y-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div
                  class="w-8 h-8 rounded-full bg-wax-red/20 border border-wax-red flex items-center justify-center transition-transform"
                  :class="adminStampPulse ? 'scale-115 border-royal-gold bg-wax-red/40' : ''"
                >
                  <GameIcon
                    name="waxSeal"
                    :class="['w-5 h-5 text-wax-red transition-transform', adminStampPulse ? 'scale-90 text-royal-gold' : 'animate-admin-stamp']"
                  />
                </div>
                <div>
                  <div class="font-medieval text-xs text-wax-red font-bold flex items-center gap-1.5">
                    <span>Royal Chancery Cadence</span>
                    <span class="text-[9px] font-mono text-royal-gold bg-fief-dark px-1.5 py-0.5 rounded border border-royal-gold/40">
                      +{{ netIncome }} AP/s Net
                    </span>
                  </div>
                  <div class="text-[10px] text-fief-text-muted font-mono">
                    Cadence: 1.2s tick • {{ adminTotal }} active bureaucrats
                  </div>
                </div>
              </div>

              <!-- Pulse indicator light -->
              <div class="flex items-center gap-1 px-2 py-1 bg-fief-dark rounded border border-fief-border">
                <div class="w-2 h-2 rounded-full" :class="adminStampPulse ? 'bg-royal-gold scale-125' : 'bg-wax-red'" />
                <span class="text-[9px] font-mono text-fief-text-dim">Inking</span>
              </div>
            </div>

            <!-- Chancery Breakdown Metrics -->
            <div class="grid grid-cols-2 gap-1.5 text-[10px] font-mono pt-1">
              <div class="bg-fief-dark border border-fief-border rounded p-1.5 flex justify-between">
                <span class="text-fief-text-muted">Scribes & Clerks:</span>
                <span class="text-peasant-green font-bold">+{{ scribeOutput }} AP/s</span>
              </div>
              <div class="bg-fief-dark border border-fief-border rounded p-1.5 flex justify-between">
                <span class="text-fief-text-muted">Supervisor Bonus:</span>
                <span class="text-royal-gold font-bold">+{{ supervisorBonusPercent }}%</span>
              </div>
              <div class="bg-fief-dark border border-fief-border rounded p-1.5 flex justify-between">
                <span class="text-fief-text-muted">Drag Reduction:</span>
                <span class="text-peasant-green font-bold">−{{ dragReductionPercent }}%</span>
              </div>
              <div class="bg-fief-dark border border-fief-border rounded p-1.5 flex justify-between">
                <span class="text-fief-text-muted">Direct Tax:</span>
                <span class="text-royal-gold font-bold">+{{ directTaxOutput }} AP/s</span>
              </div>
            </div>

            <!-- Strategic Advice on Chancery Output -->
            <div class="text-[9px] font-serif-book text-fief-text-dim border-t border-fief-border/50 pt-1 flex items-center justify-between">
              <span>Top producer: <strong class="text-royal-gold">{{ topApContributor.name }}</strong> (+{{ topApContributor.amount }} AP/s)</span>
              <span class="font-mono text-peasant-green/90">8× slot efficiency for Clerks</span>
            </div>
          </div>

          <!-- Role 1: AP Producers -->
          <div class="p-2.5 bg-fief-card border border-fief-border rounded flex items-center justify-between">
            <div class="flex items-center gap-2">
              <GameIcon
                name="roleScribe"
                :class="['w-7 h-7 text-wax-red transition-transform', adminStampPulse ? 'scale-120 text-white' : 'animate-admin-scribble']"
              />
              <div>
                <div class="font-medieval text-xs text-fief-text">Scribes (Tier I)</div>
                <div class="text-[10px] text-fief-text-muted">+0.5 AP/s • Zero upkeep • Total: {{ units.scribes }}</div>
              </div>
            </div>
            <button
              type="button"
              @click="recruitUnit('scribes', 15)"
              class="px-2.5 py-1 bg-fief-dark hover:bg-wax-red text-royal-gold hover:text-white border border-fief-border rounded text-[11px] font-mono cursor-pointer transition-colors"
            >
              +1 (15 AP)
            </button>
          </div>

          <div class="p-2.5 bg-fief-card border border-fief-border rounded flex items-center justify-between">
            <div class="flex items-center gap-2">
              <GameIcon
                name="roleClerk"
                :class="['w-7 h-7 text-wax-red transition-transform', adminStampPulse ? 'scale-90 translate-y-0.5 text-royal-gold' : 'animate-admin-stamp']"
              />
              <div>
                <div class="font-medieval text-xs text-fief-text flex items-center gap-1.5">
                  <span>Clerks (Tier II)</span>
                  <span class="text-[8px] font-mono text-royal-gold bg-royal-gold/15 px-1 rounded border border-royal-gold/30">Top Earner</span>
                </div>
                <div class="text-[10px] text-fief-text-muted">+4.0 AP/s (8× Scribes), 0.5 upkeep • Total: {{ units.clerks }}</div>
              </div>
            </div>
            <button
              type="button"
              @click="recruitUnit('clerks', 100)"
              class="px-2.5 py-1 bg-fief-dark hover:bg-wax-red text-royal-gold hover:text-white border border-fief-border rounded text-[11px] font-mono cursor-pointer transition-colors"
            >
              +1 (100 AP)
            </button>
          </div>

          <!-- Role 2: AP Multiplier (Passive Yield Boosters) -->
          <div class="p-2.5 bg-fief-card border border-fief-border rounded flex items-center justify-between">
            <div class="flex items-center gap-2">
              <GameIcon
                name="roleSupervisor"
                :class="['w-7 h-7 text-royal-gold transition-transform', adminStampPulse ? 'scale-115 text-royal-gold-light' : '']"
              />
              <div>
                <div class="font-medieval text-xs text-fief-text flex items-center gap-1.5">
                  <span>Supervisors (Tier I)</span>
                  <span class="text-[8px] font-mono text-royal-gold bg-royal-gold/15 px-1 rounded border border-royal-gold/30">Passive AP Boost</span>
                </div>
                <div class="text-[10px] text-fief-text-muted">+2% AP to all scribes/clerks • Zero upkeep • Current: +{{ units.supervisors * 2 }}% yield</div>
              </div>
            </div>
            <button
              type="button"
              @click="recruitUnit('supervisors', 80)"
              class="px-2.5 py-1 bg-fief-dark hover:bg-wax-red text-royal-gold hover:text-white border border-fief-border rounded text-[11px] font-mono cursor-pointer transition-colors"
            >
              +1 (80 AP)
            </button>
          </div>

          <div class="p-2.5 bg-fief-card border border-fief-border rounded flex items-center justify-between">
            <div class="flex items-center gap-2">
              <GameIcon
                name="roleProvincialSteward"
                :class="['w-7 h-7 text-royal-gold transition-transform', adminStampPulse ? 'scale-115' : '']"
              />
              <div>
                <div class="font-medieval text-xs text-fief-text flex items-center gap-1.5">
                  <span>Provincial Stewards (Tier II)</span>
                  <span class="text-[8px] font-mono text-royal-gold bg-royal-gold/15 px-1 rounded border border-royal-gold/30">+10% AP Multiplier</span>
                </div>
                <div class="text-[10px] text-fief-text-muted">+10% AP across chancery, 1.0 upkeep • Current: +{{ units.provincialStewards * 10 }}% yield</div>
              </div>
            </div>
            <button
              type="button"
              @click="recruitUnit('provincialStewards', 300)"
              class="px-2.5 py-1 bg-fief-dark hover:bg-wax-red text-royal-gold hover:text-white border border-fief-border rounded text-[11px] font-mono cursor-pointer transition-colors"
            >
              +1 (300 AP)
            </button>
          </div>

          <!-- Role 3: Paperwork Reducer (Passive Drag Reducers) -->
          <div class="p-2.5 bg-fief-card border border-fief-border rounded flex items-center justify-between">
            <div class="flex items-center gap-2">
              <GameIcon
                name="roleArchivist"
                :class="['w-7 h-7 text-fief-text-muted transition-transform', adminStampPulse ? 'scale-110 text-royal-gold' : '']"
              />
              <div>
                <div class="font-medieval text-xs text-fief-text flex items-center gap-1.5">
                  <span>Archivists (Tier I)</span>
                  <span class="text-[8px] font-mono text-fief-text-muted bg-fief-border px-1 rounded border border-fief-border">Passive Drag Cut</span>
                </div>
                <div class="text-[10px] text-fief-text-muted">−1.5% drag • Zero upkeep • Current: −{{ (units.archivists * 1.5).toFixed(1) }}% bureaucracy</div>
              </div>
            </div>
            <button
              type="button"
              @click="recruitUnit('archivists', 70)"
              class="px-2.5 py-1 bg-fief-dark hover:bg-wax-red text-royal-gold hover:text-white border border-fief-border rounded text-[11px] font-mono cursor-pointer transition-colors"
            >
              +1 (70 AP)
            </button>
          </div>

          <div class="p-2.5 bg-fief-card border border-fief-border rounded flex items-center justify-between">
            <div class="flex items-center gap-2">
              <GameIcon
                name="roleAuditChamber"
                :class="['w-7 h-7 text-fief-text-muted transition-transform', adminStampPulse ? 'scale-110 text-royal-gold' : '']"
              />
              <div>
                <div class="font-medieval text-xs text-fief-text flex items-center gap-1.5">
                  <span>Court of Accounts (Tier II)</span>
                  <span class="text-[8px] font-mono text-peasant-green bg-peasant-green/15 px-1 rounded border border-peasant-green/30">Major Drag Cut</span>
                </div>
                <div class="text-[10px] text-fief-text-muted">−8.0% drag, 0.6 upkeep • Current: −{{ (units.auditChamber * 8.0).toFixed(1) }}% bureaucracy</div>
              </div>
            </div>
            <button
              type="button"
              @click="recruitUnit('auditChamber', 280)"
              class="px-2.5 py-1 bg-fief-dark hover:bg-wax-red text-royal-gold hover:text-white border border-fief-border rounded text-[11px] font-mono cursor-pointer transition-colors"
            >
              +1 (280 AP)
            </button>
          </div>

          <!-- Role 4: Tax Collectors & Farmers-General -->
          <div class="p-2.5 bg-fief-card border border-fief-border rounded flex items-center justify-between">
            <div class="flex items-center gap-2">
              <GameIcon
                name="roleTaxCollector"
                :class="['w-7 h-7 text-royal-gold transition-transform', adminStampPulse ? 'scale-120' : '']"
              />
              <div>
                <div class="font-medieval text-xs text-fief-text">Tax Collectors (Tier I)</div>
                <div class="text-[10px] text-fief-text-muted">+0.8 AP/100 citizens • Total: {{ units.taxCollectors }}</div>
              </div>
            </div>
            <button
              type="button"
              @click="recruitUnit('taxCollectors', 120)"
              class="px-2.5 py-1 bg-fief-dark hover:bg-wax-red text-royal-gold hover:text-white border border-fief-border rounded text-[11px] font-mono cursor-pointer transition-colors"
            >
              +1 (120 AP)
            </button>
          </div>

          <div class="p-2.5 bg-fief-card border border-fief-border rounded flex items-center justify-between">
            <div class="flex items-center gap-2">
              <GameIcon
                name="roleGeneralFarmer"
                :class="['w-7 h-7 text-royal-gold transition-transform', adminStampPulse ? 'scale-120' : '']"
              />
              <div>
                <div class="font-medieval text-xs text-fief-text">Farmers-General (Tier II)</div>
                <div class="text-[10px] text-fief-text-muted">+4.5 AP/100 citizens, 1.2 upkeep • Total: {{ units.generalFarmers }}</div>
              </div>
            </div>
            <button
              type="button"
              @click="recruitUnit('generalFarmers', 450)"
              class="px-2.5 py-1 bg-fief-dark hover:bg-wax-red text-royal-gold hover:text-white border border-fief-border rounded text-[11px] font-mono cursor-pointer transition-colors"
            >
              +1 (450 AP)
            </button>
          </div>
        </div>

        <!-- 3. THE MILITARY (4 Roles, 8 Units) -->
        <div v-if="activeOrder === 'military'" class="space-y-2">
          <!-- High Command War Council & Logistics Card -->
          <div class="p-3 bg-iron-grey/15 border border-iron-grey/40 rounded-lg space-y-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-full bg-iron-grey/30 border border-iron-grey flex items-center justify-center">
                  <GameIcon name="militaryPower" class="w-5 h-5 text-iron-grey" />
                </div>
                <div>
                  <div class="font-medieval text-xs text-fief-text font-bold flex items-center gap-1.5">
                    <span>War Council Logistics</span>
                    <span class="text-[9px] font-mono text-wax-red bg-fief-dark px-1.5 py-0.5 rounded border border-wax-red/40">
                      −{{ totalMilitaryUpkeep }} AP/s Total Drain
                    </span>
                  </div>
                  <div class="text-[10px] text-fief-text-muted font-mono">
                    Army Force: {{ totalMilitaryForce }} combat power • Roster: {{ militaryTotal }}/{{ militaryCap }}
                  </div>
                </div>
              </div>

              <!-- Supply Discount Pill -->
              <div class="flex items-center gap-1 px-2 py-1 bg-fief-dark rounded border border-fief-border">
                <GameIcon name="roleMilitaryIntendant" class="w-3.5 h-3.5 text-royal-gold" />
                <div class="text-right leading-none">
                  <div class="text-[8px] font-mono text-peasant-green font-bold">−{{ militaryDiscountPercent }}% Upkeep</div>
                  <div class="text-[7px] text-fief-text-dim">Supply lines</div>
                </div>
              </div>
            </div>

            <!-- Upkeep Breakdown & Heaviest Drain Alert -->
            <div class="grid grid-cols-2 gap-1.5 text-[10px] font-mono pt-1">
              <div class="bg-fief-dark border border-wax-red/40 rounded p-1.5 flex justify-between items-center">
                <span class="text-fief-text-muted flex items-center gap-1">
                  <GameIcon :name="heaviestMilitaryDrain.icon" class="w-3 h-3 text-wax-red" />
                  Heaviest Drain:
                </span>
                <span class="text-wax-red font-bold">−{{ heaviestMilitaryDrain.total }} AP/s</span>
              </div>
              <div class="bg-fief-dark border border-peasant-green/40 rounded p-1.5 flex justify-between items-center">
                <span class="text-fief-text-muted flex items-center gap-1">
                  <GameIcon name="roleSoldier" class="w-3 h-3 text-peasant-green" />
                  Soldiers:
                </span>
                <span class="text-peasant-green font-bold">0 AP/s (Free)</span>
              </div>
              <div class="bg-fief-dark border border-fief-border rounded p-1.5 flex justify-between items-center">
                <span class="text-fief-text-muted">Men-at-Arms:</span>
                <span class="text-wax-red font-bold">−{{ menAtArmsUpkeep }} AP/s</span>
              </div>
              <div class="bg-fief-dark border border-fief-border rounded p-1.5 flex justify-between items-center">
                <span class="text-fief-text-muted">Captains:</span>
                <span class="text-wax-red font-bold">−{{ captainsUpkeep }} AP/s</span>
              </div>
            </div>

            <!-- Strategic Military Guidance -->
            <div class="text-[9px] font-serif-book text-fief-text-dim border-t border-fief-border/50 pt-1 flex items-center justify-between">
              <span>Heaviest burden: <strong class="text-wax-red">{{ heaviestMilitaryDrain.name }}</strong> ({{ heaviestMilitaryDrain.desc }})</span>
              <span class="font-mono text-royal-gold/90">Intendants reduce up to 60%</span>
            </div>
          </div>

          <!-- Role 1: Strength Producer -->
          <div class="p-2.5 bg-fief-card border border-fief-border rounded flex items-center justify-between">
            <div class="flex items-center gap-2">
              <GameIcon name="roleSoldier" class="w-7 h-7 text-iron-grey" />
              <div>
                <div class="font-medieval text-xs text-fief-text flex items-center gap-1.5">
                  <span>Soldiers (Tier I)</span>
                  <span class="text-[8px] font-mono text-peasant-green bg-peasant-green/15 px-1 rounded border border-peasant-green/30">Free Upkeep</span>
                </div>
                <div class="text-[10px] text-fief-text-muted">+1 force • Zero ongoing upkeep • Current: +{{ units.soldiers }} garrison force</div>
              </div>
            </div>
            <button
              type="button"
              @click="recruitUnit('soldiers', 25)"
              class="px-2.5 py-1 bg-fief-dark hover:bg-wax-red text-royal-gold hover:text-white border border-fief-border rounded text-[11px] font-mono cursor-pointer transition-colors"
            >
              +1 (25 AP)
            </button>
          </div>

          <div class="p-2.5 bg-fief-card border border-fief-border rounded flex items-center justify-between">
            <div class="flex items-center gap-2">
              <GameIcon name="roleManAtArms" class="w-7 h-7 text-iron-grey" />
              <div>
                <div class="font-medieval text-xs text-fief-text flex items-center gap-1.5">
                  <span>Men-at-Arms (Tier II)</span>
                  <span class="text-[8px] font-mono text-wax-red bg-wax-red/15 px-1 rounded border border-wax-red/30">Heavy Upkeep</span>
                </div>
                <div class="text-[10px] text-fief-text-muted">+6 force • Upkeep: −{{ (1.5 * militaryDiscountFactor).toFixed(1) }} AP/s • Current: +{{ units.menAtArms * 6 }} combat force</div>
              </div>
            </div>
            <button
              type="button"
              @click="recruitUnit('menAtArms', 150)"
              class="px-2.5 py-1 bg-fief-dark hover:bg-wax-red text-royal-gold hover:text-white border border-fief-border rounded text-[11px] font-mono cursor-pointer transition-colors"
            >
              +1 (150 AP)
            </button>
          </div>

          <!-- Role 2: Multiplier (Strength & Luck) -->
          <div class="p-2.5 bg-fief-card border border-fief-border rounded flex items-center justify-between">
            <div class="flex items-center gap-2">
              <GameIcon name="roleOfficer" class="w-7 h-7 text-royal-gold" />
              <div>
                <div class="font-medieval text-xs text-fief-text flex items-center gap-1.5">
                  <span>Officers (Tier I)</span>
                  <span class="text-[8px] font-mono text-royal-gold bg-royal-gold/15 px-1 rounded border border-royal-gold/30">Passive Leadership</span>
                </div>
                <div class="text-[10px] text-fief-text-muted">+1.5% strength & battle luck • Zero upkeep • Current: +{{ (units.officers * 1.5).toFixed(1) }}% leadership</div>
              </div>
            </div>
            <button
              type="button"
              @click="recruitUnit('officers', 100)"
              class="px-2.5 py-1 bg-fief-dark hover:bg-wax-red text-royal-gold hover:text-white border border-fief-border rounded text-[11px] font-mono cursor-pointer transition-colors"
            >
              +1 (100 AP)
            </button>
          </div>

          <div class="p-2.5 bg-fief-card border border-fief-border rounded flex items-center justify-between">
            <div class="flex items-center gap-2">
              <GameIcon name="roleCaptain" class="w-7 h-7 text-royal-gold" />
              <div>
                <div class="font-medieval text-xs text-fief-text flex items-center gap-1.5">
                  <span>Captains (Tier II)</span>
                  <span class="text-[8px] font-mono text-wax-red bg-wax-red/15 px-1 rounded border border-wax-red/30">+8.0% Command Bonus</span>
                </div>
                <div class="text-[10px] text-fief-text-muted">+8.0% strength • Upkeep: −{{ (2.0 * militaryDiscountFactor).toFixed(1) }} AP/s • Current: +{{ (units.captains * 8.0).toFixed(1) }}% leadership</div>
              </div>
            </div>
            <button
              type="button"
              @click="recruitUnit('captains', 350)"
              class="px-2.5 py-1 bg-fief-dark hover:bg-wax-red text-royal-gold hover:text-white border border-fief-border rounded text-[11px] font-mono cursor-pointer transition-colors"
            >
              +1 (350 AP)
            </button>
          </div>

          <!-- Role 3: Upkeep Reducer (Passive Logistics) -->
          <div class="p-2.5 bg-fief-card border border-fief-border rounded flex items-center justify-between">
            <div class="flex items-center gap-2">
              <GameIcon name="roleMilitaryIntendant" class="w-7 h-7 text-fief-text-muted" />
              <div>
                <div class="font-medieval text-xs text-fief-text flex items-center gap-1.5">
                  <span>Supply Intendants (Tier I)</span>
                  <span class="text-[8px] font-mono text-royal-gold bg-royal-gold/15 px-1 rounded border border-royal-gold/30">Passive Logistics</span>
                </div>
                <div class="text-[10px] text-fief-text-muted">−1.5% army upkeep • Zero upkeep • Current: −{{ (units.militaryIntendants * 1.5).toFixed(1) }}% upkeep</div>
              </div>
            </div>
            <button
              type="button"
              @click="recruitUnit('militaryIntendants', 90)"
              class="px-2.5 py-1 bg-fief-dark hover:bg-wax-red text-royal-gold hover:text-white border border-fief-border rounded text-[11px] font-mono cursor-pointer transition-colors"
            >
              +1 (90 AP)
            </button>
          </div>

          <div class="p-2.5 bg-fief-card border border-fief-border rounded flex items-center justify-between">
            <div class="flex items-center gap-2">
              <GameIcon name="roleQuartermaster" class="w-7 h-7 text-fief-text-muted" />
              <div>
                <div class="font-medieval text-xs text-fief-text flex items-center gap-1.5">
                  <span>Quartermasters (Tier II)</span>
                  <span class="text-[8px] font-mono text-royal-gold bg-royal-gold/15 px-1 rounded border border-royal-gold/30">−8.0% Major Discount</span>
                </div>
                <div class="text-[10px] text-fief-text-muted">−8.0% army upkeep • Zero upkeep • Current: −{{ (units.quartermasters * 8.0).toFixed(1) }}% upkeep</div>
              </div>
            </div>
            <button
              type="button"
              @click="recruitUnit('quartermasters', 320)"
              class="px-2.5 py-1 bg-fief-dark hover:bg-wax-red text-royal-gold hover:text-white border border-fief-border rounded text-[11px] font-mono cursor-pointer transition-colors"
            >
              +1 (320 AP)
            </button>
          </div>

          <!-- Role 4: Scouts / Spies (Passive Threat Intel) -->
          <div class="p-2.5 bg-fief-card border border-fief-border rounded flex items-center justify-between">
            <div class="flex items-center gap-2">
              <GameIcon name="roleScout" class="w-7 h-7 text-royal-gold" />
              <div>
                <div class="font-medieval text-xs text-fief-text flex items-center gap-1.5">
                  <span>Scouts (Tier I)</span>
                  <span class="text-[8px] font-mono text-peasant-green bg-peasant-green/15 px-1 rounded border border-peasant-green/30">Passive Recon</span>
                </div>
                <div class="text-[10px] text-fief-text-muted">Narrows threat range by 3 • Zero upkeep • Current: −{{ units.scouts * 3 }} distance</div>
              </div>
            </div>
            <button
              type="button"
              @click="recruitUnit('scouts', 110)"
              class="px-2.5 py-1 bg-fief-dark hover:bg-wax-red text-royal-gold hover:text-white border border-fief-border rounded text-[11px] font-mono cursor-pointer transition-colors"
            >
              +1 (110 AP)
            </button>
          </div>

          <div class="p-2.5 bg-fief-card border border-fief-border rounded flex items-center justify-between">
            <div class="flex items-center gap-2">
              <GameIcon name="roleSpy" class="w-7 h-7 text-royal-gold" />
              <div>
                <div class="font-medieval text-xs text-fief-text flex items-center gap-1.5">
                  <span>Royal Spies (Tier II)</span>
                  <span class="text-[8px] font-mono text-wax-red bg-wax-red/15 px-1 rounded border border-wax-red/30">Passive Espionage</span>
                </div>
                <div class="text-[10px] text-fief-text-muted">Reveals threat traits • Upkeep: −{{ (1.0 * militaryDiscountFactor).toFixed(1) }} AP/s • Total: {{ units.spies }} Spies</div>
              </div>
            </div>
            <button
              type="button"
              @click="recruitUnit('spies', 400)"
              class="px-2.5 py-1 bg-fief-dark hover:bg-wax-red text-royal-gold hover:text-white border border-fief-border rounded text-[11px] font-mono cursor-pointer transition-colors"
            >
              +1 (400 AP)
            </button>
          </div>
        </div>
      </div>

      <!-- 3. TAB: CROWN LAWS & STEWARD LOG -->
      <div v-if="currentSubTab === 'laws'" class="space-y-3 animate-fade-in">
        <!-- Active Laws Section -->
        <div class="bg-fief-card border border-fief-border rounded-lg p-3 space-y-2">
          <div class="flex justify-between items-center text-xs">
            <span class="font-medieval text-royal-gold flex items-center gap-1">
              <GameIcon name="lawDecree" class="w-4 h-4" /> Active Laws (3 / 5)
            </span>
            <span class="text-[10px] font-mono text-fief-text-muted">Max 5 slots</span>
          </div>

          <div class="space-y-1.5 text-xs">
            <div class="p-2 bg-fief-dark border-l-2 border-wax-red rounded flex justify-between items-center">
              <div>
                <div class="font-medieval text-fief-text">Royal Scriptorium</div>
                <div class="text-[10px] text-peasant-green">+50% scribe AP output</div>
              </div>
              <span class="text-[10px] font-mono text-wax-red">+20% drag</span>
            </div>

            <div class="p-2 bg-fief-dark border-l-2 border-peasant-green rounded flex justify-between items-center">
              <div>
                <div class="font-medieval text-fief-text">Ancient Birthright</div>
                <div class="text-[10px] text-peasant-green">+15% province capacity</div>
              </div>
              <span class="text-[10px] font-mono text-wax-red">−20% growth</span>
            </div>

            <div class="p-2 bg-fief-dark border-l-2 border-iron-grey rounded flex justify-between items-center">
              <div>
                <div class="font-medieval text-fief-text">Standing Garrison</div>
                <div class="text-[10px] text-peasant-green">60% threat defense</div>
              </div>
              <span class="text-[10px] font-mono text-wax-red">+30% upkeep</span>
            </div>

            <div class="p-2 border border-dashed border-fief-border rounded text-center text-fief-text-dim text-[11px] italic">
              Slot 4 : Empty
            </div>
            <div class="p-2 border border-dashed border-fief-border rounded text-center text-fief-text-dim text-[11px] italic">
              Slot 5 : Empty
            </div>
          </div>
        </div>

        <!-- Steward Log -->
        <div class="bg-fief-card border border-fief-border rounded-lg p-3 space-y-2">
          <div class="flex items-center gap-1.5 text-xs font-medieval text-royal-gold">
            <GameIcon name="counselorSteward" class="w-4 h-4 text-wax-red" />
            <span>Steward's Chronicle</span>
          </div>
          <p class="p-2.5 bg-fief-dark border border-fief-border rounded text-[11px] font-serif-book italic text-fief-text-muted leading-relaxed">
            "My Liege, your scribes ink parchment day and night, but coin drains faster than it gathers. Beware the auditors at Deadline 4..."
          </p>
        </div>
      </div>
    </div>

    <!-- MOBILE MODALS OVERLAY (BOTTOM SHEETS) -->
    <div
      v-if="activeModal !== 'none'"
      class="fixed inset-0 bg-ink-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-fade-in"
    >
      <!-- Law Choice Bottom Sheet -->
      <div
        v-if="activeModal === 'law'"
        class="w-full max-w-lg bg-fief-card border-t-2 sm:border sm:rounded-lg border-royal-gold p-4 space-y-3 shadow-2xl animate-slide-up"
      >
        <div class="flex justify-between items-center border-b border-fief-border pb-2">
          <div class="flex items-center gap-1.5">
            <GameIcon name="crown" class="w-5 h-5 text-royal-gold" />
            <span class="font-medieval text-sm text-royal-gold">Council Decrees</span>
          </div>
          <button type="button" @click="activeModal = 'none'" class="text-fief-text-muted hover:text-wax-red font-bold text-sm cursor-pointer">✕</button>
        </div>

        <div class="space-y-2">
          <div class="p-2.5 bg-fief-dark border border-fief-border rounded flex justify-between items-center cursor-pointer hover:border-wax-red" @click="activeModal = 'none'">
            <div>
              <div class="text-[10px] text-wax-red font-mono">Chancellor</div>
              <div class="font-medieval text-xs text-fief-text">General Cadastre</div>
              <div class="text-[10px] text-peasant-green">−25% base paperwork • +2 AP/s upkeep</div>
            </div>
            <button type="button" class="px-2 py-1 bg-wax-red text-white text-[10px] rounded font-mono">Enact</button>
          </div>

          <div class="p-2.5 bg-fief-dark border border-fief-border rounded flex justify-between items-center cursor-pointer hover:border-peasant-green" @click="activeModal = 'none'">
            <div>
              <div class="text-[10px] text-peasant-green font-mono">Prelate</div>
              <div class="font-medieval text-xs text-fief-text">Holy Holidays</div>
              <div class="text-[10px] text-peasant-green">−0.2 discontent/s • −10% AP output</div>
            </div>
            <button type="button" class="px-2 py-1 bg-peasant-green text-white text-[10px] rounded font-mono">Enact</button>
          </div>

          <div class="p-2.5 bg-fief-dark border border-fief-border rounded flex justify-between items-center cursor-pointer hover:border-iron-grey" @click="activeModal = 'none'">
            <div>
              <div class="text-[10px] text-iron-grey font-mono">Marshal</div>
              <div class="font-medieval text-xs text-fief-text">Sanctioned Plunder</div>
              <div class="text-[10px] text-peasant-green">Battle loot ×1.5 • +20% discontent</div>
            </div>
            <button type="button" class="px-2 py-1 bg-iron-grey text-white text-[10px] rounded font-mono">Enact</button>
          </div>
        </div>

        <button
          type="button"
          @click="activeModal = 'none'"
          class="w-full text-center text-[10px] text-fief-text-dim hover:text-wax-red pt-1 underline cursor-pointer"
        >
          Reject All (+1 Archive Point)
        </button>
      </div>

      <!-- Steward Dilemma Modal -->
      <div
        v-if="activeModal === 'event'"
        class="w-full max-w-lg bg-fief-card border-t-2 sm:border sm:rounded-lg border-wax-red p-4 space-y-3 shadow-2xl animate-slide-up"
      >
        <div class="flex items-center gap-2 border-b border-fief-border pb-2">
          <GameIcon name="counselorSteward" class="w-6 h-6 text-wax-red" />
          <span class="font-medieval text-sm text-wax-red">The Scribe Who Counted Too Much</span>
        </div>
        <p class="text-[11px] font-serif-book italic text-fief-text-muted leading-relaxed">
          "My Lord, a scribe claims to have found a discrepancy in the ledgers. He demands the title and wage of a Supervisor..."
        </p>
        <div class="space-y-1.5 pt-1">
          <button
            type="button"
            @click="activeModal = 'none'"
            class="w-full text-left p-2 rounded bg-fief-dark border border-fief-border hover:border-peasant-green text-xs cursor-pointer"
          >
            <div class="font-bold text-fief-text">Choice A: Promote to Supervisor</div>
            <div class="text-[10px] text-peasant-green">+1 Supervisor, +1 AP/s upkeep</div>
          </button>
          <button
            type="button"
            @click="activeModal = 'none'"
            class="w-full text-left p-2 rounded bg-fief-dark border border-fief-border hover:border-wax-red text-xs cursor-pointer"
          >
            <div class="font-bold text-fief-text">Choice B: Dismiss coldly</div>
            <div class="text-[10px] text-wax-red">+5% bureaucratic drag</div>
          </button>
        </div>
      </div>

      <!-- Tactical Battle Modal -->
      <div
        v-if="activeModal === 'battle'"
        class="w-full max-w-lg bg-fief-card border-t-2 sm:border sm:rounded-lg border-iron-grey p-4 space-y-3 shadow-2xl animate-slide-up"
      >
        <div class="flex items-center gap-2 border-b border-fief-border pb-2">
          <GameIcon name="battleCampaign" class="w-6 h-6 text-iron-grey" />
          <span class="font-medieval text-sm text-fief-text">Siege of the Border Fief (Round 1/3)</span>
        </div>
        <div class="bg-fief-dark p-2 rounded text-[11px] space-y-1">
          <div class="flex justify-between">
            <span class="text-fief-text-muted">Estimated Enemy Force:</span>
            <span class="font-mono text-wax-red font-bold">100 to 160</span>
          </div>
          <div class="flex justify-between">
            <span class="text-fief-text-muted">Available Soldiers:</span>
            <span class="font-mono text-fief-text font-bold">28</span>
          </div>
          <div class="flex justify-between">
            <span class="text-fief-text-muted">Expected Loot:</span>
            <span class="font-mono text-royal-gold font-bold">+250 AP, 1 Fief</span>
          </div>
        </div>
        <button
          type="button"
          @click="activeModal = 'none'"
          class="w-full bg-wax-red hover:bg-wax-red-dark text-white py-2 rounded text-xs font-serif-book font-bold cursor-pointer"
        >
          Commit 20 Soldiers into the fray
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes flyLetterOut {
  0% {
    transform: translate(0, 0) scale(0.35) rotate(0deg);
    opacity: 1;
  }
  60% {
    opacity: 0.95;
  }
  100% {
    transform: translate(var(--dx), var(--dy)) scale(var(--scale)) rotate(var(--rot));
    opacity: 0;
  }
}

.particle-fly-out {
  animation: flyLetterOut 0.75s cubic-bezier(0.12, 0.8, 0.32, 1) forwards;
  will-change: transform, opacity;
}

/* Population Settler Hopping Animation */
@keyframes popHop {
  0% {
    transform: scale(1) translateY(0) rotate(0deg);
  }
  25% {
    transform: scale(0.85, 1.2) translateY(-9px) rotate(-5deg);
  }
  50% {
    transform: scale(1.15, 0.88) translateY(-13px) rotate(4deg);
  }
  75% {
    transform: scale(0.95, 1.05) translateY(-3px) rotate(-2deg);
  }
  100% {
    transform: scale(1) translateY(0) rotate(0deg);
  }
}

.pop-hop-active {
  animation: popHop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1);
  will-change: transform;
}

/* Bureaucratic Stamping Impact Animation */
@keyframes adminStamp {
  0%, 100% {
    transform: translateY(0) scale(1);
  }
  30% {
    transform: translateY(-4px) scale(0.95);
  }
  50% {
    transform: translateY(4px) scale(1.12, 0.85);
  }
  70% {
    transform: translateY(-1px) scale(1.02);
  }
}

.animate-admin-stamp {
  animation: adminStamp 1.2s ease-in-out infinite;
  will-change: transform;
}

/* Scribe Inking / Scribbling Animation */
@keyframes adminScribble {
  0%, 100% {
    transform: rotate(-10deg) translate(0, 0);
  }
  25% {
    transform: rotate(12deg) translate(2px, -2px);
  }
  50% {
    transform: rotate(-8deg) translate(-2px, 1px);
  }
  75% {
    transform: rotate(8deg) translate(1px, -1px);
  }
}

.animate-admin-scribble {
  animation: adminScribble 0.9s ease-in-out infinite;
  will-change: transform;
}

/* Slow Chancellerie Guild Ring Rotation */
@keyframes spinSlow {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin-slow {
  animation: spinSlow 36s linear infinite;
}
</style>
