import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {execFileSync} from 'node:child_process';
const root=new URL('../',import.meta.url);
test('build staging preserves source, materializes all records and excludes admin code',()=>{
 const before=fs.readFileSync(new URL('_data/managed.json',root),'utf8');
 execFileSync(process.execPath,['scripts/materialize-content.mjs'],{cwd:root});
 assert.equal(fs.readFileSync(new URL('_data/managed.json',root),'utf8'),before);
 const doc=JSON.parse(before);for(const [k,records]of Object.entries(doc.collections)){
  const data=JSON.parse(fs.readFileSync(new URL(`_cms_build/_data/${k}.yml`,root),'utf8'));const count=Array.isArray(data)?data.length:data.sections.flatMap(s=>s.subsections.flatMap(x=>x.items)).length;assert.equal(count,records.length);
 }
 assert.equal(fs.existsSync(new URL('_cms_build/admin-app',root)),false);assert.equal(fs.existsSync(new URL('_cms_build/tests',root)),false);
 const config=JSON.parse(fs.readFileSync(new URL('_cms_build/_config.yml',root),'utf8'));assert.equal(config.baseurl,'');assert.ok(config.exclude.includes('scripts'));
});
