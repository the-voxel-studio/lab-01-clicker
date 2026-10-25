/**
 * Plan 04 Task 5b: sensitivity of the Greedy ROI win rate to the population growth rate.
 *
 * @module __tests__/simulation/sensitivity.growth.spec
 */

import { describeEngineSensitivity, describeSensitivity } from './sensitivitySuite'

describeEngineSensitivity()
describeSensitivity('BASE_POP_GROWTH_RATE_R', 'the population growth rate')
