import { test, expect } from '@playwright/test'

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
  await page.locator('[data-tax]').fill('30')
  await expect(page.locator('[data-proclaim]')).toContainText('30% proclaimed')
})
