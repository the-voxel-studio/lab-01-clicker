/**
 * Plan 04 Task 3: spending dominance and role coverage of the Conqueror expert bot.
 *
 * @module __tests__/simulation/dominance.conqueror.spec
 */

import { conquerorBotStrategy } from './botRunner'
import { describeDominance } from './dominanceSuite'

describeDominance(conquerorBotStrategy)
