/**
 * Plan V2_DIFFICULTY, Task 3: the reign carries its level through begin, play, save, resume and
 * conclusion, and lays down an old reign with its own level.
 *
 * @module __tests__/unit/reign_level.spec
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { startRun } from '@/core/archives'
import { generateCampaignTarget } from '@/core/battle'
import { dispatch } from '@/core/commands'
import { tick } from '@/core/engine'
import { triggerDefeat } from '@/core/mutations'
import { createInitialGameState } from '@/core/state'
import { applyArchivePerks } from '@/data/archives'
import { useArchivesStore } from '@/stores/archives'
import { useGameStore } from '@/stores/game'
import { useSettingsStore } from '@/stores/settings'
import { configForLevel } from '@/ui/levelConfig'
import { HISTORY_KEY, LEVEL_KEY, readKey, SAVE_KEY, SETTINGS_KEY, writeKey } from '@/ui/storage'

vi.mock('@/core/engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/engine')>()
  return { ...actual, tick: vi.fn<typeof actual.tick>(actual.tick) }
})
vi.mock('@/core/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/commands')>()
  return { ...actual, dispatch: vi.fn<typeof actual.dispatch>(actual.dispatch) }
})
vi.mock('@/core/battle', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/battle')>()
  return {
    ...actual,
    generateCampaignTarget: vi.fn<typeof actual.generateCampaignTarget>(
      actual.generateCampaignTarget,
    ),
  }
})

function freshStores() {
  setActivePinia(createPinia())
  const archives = useArchivesStore()
  archives.load()
  const settings = useSettingsStore()
  settings.load()
  return { archives, settings, game: useGameStore() }
}

/** A saved reign at `level`, then a fresh page as after a reload. */
function savedReign(level: 'ordinary' | 'stern' | 'tyrannical') {
  const first = freshStores()
  first.game.begin(42, level)
  first.game.save()
  return first.game.run!.runId
}

