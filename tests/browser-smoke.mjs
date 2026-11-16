import {chromium} from 'playwright';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const server=http.createServer((req,res)=>{const name=req.url==='/'?'index.html':req.url.slice(1);if(!['index.html','style.css','app.mjs','core.mjs'].includes(name)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',name.endsWith('.mjs')?'text/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(path.join(root,'admin-app/public',name)));});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
import fs from 'node:fs';import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
let doc=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/original-content.json'))),saved=null,published=false;
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
await page.route('**/api/**',async route=>{const r=route.request(),path=new URL(r.url()).pathname;let result={};if(path.endsWith('session'))result={login:'mdsamiullah',editors:['mdsamiullah'],actions:'https://github.com/mdsamiullah/mdsamiullah.github.io/actions'};if(path.endsWith('content'))result={doc:saved||doc,draftSha:saved?'d1':null,publicSha:'p1'};if(path.endsWith('save')){saved=r.postDataJSON().doc;result={sha:'d1'};}if(path.endsWith('publish')){published=true;result={sha:'p2'};}await route.fulfill({json:result});});
try {
await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#workspace').waitFor({state:'visible'});
assert.equal(await page.locator('.stat strong').allTextContents().then(x=>x.join(',')),'39,44,31,31,23');
await page.getByRole('button',{name:'Supervision',exact:true}).click();await page.getByRole('button',{name:'Add entry',exact:true}).click();
await page.getByLabel('Name',{exact:true}).fill('Browser Test Student');await page.getByLabel('Project',{exact:true}).fill('A new Bayesian network research project');await page.getByLabel('Year',{exact:true}).fill('2026');await page.locator('.rich').fill('A rich description');await page.getByRole('button',{name:'Apply changes',exact:true}).click();
assert.equal(await page.locator('.record h3').filter({hasText:'A new Bayesian network research project'}).count(),1);
const chooserPromise=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Import CSV',exact:true}).click();const chooser=await chooserPromise;await chooser.setFiles({name:'students.csv',mimeType:'text/csv',buffer:Buffer.from('name,project,year\nBrowser Test Student,A new Bayesian network research project,2026\nAnother Student,"Quoted, comma title",2026')});
await page.getByRole('heading',{name:'Map CSV columns'}).waitFor();await page.getByRole('button',{name:'Apply changes',exact:true}).click();await page.getByRole('heading',{name:'Review CSV import'}).waitFor();const checks=page.locator('#editor input[type=checkbox]');assert.equal(await checks.count(),2);assert.equal(await checks.nth(0).isChecked(),false);assert.equal(await checks.nth(1).isChecked(),true);await page.getByRole('button',{name:'Apply changes',exact:true}).click();
await page.getByRole('button',{name:'Save private draft',exact:true}).click();await page.getByText('Private draft saved',{exact:true}).waitFor();assert.equal(saved.collections.mentoring.length,46);
const record=page.locator('article.record').filter({hasText:'Quoted, comma title'});await record.getByRole('button',{name:'Delete',exact:true}).click();await page.getByRole('button',{name:'Recycle bin',exact:true}).click();await page.getByRole('button',{name:'Restore',exact:true}).click();
await page.getByRole('button',{name:'Pages & home cards',exact:true}).click();await page.locator('.record').filter({has:page.getByRole('heading',{name:'Home',exact:true})}).getByRole('button',{name:'Edit page'}).click();await page.locator('.rich').first().fill('New homepage welcome');await page.getByRole('button',{name:'Apply changes',exact:true}).click();
await page.getByRole('button',{name:'Content preview',exact:true}).click();assert.ok((await page.locator('.preview').innerText()).includes('New homepage welcome'));
await page.getByRole('button',{name:'Publish website',exact:true}).click();await page.getByText('Publication committed · website build pending',{exact:true}).waitFor();assert.equal(published,true);assert.equal(saved.collections.mentoring.length,46);
await page.getByRole('button',{name:'Supervision',exact:true}).click();
await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
assert.deepEqual(errors,[]);console.log('PASS: browser add, rich editing, CSV mapping, duplicate flag/skip, save, delete/restore, page edit, preview, publish and mobile overflow.');} finally { await browser.close(); server.close(); }
