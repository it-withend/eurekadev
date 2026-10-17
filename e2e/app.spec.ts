import { expect, test, type Page } from '@playwright/test';

/** Mark every tour as seen, so a test can focus on its own flow. */
async function skipTours(page: Page) {
  await page.addInitScript(() => {
    for (const id of ['catalog', 'experiment', 'create']) localStorage.setItem(`pocketlab.tour.${id}.done`, 'true');
  });
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test('first visit: the guided tour starts by itself and can be followed to the end', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('.tour-card');
  await expect(card).toBeVisible();
  await expect(card.getByRole('heading')).toContainText('Welcome to PocketLab');
  for (let i = 0; i < 10 && (await page.getByRole('button', { name: /^Next/ }).count()); i++) {
    await page.getByRole('button', { name: /^Next/ }).click();
  }
  await page.getByRole('button', { name: 'Got it!' }).click();
  await expect(card).toBeHidden();
  // Seen once: not shown again on the next visit.
  await page.reload();
  await expect(page.locator('h1')).toBeVisible();
  await expect(card).toBeHidden();
});

test('one-click demo link shows a finished pendulum investigation', async ({ page }) => {
  await skipTours(page);
  await page.goto('/#/experiment/pendulum/demo');
  await expect(page.locator('.demo-banner')).toBeVisible();
  await expect(page.locator('.trials tbody tr')).toHaveCount(4);
  const combined = page.locator('.result-block').first();
  await expect(combined).toContainText('from T² vs L');
  await expect(combined.locator('.headline-verdict strong')).toHaveText('Your result agrees with the accepted value');
  const g = Number((await combined.locator('.headline-value').innerText()).match(/= ([\d.]+)/)![1]);
  expect(g).toBeGreaterThan(9.7);
  expect(g).toBeLessThan(9.95);
  // Reloading the demo must not duplicate the sample trials.
  await page.reload();
  await expect(page.locator('.trials tbody tr')).toHaveCount(4);
  await expectNoHorizontalScroll(page);
});

test('every built-in experiment analyses its sample data', async ({ page }) => {
  await skipTours(page);
  for (const id of ['pendulum', 'resonance', 'centripetal']) {
    await page.goto(`/#/experiment/${id}`);
    await page.getByRole('button', { name: /Try sample data/ }).click();
    await expect(page.locator('.headline').first()).toBeVisible();
    await expect(page.locator('.result .error')).toHaveCount(0);
    await expect(page.locator('.chart canvas').first()).toBeVisible();
  }
});

test('invalid input blocks the measurement and a decimal comma is accepted', async ({ page }) => {
  await skipTours(page);
  await page.goto('/#/experiment/pendulum');
  const length = page.getByLabel('Pendulum length L');
  const start = page.getByRole('button', { name: /Start measurement/ });
  await length.fill('');
  await expect(page.getByText('Enter a number.')).toBeVisible();
  await expect(start).toBeDisabled();
  await length.fill('92,5');
  await expect(start).toBeEnabled();
  await length.fill('9000');
  await expect(page.getByText(/at most 500 cm/)).toBeVisible();
});

test('a student designs, saves and runs their own experiment', async ({ page }) => {
  await skipTours(page);
  await page.goto('/#/create');
  await page.getByRole('button', { name: /Spring constant/ }).click();
  const formula = page.locator('.formula-field input');
  await formula.fill('4π²mass/T²');
  await expect(page.locator('.formula-status')).toContainText('"mass" is not defined');
  await formula.fill('4π²m/T²');
  await expect(page.locator('.formula-status')).toContainText('Formula understood');
  await page.getByRole('button', { name: 'Save and start measuring' }).click();
  await expect(page).toHaveURL(/#\/experiment\/my-stiffness-of-a-spring-/);
  await expect(page.locator('h1')).toHaveText('Stiffness of a spring');
  await page.getByRole('button', { name: /Try sample data/ }).click();
  await expect(page.locator('.headline-value').first()).toContainText('k =');
  // It now appears in the catalogue next to the built-in ones.
  await page.goto('/');
  await expect(page.locator('.card.custom')).toContainText('Stiffness of a spring');
});

test('pages fit a phone screen', async ({ page }) => {
  await skipTours(page);
  for (const path of ['/', '/#/experiment/resonance', '/#/sensors', '/#/create', '/#/about']) {
    await page.goto(path);
    await expect(page.locator('h1').first()).toBeVisible();
    await expectNoHorizontalScroll(page);
  }
});
