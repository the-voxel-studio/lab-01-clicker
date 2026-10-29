/**
 * Copy of the chronicle of the realm: folklore lines per dread band (from Figma `Screens v7`) and
 * the names the chronicle gives to units.
 *
 * @module data/chronicleCopy
 */

import type { UnitId } from '@/core/types'
import type { DreadBand } from '@/ui/dread'

/** Folklore lines written as the realm lives, by dread band. */
export const FOLKLORE: Record<DreadBand, readonly string[]> = {
  enchanted: [
    'Minstrels play at the castle gate.',
    'A white stag was seen in the royal forest. The peasants call it a good omen.',
  ],
  uneasy: [
    'A barn burns in the night. No one saw who lit it.',
    'The tax collectors come back from Ashford with nothing.',
  ],
  rotting: ['Three deserters are hanged at dawn.', 'The well at Ashford is poisoned.'],
  death_throes: [
    'The mob has taken the granary.',
    'The bells ring for the dead and do not stop.',
    'Someone is standing behind you.',
  ],
}

/** Singular and plural name of each unit, as the chronicle writes them. */
export const UNIT_NAMES: Record<UnitId, { one: string; many: string }> = {
  peasant: { one: 'peasant', many: 'peasants' },
  farmer: { one: 'farmer', many: 'farmers' },
  artisan: { one: 'artisan', many: 'artisans' },
  guild: { one: 'guild', many: 'guilds' },
  clergy: { one: 'priest', many: 'priests' },
  prelate: { one: 'prelate', many: 'prelates' },
  notable: { one: 'notable', many: 'notables' },
  baron: { one: 'baron', many: 'barons' },
  scribe: { one: 'scribe', many: 'scribes' },
  clerk: { one: 'clerk', many: 'clerks' },
  supervisor: { one: 'supervisor', many: 'supervisors' },
  provincial_steward: { one: 'provincial steward', many: 'provincial stewards' },
  archivist: { one: 'archivist', many: 'archivists' },
  audit_chamber: { one: 'audit chamber', many: 'audit chambers' },
  collector: { one: 'collector', many: 'collectors' },
  farmer_general: { one: 'farmer general', many: 'farmers general' },
  soldier: { one: 'soldier', many: 'soldiers' },
  man_at_arms: { one: 'man-at-arms', many: 'men-at-arms' },
  sergeant: { one: 'sergeant', many: 'sergeants' },
  captain: { one: 'captain', many: 'captains' },
  quartermaster: { one: 'quartermaster', many: 'quartermasters' },
  grand_marshal: { one: 'grand marshal', many: 'grand marshals' },
  scout: { one: 'scout', many: 'scouts' },
  spymaster: { one: 'spymaster', many: 'spymasters' },
}
