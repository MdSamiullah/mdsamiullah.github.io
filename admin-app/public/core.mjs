// Shared by the browser, Worker and production content materializer. No dependencies.
export const collections = ['publications', 'mentoring', 'teaching', 'certificates', 'portfolio'];
export const fields = {
 publications: ['title','authors','venue','year','type','pdf','doi','code'],
 mentoring: ['section','subsection','name','project','year','role','url','description'],
 teaching: ['section','subsection','title','code','year','role','url','description'],
 certificates: ['section','subsection','title','issuer','year','url','description'],
 portfolio: ['section','subsection','title','year','description','status','collaboration','fundingBody','amount','Role','Keywords','url','github','demo']
};
export const clone = x => JSON.parse(JSON.stringify(x));
export const escapeHTML = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function safeURL(value) {
 const s=String(value).trim();
 if(!s) return '';
 if(/[\x00-\x20<>"'`\\]/.test(s)) throw Error('Links must not contain spaces, quotes or control characters.');
 if(!/^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(s)) throw Error('Use an https:// link, mailto: address, or a /site/path.');
 return s;
}
export function richHTML(value) {
 // Reconstruct a small HTML vocabulary; no executable attributes, CSS, SVG, embeds or raw text elements.
 const allowed=new Set('p br strong b em i u s h2 h3 h4 ul ol li blockquote a div table thead tbody tr th td pre code'.split(' '));
 return String(value).split(/(<[^>]*>)/g).map(part=>{
  if(!part.startsWith('<')) return part.replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const m=part.match(/^<\s*(\/?)\s*([a-z0-9]+)\b([^>]*)>$/i);
  if(!m || !allowed.has(m[2].toLowerCase())) return '';
  const tag=m[2].toLowerCase();
  if(m[1]) return tag==='br'?'':`</${tag}>`;
  if(tag==='a') {
   const attr=m[3].match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
   if(!attr) return '<a>';
   try { const url=safeURL((attr[1]??attr[2]??attr[3]).replace(/&amp;/g,'&')); return `<a href="${escapeHTML(url)}" rel="noopener noreferrer">`; } catch { return '<a>'; }
  }
  return `<${tag}>`;
 }).join('');
}
export function validate(doc) {
 if(!doc || doc.version!==1 || !doc.settings || !doc.pages || !doc.collections || !doc.labels || !doc.theme || !doc.options) throw Error('Unsupported content file.');
 for(const key of ['home','publications','mentoring','teaching','certificates','portfolio','cv','about','not_found']) if(!doc.pages[key] || typeof doc.pages[key].title!=='string') throw Error(`Missing page: ${key}`);
 if(!Array.isArray(doc.pages.home.cards)||!Array.isArray(doc.settings.nav)||!doc.settings.profile||!doc.settings.social) throw Error('Invalid homepage or profile settings.');
 if(typeof doc.options.automatic_citations!=='boolean') throw Error('Citation mode must be true or false.');
 const allIds=new Set();
 for(const kind of collections) {
  if(!Array.isArray(doc.collections[kind]) || doc.collections[kind].length>2000) throw Error(`Invalid ${kind} collection (maximum 2,000 records).`);
  for(const item of doc.collections[kind]) {
   if(typeof item.visible!=='boolean') throw Error('Record visibility must be true or false.');
   if(!item.id || allIds.has(item.id)) throw Error('Each record needs a unique ID.');
   allIds.add(item.id);
   if(!(item.title || item.project || item.name)) throw Error(`A ${kind} record needs a title or name.`);
   if(kind==='publications' && (!Number.isInteger(Number(item.year)) || (Number(item.year)!==0 && Number(item.year)<1000) || Number(item.year)>2200)) throw Error('Publication year must be a four-digit year, or 0 for undated work.');
  }
 }
 if(!Array.isArray(doc.citations)||doc.citations.some(r=>!Number.isInteger(Number(r.year))||Number(r.year)<1000||!Number.isInteger(Number(r.count))||Number(r.count)<0)) throw Error('Citation years and counts must be valid nonnegative integers.');
 for(const color of Object.values(doc.theme)) if(!/^#[0-9a-f]{6}$/i.test(color)) throw Error('Theme colours must use six-digit hex codes.');
 const links=new Set(['url','pdf','doi','github','demo','photo','image','website','google_scholar']);
 function walk(v,key='',path='') {
  if(path.split('.').length>20) throw Error('Content nesting is too deep.');
  if(typeof v==='string') {
   if(v.length>100000) throw Error('A text field is too long.');
   if(!path.startsWith('labels.') && links.has(key) && v && !(path.startsWith('settings.social.') && ['github'].includes(key))) safeURL(v);
   if(key==='code' && path.startsWith('collections.publications.') && v) safeURL(v);
  } else if(Array.isArray(v)) v.forEach((x,i)=>walk(x,key,`${path}.${i}`));
  else if(v && typeof v==='object') for(const [k,x] of Object.entries(v)) {
   if(['__proto__','constructor','prototype'].includes(k)) throw Error('Invalid field name.');
   walk(x,k,path?`${path}.${k}`:k);
  }
 }
 walk(doc); return doc;
}
export function publicDocument(doc) {
 validate(doc);
 // Explicit top-level allowlist. Private trash and application metadata never publish.
 const out=clone(Object.fromEntries(['version','settings','labels','pages','collections','citations','options','theme'].map(k=>[k,doc[k]])));
 for(const key of collections) out.collections[key]=out.collections[key].filter(x=>x.visible!==false);
 return out;
}
export function normalize(s) { return String(s??'').replace(/<[^>]*>/g,' ').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim(); }
export function duplicateReason(a,b,kind) {
 const doi=x=>String(x.doi||'').trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi.org\//,'').replace(/^doi:\s*/,'');
 if(doi(a)&&doi(a)===doi(b)) return 'Same DOI';
 const title=x=>normalize(x.title||x.project||'');
 if(kind==='mentoring') {
  if(normalize(a.name)&&normalize(a.name)===normalize(b.name)) return title(a)===title(b)?'Same student and project':'Same student; check project';
 } else if(title(a)&&title(a)===title(b)) return normalize(a.year)===normalize(b.year)?'Same title and year':'Same title; check year';
 const aa=new Set(title(a).split(' ').filter(Boolean)),bb=new Set(title(b).split(' ').filter(Boolean));
 const overlap=[...aa].filter(x=>bb.has(x)).length;
 if(aa.size>=4 && bb.size>=4 && overlap/(aa.size+bb.size-overlap)>=0.8) return 'Similar title';
 return '';
}
export function findDuplicates(items,kind) {
 const pairs=[];
 for(let i=0;i<items.length;i++) for(let j=i+1;j<items.length;j++) {
  const reason=duplicateReason(items[i],items[j],kind); if(reason) pairs.push({a:i,b:j,reason});
 }
 return pairs;
}
export function parseCSV(text) {
 const rows=[];let row=[],cell='',quoted=false,closed=false;
 text=String(text).replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++) {
  const c=text[i];
  if(quoted) { if(c==='"') {if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}} else cell+=c; }
  else if(c==='"' && !cell && !closed) quoted=true;
  else if(c===',' || c==='\n' || c==='\r') {
   row.push(cell);cell='';closed=false;
   if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++;if(row.some(x=>x.trim()))rows.push(row);row=[];}
  } else {if(closed||c==='"') throw Error('Malformed CSV quoting.');cell+=c;}
 }
 if(quoted)throw Error('CSV contains an unclosed quote.');
 row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
 if(rows.length<2)throw Error('CSV needs a header row and at least one record.');
 const headers=rows.shift().map(s=>s.trim());
 if(headers.some(h=>!h)||new Set(headers).size!==headers.length)throw Error('CSV column names must be nonempty and unique.');
 if(rows.length>1000)throw Error('Import at most 1,000 rows at a time.');
 if(rows.some(r=>r.length!==headers.length))throw Error('CSV rows have inconsistent numbers of columns.');
 return {headers,rows};
}
export function csvCell(value) {let s=String(value??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
