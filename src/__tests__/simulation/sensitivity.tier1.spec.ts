/**
 * Plan 04 Task 5b: sensitivity of the Greedy ROI win rate to the tier I cost ratio growth.
 *
 * @module __tests__/simulation/sensitivity.tier1.spec
 */

import { describeSensitivity } from './sensitivitySuite'

// Known balance follow up: baseline 0.49, x1.1 gives 0.28, gap 0.21 on seeds 40001 to 40100
// (the economy is steep on the tier I cost).
describeSensitivity('TIER_I_COST_RATIO', 'the tier I cost ratio growth', [1.1])
