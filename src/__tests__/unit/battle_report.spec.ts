/**
 * The missive after a fight: its figures, its opening and its return from the chronicle.
 *
 * @module __tests__/unit/battle_report.spec
 */

import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '@/App.vue'
import ChroniclePage from '@/components/game/ChroniclePage.vue'
import StableFigure from '@/components/game/ledger/StableFigure.vue'
import { dispatch } from '@/core/commands'
import { createInitialGameState } from '@/core/state'
import type { CampaignTarget, GameState } from '@/core/types'
import { useArchivesStore } from '@/stores/archives'
import { useChronicleStore } from '@/stores/chronicle'
import { useGameStore } from '@/stores/game'
import { useNavStore } from '@/stores/nav'
import { useSettingsStore } from '@/stores/settings'
import { battleReport } from '@/ui/report'

const TARGET: CampaignTarget = {
  power: 40,
  uncertaintyMargin: 0.2,
  perceivedMin: 30,
  perceivedMax: 50,
  biome: 'farmlands',
  lootType: 'ap',
  factionId: 'outlaws',
  isFalseLedger: false,
  isAmbush: false,
}

function atWar(soldiers: number): GameState {
  const state = createInitialGameState({ seed: 5 })
  state.phase = 'ACTIVE_CYCLE'
  state.deadline = 3
  state.units.soldier = soldiers
  state.totalPopulation += soldiers
  state.currentTarget = { ...TARGET }
  return state
}

function fought(state: GameState) {
  const before = structuredClone(state)
  const command = { type: 'LAUNCH_ATTACK' } as const
  const result = dispatch(state, command)
  const report = battleReport(command, before, state)
  if (!report) throw new Error('expected a report')
  return { report, before, result }
}

function line(report: NonNullable<ReturnType<typeof battleReport>>, label: string): string {
  return report.lines.find((item) => item.label === label)?.figure ?? ''
}

function begin() {
  const pinia = createPinia()
  setActivePinia(pinia)
  useArchivesStore().load()
  const settings = useSettingsStore()
  settings.load()
  settings.reducedMotion = true
  const game = useGameStore()
  game.begin(7)
  const nav = useNavStore()
  nav.go('run')
  const state = game.run!
  state.units.soldier = 200
  state.totalPopulation += 200
  state.currentTarget = { ...TARGET }
  return { pinia, game, nav, state }
}

describe('Battle report', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('tells a won campaign in force, losses and gains', () => {
    const { report, before } = fought(atWar(300))
    expect(report.won).toBe(true)
    expect(report.title).toBe('The land is yours.')
    expect(line(report, 'Your force')).toMatch(/^\d/)
    expect(line(report, 'Their force')).toBe('40')
    expect(line(report, 'Provinces')).toBe(`+1, now ${before.provinces + 1}`)
    expect(line(report, 'Soldiers lost')).toMatch(/^\d+ of 300$/)
    expect(line(report, 'Force left')).toMatch(/^\d/)
    expect(line(report, 'Loot')).toMatch(/AP$/)
  })

  it('tells a lost campaign plainly', () => {
    const { report } = fought(atWar(1))
    expect(report.won).toBe(false)
    expect(report.title).toBe('Your host was beaten.')
    expect(line(report, 'Provinces')).toBe('none')
    expect(line(report, 'Unrest')).toMatch(/^\+/)
  })

  it('writes no report for a command that is no fight', () => {
    const state = atWar(1)
    expect(battleReport({ type: 'STAMP_DOCUMENT' }, state, state)).toBeNull()
  })

  it('opens by itself after a campaign and stops the clock until it is closed', async () => {
    const { pinia, game, nav, state } = begin()
    nav.go('fortune')
    const app = mount(App, { global: { plugins: [pinia] } })
    await flushPromises()
    await app.get('[data-attack]').trigger('click')
    await flushPromises()
    expect(app.find('[data-battle-report]').exists()).toBe(true)
    const clock = state.deadlineTimeSeconds
    game.advance(1)
    expect(state.deadlineTimeSeconds).toBe(clock)
    await app.get('[data-report-close]').trigger('click')
    await flushPromises()
    expect(app.find('[data-battle-report]').exists()).toBe(false)
    game.advance(1)
    expect(state.deadlineTimeSeconds).toBeGreaterThan(clock)
  })

  it('shows the same report again from the chronicle', async () => {
    const { pinia, game } = begin()
    game.act({ type: 'LAUNCH_ATTACK' })
    const report = game.report
    game.closeReport()
    expect(useChronicleStore().entries.find((entry) => entry.report)?.report).toEqual(report)
    const page = mount(ChroniclePage, { global: { plugins: [pinia] } })
    await page.get('[data-entry-report]').trigger('click')
    expect(game.report).toEqual(report)
  })
})

describe('Stable figures', () => {
  it('gives each digit a cell of its own and keeps the text', () => {
    const figure = mount(StableFigure, { props: { value: '1,234.5k' } })
    expect(figure.text()).toBe('1,234.5k')
    expect(figure.findAll('.digit-cell')).toHaveLength(5)
  })
})
