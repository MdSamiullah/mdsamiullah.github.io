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

  const pages = {
    cv: "/cv/",
    publications: "/publications/",
    teaching: "/teaching/",
    certificates: "/certificates/",
    portfolio: "/portfolio/"
  };

  const rawDir = "generated/snap-raw";
  const outDir = "assets/img/cards";
  const procDir = "generated/snap-proc";

  for (const d of [rawDir, outDir, procDir]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }

  const selectorsToTry = [
    "main",
    ".content",
    ".panel",
    "article",
    "body"
  ];

  for (const name of Object.keys(pages)) {
    const pagePath = pages[name];
    const url = base + pagePath;
    console.log("-> Capturing", url);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

      // Give the page a moment to finish layout/fonts
      await page.waitForTimeout(1500);

      // Try to pick a good region; else fallback to excluding sidebar
      let clip = null;
      for (const sel of selectorsToTry) {
        const el = await page.$(sel);
        if (el) {
          const box = await el.boundingBox();
          if (box && box.width > 200 && box.height > 200) {
            // Crop top section and exclude left sidebar by shifting right
            const vw = page.viewport().width;
            const vh = page.viewport().height;

            const leftShift = Math.round(vw * 0.24);       // remove sidebar area
            const topHeight = Math.round(vh * 0.42);       // only top portion

            clip = {
              x: leftShift,
              y: 0,
              width: Math.round(vw * 0.72),
              height: topHeight
            };
            break;
          }
        }
      }

      if (!clip) {
        const vw = page.viewport().width;
        const vh = page.viewport().height;
        clip = {
          x: Math.round(vw * 0.24),
          y: 0,
          width: Math.round(vw * 0.72),
          height: Math.round(vh * 0.42)
        };
      }

      const rawPath = path.join(rawDir, `${name}-raw.png`);
      await page.screenshot({ path: rawPath, clip });
      console.log("Saved raw:", rawPath);

      // Processing HTML uses <img> (NOT background-image) to avoid black renders
      const title = name.charAt(0).toUpperCase() + name.slice(1).replace(/[-_]/g, ' ');
      const imgFileUrl = "file://" + path.resolve(rawPath).replace(/#/g, "%23");

      const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  html,body{margin:0;height:100%;background:#000;}
  .wrap{
    width: 1200px;
    height: 600px;
    position: relative;
    overflow: hidden;
    border-radius: 12px;
    background: #000;
  }
  .bg{
    position:absolute;
    inset:-20px; /* extra for blur edges */
    filter: blur(5px) brightness(.55);
    transform: scale(1.04);
    object-fit: cover;
    width: calc(100% + 40px);
    height: calc(100% + 40px);
  }
  .overlay{
    position:absolute; inset:0;
    background: linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.35));
  }
  .title{
    position:absolute;
    left: 28px;
    bottom: 26px;
    color: #fff;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
    font-weight: 900;
    font-size: 30px;
    letter-spacing: -0.5px;
    text-shadow: 0 10px 24px rgba(0,0,0,.65);
  }
  .wrap::before{
    content:"";
    position:absolute; inset:0;
    box-shadow: inset 0 140px 120px rgba(0,0,0,0.12);
    pointer-events:none;
  }
</style>
</head>
<body>
  <div class="wrap">
    <img class="bg" id="bg" src="${imgFileUrl}" alt="bg"/>
    <div class="overlay"></div>
    <div class="title">${title}</div>
  </div>

<script>
  // Signal readiness only after the image fully loads/decodes
  (async () => {
    const img = document.getElementById('bg');
    if (!img) return;
    if (img.decode) { try { await img.decode(); } catch(e) {} }
    window.__READY__ = true;
  })();
</script>
</body>
</html>
`;

      const procHtmlPath = path.join(procDir, `${name}-proc.html`);
      fs.writeFileSync(procHtmlPath, html, "utf8");

      const procPage = await browser.newPage();
      await procPage.setViewport({ width: 1200, height: 600 });
      await procPage.goto("file://" + path.resolve(procHtmlPath), { waitUntil: "domcontentloaded" });

      // wait for __READY__ flag (image loaded/decoded)
      await procPage.waitForFunction(() => window.__READY__ === true, { timeout: 15000 });

      const finalPath = path.join(outDir, `${name}.jpg`);
      await procPage.screenshot({ path: finalPath, type: "jpeg", quality: 82 });
      await procPage.close();

      console.log("Saved final:", finalPath);
    } catch (err) {
      console.error("FAILED:", name, err);
    }
  }

  await browser.close();
  console.log("Done.");
})();
