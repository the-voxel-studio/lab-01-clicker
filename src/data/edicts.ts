/**
 * Emergency Executive Edicts Catalog (GAME_RULES §11).
 *
 * @module data/edicts
 */

export type EdictId = 'forced_tithe' | 'church_seizure' | 'grand_festival'

export interface EdictDef {
  id: EdictId
  name: string
  description: string
  gainDescription: string
  penaltyDescription: string
}

export const EDICTS_DATA: Record<EdictId, EdictDef> = {
  forced_tithe: {
    id: 'forced_tithe',
    name: 'The Forced Tithe',
    description: 'Instant seizure of grain and coin from serfs.',
    gainDescription: 'Instantly adds 30 seconds of current poll tax income to the treasury.',
    penaltyDescription:
      '+35 immediate Unrest (escalating by +50% per prior use) and freezes population growth for 20s.',
  },
  church_seizure: {
    id: 'church_seizure',
    name: 'Church Seizure',
    description: 'Confiscating church gold and reliquaries.',
    gainDescription: 'Instantly awards max(300, 25 * Gross AP/s) to the treasury.',
    penaltyDescription:
      'Cuts Clergy and Prelate pacification by 50% for 60s (escalating) and inflicts +10 immediate Unrest (escalating). Max 2 uses per run.',
  },
  grand_festival: {
    id: 'grand_festival',
    name: 'The Grand Festival',
    description: 'Opening wine cellars and funding public feasts.',
    gainDescription: 'Instantly pacifies the realm, reducing Unrest by 20 points.',
    penaltyDescription:
      'Costs max(100, 20% positive AP, 30 * Gross AP/s) AP from the treasury.',
  },
}
