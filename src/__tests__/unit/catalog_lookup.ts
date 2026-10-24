/**
 * Throwing catalog lookups shared by the unit specs, so a missing id fails loudly instead of
 * being hidden behind a non-null assertion.
 *
 * @module __tests__/unit/catalog_lookup
 */

import { LAWS_DATA, type LawDef } from '@/data/laws'
import { DILEMMAS_DATA, type DilemmaDef } from '@/data/dilemmas'
import type { Effect } from '@/core/types'

/** Law definition of an id, failing loudly when the catalog has none. */
export function lawOf(lawId: string): LawDef {
  const law = LAWS_DATA[lawId]
  if (!law) throw new Error(`unknown law ${lawId}`)
  return law
}

/** Dilemma definition of an id, failing loudly when the catalog has none. */
export function dilemmaOf(dilemmaId: string): DilemmaDef {
  const dilemma = DILEMMAS_DATA[dilemmaId]
  if (!dilemma) throw new Error(`unknown dilemma ${dilemmaId}`)
  return dilemma
}

/** Effect of a law at an index, failing loudly when the law has fewer effects. */
export function effectOf(law: LawDef, index: number): Effect {
  const effect = law.effects[index]
  if (!effect) throw new Error(`law ${law.id} has no effect ${index}`)
  return effect
}