describe('Task 3: the reign carries its level', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(tick).mockClear()
    vi.mocked(dispatch).mockClear()
    vi.mocked(generateCampaignTarget).mockClear()
  })

  it('begins at the given level, holds its config and remembers it', async () => {
    const { game, settings } = freshStores()
    game.begin(42, 'tyrannical')
    expect(game.level).toBe('tyrannical')
    expect(game.config).toBe(configForLevel('tyrannical'))
    expect(settings.lastLevel).toBe('tyrannical')
    await nextTick()
    expect(JSON.parse(readKey(SETTINGS_KEY)!)).toMatchObject({ lastLevel: 'tyrannical' })
  })

  it('draws the first campaign target with the config of the level', () => {
    const { game, archives } = freshStores()
    game.begin(42, 'tyrannical')
    expect(vi.mocked(generateCampaignTarget).mock.calls[0]?.[1]).toBe(configForLevel('tyrannical'))
    const expected = createInitialGameState({ seed: 42 })
    applyArchivePerks(expected, archives.archive.investedPerks)
    generateCampaignTarget(expected, configForLevel('tyrannical'))
    expect({ ...game.run, runId: '' }).toEqual({ ...expected, runId: '' })
  })

  it('begins an ordinary reign exactly as startRun does', () => {
    const { game, archives } = freshStores()
    archives.archive.points = 50
    archives.invest('starting_treasury')
    game.begin(42, 'ordinary')
    expect({ ...game.run, runId: '' }).toEqual({ ...startRun(archives.archive, 42), runId: '' })
  })

  it('begins at the last level chosen when none is given', async () => {
    const first = freshStores()
    first.game.begin(1, 'stern')
    await nextTick()
    const second = freshStores()
    expect(second.settings.lastLevel).toBe('stern')
    second.game.begin(2)
    expect(second.game.level).toBe('stern')
  })

  it('hands the config of the level to every dispatch and tick', () => {
    const { game } = freshStores()
    game.begin(42, 'tyrannical')
    game.act({ type: 'STAMP_DOCUMENT' })
    game.advance(0.25)
    expect(vi.mocked(dispatch).mock.calls.at(-1)?.[2]).toBe(configForLevel('tyrannical'))
    expect(vi.mocked(tick).mock.calls.at(-1)?.[2]).toBe(configForLevel('tyrannical'))
  })

  it('shows the quotas of the level from the third audit', () => {
    const { game } = freshStores()
    game.begin(42, 'tyrannical')
    game.run!.deadline = 5
    game.act({ type: 'STAMP_DOCUMENT' })
    const required = game.quotas.map((quota) => quota.required)
    const row = configForLevel('tyrannical').quotas[4]!
    expect(required).toEqual([row.apRate, row.pop, row.military])
    expect(row.pop).toBeGreaterThan(configForLevel('ordinary').quotas[4]!.pop)
  })

  it('writes the level beside the save and resumes it after a reload', () => {
    const runId = savedReign('tyrannical')
    expect(JSON.parse(readKey(LEVEL_KEY)!)).toEqual({ runId, level: 'tyrannical' })
    const { game } = freshStores()
    expect(game.resume()).toBe(true)
    expect(game.level).toBe('tyrannical')
    expect(game.config).toBe(configForLevel('tyrannical'))
  })

  it.each([
    ['missing', null],
    ['unreadable', '{'],
    ['for another reign', JSON.stringify({ runId: 'another', level: 'tyrannical' })],
    ['an unknown level', null],
  ])('resumes as ordinary when the level key is %s', (_case, value) => {
    const runId = savedReign('tyrannical')
    const stored = _case === 'an unknown level' ? JSON.stringify({ runId, level: 'easy' }) : value
    writeKey(LEVEL_KEY, stored)
    const { game } = freshStores()
    expect(game.resume()).toBe(true)
    expect(game.level).toBe('ordinary')
  })

  it('lays down a saved stern reign with its own level when an ordinary one begins', () => {
    savedReign('stern')
    const { game, archives } = freshStores()
    game.begin(7, 'ordinary')
    expect(archives.history).toHaveLength(1)
    expect(archives.history[0]?.level).toBe('stern')
    expect(archives.history[0]?.outcome).toBe('abandoned')
    expect(readKey(SAVE_KEY)).toBeNull()
    expect(readKey(LEVEL_KEY)).toBeNull()
    expect(game.level).toBe('ordinary')
  })

  it('records the level of a defeat, an abandon and a restart', () => {
    const { game, archives } = freshStores()
    game.begin(42, 'stern')
    triggerDefeat(game.run!, 'quota_failure')
    game.advance(0.25)
    game.begin(43, 'tyrannical')
    game.abandon()
    game.begin(44, 'stern')
    game.restart()
    expect(archives.history.map((record) => record.level)).toEqual(['stern', 'tyrannical', 'stern'])
    expect(game.level).toBe('stern')
  })

  it('records the level of a victory', () => {
    const { game, archives } = freshStores()
    game.begin(42, 'tyrannical')
    game.run!.isVictory = true
    game.run!.phase = 'RUN_VICTORY'
    game.act({ type: 'STAMP_DOCUMENT' })
    expect(archives.history.at(-1)?.level).toBe('tyrannical')
  })

  it('keeps the history across a reload with every level', () => {
    const first = freshStores()
    first.game.begin(1, 'tyrannical')
    first.game.abandon()
    expect(JSON.parse(readKey(HISTORY_KEY)!).version).toBe(2)
    const second = freshStores()
    expect(second.archives.history[0]?.level).toBe('tyrannical')
  })

  it('exposes no way to change the level of a reign begun', () => {
    const { game, settings } = freshStores()
    game.begin(42, 'stern')
    expect(Object.getOwnPropertyDescriptor(game, 'setLevel')).toBeUndefined()
    settings.dreadOverride = 'rotting'
    settings.lastLevel = 'tyrannical'
    expect(game.level).toBe('stern')
    expect(game.config).toBe(configForLevel('stern'))
  })
})
