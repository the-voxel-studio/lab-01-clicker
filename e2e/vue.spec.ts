import { test, expect, type Page } from '@playwright/test'

/** The Vue application as `app.mount` leaves it on its container. */
interface VueRoot {
  config: {
    globalProperties: {
      $pinia: { _s: Map<string, { advance(dt: number): void }> }
    }
  }
}

// See here how to get started:
// https://playwright.dev/docs/intro
test('visits the app root url and renders title', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('The Grand Audit')
})

test('buys on the Commons and proclaims a tax on the Crown', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Begin a reign' }).click()
  await page.locator('[data-order="order_people"]').click()
  await expect(page.locator('h1')).toHaveText('The Commons')
  await page.locator('[data-unit="peasant"] [data-buy]').click()
  await expect(page.locator('[data-unit="peasant"]')).toContainText('1 working')
  await page.locator('[data-order="crown"]').click()
  await expect(page.locator('h1')).toHaveText('The Crown')
  await page.getByRole('tab', { name: 'Coffer' }).click()
  await page.locator('[data-tax]').fill('30')
  await expect(page.locator('[data-proclaim]')).toContainText('30% proclaimed')
})

/** Turns the leaves of the open tab to the last one. */
async function turnToTheLastLeaf(page: Page) {
  const next = page.locator('[data-leaf-next]:not([disabled])')
  for (let turn = 0; turn < 12 && (await next.count()) > 0; turn++) await next.click()
}

test('walks the four tabs of the Crown and turns the leaves of Decrees', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Begin a reign' }).click()
  await page.locator('[data-order="crown"]').click()
  await expect(page.locator('[data-tab-realm] [data-colonise]')).toBeVisible()
  await page.getByRole('tab', { name: 'Coffer' }).click()
  await expect(page.locator('[data-tax]')).toBeVisible()
  await page.getByRole('tab', { name: 'Army' }).click()
  await expect(page.locator('[data-tab-army]')).toContainText('Force in the field')

  await page.getByRole('tab', { name: 'Decrees' }).click()
  await expect(page.locator('[data-leaf-count]')).toContainText('Leaf 1 of')
  await expect(page.locator('[data-edict="forced_tithe"]')).toBeInViewport()
  const body = page.locator('[data-crown-body]')
  await expect
    .poll(() => body.evaluate((node) => node.scrollHeight - node.clientHeight))
    .toBeLessThanOrEqual(1)
  await turnToTheLastLeaf(page)
  await expect(page.locator('[data-laws]')).toBeInViewport()
  await expect(page.locator('[data-edict="forced_tithe"]')).not.toBeInViewport()

  await page.locator('[data-order="run"]').click()
  await page.locator('[data-order="crown"]').click()
  await expect(page.getByRole('tab', { name: 'Decrees' })).toHaveAttribute('aria-selected', 'true')
})

/** Steps the reign through its store: a frozen page clock would have to paint every frame. */
function advance(page: Page, seconds: number) {
  return page.evaluate((total) => {
    const root = document.querySelector<HTMLElement & { __vue_app__: VueRoot }>('#app')
    const game = root?.__vue_app__.config.globalProperties.$pinia._s.get('game')
    for (let t = 0; t < total && game; t += 0.25) game.advance(0.25)
  }, seconds)
}

/** Answers whatever the reign asks, buying once in the open resume, until it ends. */
async function playToTheEnd(page: Page) {
  // A letter that was answered stays on screen a moment while its seal breaks.
  const letter = page.locator('[data-moment-letter]:not(.letter-leave-active)')
  const answer = letter.locator('[data-moment-answer]:not([disabled])').last()
  const resume = page.locator('[data-resume]')
  const missive = page.locator('[data-report-close]')
  const fate = page.locator('[data-fate]')
  let bought = false

  for (let turn = 0; turn < 200 && (await fate.count()) === 0; turn++) {
    if ((await missive.count()) > 0) {
      await missive.click()
    } else if ((await letter.count()) > 0) {
      await answer.click()
    } else if ((await resume.count()) > 0) {
      if (!bought) {
        bought = true
        await page.locator('[data-order="order_people"]').click()
        await page.locator('[data-unit="peasant"] [data-buy]').click()
        await expect(page.locator('[data-resume-band]')).toBeVisible()
      }
      await resume.click()
    } else {
      await advance(page, 100)
    }
  }
}

test('plays a reign through its letters, the open resume and a death', async ({ page }) => {
  test.setTimeout(60000)
  await page.goto('/')
  await page.getByRole('button', { name: 'Begin a reign' }).click()
  await advance(page, 100)
  await expect(page.locator('[data-moment-letter]')).toBeVisible()
  await playToTheEnd(page)

  await expect(page.locator('[data-fate]')).toBeVisible()
  await page.locator('[data-fate-continue]').click()
  await expect(page.locator('[data-register]')).toContainText('Reign 1 is over')
})

test('reads a unit effect, the rules and a war', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /begin/i }).first().click()
  await page.locator('[data-order="order_people"]').click()
  await expect(page.locator('[data-unit="peasant"] [data-effect]')).toContainText(/\d/)
  await expect(page.locator('[data-verdict]')).toContainText(/short|met/)
  await page.locator('[data-order="fortune"]').click()
  await expect(page.locator('[data-war-panel]')).toBeVisible()
  await page.getByRole('button', { name: 'Menu' }).click()
  await page.getByRole('button', { name: /How to reign/ }).click()
  await expect(page.locator('[data-how-to-reign]')).toContainText('archive points')
})
