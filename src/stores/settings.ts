/**
 * Player settings store, persisted as JSON; double speed (one reign's choice) and the dread
 * override (a dev only tuning aid) are never persisted.
 *
 * @module stores/settings
 */

import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { isDifficultyLevel, type DifficultyLevel } from '@/data/levels'
import type { DreadBand } from '@/ui/dread'
import { readKey, SETTINGS_KEY, writeKey } from '@/ui/storage'

interface StoredSettings {
  music: boolean
  sfx: boolean
  reducedMotion: boolean
  lastLevel: DifficultyLevel
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function parseSettings(raw: string | null): Partial<StoredSettings> {
  if (raw === null) return {}
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return {}
    const result: Partial<StoredSettings> = {}
    for (const key of ['music', 'sfx', 'reducedMotion'] as const) {
      const flag: unknown = Reflect.get(value, key)
      if (typeof flag === 'boolean') result[key] = flag
    }
    const level: unknown = Reflect.get(value, 'lastLevel')
    if (isDifficultyLevel(level)) result.lastLevel = level
    return result
  } catch {
    return {}
  }
}

/**
 * Music, sound effects, reduced motion, the last level chosen and double speed, plus the dev dread
 * override.
 */
export const useSettingsStore = defineStore('settings', () => {
  const music = ref(true)
  const sfx = ref(true)
  const reducedMotion = ref(prefersReducedMotion())
  /** Level chosen for the last reign begun, offered first at the next seal. */
  const lastLevel = ref<DifficultyLevel>('ordinary')
  /** Double speed of the reign in progress; never persisted, reset by every new reign. */
  const doubleSpeed = ref(false)
  /** Forces a dread band in dev builds, for tuning and screenshots; never persisted. */
  const dreadOverride = ref<DreadBand | null>(null)

  /** Reads the stored settings; a missing or invalid value keeps its default. */
  function load(): void {
    const stored = parseSettings(readKey(SETTINGS_KEY))
    music.value = stored.music ?? true
    sfx.value = stored.sfx ?? true
    reducedMotion.value = stored.reducedMotion ?? prefersReducedMotion()
    lastLevel.value = stored.lastLevel ?? 'ordinary'
  }

  watch([music, sfx, reducedMotion, lastLevel], () => {
    const stored: StoredSettings = {
      music: music.value,
      sfx: sfx.value,
      reducedMotion: reducedMotion.value,
      lastLevel: lastLevel.value,
    }
    writeKey(SETTINGS_KEY, JSON.stringify(stored))
  })

  return { music, sfx, reducedMotion, lastLevel, doubleSpeed, dreadOverride, load }
})
