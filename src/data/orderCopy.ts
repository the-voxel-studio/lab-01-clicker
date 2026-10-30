/**
 * What each unit is called on the order pages and what it does for the realm. Effects follow the
 * roles of `docs/GAME_RULES.md`; figures stay in the engine.
 *
 * @module data/orderCopy
 */

import type { UnitId } from '@/core/types'
import type { GameIconKey } from '@/data/icons'

/** Copy and icon of one unit row. */
export interface UnitCopy {
  name: string
  verb: string
  effect: string
  icon: GameIconKey
}

/** Row copy of the 24 units. */
export const UNIT_COPY: Record<UnitId, UnitCopy> = {
  peasant: { name: 'Peasants', verb: 'working', effect: 'births rise', icon: 'rolePeasant' },
  farmer: { name: 'Farmers', verb: 'working', effect: 'births rise fast', icon: 'roleFarmer' },
  artisan: { name: 'Artisans', verb: 'working', effect: 'taxes rise', icon: 'roleArtisan' },
  guild: { name: 'Guilds', verb: 'trading', effect: 'taxes rise fast', icon: 'roleGuild' },
  clergy: { name: 'Priests', verb: 'preaching', effect: 'unrest falls', icon: 'roleClergy' },
  prelate: {
    name: 'Prelates',
    verb: 'presiding',
    effect: 'unrest falls fast',
    icon: 'rolePrelate',
  },
  notable: {
    name: 'Notables',
    verb: 'sitting',
    effect: 'housing and orders grow',
    icon: 'roleNotable',
  },
  baron: {
    name: 'Barons',
    verb: 'holding land',
    effect: 'housing and orders grow fast',
    icon: 'roleLord',
  },
  scribe: { name: 'Scribes', verb: 'writing', effect: 'AP rises', icon: 'roleScribe' },
  clerk: { name: 'Clerks', verb: 'stamping', effect: 'AP rises fast', icon: 'roleClerk' },
  supervisor: {
    name: 'Supervisors',
    verb: 'watching',
    effect: 'scribes and clerks write more',
    icon: 'roleSupervisor',
  },
  provincial_steward: {
    name: 'Provincial stewards',
    verb: 'governing',
    effect: 'scribes and clerks write far more',
    icon: 'roleProvincialSteward',
  },
  archivist: {
    name: 'Archivists',
    verb: 'filing',
    effect: 'paperwork falls',
    icon: 'roleArchivist',
  },
  audit_chamber: {
    name: 'Audit chambers',
    verb: 'sitting',
    effect: 'paperwork falls fast',
    icon: 'roleAuditChamber',
  },
  collector: {
    name: 'Tax collectors',
    verb: 'collecting',
    effect: 'free serfs pay',
    icon: 'roleTaxCollector',
  },
  farmer_general: {
    name: 'Farmers general',
    verb: 'farming taxes',
    effect: 'free serfs pay far more',
    icon: 'roleGeneralFarmer',
  },
  soldier: { name: 'Foot soldiers', verb: 'in arms', effect: 'force rises', icon: 'roleSoldier' },
  man_at_arms: {
    name: 'Men-at-arms',
    verb: 'in arms',
    effect: 'force rises fast',
    icon: 'roleManAtArms',
  },
  sergeant: {
    name: 'Sergeants',
    verb: 'drilling',
    effect: 'force and loot rise',
    icon: 'roleOfficer',
  },
  captain: {
    name: 'Captains',
    verb: 'commanding',
    effect: 'force rises, fewer die',
    icon: 'roleCaptain',
  },
  quartermaster: {
    name: 'Quartermasters',
    verb: 'supplying',
    effect: 'upkeep falls',
    icon: 'roleMilitaryIntendant',
  },
  grand_marshal: {
    name: 'Grand marshals',
    verb: 'marshalling',
    effect: 'upkeep falls fast',
    icon: 'roleQuartermaster',
  },
  scout: {
    name: 'Scouts',
    verb: 'on the roads',
    effect: 'each scouting costs one',
    icon: 'roleScout',
  },
  spymaster: {
    name: 'Spymasters',
    verb: 'listening',
    effect: 'deceit is revealed',
    icon: 'roleSpy',
  },
}
