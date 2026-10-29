/**
 * Storage helpers and the archive, settings and navigation stores.
 *
 * @module __tests__/unit/stores_meta.spec
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createArchiveData } from '@/core/archives'
import { triggerDefeat } from '@/core/mutations'
import { createInitialGameState } from '@/core/state'
import { FEATS_DATA } from '@/data/feats'
import { useArchivesStore } from '@/stores/archives'
import { useNavStore } from '@/stores/nav'
import { useSettingsStore } from '@/stores/settings'
import { readKey, writeKey } from '@/ui/storage'

/** A run lost at the first audit without recruiting a soldier: it unseals no feat. */
function defeatedRun(archivePoints = 2) {
  const state = createInitialGameState({ archivePoints })
  triggerDefeat(state, 'quota_failure')
  return state
}

describe('Task 4: storage and the archive, settings and navigation stores', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('loads the default archive and an empty history when nothing is stored', () => {
    const archives = useArchivesStore()
    archives.load()
    expect(archives.archive).toEqual(createArchiveData())
    expect(archives.history).toEqual([])
  })

  it('loads the default archive when the stored one is corrupt', () => {
    localStorage.setItem('grand_audit_archive', '{"points":-4}')
    const archives = useArchivesStore()
    archives.load()
    expect(archives.archive).toEqual(createArchiveData())
  })

  it('concludes a defeated run once: one record, its points banked', () => {
    const archives = useArchivesStore()
    archives.load()
    const run = defeatedRun()
    const first = archives.conclude(run)
    expect(first.record.outcome).toBe('quota_failure')
    const featPoints = first.conclusion.newFeats.reduce(
      (sum, id) => sum + FEATS_DATA[id].rewardArchivePoints,
      0,
    )
    expect(archives.archive.points).toBe(2 + featPoints)
    archives.conclude(run)
    expect(archives.history).toHaveLength(1)
    expect(archives.archive.points).toBe(2 + featPoints)
  })

  it('keeps the archive and the history across a reload', () => {
    const archives = useArchivesStore()
    archives.load()
    archives.conclude(defeatedRun(5))
    const saved = { archive: archives.archive, history: archives.history }

    setActivePinia(createPinia())
    const reloaded = useArchivesStore()
    reloaded.load()
    expect(reloaded.archive).toEqual(saved.archive)
    expect(reloaded.history).toEqual(saved.history)
  })

  it('round trips the settings and never persists the dread override', async () => {
    const settings = useSettingsStore()
    settings.load()
    settings.music = false
    settings.sfx = false
    settings.reducedMotion = true
    settings.doubleSpeed = true
    settings.dreadOverride = 'rotting'
    await Promise.resolve()

    setActivePinia(createPinia())
    const reloaded = useSettingsStore()
    reloaded.load()
    expect(reloaded.music).toBe(false)
    expect(reloaded.sfx).toBe(false)
    expect(reloaded.reducedMotion).toBe(true)
    expect(reloaded.doubleSpeed).toBe(true)
    expect(reloaded.dreadOverride).toBeNull()
  })

  it('does not throw when storage refuses a write or a read', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(() => writeKey('grand_audit_settings', '{}')).not.toThrow()
    expect(readKey('grand_audit_settings')).toBeNull()
  })

  it('removes a key when null is written', () => {
    writeKey('grand_audit_save', 'abc')
    expect(readKey('grand_audit_save')).toBe('abc')
    writeKey('grand_audit_save', null)
    expect(readKey('grand_audit_save')).toBeNull()
  })

  it('starts in the hall and moves between screens', () => {
    const nav = useNavStore()
    expect(nav.screen).toBe('hall')
    nav.go('run')
    expect(nav.screen).toBe('run')
    expect(nav.menuOpen).toBe(false)
  })
})
