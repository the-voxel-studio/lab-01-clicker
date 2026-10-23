/**
 * Emergency Executive Edicts Catalog (GAME_RULES §11).
 *
 * @module data/edicts
 */

/** Identifier of an emergency edict. */
export type EdictId = 'forced_tithe' | 'church_seizure' | 'grand_festival'

/** Penalty increase per prior use of the same edict in the run: `1 + 0.5 * k`. */
export const EDICT_ESCALATION_PER_USE = 0.5

/** Numbers of The Forced Tithe. */
export interface ForcedTitheValues {
  /** Seconds of current poll tax income seized. */
  pollTaxSeconds: number
  /** Immediate Unrest before escalation. */
  unrest: number
  /** Seconds population growth stays frozen (not escalated). */
  growthFreezeSeconds: number
}

/** Numbers of Church Seizure. */
export interface ChurchSeizureValues {
  /** Uses permitted per run. */
  maxUsesPerRun: number
  /** Minimum AP payout. */
  minPayout: number
  /** Seconds of Gross AP/s paid out when above the minimum. */
  grossRateSeconds: number
  /** Multiplier applied to `unrest_pacification` during the penalty. */
  pacificationMultiplier: number
  /** Penalty duration in seconds before escalation. */
  pacificationSeconds: number
  /** Immediate Unrest before escalation. */
  unrest: number
}

/** Numbers of The Grand Festival. */
export interface GrandFestivalValues {
  /** Minimum AP cost. */
  minCost: number
  /** Share of the positive treasury the cost reaches at least. */
  treasuryShare: number
  /** Seconds of Gross AP/s the cost reaches at least. */
  grossRateSeconds: number
  /** Unrest removed (not escalated). */
  unrestRelief: number
}

/** Static definition of one emergency edict: texts and the numbers the engine reads. */
export interface EdictDef<V> {
  id: EdictId
  name: string
  description: string
  gainDescription: string
  penaltyDescription: string
  /** Numbers read by the ENACT_EDICT handler (single source). */
  values: V
}

/** Shape of the edict catalog, one typed entry per edict. */
export interface EdictCatalog {
  forced_tithe: EdictDef<ForcedTitheValues>
  church_seizure: EdictDef<ChurchSeizureValues>
  grand_festival: EdictDef<GrandFestivalValues>
}

/** Catalog of the three emergency edicts (GAME_RULES §11). */
export const EDICTS_DATA: EdictCatalog = {
  forced_tithe: {
    id: 'forced_tithe',
    name: 'The Forced Tithe',
    description: 'Instant seizure of grain and coin from serfs.',
    gainDescription: 'Instantly adds 30 seconds of current poll tax income to the treasury.',
    penaltyDescription:
      '+35 immediate Unrest (escalating by +50% per prior use) and freezes population growth for 20s.',
    values: { pollTaxSeconds: 30, unrest: 35, growthFreezeSeconds: 20 },
  },
  church_seizure: {
    id: 'church_seizure',
    name: 'Church Seizure',
    description: 'Confiscating church gold and reliquaries.',
    gainDescription: 'Instantly awards max(300, 25 * Gross AP/s) to the treasury.',
    penaltyDescription:
      'Cuts Clergy and Prelate pacification by 50% for 60s (escalating) and inflicts +10 immediate Unrest (escalating). Max 2 uses per run.',
    values: {
      maxUsesPerRun: 2,
      minPayout: 300,
      grossRateSeconds: 25,
      pacificationMultiplier: 0.5,
      pacificationSeconds: 60,
      unrest: 10,
    },
  },
  grand_festival: {
    id: 'grand_festival',
    name: 'The Grand Festival',
    description: 'Opening wine cellars and funding public feasts.',
    gainDescription: 'Instantly pacifies the realm, reducing Unrest by 20 points.',
    penaltyDescription: 'Costs max(100, 20% positive AP, 30 * Gross AP/s) AP from the treasury.',
    values: { minCost: 100, treasuryShare: 0.2, grossRateSeconds: 30, unrestRelief: 20 },
  },
}
