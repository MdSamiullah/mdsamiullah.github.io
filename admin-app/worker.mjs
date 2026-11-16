import {validate,publicDocument} from './public/core.mjs';
const enc=new TextEncoder(),dec=new TextDecoder();
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json'}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const b64=b=>{let s='';for(let i=0;i<b.length;i+=8192)s+=String.fromCharCode(...b.subarray(i,i+8192));return btoa(s);};
const un64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const url64=b=>b64(b).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const random=()=>url64(crypto.getRandomValues(new Uint8Array(32)));
async function key(env){if(!env.SESSION_SECRET||env.SESSION_SECRET.length<32)fail('SESSION_SECRET must contain at least 32 random characters.',503);return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',enc.encode(env.SESSION_SECRET)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
export async function seal(value,env){const iv=crypto.getRandomValues(new Uint8Array(12));return b64(iv)+'.'+b64(new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(env),enc.encode(JSON.stringify(value)))));}
export async function unseal(value,env){try{const [iv,data]=value.split('.');const v=JSON.parse(dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(iv)},await key(env),un64(data))));if(v.exp<Date.now())return null;return v;}catch{return null;}}
const cookie=(name,value,age)=>`${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
const cookies=req=>Object.fromEntries((req.headers.get('Cookie')||'').split(';').map(x=>{const p=x.trim().indexOf('=');return p<0?['','']:[x.trim().slice(0,p),x.trim().slice(p+1)];}));
async function github(token,path,method='GET',body){
 const res=await fetch('https://api.github.com'+path,{method,headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Homepage-Admin','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 if(res.status===404)return null;
 if(!res.ok)fail(res.status===409||res.status===422?'Content changed elsewhere. Reload before saving; export your draft first.':`GitHub returned ${res.status}. Check sign-in, repository access, App permissions and branch rules.`,res.status);
 return res.status===204?{}:res.json();
}
async function readFile(token,repo,path,branch){
 const file=await github(token,`/repos/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`);
 if(!file)return null;
 let content=file.content;
 if(!content && file.sha){const blob=await github(token,`/repos/${repo}/git/blobs/${file.sha}`);content=blob?.content;}
 if(!content)fail('Cannot read content file.',502);
 return {sha:file.sha,doc:JSON.parse(dec.decode(un64(content.replace(/\s/g,''))))};
}
async function writeFile(token,repo,path,branch,doc,sha,message){
 const r=await github(token,`/repos/${repo}/contents/${path}`,'PUT',{message,branch,content:b64(enc.encode(JSON.stringify(doc,null,2)+'\n')),...(sha?{sha}:{})});
 if(!r)fail('Repository or branch not found.',404);
 return {sha:r.content.sha,commit:r.commit.sha};
}
async function body(req,max=900000){
 if(!req.headers.get('Content-Type')?.includes('application/json'))fail('JSON is required.',415);
 const reader=req.body?.getReader();if(!reader)fail('Missing request body.');let size=0,chunks=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();fail('Request is too large.',413);}chunks.push(value);}
 const all=new Uint8Array(size);let at=0;for(const c of chunks){all.set(c,at);at+=c.length;}try{return JSON.parse(dec.decode(all));}catch{fail('Invalid JSON.');}
}
async function route(req,env){
 const u=new URL(req.url),p=u.pathname;
 if(p==='/auth/login'){
  const state=random(),verifier=random();const challenge=url64(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(verifier))));
  const target=new URL('https://github.com/login/oauth/authorize');target.search=new URLSearchParams({client_id:env.GITHUB_CLIENT_ID,redirect_uri:env.APP_ORIGIN+'/auth/callback',state,code_challenge:challenge,code_challenge_method:'S256'});
  return new Response(null,{status:302,headers:{Location:target.href,'Set-Cookie':cookie('__Host-oauth',await seal({state,verifier,exp:Date.now()+600000},env),600)}});
 }
 if(p==='/auth/callback'){
  const state=await unseal(cookies(req)['__Host-oauth']||'',env);
  if(!state||state.state!==u.searchParams.get('state')||!u.searchParams.get('code'))fail('Sign-in expired or state mismatch. Start sign-in again.',403);
  const params=new URLSearchParams({client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,code:u.searchParams.get('code'),redirect_uri:env.APP_ORIGIN+'/auth/callback',code_verifier:state.verifier});
  const r=await fetch('https://github.com/login/oauth/access_token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},body:params.toString()});
  const t=await r.json();
  if(!t.access_token){
   const messages={incorrect_client_credentials:'GitHub rejected the Client ID or client secret. Check that wrangler.toml has this App’s Client ID and Cloudflare has its current client secret.',bad_verification_code:'This sign-in code is expired or was already used. Start a fresh sign-in.',redirect_uri_mismatch:'The callback URL does not match. Check APP_ORIGIN and the GitHub App Redirect URL.',access_denied:'GitHub sign-in was declined.'};
   fail(messages[t.error]||'GitHub could not exchange the sign-in code. Check the App Client ID, client secret, and exact callback URL, then start a fresh sign-in.',401);
  }
  const user=await github(t.access_token,'/user');if(!allowed(user?.login,env))fail('This GitHub account is not an approved editor.',403);
  const h=new Headers({Location:'/'});h.append('Set-Cookie',cookie('__Host-oauth','',0));h.append('Set-Cookie',cookie('__Host-session',await seal({token:t.access_token,login:user.login,exp:Date.now()+Math.min(t.expires_in||28800,28800)*1000},env),Math.min(t.expires_in||28800,28800)));
  return new Response(null,{status:302,headers:h});
 }
 if(!p.startsWith('/api/'))return env.ASSETS.fetch(req);
 const session=await unseal(cookies(req)['__Host-session']||'',env);
 if(!session||!allowed(session.login,env))fail('Sign in with GitHub to continue.',401);
 if(req.method!=='GET'&&(req.headers.get('Origin')!==env.APP_ORIGIN||req.headers.get('X-Homepage-Admin')!=='1'))fail('Request origin rejected.',403);
 const token=session.token,branch=env.BRANCH||'main';
 if(p==='/api/session'&&req.method==='GET')return json({login:session.login,publicRepo:env.PUBLIC_REPO,contentRepo:env.CONTENT_REPO,editors:env.ADMIN_USERS.split(',').map(s=>s.trim()),actions:`https://github.com/${env.PUBLIC_REPO}/actions`});
 if(p==='/api/logout'&&req.method==='POST')return new Response('{}',{headers:{'Content-Type':'application/json','Set-Cookie':cookie('__Host-session','',0)}});
 if(p==='/api/content'&&req.method==='GET'){
  const repo=await github(token,`/repos/${env.CONTENT_REPO}`);if(!repo||!repo.private)fail('Content repository must exist and be private.',403);
  const pub=await readFile(token,env.PUBLIC_REPO,'_data/managed.json',branch);if(!pub)fail('Deploy the updated public repository first.',404);
  const draft=await readFile(token,env.CONTENT_REPO,'draft.json',branch);
  return json({doc:draft?.doc||{...pub.doc,trash:[]},draftSha:draft?.sha||null,publicSha:pub.sha});
 }
 if(p==='/api/save'&&req.method==='POST'){
  const data=await body(req);validate(data.doc);
  const repo=await github(token,`/repos/${env.CONTENT_REPO}`);if(!repo?.private)fail('Drafts can only be saved to the private content repository.',403);
  const current=await readFile(token,env.CONTENT_REPO,'draft.json',branch);if((current?.sha||null)!==data.sha)fail('Draft changed in another session. Export your work, then reload.',409);
  return json(await writeFile(token,env.CONTENT_REPO,'draft.json',branch,data.doc,data.sha,`Save homepage draft (${session.login})`));
 }
 if(p==='/api/publish'&&req.method==='POST'){
  const data=await body(req);const draft=await readFile(token,env.CONTENT_REPO,'draft.json',branch);
  if(!draft||draft.sha!==data.draftSha)fail('Save your latest draft and reload any conflicting changes before publishing.',409);
  const current=await readFile(token,env.PUBLIC_REPO,'_data/managed.json',branch);if(current?.sha!==data.publicSha)fail('The published version changed. Reload before publishing.',409);
  const doc=publicDocument(draft.doc);
  return json(await writeFile(token,env.PUBLIC_REPO,'_data/managed.json',branch,doc,data.publicSha,`Publish homepage content (${session.login})`));
 }
 if(p==='/api/upload'&&req.method==='POST'){
  const data=await body(req,750000);
  // Public assets are intentionally separate from private text drafts. No SVG/HTML uploads.
  if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,70}\.(png|jpg|jpeg|webp|pdf)$/i.test(data.name||''))fail('Use a simple PNG, JPG, WebP or PDF filename.');
  if(!/^[A-Za-z0-9+/]+={0,2}$/.test(data.data||''))fail('Invalid file data.');
  const bytes=un64(data.data);if(bytes.length>512000)fail('Upload files up to 500 KB. Optimise larger images/PDFs first.');
  const ext=data.name.split('.').pop().toLowerCase();const head=dec.decode(bytes.slice(0,12));
  const valid=ext==='pdf'?head.startsWith('%PDF-'):ext==='png'?b64(bytes.slice(0,8))==='iVBORw0KGgo=':['jpg','jpeg'].includes(ext)?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:head.startsWith('RIFF')&&head.slice(8)==='WEBP';
  if(!valid)fail('File contents do not match its extension.');
  const path=`assets/uploads/${crypto.randomUUID()}-${data.name}`;
  const r=await github(token,`/repos/${env.PUBLIC_REPO}/contents/${path}`,'PUT',{message:`Upload homepage asset (${session.login})`,branch,content:data.data});if(!r)fail('Asset upload failed.',502);
  return json({path:'/'+path});
 }
 fail('Not found.',404);
}
function allowed(login,env){return !!login&&(env.ADMIN_USERS||'').toLowerCase().split(',').map(s=>s.trim()).includes(login.toLowerCase());}
export default {async fetch(req,env){let res;try{res=await route(req,env);}catch(e){res=json({error:e.status?e.message:'Unexpected server error. Retry or check Worker configuration.'},e.status||500);}const h=new Headers(res.headers);h.set('Cache-Control','no-store');h.set('X-Content-Type-Options','nosniff');h.set('Referrer-Policy','no-referrer');h.set('X-Frame-Options','DENY');h.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");return new Response(res.body,{status:res.status,headers:h});}};
