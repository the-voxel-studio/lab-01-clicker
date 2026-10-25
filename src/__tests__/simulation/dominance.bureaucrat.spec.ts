/**
 * Plan 04 Task 3: spending dominance and role coverage of the Bureaucrat expert bot.
 *
 * @module __tests__/simulation/dominance.bureaucrat.spec
 */

import { bureaucratBotStrategy } from './botRunner'
import { describeDominance } from './dominanceSuite'

describeDominance(bureaucratBotStrategy)
