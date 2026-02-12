const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });

  const base = "https://mdsamiullah.github.io";

  const pages = {
    cv: "/cv/",
    publications: "/publications/",
    teaching: "/teaching/",
    certificates: "/certificates/",
    portfolio: "/portfolio/"
  };

  const outputDir = "assets/img/cards";

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const name in pages) {
    const url = base + pages[name];
    console.log("Capturing:", url);

    await page.goto(url, { waitUntil: 'networkidle2' });

    await page.screenshot({
      path: `${outputDir}/${name}.jpg`,
      fullPage: false
    });
  }

  await browser.close();
})();
