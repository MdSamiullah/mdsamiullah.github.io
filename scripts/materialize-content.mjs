import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validate,publicDocument,escapeHTML,richHTML,collections} from '../admin-app/public/core.mjs';
const sourceRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=path.join(sourceRoot,'_cms_build');
const source=JSON.parse(fs.readFileSync(path.join(sourceRoot,'_data/managed.json'),'utf8'));validate(source);
if(source.trash?.length || collections.some(k=>source.collections[k].some(i=>i.visible===false))) throw Error('Private records found in public content. Publish through the admin panel.');
fs.rmSync(root,{recursive:true,force:true});
const excluded=new Set(['_cms_build','_site','.git','node_modules','admin-app','tests','docs']);
fs.mkdirSync(root,{recursive:true});
for(const name of fs.readdirSync(sourceRoot)){if(!excluded.has(name))fs.cpSync(path.join(sourceRoot,name),path.join(root,name),{recursive:true});}
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const write=(p,x)=>fs.writeFileSync(path.join(root,p),JSON.stringify(x,null,2)+'\n');
const doc=publicDocument(source);
function safe(v,key=''){
 if(typeof v==='string')return ['body','description'].includes(key)?richHTML(v):escapeHTML(v);
 if(Array.isArray(v))return v.map(x=>safe(x,key));
 if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,safe(x,k)]));return v;
}
const display=safe(doc);
// Config fields are a fixed allowlist: content can never change plugins, include or destination paths.
const base=read('scripts/base-config.json');
for(const k of ['title','description','profile','social','nav'])base[k]=display.settings[k];
// SEO description stays plain text; it is escaped by the layout.
base.description=source.settings.description;
base.exclude=[...new Set([...(base.exclude||[]),'admin-app','tests','docs','scripts','node_modules','package.json','package-lock.json','README.md','Gemfile','Gemfile.lock'])];
base.defaults=[...(base.defaults||[]),...Object.entries(display.pages).filter(([k])=>!['not_found','home'].includes(k)).map(([k,p])=>({scope:{path:k},values:{title:p.title}}))];
write('_config.yml',base);
for(const kind of collections){
 const records=display.collections[kind].map(x=>{const {id,visible,...item}=x;return item;});
 if(kind==='publications'){records.forEach(x=>x.year=Number(x.year));write('_data/publications.yml',records);continue;}
 const sections=[];
 for(const record of records){const {section='',subsection='',...item}=record;let s=sections.find(s=>s.title===section);if(!s){s={title:section,subsections:[]};sections.push(s);}let sub=s.subsections.find(x=>x.title===subsection);if(!sub){sub={title:subsection,items:[]};s.subsections.push(sub);}sub.items.push(item);}
 write(`_data/${kind}.yml`,{sections});
}
if(!doc.options.automatic_citations)write('_data/citations.yml',doc.citations.map(x=>({year:Number(x.year),count:Number(x.count)})));
// Only the build copy is escaped; source JSON in Git remains editable.
write('_data/managed.json',display);
fs.writeFileSync(path.join(root,'assets/css/managed.css'),`:root{--accent:${doc.theme.accent};--accent2:${doc.theme.accent2};--bg:${doc.theme.background}}\n.info-card__desc p:first-child,.qcard__text p:first-child{margin-top:0}.info-card__desc p:last-child,.qcard__text p:last-child{margin-bottom:0}.info-card__desc table{border-collapse:collapse;max-width:100%;display:block;overflow:auto}.info-card__desc th,.info-card__desc td{border:1px solid var(--line);padding:6px}.profile__photo{max-width:240px;height:auto;aspect-ratio:1 / 1;object-fit:cover}\n`);
const routes={home:'index.html',about:'about.html',not_found:'404.html',cv:'cv/index.html',publications:'publications/index.html',mentoring:'mentoring/index.html',teaching:'teaching/index.html',certificates:'certificates/index.html',portfolio:'portfolio/index.html',welcome_post:'_posts/2026-02-10-welcome-to-jekyll.markdown'};
for(const [key,file] of Object.entries(routes)){if(!display.pages[key])continue;const filename=path.join(root,file);let text=fs.readFileSync(filename,'utf8');const parts=text.split('---');parts[1]=parts[1].replace(/^title:.*$/m,'title: '+JSON.stringify(display.pages[key].title));fs.writeFileSync(filename,parts.join('---'));}
console.log('Approved content materialized in _cms_build:',Object.fromEntries(collections.map(k=>[k,doc.collections[k].length])));
