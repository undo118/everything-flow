import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })

// Capture console errors
const errors = []
page.on('console', msg => {
  if (msg.type() === 'error') {
    errors.push(msg.text())
  }
})
page.on('pageerror', err => {
  errors.push(err.message)
})

await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 20000 })
await page.waitForTimeout(4000)

console.log('Console errors:', JSON.stringify(errors, null, 2))

const hasErrorBoundary = await page.evaluate(() => {
  return document.querySelector('.error-boundary') !== null
})
console.log('Error boundary visible:', hasErrorBoundary)

const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 1000))
console.log('Page text:', bodyText)

await browser.close()
