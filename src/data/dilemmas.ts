/**
 * The 20 Reactive Steward Dilemmas Catalog (Task 2.3, GAME_RULES §9).
 *
 * @module data/dilemmas
 */

import type { Effect, GameState } from '@/core/types'
import type { EngineConfig } from '@/core/config'
import { DEFAULT_ENGINE_CONFIG, quotaForDeadline } from '@/core/config'
import { calculateGrossApRate, calculateMilitaryUpkeep, calculateNetPaperwork } from '@/core/engine'

export interface DilemmaChoice {
  text: string
  effects: Effect[]
}

export interface DilemmaDef {
  id: string
  name: string
  description: string
  trigger: (state: GameState, config?: EngineConfig) => boolean
  choices: [DilemmaChoice, DilemmaChoice]
}

export const DILEMMAS_DATA: Record<string, DilemmaDef> = {
  'dilemma:taxable_windows': {
    id: 'dilemma:taxable_windows',
    name: 'The Taxable Windows',
    description:
      'The Chancellor suggests levying a tax on the number of glass panes in noble estates.',
    trigger: (state, config) => calculateGrossApRate(state, config).total > 150,
    choices: [
      {
        text: 'Tax glass panes (+15% Tax Efficiency, +15 Unrest)',
        effects: [
          {
            type: 'stat_modifier',
            modifier: {
              source: 'dilemma:taxable_windows',
              stat: 'tax_efficiency',
              op: 'addPct',
              value: 0.15,
            },
          },
          {
            type: 'instant_resource',
            resource: 'unrest',
            amount: 15,
          },
        ],
      },
      {
        text: 'Forbid such petty tolls (-10 Unrest, +1 Archive Point)',
        effects: [
          {
            type: 'instant_resource',
            resource: 'unrest',
            amount: -10,
          },
          {
            type: 'instant_resource',
            resource: 'archive_points',
            amount: 1,
          },
        ],
      },
    ],
  },

  'dilemma:scribe_counted_too_much': {
    id: 'dilemma:scribe_counted_too_much',
    name: 'The Scribe Who Counted Too Much',
    description: 'A zealous clerk has audited our own archives and discovered discrepancies.',
    trigger: (state, config = DEFAULT_ENGINE_CONFIG) => {
      const quota = quotaForDeadline(config, state.deadline)
      const gross = state.lastAuditOutcome?.grossApRate ?? calculateGrossApRate(state, config).total
      return quota.apRate > 0 && gross / quota.apRate < 1.15
    },
    choices: [
      {
        text: 'Promote to Senior Clerk (+1 Clerk, +0.5 AP/s upkeep)',
        effects: [
          {
            type: 'grant_units',
            unitId: 'clerk',
            count: 1,
            external: true,
          },
        ],
      },
      {
        text: 'Discard ledgers in the moat (-5% paperwork, +10 Unrest)',
        effects: [
          {
            type: 'stat_modifier',
            modifier: {
              source: 'dilemma:scribe_counted_too_much',
              stat: 'paperwork_friction',
              op: 'addPct',
              value: -0.05,
            },
          },
          {
            type: 'instant_resource',
            resource: 'unrest',
            amount: 10,
          },
        ],
      },
    ],
  },

  'dilemma:princely_cousin': {
    id: 'dilemma:princely_cousin',
    name: 'The Princely Cousin',
    description:
      'A highborn relative demands an exorbitant sovereign pension for nominal military command.',
    trigger: (state, config = DEFAULT_ENGINE_CONFIG) =>
      calculateMilitaryUpkeep(state, config) >
      config.balance.PRINCELY_COUSIN_UPKEEP_SHARE * calculateGrossApRate(state, config).total,
    choices: [
      {
        text: 'Pay his extravagant stipend (-500 AP, -15 Unrest)',
        effects: [
          {
            type: 'instant_resource',
            resource: 'ap',
            amount: -500,
          },
          {
            type: 'instant_resource',
            resource: 'unrest',
            amount: -15,
          },
        ],
      },
      {
        text: 'Post him to the harsh frontier (-10% military upkeep, +15% threat power)',
        effects: [
          {
            type: 'stat_modifier',
            modifier: {
              source: 'dilemma:princely_cousin',
              stat: 'unit_upkeep',
              op: 'addPct',
              value: -0.1,
              scope: { order: 'military' },
            },
          },
          {
            type: 'stat_modifier',
            modifier: {
              source: 'dilemma:princely_cousin',
              stat: 'threat_power',
              op: 'mul',
              value: 1.15,
            },
          },
        ],
      },
    ],
  },

  'dilemma:great_archive_fire': {
    id: 'dilemma:great_archive_fire',
    name: 'The Great Archive Fire',
    description: 'A candle has fallen in the registry tower. Thousands of tax rolls are burning.',
    trigger: (state, config) => calculateNetPaperwork(state, config) > 0.45,
    choices: [
      {
        text: 'Let them burn! (-20% paperwork, +20 Unrest)',
        effects: [
          {
            type: 'stat_modifier',
            modifier: {
              source: 'dilemma:great_archive_fire',
              stat: 'paperwork_friction',
              op: 'addPct',
              value: -0.2,
            },
          },
          {
            type: 'instant_resource',
            resource: 'unrest',
            amount: 20,
          },
        ],
      },
      {
        text: 'Hire emergency copyists (-400 AP, -5% paperwork)',
        effects: [
          {
            type: 'instant_resource',
            resource: 'ap',
            amount: -400,
          },
          {
            type: 'stat_modifier',
            modifier: {
              source: 'dilemma:great_archive_fire',
              stat: 'paperwork_friction',
              op: 'addPct',
              value: -0.05,
            },
          },
        ],
      },
    ],
  },

  'dilemma:cabinet_scarcity': {
    id: 'dilemma:cabinet_scarcity',
    name: 'The Cabinet Scarcity',
    description: 'We have produced so much wealth that our storage vaults are overflowing.',
    trigger: (state, config = DEFAULT_ENGINE_CONFIG) => {
      const quota = quotaForDeadline(config, state.deadline)
      const gross = state.lastAuditOutcome?.grossApRate ?? calculateGrossApRate(state, config).total
      return quota.apRate > 0 && gross / quota.apRate > 3.0
    },
    choices: [
      {
        text: 'Commission reinforced iron vaults (-600 AP, +10% Admin output)',
        effects: [
          {
            type: 'instant_resource',
            resource: 'ap',
            amount: -600,
          },
          {
            type: 'stat_modifier',
            modifier: {
              source: 'dilemma:cabinet_scarcity',
              stat: 'gross_ap_rate',
              op: 'addPct',
              value: 0.1,
            },
          },
        ],
      },
      {
        text: 'Melt old relics and discard archive scraps (-1 Archive Point, +800 AP)',
        effects: [
          {
            type: 'instant_resource',
            resource: 'archive_points',
            amount: -1,
          },
          {
            type: 'instant_resource',
            resource: 'ap',
            amount: 800,
          },
        ],
      },
    ],
  },

  'dilemma:peasant_salt_boycott': {
    id: 'dilemma:peasant_salt_boycott',
    name: 'The Peasant Salt Boycott',
    description: 'Villagers have blockaded the salt roads in protest against royal levies.',
    trigger: (state) => state.unrest > 50,
    choices: [
      {
        text: 'Seize communal salt stores (+400 AP, +20 Unrest)',
        effects: [
          {
            type: 'instant_resource',
            resource: 'ap',
            amount: 400,
          },
          {
            type: 'instant_resource',
            resource: 'unrest',
            amount: 20,
          },
        ],
      },
      {
        text: 'Concede a tax-free salt jubilee (-25% taxes for 30s, -25 Unrest)',
        effects: [
          {
            type: 'stat_modifier',
            modifier: {
              source: 'dilemma:peasant_salt_boycott',
              stat: 'tax_efficiency',
              op: 'addPct',
              value: -0.25,
              durationSeconds: 30,
            },
          },
          {
            type: 'instant_resource',
            resource: 'unrest',
            amount: -25,
          },
        ],
      },
    ],
  },

  'dilemma:runaway_serfs': {
    id: 'dilemma:runaway_serfs',
    name: 'The Runaway Serfs',
    description: 'Bands of unfree peasants have fled their manors into the trackless wilderness.',
    trigger: (state) => state.totalPopulation > 0 && state.freeSerfs / state.totalPopulation < 0.15,
    choices: [
      {
        text: 'Hunt and drag fugitives back (+50 Free Serfs, +25 Unrest, costs 200 AP)',
        effects: [
          {
            type: 'instant_resource',
            resource: 'ap',
            amount: -200,
          },
          {
            type: 'instant_resource',
            resource: 'population',
            amount: 50,
          },
          {
            type: 'instant_resource',
            resource: 'unrest',
            amount: 25,
          },
        ],
      },
      {
        text: 'Grant them free tenures (-10% tax efficiency, +0.10 pop growth/s)',
        effects: [
          {
            type: 'stat_modifier',
            modifier: {
              source: 'dilemma:runaway_serfs',
              stat: 'tax_efficiency',
              op: 'addPct',
              value: -0.1,
            },
          },
          {
            type: 'stat_modifier',
            modifier: {
              source: 'dilemma:runaway_serfs',
              stat: 'pop_growth_flat',
              op: 'add',
              value: 0.1,
            },
          },
        ],
      },
    ],
  },

  'dilemma:wandering_troubadours': {
    id: 'dilemma:wandering_troubadours',
    name: 'The Wandering Troubadours',
    description:
      'Minstrels have arrived in the castle courtyard singing tales of your dynastic virtue.',
    trigger: (state) => state.deadline >= 3 && state.unrest < 35,
    choices: [
      {
        text: 'Shower the artists with gold (-200 AP, -15 Unrest, +1 Archive Point)',
        effects: [
          {
            type: 'instant_resource',
            resource: 'ap',
            amount: -200,
          },
          {
            type: 'instant_resource',
            resource: 'unrest',
            amount: -15,
          },
          {
            type: 'instant_resource',
            resource: 'archive_points',
            amount: 1,
          },
        ],
      },
      {
        text: 'Conscript their literate squires (+2 Scribes external)',
        effects: [
          {
            type: 'grant_units',
            unitId: 'scribe',
            count: 2,
            external: true,
          },
        ],
      },
    ],
  },

  'dilemma:false_relic_merchant': {
    id: 'dilemma:false_relic_merchant',
    name: 'The False Relic Merchant',
    description:
      'A Venetian trader is peddling the finger bone of an obscure saint to local abbeys.',
    trigger: (state) => (state.units.clergy ?? 0) + (state.units.prelate ?? 0) >= 5,
    choices: [
      {
        text: 'Purchase bone for cathedral abbey (-450 AP, -20 Unrest, +5% Prelate efficiency)',
        effects: [
          {
            type: 'instant_resource',
            resource: 'ap',
            amount: -450,
          },
          {
            type: 'instant_resource',
            resource: 'unrest',
            amount: -20,
          },
          {
            type: 'stat_modifier',
            modifier: {
              source: 'dilemma:false_relic_merchant',
              stat: 'unit_output',
              op: 'addPct',
              value: 0.05,
              scope: { unitId: 'prelate' },
            },
          },
        ],
      },
      {
        text: 'Expose the fraud and confiscate his goods (+150 AP seized, +10 Unrest)',
        effects: [
          {
            type: 'instant_resource',
            resource: 'ap',
            amount: 150,
          },
          {
            type: 'instant_resource',
            resource: 'unrest',
            amount: 10,
          },
        ],
      },
    ],
  },

  'dilemma:foreign_envoy_bribe': {
    id: 'dilemma:foreign_envoy_bribe',
    name: "The Foreign Envoy's Bribe",
    description:
      'An ambassador from a rival realm offers a heavy purse to look away from border skirmishes.',
    trigger: (state) => state.provinces >= 4,
    choices: [
      {
        text: 'Discreetly accept the tribute (+1,200 AP, +15 Unrest)',
        effects: [
          {
            type: 'instant_resource',
            resource: 'ap',
            amount: 1200,
          },
          {
            type: 'instant_resource',
            resource: 'unrest',
            amount: 15,
          },
        ],
      },
      {
        text: 'Denounce and expel the envoy (+1 Archive Point, -10 Unrest)',
        effects: [
          {
            type: 'instant_resource',
            resource: 'archive_points',
            amount: 1,
          },
          {
            type: 'instant_resource',
            resource: 'unrest',
            amount: -10,
          },
        ],
      },
    ],
  },

  'dilemma:rotting_grain_silos': {
    id: 'dilemma:rotting_grain_silos',
    name: 'The Rotting Grain Silos',
    description: 'Dampness has compromised our provincial granaries in the arable plains.',
    trigger: (state) => state.provinceBiomes.includes('farmlands'),
    choices: [
      {
        text: 'Ration the spoiled grain to commoners (-30 Pop, saves coin)',
        effects: [
          {
            type: 'instant_resource',
            resource: 'population',
            amount: -30,
          },
        ],
      },
      {
        text: 'Import emergency rye from the Baltics (-350 AP, population spared)',
        effects: [
          {
            type: 'instant_resource',
            resource: 'ap',
            amount: -350,
          },
        ],
      },
    ],
  },

  'dilemma:deserting_mercenaries': {
    id: 'dilemma:deserting_mercenaries',
    name: 'The Deserting Mercenaries',
    description: 'With treasury empty, our hired sellswords threaten mutiny.',
    trigger: (state) => state.ap <= 0,
    choices: [
      {
        text: 'Melt sacred reliquaries (+400 AP, +15 Unrest)',
        effects: [
          {
            type: 'instant_resource',
            resource: 'ap',
            amount: 400,
          },
          {
            type: 'instant_resource',
            resource: 'unrest',
            amount: 15,
          },
        ],
      },
      {
        text: 'Disband 10 soldiers and let them disperse (-10 Soldiers, restarts the bankruptcy countdown from its full grace)',
        effects: [
          {
            type: 'grant_units',
            unitId: 'soldier',
            count: -10,
          },
          { type: 'end_bankruptcy_countdown' },
        ],
      },
    ],
  },

  'dilemma:ghost_scribes': {
    id: 'dilemma:ghost_scribes',
    name: 'The Ghost Scribes',
    description:
      'An internal investigation reveals dozens of deceased scribes still receiving paychecks.',
    trigger: (state) => (state.units.scribe ?? 0) >= 20,
    choices: [
      {
        text: 'Claw back the embezzled coin (+500 AP, +15 Unrest)',
        effects: [
          {
            type: 'instant_resource',
            resource: 'ap',
            amount: 500,
          },
          {
            type: 'instant_resource',
            resource: 'unrest',
            amount: 15,
          },
        ],
      },
      {
        text: 'Reallocate to supervisors (+10% Supervisor output)',
        effects: [
          {
            type: 'stat_modifier',
            modifier: {
              source: 'dilemma:ghost_scribes',
              stat: 'unit_output',
              op: 'addPct',
              value: 0.1,
              scope: { unitId: 'supervisor' },
            },
          },
        ],
      },
    ],
  },

  'dilemma:inquisitor_demand': {
    id: 'dilemma:inquisitor_demand',
    name: "The Inquisitor's Demand",
    description: 'Papal inquisitors arrive demanding suspected heretics among the workforce.',
    trigger: (state) => state.unrest >= 70,
    choices: [
      {
        text: 'Hand over dissidents (-25 Pop, -30 Unrest)',
        effects: [
          {
            type: 'instant_resource',
            resource: 'population',
            amount: -25,
          },
          {
            type: 'instant_resource',
            resource: 'unrest',
            amount: -30,
          },
        ],
      },
      {
        text: 'Shield your loyal subjects (+10 Unrest, +2 Archive Points)',
        effects: [
          {
            type: 'instant_resource',
            resource: 'unrest',
            amount: 10,
          },
          {
            type: 'instant_resource',
            resource: 'archive_points',
            amount: 2,
          },
        ],
      },
    ],
  },

  'dilemma:auditor_nephew': {
    id: 'dilemma:auditor_nephew',
    name: "The Auditor's Nephew",
    description:
      'The Royal Auditor strongly hints that his inept nephew would make a fine provincial bailiff.',
    trigger: (state) => state.deadline >= 5,
    choices: [
      {
        text: 'Appoint the boy Crown Bailiff (+1 Bailiff, +15% paperwork)',
        effects: [
          {
            type: 'grant_units',
            unitId: 'supervisor',
            count: 1,
            external: true,
          },
          {
            type: 'stat_modifier',
            modifier: {
              source: 'dilemma:auditor_nephew',
              stat: 'paperwork_friction',
              op: 'addPct',
              value: 0.15,
            },
          },
        ],
      },
      {
        text: 'Politely refuse the nepotism (no Royal Pardon at the next audit, +1 Archive Point)',
        effects: [
          {
            type: 'rule_flag',
            flag: 'law_effect:pardon_forfeited',
          },
          {
            type: 'instant_resource',
            resource: 'archive_points',
            amount: 1,
          },
        ],
      },
    ],
  },

  'dilemma:smugglers_cove': {
    id: 'dilemma:smugglers_cove',
    name: "The Smugglers' Cove",
    description: 'A thriving contraband network has set up docks along the trade river.',
    trigger: (state) => state.provinceBiomes.includes('trade_hub'),
    choices: [
      {
        text: 'Take a silent 20% cut of their trade (+15% gross AP, +10 Unrest)',
        effects: [
          {
            type: 'stat_modifier',
            modifier: {
              source: 'dilemma:smugglers_cove',
              stat: 'gross_ap_rate',
              op: 'addPct',
              value: 0.15,
            },
          },
          {
            type: 'instant_resource',
            resource: 'unrest',
            amount: 10,
          },
        ],
      },
      {
        text: 'Hang the ringleaders (+15 Military Power, +1 Archive Point)',
        effects: [
          {
            type: 'stat_modifier',
            modifier: {
              source: 'dilemma:smugglers_cove',
              stat: 'military_power',
              op: 'add',
              value: 15,
            },
          },
          {
            type: 'instant_resource',
            resource: 'archive_points',
            amount: 1,
          },
        ],
      },
    ],
  },

  'dilemma:boundary_dispute': {
    id: 'dilemma:boundary_dispute',
    name: 'The Boundary Dispute',
    description: 'Two neighboring baronies feud over an unregistered forest parcel.',
    trigger: (state) => state.deadline >= 4,
    choices: [
      {
        text: 'Annex the disputed parcel directly for the Crown (+50 Housing, +10 Unrest)',
        effects: [
          {
            type: 'stat_modifier',
            modifier: {
              source: 'dilemma:boundary_dispute',
              stat: 'housing_capacity',
              op: 'add',
              value: 50,
            },
          },
          {
            type: 'instant_resource',
            resource: 'unrest',
            amount: 10,
          },
        ],
      },
      {
        text: 'Arbitrate in exchange for hefty legal fees (+400 AP, -5 Unrest)',
        effects: [
          {
            type: 'instant_resource',
            resource: 'ap',
            amount: 400,
          },
          {
            type: 'instant_resource',
            resource: 'unrest',
            amount: -5,
          },
        ],
      },
    ],
  },

  'dilemma:crowns_forced_loan': {
    id: 'dilemma:crowns_forced_loan',
    name: "The Crown's Forced Loan",
    description: 'The High Emperor demands a forced war loan from wealthy local vassals.',
    trigger: (state) => state.ap > 5000,
    choices: [
      {
        text: 'Pay the Imperial war subsidy (-2,000 AP, next quota -15%)',
        effects: [
          {
            type: 'instant_resource',
            resource: 'ap',
            amount: -2000,
          },
          {
            type: 'stat_modifier',
            modifier: {
              source: 'dilemma:crowns_forced_loan',
              stat: 'quota_requirement',
              op: 'mul',
              value: 0.85,
              untilNextAudit: true,
            },
          },
        ],
      },
      {
        text: 'Hide the treasury in secret church crypts (-15% gross AP for 30s)',
        effects: [
          {
            type: 'stat_modifier',
            modifier: {
              source: 'dilemma:crowns_forced_loan',
              stat: 'gross_ap_rate',
              op: 'mul',
              value: 0.85,
              durationSeconds: 30,
            },
          },
        ],
      },
    ],
  },

  'dilemma:mutinous_quartermaster': {
    id: 'dilemma:mutinous_quartermaster',
    name: 'The Mutinous Quartermaster',
    description:
      'Our chief supply officer has been caught selling army provisions to private merchants.',
    trigger: (state) => {
      let milCount = 0
      for (const [id, count] of Object.entries(state.units)) {
        if (['soldier', 'man_at_arms', 'sergeant', 'captain'].includes(id)) {
          milCount += count
        }
      }
      return milCount >= 25
    },
    choices: [
      {
        text: 'Hang him publicly from the garrison gallows (-1 Quartermaster, -10 Unrest)',
        effects: [
          {
            type: 'grant_units',
            unitId: 'quartermaster',
            count: -1,
          },
          {
            type: 'instant_resource',
            resource: 'unrest',
            amount: -10,
          },
        ],
      },
      {
        text: 'Enforce secret double bookkeeping (+300 AP seized, +5% military upkeep)',
        effects: [
          {
            type: 'instant_resource',
            resource: 'ap',
            amount: 300,
          },
          {
            type: 'stat_modifier',
            modifier: {
              source: 'dilemma:mutinous_quartermaster',
              stat: 'unit_upkeep',
              op: 'addPct',
              value: 0.05,
              scope: { order: 'military' },
            },
          },
        ],
      },
    ],
  },

  'dilemma:astrologer_comet': {
    id: 'dilemma:astrologer_comet',
    name: "The Astrologer's Comet",
    description:
      'A crimson comet blazes across the night sky, unsettling soldiers and clergymen alike.',
    trigger: (state) => state.deadline === 8 || state.deadline === 9,
    choices: [
      {
        text: 'Declare it an omen of glorious conquest (+10% Military Power, +10 Unrest)',
        effects: [
          {
            type: 'stat_modifier',
            modifier: {
              source: 'dilemma:astrologer_comet',
              stat: 'military_power',
              op: 'addPct',
              value: 0.1,
            },
          },
          {
            type: 'instant_resource',
            resource: 'unrest',
            amount: 10,
          },
        ],
      },
      {
        text: 'Fund realm-wide penitential prayers (-500 AP, -25 Unrest)',
        effects: [
          {
            type: 'instant_resource',
            resource: 'ap',
            amount: -500,
          },
          {
            type: 'instant_resource',
            resource: 'unrest',
            amount: -25,
          },
        ],
      },
    ],
  },
}
