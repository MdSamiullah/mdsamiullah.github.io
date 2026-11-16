import {collections,fields,clone,escapeHTML,richHTML,safeURL,validate,publicDocument,findDuplicates,duplicateReason,parseCSV,csvCell} from './core.mjs';
const $=s=>document.querySelector(s),E=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const names={overview:'Overview',settings:'Profile & navigation',pages:'Pages & home cards',publications:'Research publications',mentoring:'Supervision',teaching:'Teaching',certificates:'Certificates & awards',portfolio:'Portfolio & projects',citations:'Citation counts',labels:'Labels & footer',theme:'Colours',media:'Upload files',trash:'Recycle bin',preview:'Content preview',access:'Editors & backups'};
let doc,draftSha,publicSha,session,dirty=false,busy=false,current='overview',dialogApply;
function message(s,error=false){$('#notice').textContent=s;$('#notice').className=error?'error':'';}
function changed(){dirty=true;$('#state').textContent='Unsaved changes · save a private draft';}
function button(text,fn,cls){const b=E('button',text,cls);b.type='button';b.onclick=()=>Promise.resolve().then(fn).catch(e=>message(e.message,true));return b;}
async function api(path,body){const r=await fetch('/api/'+path,{credentials:'same-origin',...(body!==undefined?{method:'POST',headers:{'Content-Type':'application/json','X-Homepage-Admin':'1'},body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok)throw Error(data.error||'Request failed.');return data;}
async function operation(fn){if(busy)return;busy=true;$('#view').inert=true;$('#sections').inert=true;$('#logout').disabled=true;for(const b of document.querySelectorAll('.actionbar button'))b.disabled=true;try{await fn();}catch(e){message(e.message,true);}finally{busy=false;$('#view').inert=false;$('#sections').inert=false;$('#logout').disabled=false;for(const b of document.querySelectorAll('.actionbar button'))b.disabled=false;}}
function download(name,text,type='application/json'){const a=E('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);}
async function load(){const data=await api('content');validate(data.doc);doc=data.doc;doc.trash??=[];draftSha=data.draftSha;publicSha=data.publicSha;dirty=false;$('#state').textContent=draftSha?'Private draft loaded':'Published content loaded · no private draft yet';render(current);}
async function save(){validate(doc);const r=await api('save',{doc,sha:draftSha});draftSha=r.sha;dirty=false;$('#state').textContent='Private draft saved';message('Draft saved privately. Your live website has not changed.');}
function showDialog(title,body,apply){$('#editor-title').textContent=title;$('#editor-body').replaceChildren(body);dialogApply=apply;$('#editor').showModal();}
$('#editor-form').onsubmit=e=>{e.preventDefault();try{dialogApply?.();$('#editor').close();}catch(err){message(err.message,true);}};
function closeDialog(){if(confirm('Discard changes in this dialog?'))$('#editor').close();}
$('#close-editor').onclick=closeDialog;$('#cancel-editor').onclick=closeDialog;
$('#editor').addEventListener('cancel',e=>{e.preventDefault();closeDialog();});
function richEditor(value,onChange){
 const outer=E('div'),toolbar=E('div',undefined,'rich-toolbar'),editor=E('div',undefined,'rich');editor.contentEditable='true';editor.setAttribute('role','textbox');editor.setAttribute('aria-multiline','true');editor.innerHTML=richHTML(value||'');
 const commands=[['Bold','bold'],['Italic','italic'],['Underline','underline'],['Heading','formatBlock','h2'],['Paragraph','formatBlock','p'],['Bullets','insertUnorderedList'],['Numbered','insertOrderedList'],['Quote','formatBlock','blockquote'],['Undo','undo'],['Redo','redo'],['Clear formatting','removeFormat']];
 function commit(){onChange(richHTML(editor.innerHTML));}
 for(const [label,cmd,arg]of commands){const b=button(label,()=>{editor.focus();document.execCommand(cmd,false,arg);commit();});b.onmousedown=e=>e.preventDefault();toolbar.append(b);}
 const link=button('Link',()=>{const url=prompt('Link address (https://…)');if(url){safeURL(url);editor.focus();document.execCommand('createLink',false,url);commit();}});link.onmousedown=e=>e.preventDefault();toolbar.append(link);
 const table=button('Table',()=>{editor.focus();document.execCommand('insertHTML',false,'<table><tbody><tr><th>Heading</th><th>Heading</th></tr><tr><td>Cell</td><td>Cell</td></tr></tbody></table><p><br></p>');commit();});table.onmousedown=e=>e.preventDefault();toolbar.append(table);
 editor.addEventListener('input',commit);editor.addEventListener('paste',e=>{e.preventDefault();const html=e.clipboardData.getData('text/html');const text=e.clipboardData.getData('text/plain');document.execCommand('insertHTML',false,html?richHTML(html):escapeHTML(text).replace(/\n/g,'<br>'));commit();});
 editor.addEventListener('drop',e=>e.preventDefault());outer.append(toolbar,editor);return outer;
}
const human=s=>s.replaceAll('_',' ').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,s=>s.toUpperCase());
const richKeys=new Set(['body','description']);
function editObject(value,onApply,title='Edit content',fieldOrder){
 const copy=clone(value),form=E('div');renderObject(copy,form,fieldOrder);
 showDialog(title,form,()=>onApply(copy));
}
function renderObject(obj,container,fieldOrder){
 const grid=E('div',undefined,'fields');container.append(grid);
 const keys=fieldOrder?[...new Set([...fieldOrder,...Object.keys(obj)])]:Object.keys(obj);
 for(const key of keys){if(key==='id')continue;const v=obj[key]??'';
  if(v&&typeof v==='object'){
   const section=E('div',undefined,'wide');section.append(E('h3',human(key)));grid.append(section);
   if(Array.isArray(v))renderArray(v,section,key);else renderObject(v,section);continue;
  }
  const label=E('label',undefined,'field'+(richKeys.has(key)?' wide':''));label.append(E('span',human(key)));grid.append(label);
  if(richKeys.has(key)){label.append(richEditor(v,x=>obj[key]=x));continue;}
  const input=E('input');input.type=typeof v==='boolean'?'checkbox':typeof v==='number'?'number':/^#[a-f0-9]{6}$/i.test(v)?'color':'text';if(input.type==='checkbox')input.checked=v;else input.value=v;
  input.oninput=()=>obj[key]=input.type==='checkbox'?input.checked:input.type==='number'?(input.value===''?'':Number(input.value)):input.value;
  label.append(input);
 }
}
function renderArray(arr,container,key){
 const list=E('div');container.append(list);
 const prototype=()=>key==='nav'?{title:'New page',url:'/'}:key==='cards'?{title:'New card',description:'',url:'/',image:'',button:'Open'}:key==='citations'?{year:new Date().getFullYear(),count:0}:arr[0]&&typeof arr[0]==='object'?Object.fromEntries(Object.keys(arr[0]).map(k=>[k,typeof arr[0][k]==='number'?0:''])):'';
 const redraw=()=>{list.replaceChildren();arr.forEach((item,index)=>{
  const row=E('div',undefined,'array-item');const actions=E('div',undefined,'record-actions');
  actions.append(button('↑',()=>{if(index){[arr[index-1],arr[index]]=[arr[index],arr[index-1]];redraw();}}),button('↓',()=>{if(index<arr.length-1){[arr[index+1],arr[index]]=[arr[index],arr[index+1]];redraw();}}),button('Remove',()=>{arr.splice(index,1);redraw();},'danger'));
  if(item&&typeof item==='object')renderObject(item,row);else{const input=E('input');input.value=item;input.oninput=()=>arr[index]=input.value;row.append(input);}row.append(actions);list.append(row);
 });};redraw();container.append(button('Add '+human(key==='nav'?'navigation link':key==='cards'?'home card':'item'),()=>{arr.push(prototype());redraw();}));
}
function trash(kind,index){const item=doc.collections[kind].splice(index,1)[0];doc.trash.push({kind,item,deleted:new Date().toISOString()});changed();render(kind);}
function mergeDialog(kind,a,b,onDone){
 const left=doc.collections[kind][a],right=doc.collections[kind][b],result=clone(left),body=E('div');body.append(E('p','Choose the value to keep for each field. The other record will move to the recycle bin.'));
 for(const k of new Set([...Object.keys(left),...Object.keys(right)])){if(k==='id')continue;if(JSON.stringify(left[k])===JSON.stringify(right[k]))continue;
  const label=E('label',undefined,'field');label.append(E('span',human(k)));const select=E('select');
  for(const [i,v]of [left[k],right[k]].entries()){const opt=E('option',`${i?'Second':'First'}: ${typeof v==='object'?JSON.stringify(v):String(v??'(empty)')}`);opt.value=String(i);select.append(opt);}
  const defaultRight=left[k]===undefined||left[k]==='';select.value=defaultRight?'1':'0';result[k]=defaultRight?right[k]:left[k];select.onchange=()=>result[k]=select.value==='1'?right[k]:left[k];label.append(select);body.append(label);
 }
 showDialog('Merge duplicate records',body,()=>{doc.collections[kind][a]=result;const removed=doc.collections[kind].splice(b,1)[0];doc.trash.push({kind,item:removed,deleted:new Date().toISOString()});changed();onDone();});
}
function collectionView(kind,view){
 const tools=E('div',undefined,'toolbar'),search=E('input');search.type='search';search.placeholder='Search titles, people, years…';tools.append(search,button('Add entry',()=>{
  const item=Object.fromEntries(fields[kind].map(k=>[k,k==='year'&&kind==='publications'?new Date().getFullYear():'']));item.id=crypto.randomUUID();item.visible=true;
  editObject(item,x=>{const trial=clone(doc);trial.collections[kind].push(x);validate(trial);doc=trial;changed();render(kind);},'Add '+names[kind],fields[kind]);
 }),button('Import CSV',()=>csvImport(kind)),button('CSV template',()=>download(kind+'-template.csv',fields[kind].map(csvCell).join(',')+'\r\n','text/csv')),button('Export CSV',()=>download(kind+'.csv',[fields[kind].map(csvCell).join(','),...doc.collections[kind].map(r=>fields[kind].map(k=>csvCell(Array.isArray(r[k])?r[k].join('; '):r[k])).join(','))].join('\r\n'),'text/csv')));
 view.append(tools);
 const duplicates=findDuplicates(doc.collections[kind],kind),duplicateIds=new Set(duplicates.flatMap(p=>[p.a,p.b]));
 if(duplicates.length){const panel=E('details',undefined,'panel');panel.append(E('summary',`${duplicates.length} possible duplicate pair${duplicates.length===1?'':'s'} · review before merging`));for(const pair of duplicates.slice(0,100)){const row=E('div',undefined,'record');row.append(E('p',`${pair.reason}: ${doc.collections[kind][pair.a].title||doc.collections[kind][pair.a].name} ↔ ${doc.collections[kind][pair.b].title||doc.collections[kind][pair.b].name}`),button('Compare & merge',()=>mergeDialog(kind,pair.a,pair.b,()=>render(kind))));panel.append(row);}view.append(panel);}
 const list=E('div');view.append(list);
 function draw(){list.replaceChildren();doc.collections[kind].forEach((item,index)=>{if(search.value&&!JSON.stringify(item).toLowerCase().includes(search.value.toLowerCase()))return;
  const row=E('article',undefined,'record');row.append(E('h3',item.title||item.project||item.name));row.append(E('p',[item.name,item.year,item.section,item.subsection].filter(Boolean).join(' · ')));
  if(!item.visible)row.append(E('span','Hidden from published site','tag'));if(duplicateIds.has(index))row.append(E('span','Possible duplicate','tag'));
  const actions=E('div',undefined,'record-actions');actions.append(button('Edit',()=>editObject(item,x=>{const trial=clone(doc);trial.collections[kind][index]=x;validate(trial);doc=trial;changed();render(kind);},'Edit entry',fields[kind])),button('Move up',()=>{if(index){[doc.collections[kind][index-1],doc.collections[kind][index]]=[item,doc.collections[kind][index-1]];changed();render(kind);}}),button('Move down',()=>{if(index<doc.collections[kind].length-1){[doc.collections[kind][index+1],doc.collections[kind][index]]=[item,doc.collections[kind][index+1]];changed();render(kind);}}),button('Delete',()=>{if(confirm('Move this entry to the recycle bin?'))trash(kind,index);},'danger'));row.append(actions);list.append(row);
 });if(!list.children.length)list.append(E('p','No matching entries.'));}search.oninput=draw;draw();
}
function csvImport(kind){
 const input=E('input');input.type='file';input.accept='.csv,text/csv';input.onchange=async()=>{try{
  const file=input.files[0];if(file.size>500000)throw Error('CSV must be smaller than 500 KB.');const parsed=parseCSV(await file.text());
  const body=E('div'),mapping={};body.append(E('p',`Map columns for ${parsed.rows.length} rows. Extra columns are ignored. Records are added to your working draft only.`));
  for(const field of fields[kind]){const label=E('label',undefined,'field');label.append(E('span',human(field)));const select=E('select');select.append(new Option('Do not import',''));parsed.headers.forEach((h,i)=>select.append(new Option(h,String(i))));const match=parsed.headers.findIndex(h=>h.toLowerCase()===field.toLowerCase());select.value=match<0?'':String(match);mapping[field]=select.value;select.onchange=()=>mapping[field]=select.value;label.append(select);body.append(label);}
  showDialog('Map CSV columns',body,()=>{const rows=parsed.rows.map(row=>{const obj={id:crypto.randomUUID(),visible:true};for(const [field,col]of Object.entries(mapping))if(col!=='')obj[field]=row[Number(col)].trim();if(kind==='publications')obj.year=Number(obj.year);return obj;});setTimeout(()=>reviewImport(kind,rows),0);});
 }catch(e){message(e.message,true);}};input.click();
}
function reviewImport(kind,rows){
 const body=E('div'),selected=[],existing=doc.collections[kind],seen=[...existing];body.append(E('p','Uncheck records to skip. Potential duplicates start unchecked. You can import them for field-by-field merging afterwards. Invalid rows cannot be selected.'));
 const table=E('table'),head=E('tr');['Import','Record','Year','Review'].forEach(s=>head.append(E('th',s)));table.append(head);
 rows.forEach((row,index)=>{let error='';try{const trial=clone(doc);trial.collections[kind].push(row);validate(trial);}catch(e){error=e.message;}
  const match=seen.map(r=>duplicateReason(r,row,kind)).find(Boolean);seen.push(row);
  const tr=E('tr'),check=E('input');check.type='checkbox';check.checked=!error&&!match;check.disabled=!!error;selected[index]=check.checked;check.onchange=()=>selected[index]=check.checked;
  const td=E('td');td.append(check);tr.append(td,E('td',row.title||row.project||row.name||'(missing title)'),E('td',row.year||''),E('td',error||match||'New record'));table.append(tr);
 });const wrap=E('div',undefined,'table-scroll');wrap.append(table);body.append(wrap);
 showDialog('Review CSV import',body,()=>{const accepted=rows.filter((_,i)=>selected[i]);const trial=clone(doc);trial.collections[kind].push(...accepted);validate(trial);doc=trial;changed();render(kind);message(`${accepted.length} records imported; ${rows.length-accepted.length} skipped. Save your private draft when ready.`);});
}
function overview(view){const stats=E('div',undefined,'stats');for(const k of collections){const s=E('div',undefined,'stat');s.append(E('strong',String(doc.collections[k].length)),E('span',names[k]));stats.append(s);}view.append(stats);const panel=E('div',undefined,'panel');panel.append(E('h2','Your next update, without code'),E('p','Choose a section to edit a record or import a CSV. Save a private draft as you work. Publish only when the content is ready for your public website.'),E('p','Rich text descriptions support headings, lists, links, tables and formatted text. Dates, names and links use simple fields.'));view.append(panel);}
function preview(view){view.append(E('p','Content preview only. Your live Jekyll layout is preserved; check the deployed site after publishing. Hidden records are excluded here.','hint'));const select=E('select');for(const k of Object.keys(doc.pages))select.append(new Option(human(k),k));const area=E('div',undefined,'preview');view.append(select,area);function draw(){const key=select.value,p=doc.pages[key];area.replaceChildren(E('h2',p.title));const prose=E('div');prose.innerHTML=richHTML(p.body||'');area.append(prose);for(const item of (doc.collections[key]||[]).filter(i=>i.visible!==false)){const a=E('article');a.append(E('h3',item.title||item.project||item.name),E('p',[item.name,item.year,item.authors,item.venue,item.section,item.subsection].filter(Boolean).join(' · ')));const desc=E('div');desc.innerHTML=richHTML(item.description||'');a.append(desc);area.append(a);}if(key==='home')for(const card of p.cards){area.append(E('h3',card.title));const d=E('div');d.innerHTML=richHTML(card.description);area.append(d);}}select.onchange=draw;draw();}
function render(key){current=key;$('#heading').textContent=names[key];for(const b of $('#sections').children)b.classList.toggle('active',b.dataset.key===key);const view=$('#view');view.replaceChildren();
 if(collections.includes(key))return collectionView(key,view);
 if(key==='overview')return overview(view);
 if(key==='preview')return preview(view);
 if(['settings','labels','theme'].includes(key)){view.append(E('p',key==='settings'?'Edit your profile, contact links, and navigation. Navigation links point to existing pages; changing a label does not rename a page URL.':'Edit the visible wording or colours used throughout your site.'),button('Edit '+names[key],()=>editObject(doc[key],x=>{const trial=clone(doc);trial[key]=x;validate(trial);doc=trial;changed();render(key);},names[key])));const pre=E('div',undefined,'panel');pre.append(E('p',key==='settings'?doc.settings.title+' · '+doc.settings.description:Object.values(doc[key]).join(' · ')));view.append(pre);}
 if(key==='pages'){for(const [name,page] of Object.entries(doc.pages)){const p=E('div',undefined,'record');p.append(E('h3',human(name)),E('p',page.title),button('Edit page',()=>editObject(page,x=>{const trial=clone(doc);trial.pages[name]=x;validate(trial);doc=trial;changed();render(key);},human(name))));view.append(p);}}
 if(key==='citations'){view.append(E('p','Automatic mode uses the existing Scholar workflow. Turn it off to use the manually entered counts.'),button('Edit citation settings',()=>editObject({automatic_citations:doc.options.automatic_citations,citations:doc.citations},x=>{const trial=clone(doc);trial.options.automatic_citations=x.automatic_citations;trial.citations=x.citations;validate(trial);doc=trial;changed();render(key);},'Citations')));}
 if(key==='trash'){for(const [i,t]of doc.trash.entries()){const r=E('div',undefined,'record');r.append(E('h3',t.item.title||t.item.project||t.item.name),E('p',names[t.kind]+' · '+t.deleted),button('Restore',()=>{doc.collections[t.kind].push(t.item);doc.trash.splice(i,1);changed();render(key);}),button('Permanently remove from draft',()=>{if(confirm('Remove this entry from the recycle bin? Saved Git history will still retain previous versions.')){doc.trash.splice(i,1);changed();render(key);}},'danger'));view.append(r);}if(!doc.trash.length)view.append(E('p','Your recycle bin is empty.'));}
 if(key==='media'){view.append(E('p','Uploads become PUBLIC immediately and trigger a site build. Upload only public images and documents. Text drafts remain private.'),E('p','PNG, JPG, WebP or PDF, up to 500 KB per file. The returned path can be used in your profile photo, home cards, CV, or record links.','hint'));const file=E('input');file.type='file';file.accept='.png,.jpg,.jpeg,.webp,.pdf';view.append(file,button('Upload public file',async()=>{const f=file.files[0];if(!f)throw Error('Choose a file first.');if(f.size>512000)throw Error('Maximum file size is 500 KB.');if(!confirm('This file will be uploaded to your PUBLIC repository immediately. Continue?'))return;const bytes=new Uint8Array(await f.arrayBuffer());let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));await operation(async()=>{const r=await api('upload',{name:f.name,data:btoa(s)});const label=E('label',undefined,'field');label.append(E('span','Uploaded file path (copy into the appropriate field)'));const out=E('input');out.readOnly=true;out.value=r.path;label.append(out);view.append(label);message('Public file uploaded. It will become available when the site build completes.');});}));}
 if(key==='access'){view.append(E('h2','Approved editors'),E('p',session.editors.join(', ')),E('p','To add an editor, give their GitHub account write access to both repositories, let them authorise the GitHub App, and add their username to ADMIN_USERS in the Cloudflare Worker settings. They must sign in with their own account. Removing a username takes effect on the next request.'),E('h2','Restore a backup'),E('p','Export includes private hidden records and the recycle bin. Keep backups private. Importing replaces the working draft; saving and publishing are separate actions.'));const input=E('input');input.type='file';input.accept='.json';view.append(input,button('Restore JSON backup',async()=>{if(!input.files[0])throw Error('Choose a backup first.');if(input.files[0].size>800000)throw Error('Backup too large.');const next=JSON.parse(await input.files[0].text());validate(next);if(confirm('Replace the working draft with this backup?')){doc=next;doc.trash??=[];changed();render(key);}}));const a=E('a','Open build and deployment status');a.href=session.actions;a.target='_blank';a.rel='noopener';view.append(E('p'),a);}
}
$('#reload').onclick=()=>{if(!dirty||confirm('Discard unsaved changes and load the saved draft?'))operation(load);};
$('#save').onclick=()=>operation(save);
$('#export').onclick=()=>download('homepage-private-backup-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(doc,null,2));
$('#publish').onclick=()=>operation(async()=>{validate(doc);if(!confirm('Publish all visible content to your PUBLIC website repository? Hidden records and recycle bin are excluded.'))return;if(dirty||!draftSha)await save();const r=await api('publish',{draftSha,publicSha});publicSha=r.sha;$('#state').textContent='Publication committed · website build pending';message('Content published to GitHub. Wait for the Pages build to succeed before checking the live site.');});
$('#logout').onclick=()=>{if(dirty&&!confirm('Sign out and discard unsaved changes?'))return;operation(async()=>{await api('logout',{});location.reload();});};
window.addEventListener('beforeunload',e=>{if(dirty||$('#editor').open){e.preventDefault();e.returnValue='';}});
for(const [key,name]of Object.entries(names)){const b=button(name,()=>render(key));b.dataset.key=key;$('#sections').append(b);}
try{session=await api('session');$('#account').textContent=session.login;$('#logout').hidden=false;await load();$('#login').hidden=true;$('#workspace').hidden=false;}catch(e){message(e.message,true);}
