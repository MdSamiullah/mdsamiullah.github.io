// scripts/screenshot-pages.js
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security'
    ]
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
  const procDir = "generated/snap-proc";
  const outDir = "assets/img/cards";

  for (const d of [rawDir, procDir, outDir]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }

  function titleFromKey(key) {
    return key.charAt(0).toUpperCase() + key.slice(1).replace(/[-_]/g, ' ');
  }

  for (const key of Object.keys(pages)) {
    const url = base + pages[key];
    console.log("-> Capturing", url);

    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      await page.waitForTimeout(2500); // give layout/fonts time

      // Crop: remove left sidebar; keep only top section
      const vw = page.viewport().width;
      const vh = page.viewport().height;

      const clip = {
        x: Math.round(vw * 0.24),       // cut left sidebar area
        y: 0,
        width: Math.round(vw * 0.72),
        height: Math.round(vh * 0.42)   // top portion only
      };

      const rawPath = path.join(rawDir, `${key}-raw.png`);
      await page.screenshot({ path: rawPath, clip });
      console.log("Saved raw:", rawPath);

      // Read raw screenshot and embed as base64 (NO file:// loading issues)
      const rawB64 = fs.readFileSync(rawPath).toString('base64');
      const dataUrl = `data:image/png;base64,${rawB64}`;

      const title = titleFromKey(key);

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
    inset:-20px;
    width: calc(100% + 40px);
    height: calc(100% + 40px);
    object-fit: cover;
    filter: blur(5px) brightness(.55);
    transform: scale(1.04);
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
</style>
</head>
<body>
  <div class="wrap">
    <img class="bg" id="bg" src="${dataUrl}" alt="bg"/>
    <div class="overlay"></div>
    <div class="title">${title}</div>
  </div>
<script>
  (async () => {
    const img = document.getElementById('bg');
    if (img && img.decode) { try { await img.decode(); } catch(e) {} }
    window.__READY__ = true;
  })();
</script>
</body>
</html>
`;

      const procHtmlPath = path.join(procDir, `${key}-proc.html`);
      fs.writeFileSync(procHtmlPath, html, "utf8");

      const procPage = await browser.newPage();
      await procPage.setViewport({ width: 1200, height: 600 });
      await procPage.goto("file://" + path.resolve(procHtmlPath), { waitUntil: "domcontentloaded" });
      await procPage.waitForFunction(() => window.__READY__ === true, { timeout: 15000 });

      const finalPath = path.join(outDir, `${key}.jpg`);
      await procPage.screenshot({ path: finalPath, type: "jpeg", quality: 82 });
      await procPage.close();

      console.log("Saved final:", finalPath);
    } catch (e) {
      console.error("FAILED:", key, e);
    }
  }

  await browser.close();
  console.log("Done.");
})();
