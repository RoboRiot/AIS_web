const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const original=fs.readFileSync(path.join(__dirname,'memory-release-20261123.cjs'),'utf8');
const oldApp='/root/ais-reliability-82838bf-20261118/app';
const newApp='/root/ais-memory-212f075-20261123/app';
const record=(cwd,status='online')=>({name:'AIS_web',pm2_env:{pm_cwd:cwd,status}});
function fixture(initial,log=''){
  let rows=initial;const calls=[],writes=[];
  const fakeFs={existsSync:()=>false,writeFileSync:(...args)=>writes.push(args),statSync:()=>({size:Buffer.byteLength(log)}),readFileSync:()=>log};
  const fakeCp={execFileSync:(command,args)=>{
    assert.equal(command,'pm2');calls.push(args);
    if(args[0]==='jlist')return JSON.stringify(rows);
    if(args[0]==='delete')rows=[];
    if(args[0]==='start')rows=[record(oldApp)];
    if(args[0]==='restart')rows[0].pm2_env.status='online';
    return '';
  }};
  const context=vm.createContext({Buffer,console:{log(){}},process:{},setTimeout,
    require:id=>id==='node:fs'?fakeFs:id==='node:child_process'?fakeCp:require(id),module:{exports:{}}});
  const code=original.replace(/main\(\)\.catch\(error=>\{console\.error\(error\.message\);process\.exitCode=1;\}\);\s*$/,
    'ready=async()=>{};smoke=async()=>{};module.exports={rollback,checkRuntimeLog};');
  assert.notEqual(code,original,'Entry point must be removed before isolated test');
  vm.runInContext(code,context);return{run:()=>context.module.exports.rollback(),checkLog:p=>context.module.exports.checkRuntimeLog(p),calls,writes};
}
test('rollback restores captured release if candidate is present',async()=>{
  const f=fixture([record(newApp)]);await f.run();
  assert.deepEqual(f.calls.map(x=>x[0]),['jlist','delete','start','save']);
  assert.match(f.calls[2][1],/rollback\/ecosystem\.private\.json$/);
});
test('runtime gate checks actual PM2 suffixed log and permits non-fatal warning',()=>{
  const p=record(newApp);Object.assign(p.pm2_env,{AIS_RELEASE_ID:'212f075d1198-linux-20261123',pm_err_log_path:'/root/ais-memory-212f075-20261123/runtime-error.private-0.log'});
  const f=fixture([], '[DEP0060] DeprecationWarning: util._extend');assert.equal(f.checkLog(p).fatalEntries,0);
  assert.throws(()=>fixture([], 'FATAL ERROR: Reached heap limit').checkLog(p));
  p.pm2_env.pm_err_log_path='/outside/error.log';assert.throws(()=>f.checkLog(p));
});
test('rollback restores captured release when cutover left no process',async()=>{
  const f=fixture([]);await f.run();assert.deepEqual(f.calls.map(x=>x[0]),['jlist','start','save']);
});
test('rollback restarts a captured old process left stopped',async()=>{
  const f=fixture([record(oldApp,'stopped')]);await f.run();assert.deepEqual(f.calls.map(x=>x[0]),['jlist','restart','save']);
});
test('rollback does not restart an already healthy old release',async()=>{
  const f=fixture([record(oldApp)]);await f.run();assert.deepEqual(f.calls.map(x=>x[0]),['jlist','save']);
});
test('rollback refuses unknown process topology or working directory',async()=>{
  for(const rows of [[record('/different/app')],[record(oldApp),record(newApp)]]){
    const f=fixture(rows);await assert.rejects(f.run());assert.equal(f.calls.length,1);assert.equal(f.writes.length,0);
  }
});
