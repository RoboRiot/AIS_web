const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const [mode,directory,configFile]=process.argv.slice(2);
const p=f=>path.join(directory,f);
const m=JSON.parse(fs.readFileSync(p('manifest.json')));
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
assert.equal(m.release,'82838bfc251a-linux-20261118');assert.equal(m.sourceRevision,'82838bfc251a1fd9d31485f1460219412694b4a9');
const aad=Buffer.from('AIS memory reliability release\n'+m.release+'\n'+m.sourceRevision,'utf8');
const params={oaepHash:'sha256',padding:crypto.constants.RSA_PKCS1_OAEP_PADDING};
if(mode==='encrypt'){
  const publics=JSON.parse(fs.readFileSync(configFile));
  function wrap(type,key){return crypto.publicEncrypt({...params,key:crypto.createPublicKey({key:Buffer.from(publics[type],'base64'),format:'der',type:'spki'})},key).toString('base64');}
  const iv=crypto.randomBytes(12),key=crypto.randomBytes(32), cipher=crypto.createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(aad);
  const plain=fs.readFileSync(p('release.tar.gz'));assert.equal(sha(plain),m.sha256);assert.equal(plain.length,m.sizeBytes);
  const data=Buffer.concat([cipher.update(plain),cipher.final()]);
  m.transport={algorithm:'AES-256-GCM',wrap:'RSA-OAEP-SHA256',file:'release.tar.gz.enc',sha256:sha(data),sizeBytes:data.length,ivBase64:iv.toString('base64'),tagBase64:cipher.getAuthTag().toString('base64'),serverWrappedKeyBase64:wrap('server',key),serverPublicKeySha256:sha(Buffer.from(publics.server,'base64')),localWrappedKeyBase64:wrap('local',key)};
  assert.equal(m.transport.serverPublicKeySha256,'49fdcd0d2cb9dce16ecc323f4ba1ae2e860e9d648ee23eb3ec1f4a09aac40869');
  fs.writeFileSync(p(m.transport.file),data,{flag:'wx'});fs.writeFileSync(p('manifest.json'),JSON.stringify(m,null,2)+'\n');
  fs.unlinkSync(p('release.tar.gz'));
  assert.deepEqual(fs.readdirSync(directory).sort(),['manifest.json','release.tar.gz.enc']);
}else if(mode==='check-local'){
  const t=m.transport, cipher=fs.readFileSync(p('release.tar.gz.enc'));assert.equal(t.file,'release.tar.gz.enc');assert.equal(t.sha256,sha(cipher));assert.equal(t.sizeBytes,cipher.length);
  const key=crypto.privateDecrypt({...params,key:crypto.createPrivateKey({key:fs.readFileSync(configFile),format:'der',type:'pkcs8'})},Buffer.from(t.localWrappedKeyBase64,'base64'));
  const dec=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(t.ivBase64,'base64'));dec.setAAD(aad);dec.setAuthTag(Buffer.from(t.tagBase64,'base64'));
  const plain=Buffer.concat([dec.update(cipher),dec.final()]);assert.equal(sha(plain),m.sha256);assert.equal(plain.length,m.sizeBytes);
  fs.writeFileSync(path.join(directory,'inspected-private.tar.gz'),plain,{flag:'wx',mode:0o600});
}else throw new Error('unexpected mode');
