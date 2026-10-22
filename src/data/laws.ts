/**
 * The 30 Imperial Laws Catalog (Task 2.3, GAME_RULES §10).
 *
 * 10 Chancellor Laws (Administration & Fiscal)
 * 10 Prelate Laws (The People & Church)
 * 10 Marshal Laws (The Military & War)
 *
 * @module data/laws
 */

import type { Effect } from '@/core/types'

export type LawOrder = 'chancellor' | 'prelate' | 'marshal'

export interface LawDef {
  id: string
  order: LawOrder
  name: string
  description: string
  effects: Effect[]
}

export const LAWS_DATA: Record<string, LawDef> = {
  // ==========================================
  // 10.1 The Chancellor (Administration & Fiscal)
  // ==========================================
  'law:royal_scriptorium': {
    id: 'law:royal_scriptorium',
    order: 'chancellor',
    name: 'Royal Scriptorium',
    description: '+50% Scribe AP output | +20% paperwork inertia.',
    effects: [
      {
        type: 'stat_modifier',
        modifier: {
          source: 'law:royal_scriptorium',
          stat: 'gross_ap_rate',
          op: 'addPct',
          value: 0.25,
        },
      },
      {
        type: 'stat_modifier',
        modifier: {
          source: 'law:royal_scriptorium',
          stat: 'paperwork_friction',
          op: 'addPct',
          value: 0.20,
        },
      },
    ],
  },
  'law:general_cadastre': {
    id: 'law:general_cadastre',
    order: 'chancellor',
    name: 'General Cadastre',
    description: '-25% paperwork inertia | +2.0 AP/s upkeep per province.',
    effects: [
      {
        type: 'stat_modifier',
        modifier: {
          source: 'law:general_cadastre',
          stat: 'paperwork_friction',
          op: 'mul',
          value: 0.75,
        },
      },
      {
        type: 'rule_flag',
        flag: 'law:general_cadastre',
        enabled: true,
      },
    ],
  },
  'law:exceptional_tithe': {
    id: 'law:exceptional_tithe',
    order: 'chancellor',
    name: 'Exceptional Tithe',
    description: '+80% AP output during deadline | +30 Unrest upon audit.',
    effects: [
      {
        type: 'stat_modifier',
        modifier: {
          source: 'law:exceptional_tithe',
          stat: 'gross_ap_rate',
          op: 'addPct',
          value: 0.80,
        },
      },
      {
        type: 'rule_flag',
        flag: 'law:exceptional_tithe',
        enabled: true,
      },
    ],
  },
  'law:single_window_bureaucracy': {
    id: 'law:single_window_bureaucracy',
    order: 'chancellor',
    name: 'Single Window Bureaucracy',
    description: 'Archivists grant double reduction | Supervisors -50% efficiency.',
    effects: [
      {
        type: 'rule_flag',
        flag: 'law:single_window_bureaucracy',
        enabled: true,
      },
    ],
  },
  'law:stamp_duty_monopoly': {
    id: 'law:stamp_duty_monopoly',
    order: 'chancellor',
    name: 'Stamp Duty Monopoly',
    description: 'Clicks yield +100% AP | Free serf tax yield -15%.',
    effects: [
      {
        type: 'stat_modifier',
        modifier: {
          source: 'law:stamp_duty_monopoly',
          stat: 'click_power',
          op: 'addPct',
          value: 1.00,
        },
      },
      {
        type: 'stat_modifier',
        modifier: {
          source: 'law:stamp_duty_monopoly',
          stat: 'tax_efficiency',
          op: 'addPct',
          value: -0.15,
        },
      },
    ],
  },
  'law:crown_monopolies': {
    id: 'law:crown_monopolies',
    order: 'chancellor',
    name: 'Crown Monopolies',
    description: '+25% gross AP output | Tier I unit recruit cost +25%.',
    effects: [
      {
        type: 'stat_modifier',
        modifier: {
          source: 'law:crown_monopolies',
          stat: 'gross_ap_rate',
          op: 'addPct',
          value: 0.25,
        },
      },
      {
        type: 'rule_flag',
        flag: 'law:crown_monopolies',
        enabled: true,
      },
    ],
  },
  'law:chancery_red_tape': {
    id: 'law:chancery_red_tape',
    order: 'chancellor',
    name: 'Chancery Red Tape',
    description: 'Bankruptcy grace extended to 50s | Base paperwork +15%.',
    effects: [
      {
        type: 'stat_modifier',
        modifier: {
          source: 'law:chancery_red_tape',
          stat: 'paperwork_friction',
          op: 'addPct',
          value: 0.15,
        },
      },
      {
        type: 'rule_flag',
        flag: 'law:chancery_red_tape',
        enabled: true,
      },
    ],
  },
  'law:corvee_exemption_tax': {
    id: 'law:corvee_exemption_tax',
    order: 'chancellor',
    name: 'Corvée Exemption Tax',
    description: '+30% tax efficiency | Peasant pop growth -25%.',
    effects: [
      {
        type: 'stat_modifier',
        modifier: {
          source: 'law:corvee_exemption_tax',
          stat: 'tax_efficiency',
          op: 'addPct',
          value: 0.30,
        },
      },
      {
        type: 'rule_flag',
        flag: 'law:corvee_exemption_tax',
        enabled: true,
      },
    ],
  },
  'law:auditors_inquisition': {
    id: 'law:auditors_inquisition',
    order: 'chancellor',
    name: "Auditors' Inquisition",
    description: 'Audit Chamber grants double reduction | +15 Unrest at each audit.',
    effects: [
      {
        type: 'rule_flag',
        flag: 'law:auditors_inquisition',
        enabled: true,
      },
    ],
  },
  'law:imperial_bond_floating': {
    id: 'law:imperial_bond_floating',
    order: 'chancellor',
    name: 'Imperial Bond Floating',
    description: '+3,000 AP instantly | -10% gross AP/s debt service.',
    effects: [
      {
        type: 'instant_resource',
        resource: 'ap',
        amount: 3000,
      },
      {
        type: 'stat_modifier',
        modifier: {
          source: 'law:imperial_bond_floating',
          stat: 'gross_ap_rate',
          op: 'mul',
          value: 0.90,
        },
      },
    ],
  },

  // ==========================================
  // 10.2 The Prelate (The People & Church)
  // ==========================================
  'law:census_edict': {
    id: 'law:census_edict',
    order: 'prelate',
    name: 'Census Edict',
    description: '+25% pop capacity | Admin order cap reduced by 20%.',
    effects: [
      {
        type: 'stat_modifier',
        modifier: {
          source: 'law:census_edict',
          stat: 'housing_capacity',
          op: 'addPct',
          value: 0.25,
        },
      },
      {
        type: 'rule_flag',
        flag: 'law:census_edict',
        enabled: true,
      },
    ],
  },
  'law:holy_days_vigils': {
    id: 'law:holy_days_vigils',
    order: 'prelate',
    name: 'Holy Days & Vigils',
    description: '-0.20 Unrest/s pacification | -10% AP output.',
    effects: [
      {
        type: 'stat_modifier',
        modifier: {
          source: 'law:holy_days_vigils',
          stat: 'unrest_pacification',
          op: 'add',
          value: 0.20,
        },
      },
      {
        type: 'stat_modifier',
        modifier: {
          source: 'law:holy_days_vigils',
          stat: 'gross_ap_rate',
          op: 'mul',
          value: 0.90,
        },
      },
    ],
  },
  'law:primogeniture_decrees': {
    id: 'law:primogeniture_decrees',
    order: 'prelate',
    name: 'Primogeniture Decrees',
    description: '+20% province pop capacity | -20% demographic growth.',
    effects: [
      {
        type: 'stat_modifier',
        modifier: {
          source: 'law:primogeniture_decrees',
          stat: 'housing_capacity',
          op: 'addPct',
          value: 0.20,
        },
      },
      {
        type: 'stat_modifier',
        modifier: {
          source: 'law:primogeniture_decrees',
          stat: 'pop_growth_rate',
          op: 'mul',
          value: 0.80,
        },
      },
    ],
  },
  'law:grand_kermesse': {
    id: 'law:grand_kermesse',
    order: 'prelate',
    name: 'Grand Kermesse',
    description: '-25 Unrest immediately | Costs 400 AP.',
    effects: [
      {
        type: 'instant_resource',
        resource: 'ap',
        amount: -400,
      },
      {
        type: 'instant_resource',
        resource: 'unrest',
        amount: -25,
      },
    ],
  },
  'law:sanctuary_rights': {
    id: 'law:sanctuary_rights',
    order: 'prelate',
    name: 'Sanctuary Rights',
    description: 'Prevents soldier desertion below 90% Unrest only | Military recruit costs +30%.',
    effects: [
      {
        type: 'rule_flag',
        flag: 'law:sanctuary_rights',
        enabled: true,
      },
    ],
  },
  'law:monastic_granaries': {
    id: 'law:monastic_granaries',
    order: 'prelate',
    name: 'Monastic Granaries',
    description: '+0.08 pop growth/s per 100 serfs | 10% poll tax evasion.',
    effects: [
      {
        type: 'stat_modifier',
        modifier: {
          source: 'law:monastic_granaries',
          stat: 'pop_growth_rate',
          op: 'add',
          value: 0.08,
          resolverKey: 'law:feudal_levy',
        },
      },
      {
        type: 'stat_modifier',
        modifier: {
          source: 'law:monastic_granaries',
          stat: 'tax_efficiency',
          op: 'addPct',
          value: -0.10,
        },
      },
    ],
  },
  'law:tithe_commutation': {
    id: 'law:tithe_commutation',
    order: 'prelate',
    name: 'Tithe Commutation',
    description: 'Priests and Prelates have zero upkeep | Tax efficiency -10%.',
    effects: [
      {
        type: 'stat_modifier',
        modifier: {
          source: 'law:tithe_commutation',
          stat: 'tax_efficiency',
          op: 'addPct',
          value: -0.10,
        },
      },
      {
        type: 'rule_flag',
        flag: 'law:tithe_commutation',
        enabled: true,
      },
    ],
  },
  'law:sumptuary_edicts': {
    id: 'law:sumptuary_edicts',
    order: 'prelate',
    name: 'Sumptuary Edicts',
    description: '-15% civil upkeep | Click critical chance -50%.',
    effects: [
      {
        type: 'rule_flag',
        flag: 'law:sumptuary_edicts',
        enabled: true,
      },
    ],
  },
  'law:parish_relief_registers': {
    id: 'law:parish_relief_registers',
    order: 'prelate',
    name: 'Parish Relief Registers',
    description: 'No demographic freeze during overcrowding | -5% gross AP/s.',
    effects: [
      {
        type: 'stat_modifier',
        modifier: {
          source: 'law:parish_relief_registers',
          stat: 'gross_ap_rate',
          op: 'mul',
          value: 0.95,
        },
      },
      {
        type: 'rule_flag',
        flag: 'law:parish_relief_registers',
        enabled: true,
      },
    ],
  },
  'law:papal_concordat': {
    id: 'law:papal_concordat',
    order: 'prelate',
    name: 'Papal Concordat',
    description: '-40% base Unrest generation | 1 active law slot permanently pledged to Holy See.',
    effects: [
      {
        type: 'stat_modifier',
        modifier: {
          source: 'law:papal_concordat',
          stat: 'unrest_generation',
          op: 'mul',
          value: 0.60,
        },
      },
      {
        type: 'rule_flag',
        flag: 'law:papal_concordat',
        enabled: true,
      },
    ],
  },

  // ==========================================
  // 10.3 The Marshal (The Military & War)
  // ==========================================
  'law:standing_garrisons': {
    id: 'law:standing_garrisons',
    order: 'marshal',
    name: 'Standing Garrisons',
    description: '60% of threat power absorbed | Military upkeep +30%.',
    effects: [
      {
        type: 'rule_flag',
        flag: 'law:standing_garrisons',
        enabled: true,
      },
    ],
  },
  'law:merit_pay': {
    id: 'law:merit_pay',
    order: 'marshal',
    name: 'Merit Pay',
    description: '-30% military upkeep | Only effective if holding <= 3 provinces.',
    effects: [
      {
        type: 'rule_flag',
        flag: 'law:merit_pay',
        enabled: true,
      },
    ],
  },
  'law:sanctioned_plunder': {
    id: 'law:sanctioned_plunder',
    order: 'marshal',
    name: 'Sanctioned Plunder',
    description: 'Battle loot x1.5 | +15 Unrest per campaign battle.',
    effects: [
      {
        type: 'stat_modifier',
        modifier: {
          source: 'law:sanctioned_plunder',
          stat: 'battle_loot_multiplier',
          op: 'mul',
          value: 1.5,
        },
      },
      {
        type: 'rule_flag',
        flag: 'law:sanctioned_plunder',
        enabled: true,
      },
    ],
  },
  'law:officer_academies': {
    id: 'law:officer_academies',
    order: 'marshal',
    name: 'Officer Academies',
    description: 'Sergeants and Captains count double | Soldier cost +20%.',
    effects: [
      {
        type: 'rule_flag',
        flag: 'law:officer_academies',
        enabled: true,
      },
    ],
  },
  'law:feudal_retinue_levy': {
    id: 'law:feudal_retinue_levy',
    order: 'marshal',
    name: 'Feudal Retinue Levy',
    description: '+15 Men-at-Arms recruited instantly | Costs 15 Free Serfs and +20 Unrest.',
    effects: [
      {
        type: 'grant_units',
        unitId: 'man_at_arms',
        count: 15,
        external: false,
      },
      {
        type: 'instant_resource',
        resource: 'unrest',
        amount: 20,
      },
    ],
  },
  'law:scorched_earth': {
    id: 'law:scorched_earth',
    order: 'marshal',
    name: 'Scorched Earth',
    description: 'Ambush probability 0% | Conquered provinces yield 50% less loot.',
    effects: [
      {
        type: 'rule_flag',
        flag: 'law:scorched_earth',
        enabled: true,
      },
    ],
  },
  'law:vanguard_drills': {
    id: 'law:vanguard_drills',
    order: 'marshal',
    name: 'Vanguard Drills',
    description: 'Combat roll raised to [1.05, 1.20] | Battle casualties +15%.',
    effects: [
      {
        type: 'rule_flag',
        flag: 'law:vanguard_drills',
        enabled: true,
      },
    ],
  },
  'law:guerrilla_border_watch': {
    id: 'law:guerrilla_border_watch',
    order: 'marshal',
    name: 'Guerrilla Border Watch',
    description: 'Border Strongholds grant double defense | Military upkeep +10%.',
    effects: [
      {
        type: 'rule_flag',
        flag: 'law:guerrilla_border_watch',
        enabled: true,
      },
    ],
  },
  'law:mercenary_capitulation': {
    id: 'law:mercenary_capitulation',
    order: 'marshal',
    name: 'Mercenary Capitulation',
    description: 'Hire Men-at-Arms with AP without consuming Serfs | Upkeep doubled (3.0 AP/s).',
    effects: [
      {
        type: 'rule_flag',
        flag: 'law:mercenary_capitulation',
        enabled: true,
      },
    ],
  },
  'law:marshals_carte_blanche': {
    id: 'law:marshals_carte_blanche',
    order: 'marshal',
    name: "Marshal's Carte Blanche",
    description: '+25% Military Power | Chancellor laws cost double AP.',
    effects: [
      {
        type: 'stat_modifier',
        modifier: {
          source: 'law:marshals_carte_blanche',
          stat: 'military_power',
          op: 'addPct',
          value: 0.25,
        },
      },
      {
        type: 'rule_flag',
        flag: 'law:marshals_carte_blanche',
        enabled: true,
      },
    ],
  },
}
