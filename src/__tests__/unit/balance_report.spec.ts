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
  renderReport,
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

    it('keeps one decimal on an AP rate of deadline 1 below 1', () => {
      expect(roundAxis([0.34, 5], 'apRate')).toEqual([0.3, 5])
      expect(roundAxis([0.01, 5], 'apRate')).toEqual([0.1, 5])
      expect(roundAxis([0.34, 5], 'pop')).toEqual([0, 5])
      expect(roundAxis([0.7, 5], 'apRate')).toEqual([0.7, 5])
    })

    it('keeps the strictly increasing rule after a decimal first value', () => {
      expect(roundAxis([0.3, 0.4, 0.5], 'apRate')).toEqual([0.3, 1, 2])
    })
  })

  describe('quotaTable', () => {
    const calibration: Calibration = {
      deadlines: [
        deadlineOf(1, [10.7, 100.9, 20.2]),
        deadlineOf(2, [20, 200, 40]),
        deadlineOf(3, [40, 400, 80]),
        deadlineOf(4, [80, 800, 160]),
        deadlineOf(5, [80, 800, 160]),
      ],
      defeats: {},
    }

    it('bridges deadline 4 between its neighbours, so the curve has no step', () => {
      const table = quotaTable(1, calibration)
      expect(table[3]?.pop).toBe(Math.round(Math.sqrt(380 * 800)))
    })

    it('keeps deadline 1 at the floor of its medians whatever c', () => {
      expect(quotaTable(1, calibration)[0]).toEqual({
        deadline: 1,
        apRate: 10,
        pop: 100,
        military: 20,
      })
      expect(quotaTable(2, calibration)[0]).toEqual({
        deadline: 1,
        apRate: 10,
        pop: 100,
        military: 20,
      })
    })

    it('keeps one decimal of a deadline 1 AP rate median below 1 instead of rounding it to 0.1', () => {
      const slow: Calibration = {
        deadlines: [deadlineOf(1, [0.74, 100, 20]), deadlineOf(2, [20, 200, 40])],
        defeats: {},
      }
      expect(quotaTable(1, slow)[0]!.apRate).toBe(0.7)
    })

    it('weights c by 0.9 at deadline 2 and 0.95 at deadline 3, and bridges deadline 4', () => {
      const table = quotaTable(2, calibration)
      expect(table.map((row) => row.deadline)).toEqual([1, 2, 3, 4, 5])
      expect(table[1]).toEqual({ deadline: 2, apRate: 36, pop: 360, military: 72 })
      expect(table[2]).toEqual({ deadline: 3, apRate: 76, pop: 760, military: 152 })
      expect(table[3]).toEqual({ deadline: 4, apRate: 110, pop: 1103, military: 221 })
    })

    it('is strictly increasing on every axis, even when the medians are flat or c is low', () => {
      for (const c of [0.3, 1, 2]) {
        const table = quotaTable(c, calibration)
        for (let index = 1; index < table.length; index++) {
          expect(table[index]!.apRate).toBeGreaterThan(table[index - 1]!.apRate)
          expect(table[index]!.pop).toBeGreaterThan(table[index - 1]!.pop)
          expect(table[index]!.military).toBeGreaterThan(table[index - 1]!.military)
        }
      }
      expect(quotaTable(2, calibration)[4]!.apRate).toBe(160)
      expect(quotaTable(0.3, calibration)[1]!.apRate).toBe(11)
    })

    describe('late medians (deadlines 5 to 10)', () => {
      const early = [
        deadlineOf(1, [10, 100, 10]),
        deadlineOf(2, [20, 200, 20]),
        deadlineOf(3, [30, 300, 30]),
        deadlineOf(4, [40, 400, 40]),
      ]
      const late = (medians: readonly number[]): DeadlineCalibration[] =>
        medians.map((median, index) => deadlineOf(5 + index, [median, median * 10, median]))

      it('keeps a late curve that already grows by a constant factor', () => {
        const table = quotaTable(1, {
          deadlines: [...early, ...late([50, 100, 200, 400, 800, 1600])],
          defeats: {},
        })
        expect(table.slice(4).map((row) => row.apRate)).toEqual([50, 100, 200, 400, 800, 1600])
      })

      it('names the axis and the deadline of a late median that is not positive', () => {
        expect(() =>
          quotaTable(1, {
            deadlines: [...early, ...late([50, 100, 200, 400, 800, 0])],
            defeats: {},
          }),
        ).toThrow('Median apRate of deadline 10 must be positive for the late fit.')
      })

      it('states the late fit and prints the fitted medians in the solver report', () => {
        const report = renderReport(
          {
            calibration: {
              deadlines: [...early, ...late([100, 100, 100, 100, 1000, 1000])],
              defeats: {},
            },
            steps: [],
            chosen: null,
            failure: 'test',
          },
          1,
        )
        expect(report).toContain(
          'From deadline 5, quotas use the log linear least squares fit of the deadline 5 to 10 medians',
        )
        expect(report).toContain('| 10 | 803.1 | 8030.9 | 803.1 |')
      })

      it('replaces a late jump by the log linear fit of the deadline 5 to 10 medians', () => {
        const table = quotaTable(1, {
          deadlines: [...early, ...late([100, 100, 100, 100, 1000, 1000])],
          defeats: {},
        })
        const fitted = table.slice(4).map((row) => row.apRate)
        expect(fitted).toEqual([58, 98, 166, 280, 474, 803])
        expect(table[3]!.apRate).toBe(41)
      })
    })

    it('refuses a non finite median instead of writing it into the table', () => {
      const broken: Calibration = { deadlines: [deadlineOf(1, [Number.NaN, 1, 1])], defeats: {} }
      expect(() => quotaTable(1, broken)).toThrow('not finite')
    })
  })
})
