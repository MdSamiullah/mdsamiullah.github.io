// scripts/screenshot-pages.js
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  const base = process.env.SITE_BASE || "https://mdsamiullah.github.io";

  // Pages you want screenshots for; adjust paths or names if needed
  const pages = {
    cv: "/cv/",
    publications: "/publications/",
    teaching: "/teaching/",
    certificates: "/certificates/",
    portfolio: "/portfolio/"
  };

  const rawDir = "generated/snap-raw";
  const outDir = "assets/img/cards";

  if (!fs.existsSync(rawDir)) fs.mkdirSync(rawDir, { recursive: true });
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // selectors to try when picking the top/content region (first match wins)
  const selectorsToTry = [
    "header", "main", "main .panel", ".scholar-chart", ".panel", ".content", ".shell", "#content", "article"
  ];

  for (const name of Object.keys(pages)) {
    const pagePath = pages[name];
    const url = base + pagePath;
    console.log("-> Capturing", url);

    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      // try to find a desired element bounding box
      let clip = null;
      for (const sel of selectorsToTry) {
        const el = await page.$(sel);
        if (el) {
          const box = await el.boundingBox();
          if (box && box.width > 50 && box.height > 50) {
            // we want the top portion; reduce height to ~50-60% to avoid sidebar
            const height = Math.min(box.height, page.viewport().height * 0.5);
            clip = {
              x: Math.round(box.x),
              y: Math.round(box.y),
              width: Math.round(box.width),
              height: Math.round(height)
            };
            console.log("Using selector", sel, "clip:", clip);
            break;
          }
        }
      }

      // fallback: center-top crop removing left sidebar area
      if (!clip) {
        const vw = page.viewport().width;
        const vh = page.viewport().height;
        // assume sidebar ~300px, take center-right area
        const left = Math.round(vw * 0.25);
        const width = Math.round(vw * 0.7);
        const height = Math.round(vh * 0.42);
        clip = { x: left, y: 0, width: width, height: height };
        console.log("Fallback clip:", clip);
      }

      // raw screenshot of the region
      const rawPath = path.join(rawDir, `${name}-raw.png`);
      await page.screenshot({ path: rawPath, clip: clip });
      console.log("Saved raw:", rawPath);

      // create a small HTML file for processing (overlay/filters)
      const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  html,body{margin:0;height:100%}
  .wrap{
    width: 1200px;
    height: 600px;
    display:flex;
    align-items:center;
    justify-content:center;
    position:relative;
    overflow:hidden;
    border-radius:12px;
  }
  .bg{
    position:absolute;
    inset:0;
    background-image: url("file://${path.resolve(rawPath)}");
    background-size: cover;
    background-position: center;
    filter: blur(4px) brightness(.52);
    transform: scale(1.02);
  }
  /* subtle noise / texture (optional) */
  .overlay{
    position:absolute; inset:0;
    background: linear-gradient(180deg, rgba(0,0,0,0.12), rgba(0,0,0,0.25));
  }
  .title{
    position:absolute;
    left: 28px;
    bottom: 28px;
    color: white;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
    font-weight:800;
    font-size:28px;
    text-shadow: 0 6px 20px rgba(0,0,0,.6);
    letter-spacing: -0.5px;
  }
  /* rounded vignette */
  .wrap::before{
    content:"";
    position:absolute; inset:0;
    box-shadow: inset 0 120px 120px rgba(0,0,0,0.12);
    pointer-events:none;
  }
</style>
</head>
<body>
  <div class="wrap">
    <div class="bg"></div>
    <div class="overlay"></div>
    <div class="title">${name.charAt(0).toUpperCase() + name.slice(1).replace(/[-_]/g,' ')}</div>
  </div>
</body>
</html>
`;

      const procHtmlPath = path.join(rawDir, `${name}-proc.html`);
      fs.writeFileSync(procHtmlPath, html, "utf8");

      // render the processed HTML and screenshot center area
      const procPage = await browser.newPage();
      await procPage.setViewport({ width: 1200, height: 600 });
      await procPage.goto("file://" + path.resolve(procHtmlPath), { waitUntil: 'networkidle2' });

      const finalPath = path.join(outDir, `${name}.jpg`);
      await procPage.screenshot({ path: finalPath, type: 'jpeg', quality: 80 });
      await procPage.close();
      console.log("Saved final:", finalPath);

    } catch (err) {
      console.error("Failed for", name, err);
    }
  }

  await browser.close();
  console.log("Done.");
})();
