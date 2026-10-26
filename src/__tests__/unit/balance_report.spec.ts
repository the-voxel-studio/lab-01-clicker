/**
 * Unit tests for the quota solver helpers of the balance report script (GAME_RULES §21): `quantile`,
 * `roundAxis` and `quotaTable`.
 *
 * @module __tests__/unit/balance_report.spec
 */

import { describe, it, expect } from 'vitest'
import {
  quantile,
  quotaTable,
  roundAxis,
  type AxisSpread,
  type Calibration,
  type DeadlineCalibration,
} from '../../../scripts/generate-balance-report'

/**
 * Builds a spread whose every quantile equals the median.
 *
 * @param median - Median of the spread.
 * @returns The flat spread.
 */
function flatSpread(median: number): AxisSpread {
  return { p10: median, p25: median, median, p75: median, p90: median }
}

/**
 * Builds the calibration of one deadline with one median per axis.
 *
 * @param deadline - Deadline number.
 * @param medians - Median AP rate, population and military power.
 * @returns The deadline calibration.
 */
function deadlineOf(deadline: number, medians: [number, number, number]): DeadlineCalibration {
  return {
    deadline,
    runs: 200,
    apRate: flatSpread(medians[0]),
    pop: flatSpread(medians[1]),
    military: flatSpread(medians[2]),
  }
}

describe('Balance report helpers (GAME_RULES §21)', () => {
  describe('quantile', () => {
    it('returns the middle value of an odd length list as the median', () => {
      expect(quantile([1, 5, 9], 0.5)).toBe(5)
      expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3)
    })

    it('returns the mean of the two middle values of an even length list', () => {
      expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5)
      expect(quantile([10, 20], 0.5)).toBe(15)
    })

    it('returns the first value at share 0 and the last value at share 1', () => {
      expect(quantile([3, 7, 11, 20], 0)).toBe(3)
      expect(quantile([3, 7, 11, 20], 1)).toBe(20)
      expect(quantile([4], 0)).toBe(4)
      expect(quantile([4], 1)).toBe(4)
    })

    it('interpolates linearly between the two closest ranks', () => {
      expect(quantile([0, 10, 20, 30, 40], 0.1)).toBeCloseTo(4)
      expect(quantile([0, 10, 20, 30, 40], 0.75)).toBeCloseTo(30)
    })
  })

  describe('roundAxis', () => {
    it('rounds each value to a whole number', () => {
      expect(roundAxis([10.4, 20.6, 30.5], 'pop')).toEqual([10, 21, 31])
    })

    it('forces the axis strictly increasing', () => {
      const rounded = roundAxis([10, 10, 9, 10.2, 30], 'military')
      expect(rounded).toEqual([10, 11, 12, 13, 30])
      for (let index = 1; index < rounded.length; index++) {
        expect(rounded[index]!).toBeGreaterThan(rounded[index - 1]!)
      }
    })

    it('keeps one decimal on the AP rate of deadline 1 when it would round to 0', () => {
      expect(roundAxis([0.34, 5], 'apRate')).toEqual([0.3, 5])
      expect(roundAxis([0.01, 5], 'apRate')).toEqual([0.1, 5])
      expect(roundAxis([0.34, 5], 'pop')).toEqual([0, 5])
    })

    it('keeps the strictly increasing rule after a decimal first value', () => {
      expect(roundAxis([0.3, 0.4, 0.5], 'apRate')).toEqual([0.3, 1, 2])
    })
  })

  describe('quotaTable', () => {
    const calibration: Calibration = {
      deadlines: [
        deadlineOf(1, [10, 100, 20]),
        deadlineOf(2, [20, 200, 40]),
        deadlineOf(3, [20, 300, 40]),
      ],
      defeats: {},
    }

    it('multiplies the median of each deadline by c', () => {
      const table = quotaTable(0.5, calibration)
      expect(table.map((row) => row.deadline)).toEqual([1, 2, 3])
      expect(table[0]).toEqual({ deadline: 1, apRate: 5, pop: 50, military: 10 })
      expect(table[1]).toEqual({ deadline: 2, apRate: 10, pop: 100, military: 20 })
    })

    it('is strictly increasing on every axis, even when the medians are flat', () => {
      const table = quotaTable(0.5, calibration)
      for (let index = 1; index < table.length; index++) {
        expect(table[index]!.apRate).toBeGreaterThan(table[index - 1]!.apRate)
        expect(table[index]!.pop).toBeGreaterThan(table[index - 1]!.pop)
        expect(table[index]!.military).toBeGreaterThan(table[index - 1]!.military)
      }
      expect(table[2]!.apRate).toBe(11)
    })

    it('refuses a non finite median instead of writing it into the table', () => {
      const broken: Calibration = { deadlines: [deadlineOf(1, [Number.NaN, 1, 1])], defeats: {} }
      expect(() => quotaTable(1, broken)).toThrow('not finite')
    })
  })
})
