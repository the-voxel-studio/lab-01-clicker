/**
 * Plan V2_LEDGER_LANGUAGE Task 2: no text below the floor on any screen.
 *
 * @module __tests__/unit/ledger_type_floor.spec
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = 'src/components/game'
/** The labels of the six buttons of the order bar: they share 430 px at most. */
const ALLOWED = new Set(['src/components/game/run/ActionBar.vue'])
const FLOOR = 16

function vueFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return vueFiles(path)
    return entry.name.endsWith('.vue') ? [path] : []
  })
}

function offenders(file: string): string[] {
  const source = readFileSync(file, 'utf8')
  const named = source.match(/\btext-(xs|sm)\b/g) ?? []
  const sized = [...source.matchAll(/\btext-\[(\d+)px\]/g)].filter(
    (match) => Number(match[1]) < FLOOR,
  )
  const scoped = [...source.matchAll(/font-size: (\d+)px/g)].filter(
    (match) => Number(match[1]) < FLOOR,
  )
  return [...named, ...sized.map((match) => match[0]), ...scoped.map((match) => match[0])]
}

describe('Task 2: type floor on every screen', () => {
  it('keeps every class at 16 px or more outside the order bar labels', () => {
    const found = vueFiles(ROOT)
      .filter((file) => !ALLOWED.has(file))
      .flatMap((file) => offenders(file).map((text) => `${file}: ${text}`))
    expect(found).toEqual([])
  })
})
