/**
 * Game store: the bridge between the frozen engine and the interface.
 *
 * @module __tests__/unit/stores_game.spec
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { startRun } from '@/core/archives'
import { triggerDefeat } from '@/core/mutations'
import { useArchivesStore } from '@/stores/archives'
import { useGameStore } from '@/stores/game'
import { useNavStore } from '@/stores/nav'
import { useSettingsStore } from '@/stores/settings'
import { readKey, SAVE_KEY, writeKey } from '@/ui/storage'

/** Fresh pinia with the archive and settings loaded, as the app does at start. */
function freshStores() {
  setActivePinia(createPinia())
  const archives = useArchivesStore()
  archives.load()
  const settings = useSettingsStore()
  settings.load()
  return { archives, settings, game: useGameStore(), nav: useNavStore() }
}

/** Advances by `seconds` in frames of 0.25 s, as the clamped frame loop would. */
function play(game: ReturnType<typeof useGameStore>, seconds: number) {
  for (let t = 0; t < seconds; t += 0.25) game.advance(0.25)
}

describe('Task 6: game store', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('begins a run with the given seed in the active cycle', () => {
    const { game } = freshStores()
    game.begin(42)
    expect(game.phase).toBe('ACTIVE_CYCLE')
    expect(game.run?.seed).toBe(42)
  })

  it('applies the invested perks when a run begins', () => {
    const { archives, game } = freshStores()
    archives.archive.points = 50
    expect(archives.invest('starting_treasury').success).toBe(true)
    game.begin(42)
    expect(game.run?.ap).toBe(startRun(archives.archive, 42).ap)
    expect(game.run?.ap).not.toBe(
      startRun({ points: 0, investedPerks: [], unlockedFeats: [] }, 42).ap,
    )
  })

  it('raises the coffer when the seal is stamped', () => {
    const { game } = freshStores()
    game.begin(42)
    const before = game.coffer
    expect(game.act({ type: 'STAMP_DOCUMENT' }).success).toBe(true)
    expect(game.coffer).toBeGreaterThan(before)
  })

  it('counts the deadline seconds down as time advances', () => {
    const { game } = freshStores()
    game.begin(42)
    expect(game.secondsLeft).toBe(100)
    game.advance(1)
    expect(game.secondsLeft).toBe(99)
  })

  it('keeps the last AP rate through frames that run no fixed step', () => {
    const { game } = freshStores()
    game.begin(42)
    game.advance(1)
    const rate = game.netApPerSecond
    expect(rate).not.toBe(0)
    game.advance(0.016)
    expect(game.netApPerSecond).toBe(rate)
  })

  it('saves when a deadline completes', () => {
    const { game } = freshStores()
    game.begin(42)
    play(game, 100)
    expect(game.run?.deadlineTimeSeconds === 0 || game.phase !== 'ACTIVE_CYCLE').toBe(true)
    expect(readKey(SAVE_KEY)).not.toBeNull()
    expect(game.hasSave).toBe(true)
  })

  it('resumes a saved run with the same seed and deadline', () => {
    const first = freshStores()
    first.game.begin(42)
    first.game.save()
    const saved = { seed: first.game.run?.seed, deadline: first.game.run?.deadline }

    const second = freshStores()
    expect(second.game.resume()).toBe(true)
    expect(second.game.run?.seed).toBe(saved.seed)
    expect(second.game.run?.deadline).toBe(saved.deadline)
  })

  it('lays down a saved reign when a new one begins over it', () => {
    const first = freshStores()
    first.game.begin(42)
    first.game.save()

    const second = freshStores()
    second.game.begin(7)
    expect(second.archives.history).toHaveLength(1)
    expect(second.archives.history[0]?.seed).toBe(42)
    expect(second.archives.history[0]?.outcome).toBe('abandoned')
    expect(readKey(SAVE_KEY)).toBeNull()
    expect(second.game.hasSave).toBe(false)
    expect(second.game.run?.seed).toBe(7)
  })

  it('refuses a corrupt save', () => {
    writeKey(SAVE_KEY, 'not a save')
    const { game } = freshStores()
    expect(game.resume()).toBe(false)
    expect(game.run).toBeNull()
  })

  it('keeps the archive of record when resuming an older save', () => {
    const first = freshStores()
    first.game.begin(42)
    first.game.save()
    first.archives.archive.points = 50
    first.archives.invest('starting_treasury')

    const second = freshStores()
    expect(second.game.resume()).toBe(true)
    expect(second.archives.archive.investedPerks).toContain('starting_treasury')
  })

  it('concludes a defeat once, clears the save and shows the end screen', () => {
    const { archives, game, nav } = freshStores()
    game.begin(42)
    game.save()
    const run = game.run
    if (!run) throw new Error('run expected')
    triggerDefeat(run, 'revolution')
    game.advance(0.05)
    game.advance(0.05)
    expect(archives.history).toHaveLength(1)
    expect(archives.history[0]?.outcome).toBe('revolution')
    expect(game.lastConclusion?.record.outcome).toBe('revolution')
    expect(readKey(SAVE_KEY)).toBeNull()
    expect(game.hasSave).toBe(false)
    expect(nav.screen).toBe('fate')
  })

  it('ignores double speed before fast forward unlocks', () => {
    const { game, settings } = freshStores()
    game.begin(42)
    settings.doubleSpeed = true
    game.advance(1)
    expect(game.secondsLeft).toBe(99)
  })

  it('doubles the step once fast forward is unlocked', () => {
    const { game, settings } = freshStores()
    game.begin(42)
    settings.doubleSpeed = true
    const run = game.run
    if (!run) throw new Error('run expected')
    run.deadline = 5
    game.advance(1)
    expect(game.secondsLeft).toBe(98)
  })

  it('records an abandoned reign', () => {
    const { archives, game, nav } = freshStores()
    game.begin(42)
    game.abandon()
    expect(archives.history).toHaveLength(1)
    expect(archives.history[0]?.outcome).toBe('abandoned')
    expect(nav.screen).toBe('end')
  })

  it('restarts mid reign with one abandoned record and a fresh run on the same seed', () => {
    const { archives, game, nav } = freshStores()
    nav.go('run')
    game.begin(42)
    play(game, 30)
    game.restart()
    expect(archives.history).toHaveLength(1)
    expect(archives.history[0]?.outcome).toBe('abandoned')
    expect(game.run?.seed).toBe(42)
    expect(game.run?.deadline).toBe(1)
    expect(game.secondsLeft).toBe(100)
    expect(nav.screen).toBe('run')
  })

  it('reads a corrupt save as no save and removes it', () => {
    writeKey(SAVE_KEY, 'not a save')
    const { game } = freshStores()
    expect(game.savedDeadline).toBeNull()
    expect(game.hasSave).toBe(false)
    expect(readKey(SAVE_KEY)).toBeNull()
  })

  it('knows the deadline of the save and of the last save of the reign', () => {
    const { game } = freshStores()
    game.begin(42)
    expect(game.lastSavedDeadline).toBeNull()
    game.save()
    expect(game.savedDeadline).toBe(1)
    expect(game.lastSavedDeadline).toBe(1)
  })

  it('does not refresh the getters when a frame runs nothing', () => {
    const { game } = freshStores()
    game.begin(42)
    game.act({ type: 'SET_PAUSED', paused: true })
    const before = game.revision
    game.advance(0.01)
    expect(game.revision).toBe(before)
  })

  it('marks an abandoned reign as over', () => {
    const { game } = freshStores()
    game.begin(42)
    expect(game.isOver).toBe(false)
    game.abandon()
    expect(game.isOver).toBe(true)
  })

  it('turns double speed off for every new, resumed or restarted reign', () => {
    const { game, settings } = freshStores()
    settings.doubleSpeed = true
    game.begin(42)
    expect(settings.doubleSpeed).toBe(false)
    game.save()
    settings.doubleSpeed = true
    game.restart()
    expect(settings.doubleSpeed).toBe(false)
    game.save()
    settings.doubleSpeed = true
    expect(game.resume()).toBe(true)
    expect(settings.doubleSpeed).toBe(false)
  })

  it('exposes the three quotas against their targets', () => {
    const { game } = freshStores()
    game.begin(42)
    expect(game.quotas.map((q) => q.axis)).toEqual(['ap', 'pop', 'military'])
    for (const quota of game.quotas) expect(quota.met).toBe(quota.current >= quota.required)
  })
})
