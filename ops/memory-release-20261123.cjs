'use strict';
const fs = require('node:fs');
const cp = require('node:child_process');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {pathToFileURL} = require('node:url');
const stage = '/root/ais-memory-212f075-20261123';
const app = stage + '/app';
const oldStage = '/root/ais-reliability-82838bf-20261118';
const oldApp = oldStage + '/app';
const release = '212f075d1198-linux-20261123';
const source = '212f075d11985f818424c3f87ff94cf96dfe4954';
const oldRelease = 'babcc090bd4d-linux-20261118';
const node = '/root/ais-release-0bfb9ed-20261109/runtime/node-v22.23.4-linux-x64/bin/node';
const nginxFile = '/etc/nginx/sites-available/ais_web';
const MiB = 1024 ** 2;
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const run = (command, args, options = {}) => cp.execFileSync(command, args, {encoding:'utf8',maxBuffer:16*MiB,...options});
const pm2 = args => run('pm2', args);
const processes = () => JSON.parse(pm2(['jlist']));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const read = file => JSON.parse(fs.readFileSync(stage + '/' + file));
const write = (file, value, once = false) => fs.writeFileSync(stage + '/' + file, JSON.stringify(value,null,2), {mode:0o600,flag:once?'wx':'w'});
const disk = () => {const s=fs.statfsSync('/');return s.bavail*s.bsize;};
const available = () => Number(fs.readFileSync('/proc/meminfo','utf8').match(/^MemAvailable:\s+(\d+)/m)[1])*1024;
const active = () => {const rows=processes();assert.equal(rows.length,1,'Unexpected PM2 topology');return rows[0];};
function assertOld() {
  const p=active();assert.equal(p.name,'AIS_web');assert.equal(p.pm2_env.status,'online');
  assert.equal(p.pm2_env.AIS_RELEASE_ID,oldRelease);assert.equal(p.pm2_env.pm_cwd,oldApp);return p;
}
function assertHost() {
  assert.equal(process.getuid(),0);assert.equal(run('hostname',[]).trim(),'ubuntu-s-1vcpu-1gb-sfo3-01');
  assert.equal(run(node,['--version']).trim(),'v22.23.4');
}
async function request(port, route, identity, status=200, location) {
  const r=await fetch('http://127.0.0.1:'+port+route,{redirect:'manual',signal:AbortSignal.timeout(30000),headers:{'user-agent':'AIS-Release-Verification/1.0'}});
  const body=await r.text();assert.equal(r.status,status,route+' HTTP');
  if (status<300 || r.headers.has('x-ais-release')) assert.equal(r.headers.get('x-ais-release'),identity,route+' release');
  if(location)assert.equal(new URL(r.headers.get('location'),'http://localhost:'+port).pathname,location);
  return body;
}
async function ready(port, identity) {
  let last;for(let n=0;n<30;n++){try{await request(port,'/',identity);return;}catch(e){last=e;await sleep(1000);}}throw last;
}
async function smoke(port, identity) {
  for(const route of ['/','/parts','/contact','/services/ct-service','/services/mri-service','/trailers/mobile-ct-trailer-rental','/trailers/mobile-mri-trailer-rental','/sitemap.xml']){
    const body=await request(port,route,identity);
    if(route==='/contact')assert(body.includes('559')&&body.includes('6851')&&body.includes('800')&&body.includes('3583'));
    await sleep(150);
  }
  await request(port,'/ct',identity,308,'/services/ct-service');
}
function capture() {
  assert(!fs.existsSync(stage),'Existing stage must be inspected, not overwritten');
  const p=assertOld();assert(disk()>1.35*1024**3,'Staging disk gate');assert(available()>=350*MiB,'Staging RAM gate');
  const previous=JSON.parse(fs.readFileSync(oldStage+'/ecosystem.candidate.private.json'));
  const config=previous.apps[0], e=p.pm2_env;
  assert.equal(previous.apps.length,1);assert.equal(config.name,p.name);assert.equal(config.cwd,e.pm_cwd);
  assert.equal(config.script,e.pm_exec_path);assert.equal(config.interpreter,e.exec_interpreter);
  assert.deepEqual(config.args,e.args);assert.deepEqual(config.node_args,e.node_args);
  assert.equal(config.env.AIS_RELEASE_ID,oldRelease);assert.equal(e.max_memory_restart,450*MiB);
  assert.equal(fs.realpathSync('/etc/nginx/sites-enabled/ais_web'),nginxFile);
  const nginx=fs.readFileSync(nginxFile);assert.equal((nginx.toString().match(/proxy_pass http:\/\/localhost:3000;/g)||[]).length,1);
  fs.mkdirSync(stage,{mode:0o700});fs.mkdirSync(stage+'/rollback',{mode:0o700});
  write('rollback/pm2.private.json',[p],true);write('rollback/ecosystem.private.json',previous,true);
  fs.writeFileSync(stage+'/rollback/nginx.conf',nginx,{mode:0o600,flag:'wx'});
  if(fs.existsSync('/root/.pm2/dump.pm2'))fs.copyFileSync('/root/.pm2/dump.pm2',stage+'/rollback/dump.private.json',fs.constants.COPYFILE_EXCL);
  fs.chmodSync(stage+'/rollback/dump.private.json',0o600);
  const result={at:new Date().toISOString(),release:oldRelease,pid:p.pid,restarts:e.restart_time,nginxSha256:sha(nginx),nginxMode:fs.statSync(nginxFile).mode&0o777,diskBytes:disk(),availableBytes:available()};
  write('baseline.json',result,true);console.log(JSON.stringify({captured:true,...result}));
}
function stageSource() {
  assertOld();assert(!fs.existsSync(app));assert(disk()>1.25*1024**3);
  fs.mkdirSync(app,{mode:0o700});fs.mkdirSync(stage+'/git-home',{mode:0o700});
  const env={PATH:path.dirname(node)+':/usr/local/bin:/usr/bin:/bin',HOME:stage+'/git-home',LANG:'C.UTF-8',GIT_TERMINAL_PROMPT:'0'};
  const git=args=>run('git',['-C',app,...args],{env});
  git(['init']);git(['remote','add','origin','https://github.com/RoboRiot/AIS_web.git']);
  git(['sparse-checkout','init','--no-cone']);git(['sparse-checkout','set','--no-cone','/*','!/data/']);
  git(['fetch','--depth=1','--filter=blob:none','origin',source]);git(['checkout','--detach',source]);
  assert.equal(git(['rev-parse','HEAD']).trim(),source);assert(!fs.existsSync(app+'/data'));
  const lock=sha(fs.readFileSync(app+'/package-lock.json'));
  assert.equal(lock,'942c074a7c95baca7436fb72b07f275f2da9b08c4b3e95293c3f3fdd89a0f5d5');
  assert.equal(lock,sha(fs.readFileSync(oldApp+'/package-lock.json')));
  fs.symlinkSync(oldApp+'/node_modules',app+'/node_modules','dir');
  run(node,['scripts/verify-runtime-memory-fixes.cjs'],{cwd:app});
  assert.equal(require(app+'/node_modules/next/package.json').version,'15.5.29');
  assert(fs.lstatSync(oldApp+'/.env.production').isFile());
  fs.writeFileSync(app+'/.env.production',fs.readFileSync(oldApp+'/.env.production'),{flag:'wx',mode:0o600});
  assert(disk()>1024**3,'Post-source disk gate');assertOld();
  write('source-ready.json',{source,release,dependencySource:oldApp+'/node_modules',dependenciesUnmodified:true,diskBytes:disk()},true);
  console.log(JSON.stringify({sourceReady:true,source,diskBytes:disk()}));
}
async function nginx() {
  assertOld();const before=fs.readFileSync(stage+'/rollback/nginx.conf');
  assert.equal(sha(fs.readFileSync(nginxFile)),sha(before),'Nginx drift');
  const {prepareNginxUpstream}=await import(pathToFileURL(app+'/scripts/prepare-nginx-upstream.mjs'));
  const after=Buffer.from(prepareNginxUpstream(before.toString()));
  fs.writeFileSync(stage+'/nginx.candidate.conf',after,{flag:'wx',mode:0o600});
  run('nginx',['-t']);
  try {
    fs.writeFileSync(nginxFile,after);run('nginx',['-t']);run('systemctl',['reload','nginx']);
    const response=run('curl',['--silent','--show-error','--fail','--max-time','30','--resolve','advancedimagingparts.com:443:127.0.0.1','-I','https://advancedimagingparts.com/']);
    assert(response.includes(oldRelease),'Nginx release check');
    write('nginx-applied.json',{at:new Date().toISOString(),before:sha(before),after:sha(after),tested:true,reloaded:true},true);
    console.log(JSON.stringify({nginxReloaded:true,onlyChange:'localhost:3000 -> 127.0.0.1:3000',release:oldRelease}));
  } catch(error) {fs.writeFileSync(nginxFile,before);run('nginx',['-t']);run('systemctl',['reload','nginx']);throw error;}
}
async function installArtifact() {
  assertOld();assert(read('source-ready.json').source===source);assert(disk()>1.1*1024**3);
  const revision=process.argv[3];assert(/^[0-9a-f]{40}$/.test(revision));
  const root='.next-releases/'+release,transport=stage+'/artifact';assert(!fs.existsSync(app+'/'+root));
  fs.mkdirSync(transport,{mode:0o700});
  const download=async(file,max)=>{const r=await fetch('https://raw.githubusercontent.com/RoboRiot/AIS_web/'+revision+'/ops/artifact/'+file,{signal:AbortSignal.timeout(60000)});assert.equal(r.status,200);const b=Buffer.from(await r.arrayBuffer());assert(b.length<=max);fs.writeFileSync(transport+'/'+file,b,{flag:'wx',mode:0o600});return b;};
  const manifest=JSON.parse(await download('manifest.json',20000));
  assert.equal(manifest.release,release);assert.equal(manifest.sourceRevision,source);assert.equal(manifest.workflowRunId,'45263811550');
  assert.equal(manifest.sha256,'5c854aa6db9e5afce7f5eae1688e92c4664562c204cb83ca8d8d549639dda3e9');
  assert.equal(manifest.nodeVersion,'v22.23.4');assert.equal(manifest.platform,'linux');assert.equal(manifest.arch,'x64');
  assert.deepEqual(manifest.checks.tests,{repository:233,recovery:9});
  assert.equal(manifest.dependencyLockSha256,sha(fs.readFileSync(app+'/package-lock.json')));
  const t=manifest.transport,ciphertext=await download('release.tar.gz.enc',6*MiB);
  assert.equal(sha(ciphertext),'8d1b5857fe51447ed0118f053af9c39732ebfeea4b6127885294553196f0bd7e');
  assert.equal(ciphertext.length,4877620);
  const keyFile=oldStage+'/release-transport.key';assert.equal(fs.statSync(keyFile).mode&0o077,0);
  const privateKey=crypto.createPrivateKey(fs.readFileSync(keyFile));
  assert.equal(sha(crypto.createPublicKey(privateKey).export({type:'spki',format:'der'})),'49fdcd0d2cb9dce16ecc323f4ba1ae2e860e9d648ee23eb3ec1f4a09aac40869');
  const key=crypto.privateDecrypt({key:privateKey,oaepHash:'sha256',padding:crypto.constants.RSA_PKCS1_OAEP_PADDING},Buffer.from(t.serverWrappedKeyBase64,'base64'));
  const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(t.ivBase64,'base64'));
  decipher.setAAD(Buffer.from('AIS memory reliability release\n'+release+'\n'+source));decipher.setAuthTag(Buffer.from(t.tagBase64,'base64'));
  const plain=Buffer.concat([decipher.update(ciphertext),decipher.final()]);assert.equal(sha(plain),manifest.sha256);
  const archive=transport+'/release.tar.gz';fs.writeFileSync(archive,plain,{flag:'wx',mode:0o600});
  const entries=run('tar',['-tzf',archive]).trim().split('\n');assert(entries.length>700&&entries.length<1000);assert.equal(new Set(entries).size,entries.length);
  assert(entries.every(n=>n.startsWith(root+'/')&&!n.split('/').some(p=>['..','.git','node_modules','cache'].includes(p)||p.startsWith('.env'))));
  const listing=run('tar',['-tvzf',archive]).trim().split('\n');assert(listing.every(n=>n[0]==='-'||n[0]==='d'));
  const bytes=listing.reduce((sum,line)=>sum+Number(line.trim().split(/\s+/)[2]),0);assert(Number.isFinite(bytes)&&disk()-bytes>1024**3);
  run('tar',['-xzf',archive,'-C',app,'--no-same-owner','--no-same-permissions']);
  assert.equal(fs.readFileSync(app+'/'+root+'/BUILD_ID','utf8').trim(),release);
  let retained=0;function copyAssets(from,to){fs.mkdirSync(to,{recursive:true});for(const e of fs.readdirSync(from,{withFileTypes:true})){assert(!e.isSymbolicLink());const a=path.join(from,e.name),b=path.join(to,e.name);if(e.isDirectory())copyAssets(a,b);else{assert(e.isFile());if(fs.existsSync(b))assert.equal(sha(fs.readFileSync(a)),sha(fs.readFileSync(b)),'Immutable asset collision');else{fs.copyFileSync(a,b,fs.constants.COPYFILE_EXCL);retained++;}}}}
  copyAssets(oldApp+'/.next-releases/'+oldRelease+'/static',app+'/'+root+'/static');
  const env=require(app+'/node_modules/@next/env').loadEnvConfig(app,false,{info(){},error(){}}).parsedEnv||{};
  const secretValues=Object.entries(env).filter(([k,v])=>!k.startsWith('NEXT_PUBLIC_')&&/(SECRET|PASSWORD|PRIVATE|TOKEN|API_KEY)/i.test(k)&&v.length>=12).map(([,v])=>v);
  let scanned=0;function scan(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())scan(p);else if(/\.(js|json|html|css)$/.test(e.name)){const content=fs.readFileSync(p,'utf8');assert(!secretValues.some(s=>content.includes(s)),'Runtime secret in client asset');scanned++;}}}scan(app+'/'+root+'/static');
  assert(disk()>1024**3);assertOld();const result={source,release,archiveMembers:entries.length,expandedBytes:bytes,retainedAssets:retained,scannedClientFiles:scanned,diskBytes:disk(),privateRuntimeOnly:true};write('artifact-ready.json',result,true);console.log(JSON.stringify(result));
}
function candidateConfig() {
  process.env.AIS_APP_ROOT=app;process.env.AIS_NODE_BINARY=node;process.env.AIS_RELEASE_ID=release;process.env.AIS_PORT='3000';
  const config=require(app+'/ecosystem.config.cjs'), item=config.apps[0];
  item.env={...read('rollback/ecosystem.private.json').apps[0].env,...item.env,PATH:path.dirname(node)+':/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',AIS_APP_ROOT:app,AIS_NODE_BINARY:node};
  assert(item.node_args.includes('--max-old-space-size=320'));assert.equal(item.max_memory_restart,'450M');
  item.out_file=stage+'/runtime-out.private.log';item.error_file=stage+'/runtime-error.private.log';item.time=true;
  for(const file of [item.out_file,item.error_file])if(!fs.existsSync(file))fs.writeFileSync(file,'',{mode:0o600,flag:'wx'});
  write('ecosystem.candidate.private.json',config);return config;
}
async function preview() {
  assertOld();assert(disk()>1024**3);assert(available()>=350*MiB,'Pre-preview RAM gate');
  assert(read('artifact-ready.json').source===source);assert(!fs.existsSync(stage+'/preview-result.json'));
  const config=candidateConfig().apps[0], samples=[];let child,verifier,failure=null;
  const dist=app+'/.next-releases/'+release;const manifest=JSON.parse(fs.readFileSync(dist+'/prerender-manifest.json'));
  let aged=0;for(const route of Object.keys(manifest.routes)){
    if(!route.endsWith('.xml')||!route.includes('sitemap'))continue;assert(!route.includes('..'));
    const file=dist+'/server/app/'+route.slice(1),meta=JSON.parse(fs.readFileSync(file+'.meta'));
    meta.routeCacheLastModified=Date.now()-7200000;fs.writeFileSync(file+'.meta',JSON.stringify(meta));
    fs.utimesSync(file+'.body',new Date(meta.routeCacheLastModified),new Date(meta.routeCacheLastModified));aged++;
  }assert.equal(aged,84);
  const out=fs.openSync(stage+'/preview-out.private.log','wx',0o600),err=fs.openSync(stage+'/preview-error.private.log','wx',0o600);
  child=cp.spawn(node,[...config.node_args,config.script,'start','-H','127.0.0.1','-p','3001'],{cwd:app,env:{...process.env,...config.env},stdio:['ignore',out,err]});
  fs.closeSync(out);fs.closeSync(err);const started=Date.now();
  const stop=message=>{failure||=message;if(verifier?.pid){try{process.kill(-verifier.pid,'SIGTERM');}catch(e){if(e.code!=='ESRCH')throw e;}}if(child.exitCode===null)child.kill('SIGTERM');};
  child.once('error',e=>stop(e.message));
  const sample=()=>{try{const rss=Number(fs.readFileSync('/proc/'+child.pid+'/status','utf8').match(/^VmRSS:\s+(\d+)/m)[1])*1024;const ram=available();samples.push({at:new Date().toISOString(),rssBytes:rss,availableBytes:ram});if(rss>=400*MiB||ram<150*MiB)stop('Preview memory gate failed');}catch(e){stop('Preview process missing');}};
  const timer=setInterval(sample,2000);
  write('preview-progress.json',{started:new Date(started).toISOString(),pid:child.pid,release});
  try {
    await ready(3001,release);sample();if(failure)throw Error(failure);
    const log=fs.openSync(stage+'/preview-http.private.log','wx',0o600);
    try {await new Promise((resolve,reject)=>{
      verifier=cp.spawn(node,['--max-old-space-size=96','scripts/verify-release.mjs','http://localhost:3001',release,stage+'/preview-http.json'],{cwd:app,detached:true,env:{...process.env,...config.env,NODE_OPTIONS:'--max-old-space-size=96'},stdio:['ignore',log,log]});
      const timeout=setTimeout(()=>{stop('Verifier timeout');reject(Error('Verifier timeout'));},600000);
      verifier.once('error',e=>{clearTimeout(timeout);reject(e);});verifier.once('close',code=>{clearTimeout(timeout);verifier=null;code===0&&!failure?resolve():reject(Error(failure||'HTTP gate failed: '+code));});
    });}finally{fs.closeSync(log);}
    while(Date.now()-started<1800000){if(failure)throw Error(failure);assert.equal(child.exitCode,null);await smoke(3001,release);await sleep(60000);}
    sample();if(failure)throw Error(failure);assertOld();
    const errors=fs.readFileSync(stage+'/preview-error.private.log','utf8');assert(!/FATAL ERROR|heap out of memory|ENOMEM|Unable to generate|Missing Firebase|Unhandled/i.test(errors),'Preview runtime error');
    const result={success:true,release,source,started:new Date(started).toISOString(),finished:new Date().toISOString(),elapsedMs:Date.now()-started,agedSitemaps:aged,peakRssBytes:Math.max(...samples.map(x=>x.rssBytes)),minAvailableBytes:Math.min(...samples.map(x=>x.availableBytes)),fullHttpGate:true,submissions:0};
    write('preview-result.json',result,true);console.log(JSON.stringify(result));
  }catch(error){write('preview-failure.json',{at:new Date().toISOString(),reason:error.message});throw error;}
  finally{clearInterval(timer);if(child.exitCode===null)child.kill('SIGTERM');for(let n=0;n<40&&child.exitCode===null&&child.signalCode===null;n++)await sleep(250);assert(child.exitCode!==null||child.signalCode!==null,'Preview did not stop');write('preview-memory.json',{samples});await request(3000,'/',oldRelease);}
}
function restoreNginx() {
  if(!fs.existsSync(stage+'/nginx-applied.json'))return;
  const saved=read('nginx-applied.json'),current=sha(fs.readFileSync(nginxFile));
  assert([saved.before,saved.after].includes(current),'Nginx changed outside deployment');
  fs.writeFileSync(nginxFile,fs.readFileSync(stage+'/rollback/nginx.conf'));run('nginx',['-t']);run('systemctl',['reload','nginx']);
}
async function rollback() {
  const rows=processes();assert(rows.length<=1,'Unexpected rollback topology');const current=rows[0];
  if(current){assert.equal(current.name,'AIS_web');assert([app,oldApp].includes(current.pm2_env.pm_cwd));}
  if(current?.pm2_env.pm_cwd===app)pm2(['delete','AIS_web']);
  if(!current||current.pm2_env.pm_cwd===app)pm2(['start',stage+'/rollback/ecosystem.private.json','--only','AIS_web']);
  else if(current.pm2_env.status!=='online')pm2(['restart','AIS_web']);
  await ready(3000,oldRelease);await smoke(3000,oldRelease);restoreNginx();pm2(['save']);
  write('rollback-result.json',{at:new Date().toISOString(),release:oldRelease,verified:true});console.log(JSON.stringify({rolledBack:true,release:oldRelease}));
}
async function cutover(singleCopyApproved=false) {
  if(singleCopyApproved){const http=read('preview-http.json');assert(http.httpVerified&&http.expectedRelease===release&&http.pages===81&&http.resources===1001);assert.equal(read('preview-failure.json').reason,'Preview memory gate failed');assert(!fs.existsSync('/proc/'+read('preview-progress.json').pid),'Preview must be stopped');}
  else {const preview=read('preview-result.json');assert(preview.success&&preview.release===release&&preview.elapsedMs>=1800000);}
  const before=assertOld();assert(available()>=350*MiB);assert(disk()>1024**3);assert(read('nginx-applied.json').tested);candidateConfig();
  write('rollback/pm2-cutover.private.json',[before],true);
  write('cutover-baseline.json',{at:new Date().toISOString(),pid:before.pid,restarts:before.pm2_env.restart_time,oldRelease,singleCopyApproved},true);
  const started=Date.now();
  try{pm2(['stop','AIS_web']);pm2(['delete','AIS_web']);pm2(['start',stage+'/ecosystem.candidate.private.json','--only','AIS_web']);await ready(3000,release);await smoke(3000,release);
    const p=active();assert.equal(p.pm2_env.pm_cwd,app);write('cutover-result.json',{started:new Date(started).toISOString(),release,pid:p.pid,restarts:p.pm2_env.restart_time,bootSaved:false},true);console.log(JSON.stringify({cutover:true,release,pid:p.pid,elapsedMs:Date.now()-started,bootSaved:false}));
  }catch(error){await rollback();throw error;}
}
async function observe() {
  const baseline=read('cutover-result.json'),started=Date.now(),samples=[];
  const logStates=['/var/log/nginx/access.log','/var/log/nginx/error.log'].map(file=>({file,inode:fs.statSync(file).ino,offset:fs.statSync(file).size}));
  function checkLogs(){for(const state of logStates){const stat=fs.statSync(state.file);if(stat.ino!==state.inode||stat.size<state.offset){state.inode=stat.ino;state.offset=0;}const size=stat.size-state.offset;assert(size<=4*MiB,'Unexpected nginx log growth');if(!size)continue;const handle=fs.openSync(state.file,'r'),buffer=Buffer.alloc(size);try{fs.readSync(handle,buffer,0,size,state.offset);}finally{fs.closeSync(handle);}state.offset=stat.size;const value=buffer.toString();if(state.file.endsWith('/access.log'))assert(!/"\s+5\d\d\s/.test(value),'New nginx 5xx after cutover');else assert(!/connect\(\) failed|upstream prematurely closed|upstream timed out|no live upstreams/.test(value),'New nginx upstream failure');}}
  try{while(Date.now()-started<1800000){const p=active();assert.equal(p.pid,baseline.pid);assert.equal(p.pm2_env.restart_time,baseline.restarts);assert.equal(p.pm2_env.status,'online');assert.equal(p.pm2_env.AIS_RELEASE_ID,release);assert(p.monit.memory<400*MiB);assert(available()>=150*MiB);assert(disk()>1024**3);samples.push({at:new Date().toISOString(),rssBytes:p.monit.memory,availableBytes:available()});await smoke(3000,release);checkLogs();write('live-progress.json',{started:new Date(started).toISOString(),samples:samples.length,release,latest:samples.at(-1)});await sleep(60000);}
    checkLogs();
    const errors=fs.readFileSync(stage+'/runtime-error.private.log','utf8');assert(!/FATAL ERROR|heap out of memory|ENOMEM|Unable to generate|Missing Firebase|Unhandled/i.test(errors));
    const result={success:true,release,started:new Date(started).toISOString(),elapsedMs:Date.now()-started,peakRssBytes:Math.max(...samples.map(x=>x.rssBytes)),minAvailableBytes:Math.min(...samples.map(x=>x.availableBytes)),restarts:0,nginx5xx:0,nginxUpstreamErrors:0,samples};write('live-result.json',result,true);console.log(JSON.stringify({...result,samples:samples.length}));
  }catch(error){write('live-failure.json',{at:new Date().toISOString(),reason:error.message});await rollback();throw error;}
}
async function finalize() {
  const live=read('live-result.json'),browser=read('browser-acceptance.json');assert(live.success&&live.elapsedMs>=1800000&&live.release===release);assert(browser.release===release&&browser.desktop&&browser.mobile&&browser.publicHttp&&browser.nginxErrors===0);
  const p=active(),cutover=read('cutover-result.json');assert.equal(p.pid,cutover.pid);assert.equal(p.pm2_env.restart_time,cutover.restarts);await smoke(3000,release);pm2(['save']);
  write('finalized.json',{at:new Date().toISOString(),release,source,bootSaved:true,rollbackRetained:true},true);console.log(JSON.stringify({finalized:true,release,rollbackRetained:true}));
}
async function main(){assertHost();const command=process.argv[2];if(command!=='capture'){assert.equal(fs.realpathSync(stage),stage);assert.equal(fs.statSync(stage).mode&0o077,0);}if(command==='capture')capture();else if(command==='stage-source')stageSource();else if(command==='install-artifact')await installArtifact();else if(command==='nginx')await nginx();else if(command==='preview')await preview();else if(command==='cutover')await cutover();else if(command==='cutover-single-copy-approved'){await cutover(true);await observe();}else if(command==='observe')await observe();else if(command==='rollback')await rollback();else if(command==='finalize')await finalize();else throw Error('Unknown operation');}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
