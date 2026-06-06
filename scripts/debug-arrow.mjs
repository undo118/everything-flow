import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://localhost:3001/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  await (await page.$('button')).click();
  await page.waitForTimeout(500);
  await (await page.$('button')).click();
  await page.waitForTimeout(500);

  const canvas = await page.$('.tl-canvas');
  await canvas.click({ position: { x: 600, y: 400 } });
  await page.waitForTimeout(500);

  const dots = await page.$$('[data-cod]');
  const box = await dots[0].boundingBox();
  
  await page.mouse.move(box.x + 7, box.y + 7, { steps: 5 });
  await page.waitForTimeout(100);
  await page.mouse.down();
  await page.waitForTimeout(100);
  await page.mouse.move(box.x + 200, box.y + 100, { steps: 10 });
  await page.waitForTimeout(200);

  // Find arrow SVG by id prefix
  const arrowInfo = await page.evaluate(() => {
    const allSvgs = document.querySelectorAll('.tl-shapes svg');
    const results = [];
    
    for (const svg of allSvgs) {
      if (svg.id && svg.id.startsWith('shape:arr-')) {
        const info = {
          id: svg.id,
          tag: svg.tagName,
          className: (svg.className && String(svg.className)).substring(0, 60),
          viewBox: svg.getAttribute('viewBox') || 'none',
          transform: svg.getAttribute('transform') || 'none',
          children: [],
        };
        
        for (const child of svg.children) {
          const c = {
            tag: child.tagName,
            stroke: child.getAttribute('stroke') || 'default',
            strokeWidth: child.getAttribute('stroke-width') || 'default',
            strokeDasharray: child.getAttribute('stroke-dasharray') || 'default',
            fill: child.getAttribute('fill') || 'default',
            opacity: child.getAttribute('opacity') || 'default',
            d: child.getAttribute('d') || child.getAttribute('cx') || child.getAttribute('x') || '',
            class: String(child.className || '').substring(0, 40),
            style: child.getAttribute('style') || '',
          };
          if (c.d && c.d.length > 80) c.d = c.d.substring(0, 80) + '...';
          info.children.push(c);
        }
        results.push(info);
      }
    }
    
    return results;
  });
  
  console.log('Arrow SVG:', JSON.stringify(arrowInfo, null, 2));

  // Also look at the tl-overlays for selection indicator
  const overlayInfo = await page.evaluate(() => {
    const overlays = document.querySelector('.tl-overlays');
    if (!overlays) return 'no overlays';
    return overlays.innerHTML.substring(0, 2000);
  });
  console.log('Overlays HTML:', overlayInfo);

  await page.mouse.up();
  await browser.close();
})();
