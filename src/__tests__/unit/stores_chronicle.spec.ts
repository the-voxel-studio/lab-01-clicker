/**
 * Chronicle store: entries kept with the reign, its save and its audits.
 *
 * @module __tests__/unit/stores_chronicle.spec
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useArchivesStore } from '@/stores/archives'
import { useChronicleStore } from '@/stores/chronicle'
import { useGameStore } from '@/stores/game'
import { useSettingsStore } from '@/stores/settings'
import { CHRONICLE_KEY, writeKey } from '@/ui/storage'

function freshStores() {
  setActivePinia(createPinia())
  useArchivesStore().load()
  useSettingsStore().load()
  return { game: useGameStore(), chronicle: useChronicleStore() }
}

const texts = (chronicle: ReturnType<typeof useChronicleStore>) =>
  chronicle.entries.map((e) => e.text)

describe('Task 3: chronicle store', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('opens the chronicle with the coronation', () => {
    const { game, chronicle } = freshStores()
    game.begin(42)
    expect(chronicle.entries).toHaveLength(1)
    expect(chronicle.entries[0]?.deadline).toBe(0)
    expect(chronicle.entries[0]?.text).toMatch(/^You are crowned before a crowd of/)
  })

  it('writes the player purchases, newest first', () => {
    const { game, chronicle } = freshStores()
    game.begin(42)
    expect(game.act({ type: 'BUY_UNIT', unitId: 'peasant', count: 1 }).success).toBe(true)
    expect(chronicle.entries[0]?.text).toBe('You hired your first peasant.')
  })

  it('keeps the chronicle with the saved reign', () => {
    const first = freshStores()
    first.game.begin(42)
    first.game.act({ type: 'BUY_UNIT', unitId: 'peasant', count: 1 })
    first.game.save()
    const saved = texts(first.chronicle)

    const second = freshStores()
    expect(second.game.resume()).toBe(true)
    expect(texts(second.chronicle)).toEqual(saved)
  })

  it('starts a fresh chronicle for a new reign', () => {
    const first = freshStores()
    first.game.begin(42)
    first.game.act({ type: 'BUY_UNIT', unitId: 'peasant', count: 1 })
    first.game.save()

    const second = freshStores()
    second.game.resume()
    second.game.begin(7)
    expect(second.chronicle.entries).toHaveLength(1)
    expect(second.chronicle.entries[0]?.deadline).toBe(0)
  })

  it('ignores a stored chronicle of another reign', () => {
    const first = freshStores()
    first.game.begin(42)
    first.game.act({ type: 'BUY_UNIT', unitId: 'peasant', count: 1 })
    first.game.save()
    writeKey(CHRONICLE_KEY, JSON.stringify({ version: 1, runId: 'another', entries: [] }))

    const second = freshStores()
    expect(second.game.resume()).toBe(true)
    expect(second.chronicle.entries).toHaveLength(1)
    expect(second.chronicle.entries[0]?.deadline).toBe(0)
  })

  it('groups the entries by audit with their titles', () => {
    const { game, chronicle } = freshStores()
    game.begin(42)
    for (let t = 0; t < 100; t += 0.25) game.advance(0.25)
    expect(game.act({ type: 'SUBMIT_AUDIT' }).success).toBe(true)
    const titles = chronicle.byAudit.map((group) => group.title)
    expect(titles[titles.length - 1]).toBe('Coronation')
    expect(titles).toContainEqual(expect.stringMatching(/^First audit, (passed|pardoned|failed)$/))
    expect(titles[0]).toMatch(/^(First|Second) audit/)
  })
})
