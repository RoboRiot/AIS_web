'use strict';
// The compiler uses Next's public catalog output from the currently published site.
// This helper and the cache never enter the runtime tar.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createRequire } = require('node:module');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const cwd=process.cwd(), appRequire=createRequire(path.join(cwd,'package.json'));
const dist=path.resolve(process.env.AIS_SEED_DIST || path.join(cwd,'.next-releases',process.env.RELEASE));
const source='https://advancedimagingparts.com', hashes={}, digest=s=>createHash('sha256').update(s).digest('hex');
const journal=process.env.AIS_SEED_JOURNAL || path.join(process.env.RUNNER_TEMP,'ais-public-catalog.json');
const keys={sitemap:'45e470bb11f23a767ed5b67f8613e306eea414b689a1cc3cb72ca368d847c71d', parts:'83ecef1c8968768187aaba20849727df9c9abb712e14c6fa03f7ba2a7bc98e83',home:'cd4cd6d5d156c2c4a34d8ca84acaed6db20fc5996868ddf99aebac4586622331'};
async function get(route){
  assert(process.env.AIS_LOCAL_BUILD_DIRECTORY, 'Capture requires a local build; no production crawl allowed');
  assert(route.startsWith('/')&&!route.startsWith('//')&&!route.includes('..'));
  const file = route.endsWith('.xml') ? route.slice(1)+'.body' : route === '/' ? 'index.html' : route.slice(1)+'.html';
  return fs.readFileSync(path.join(process.env.AIS_LOCAL_BUILD_DIRECTORY,'server/app',file),'utf8');
}
function props(html,property) {
  const flight=[...html.matchAll(/<script>self\.__next_f\.push\((\[[^<]*\])\)<\/script>/g)].map(m=>JSON.parse(m[1])).filter(r=>r[0]===1).map(r=>r[1]).join('');
  const marker=JSON.stringify(property)+':', result=[];
  let start=-1;
  while ((start=flight.indexOf(marker,start+1))>=0) {
    const at=start+marker.length, opening=flight[at];
    assert(['[','{'].includes(opening));let depth=0,inString=false,escape=false;
    for(let i=at;i<flight.length;i++){
      const c=flight[i];
      if(inString){if(escape) escape=false;else if(c==='\\') escape=true;else if(c==='"') inString=false;continue;}
      if(c==='"')inString=true;
      else if(c==='{'||c==='[')depth++;
      else if((c==='}'||c===']')&&--depth===0) {
        const value=JSON.parse(flight.slice(at,i+1),(_k,v)=>{
          if(typeof v!=='string'||!v.startsWith('$'))return v;
          if(v.startsWith('$$'))return v.slice(1);
          if(v==='$undefined')return undefined;
          if(/^\$[0-9a-f]+$/.test(v)){
            const id=v.slice(1);
            const t=flight.match(new RegExp('(?:^|\\n)'+id+':T([0-9a-f]+),'));
            assert(t,'unsupported public Flight reference: '+id);
            const payload=Buffer.from(flight.slice(t.index+t[0].length),'utf8').subarray(0,parseInt(t[1],16));
            return payload.toString('utf8');
          }
          throw new Error('unexpected public Flight scalar '+v.slice(0,5));
        });
        result.push(value);break;
      }
    }
  }
  return result;
}
function writeSeed(key,value,seconds){
  const folder=path.join(dist,'cache','fetch-cache');
  fs.mkdirSync(folder,{recursive:true});
  fs.writeFileSync(path.join(folder,key),JSON.stringify({kind:'FETCH',data:{headers:{},body:JSON.stringify(value),status:200,url:''},revalidate:seconds,tags:[]}));
}
const idList=rows=>rows.map(r=>{assert(typeof r.id==='string'&&r.id&&r.Name);return r.id;});
async function main() {
  if(process.argv[2]==='capture-local' || process.argv[2]==='capture'){
    const {verifySitemaps}=await import(pathToFileURL(path.join(cwd,'scripts/verify-sitemaps.mjs')));
    const raw=new Map(), {XMLParser}=appRequire('fast-xml-parser');
    let entries=[];
    let snapshot;
    if(process.env.AIS_PUBLIC_SITEMAP){snapshot=JSON.parse(require('node:zlib').gunzipSync(fs.readFileSync(process.env.AIS_PUBLIC_SITEMAP)));entries=snapshot.entries;Object.assign(hashes,snapshot.hashes);assert.equal(entries.length,7983);assert.equal(Object.keys(hashes).length,84);}
    else{
      const tree=await verifySitemaps(async p=>{const s=await get(p);raw.set(p,s);hashes[p]=digest(s);return s;});
      for(const doc of tree.documents.filter(d=>d.path.startsWith('/sitemaps/products/'))){
        const data=new XMLParser({parseTagValue:false}).parse(raw.get(doc.path)).urlset.url;
        for(const row of [].concat(data))entries.push({url:row.loc,...(row.lastmod?{lastModified:row.lastmod}:{})});
      }
      assert.equal(entries.length,tree.products);
    }
    assert.deepEqual(entries.map(x=>x.url),entries.map(x=>x.url).toSorted());
    const home=snapshot?.home || props(await get('/'),'initialProducts'), parts=snapshot?.parts || props(await get('/parts'),'initialCatalog');
    assert.equal(home.length,2);assert.equal(parts.length,1);
    for(const a of [home[0],home[1],parts[0].products])assert(a.length>=10);
    if(process.argv[2]==='capture-local') {
      assert(process.argv[3]);
      fs.writeFileSync(process.argv[3],require('node:zlib').gzipSync(JSON.stringify({capturedAt:new Date().toISOString(),source:'local build of approved public catalog',entries,hashes,home,parts})));
      console.log(JSON.stringify({publicProducts:entries.length,sitemapDocuments:Object.keys(hashes).length,homepageGroups:home.map(x=>x.length),parts:parts[0].products.length}));
      return;
    }
    fs.writeFileSync(path.join(process.env.RUNNER_TEMP,'ais-sitemap-entries.json'),JSON.stringify(entries));
    writeSeed(keys.home,{mostRequested:home[0],ctTubes:home[1]},900);
    writeSeed(keys.parts,parts[0].products,900);
    fs.writeFileSync(journal,JSON.stringify({hashes,products:entries.length,home:home.map(idList),parts:idList(parts[0].products)}));
    console.log('Captured public sitemap products, documents, homepage groups and catalog items:',entries.length,raw.size,home.map(r=>r.length),parts[0].products.length);
  }else if(process.argv[2]==='verify'){
    const j=JSON.parse(fs.readFileSync(journal,'utf8')), dir=path.join(dist,'server','app');
    for(const [route,expected] of Object.entries(j.hashes)){
      assert.equal(digest(fs.readFileSync(path.join(dir,route.slice(1)+'.body'))),expected,route);
    }
    const home=props(fs.readFileSync(path.join(dir,'index.html'),'utf8'),'initialProducts');
    const parts=props(fs.readFileSync(path.join(dir,'parts.html'),'utf8'),'initialCatalog');
    assert.deepEqual(home.map(idList),j.home);assert.deepEqual(parts.map(x=>idList(x.products)),[j.parts]);
    console.log('Verified all sitemap bytes and primary public catalog selections against live source:',j.products,Object.keys(j.hashes).length,j.home.map(x=>x.length),j.parts.length);
  }else throw new Error('mode');
}
main().catch(e=>{console.error(e.message.slice(0,180));process.exitCode=1;});
