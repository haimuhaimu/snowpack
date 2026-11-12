import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Readable} from 'node:stream';
import {createInitialState} from '../docs/core.mjs';
import {validateSnapshot} from '../docs/sync-data.mjs';

// The external Blob boundary is replaced; HTTP parsing, authorization, validation,
// immutable asset writes and conditional snapshot writes run through real code.
import {createSyncHandler} from '../server/lib/handler.mjs';
const code = `SNOW1-${'a'.repeat(43)}`;
const sha = text => createHash('sha256').update(text).digest('hex');
const tokenHash = sha(code);
const origin = 'https://haimuhaimu.github.io';
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jrrsAAAAASUVORK5CYII=';
const snapshot = createInitialState();
class BlobPreconditionFailedError extends Error {}

function fixture(options = {}) {
  const objects = new Map();
  const calls = [];
  let revision = 0;
  const blob = {
    BlobPreconditionFailedError,
    async get(path, config) {
      calls.push({method:'get',path,config});
      const object = objects.get(path);
      if (!object) return null;
      const body = Buffer.from(object.body);
      return {statusCode:200, stream:new Blob([body]).stream(), headers:new Headers(),
        blob:{url:`https://test.private.blob.vercel-storage.com/${path}`,downloadUrl:'',pathname:path,
          contentType:'application/json',contentDisposition:'',cacheControl:'',etag:object.etag,
          size:body.length,uploadedAt:new Date()}};
    },
    async put(path, body, config) {
      calls.push({method:'put',path,body,config});
      const object = objects.get(path);
      if (config.ifMatch && object?.etag !== config.ifMatch) throw new BlobPreconditionFailedError();
      // The real SDK exposes no AlreadyExists error class; this is a generic error.
      if (!config.allowOverwrite && object) throw new Error('blob exists');
      const etag = `"revision-${++revision}"`;
      objects.set(path,{body,etag});
      return {pathname:path,url:'https://test.private.blob.vercel-storage.com/',downloadUrl:'',etag};
    },
  };
  const handler = createSyncHandler({blob,tokenHash,validateSnapshot,...options});
  async function request({method='GET',url='/api/sync?kind=state',body='',headers={},chunks}={}) {
    const req = Readable.from(chunks || [Buffer.from(body)]);
    req.method = method;
    req.url = url;
    req.headers = {authorization:`Bearer ${code}`,origin,...headers};
    const response = {statusCode:200,headers:{},body:'',
      setHeader(name,value) {this.headers[name.toLowerCase()]=value;},
      end(value='') {this.body += value;},
    };
    await handler(req,response);
    return {...response,json:()=>JSON.parse(response.body)};
  }
  return {request,objects,calls,blob};
}

test('requests with missing, malformed, or wrong credentials cannot read storage', async()=>{
  const {request,calls}=fixture();
  for (const authorization of [undefined,'Bearer short',`Bearer SNOW1-${'b'.repeat(43)}`]) {
    const response=await request({headers:{authorization}});
    assert.equal(response.statusCode,401);
    assert.match(response.headers['cache-control'],/no-store/);
  }
  assert.equal(calls.length,0);
});

test('missing server secret fails closed without accessing storage', async()=>{
  const {request,calls}=fixture({tokenHash:undefined});
  assert.equal((await request()).statusCode,503);
  assert.equal(calls.length,0);
});

test('CORS denies unapproved origins and permits credential-free allowed preflight', async()=>{
  const {request,calls}=fixture();
  const denied=await request({headers:{origin:'https://example.com'}});
  assert.equal(denied.statusCode,403);
  assert.equal(denied.headers['access-control-allow-origin'],undefined);
  const preflight=await request({method:'OPTIONS',headers:{authorization:undefined,
    'access-control-request-method':'PUT','access-control-request-headers':'authorization, content-type, if-match'}});
  assert.equal(preflight.statusCode,204);
  assert.equal(preflight.headers['access-control-allow-origin'],origin);
  assert.match(preflight.headers['access-control-allow-headers'],/If-None-Match/i);
  assert.equal(preflight.headers['access-control-allow-credentials'],undefined);
  assert.equal(calls.length,0);
});

test('unsupported methods, resources and malformed hashes cannot access storage', async()=>{
  const {request,calls}=fixture();
  assert.equal((await request({method:'DELETE'})).statusCode,405);
  for(const url of ['/api/sync?kind=unknown','/api/sync?kind=asset&hash=../state','/api/sync?kind=state&kind=asset']) {
    assert.equal((await request({url})).statusCode,400);
  }
  assert.equal(calls.length,0);
});

test('empty cloud is represented explicitly and private reads bypass cache', async()=>{
  const {request,calls}=fixture();
  const response=await request();
  assert.equal(response.statusCode,200);
  assert.deepEqual(response.json(),{revision:null,snapshot:null});
  assert.equal(calls[0].config.access,'private');
  assert.equal(calls[0].config.useCache,false);
});

test('snapshot writes require a specific conditional version before touching storage', async()=>{
  const {request,calls}=fixture();
  const input={method:'PUT',body:JSON.stringify({snapshot}),headers:{'content-type':'application/json'}};
  assert.equal((await request(input)).statusCode,428);
  for(const condition of [{'if-match':'*'},{'if-none-match':'"any"'},
    {'if-match':'"a"','if-none-match':'*'},{'if-match':'"a", "b"'}]) {
    assert.equal((await request({...input,headers:{...input.headers,...condition}})).statusCode,400);
  }
  assert.equal(calls.length,0);
});

test('state JSON parsing and validation reject malformed or oversized bodies', async()=>{
  const {request,calls}=fixture();
  const headers={'content-type':'application/json','if-none-match':'*'};
  for(const body of ['{','null','[]','{}','{"snapshot":{"version":2}}']) {
    assert.equal((await request({method:'PUT',headers,body})).statusCode,400);
  }
  assert.equal((await request({method:'PUT',headers:{...headers,'content-type':'text/plain'},body:'{}'})).statusCode,415);
  assert.equal((await request({method:'PUT',headers:{...headers,'content-length':'2000001'},body:''})).statusCode,413);
  assert.equal((await request({method:'PUT',headers,chunks:[Buffer.alloc(1_000_001),Buffer.alloc(1_000_000)]})).statusCode,413);
  assert.equal((await request({method:'PUT',headers,chunks:[Buffer.from([0xc3,0x28])]})).statusCode,400);
  assert.equal(calls.length,0);
});

test('first create is atomic and an outdated revision never overwrites newer state', async()=>{
  const {request,calls}=fixture();
  const headers={'content-type':'application/json','if-none-match':'*'};
  const created=await request({method:'PUT',headers,body:JSON.stringify({snapshot})});
  assert.equal(created.statusCode,200);
  assert.equal(created.json().revision,'"revision-1"');
  assert.equal(calls[0].config.allowOverwrite,false);
  assert.equal(calls[0].config.addRandomSuffix,false);
  assert.equal(calls[0].config.access,'private');
  const duplicate=await request({method:'PUT',headers,body:JSON.stringify({snapshot})});
  assert.equal(duplicate.statusCode,409);
  const next=structuredClone(snapshot);
  next.trips[0].name='next trip';
  const updateHeaders={'content-type':'application/json','if-match':created.json().revision};
  const updated=await request({method:'PUT',headers:updateHeaders,body:JSON.stringify({snapshot:next})});
  assert.equal(updated.statusCode,200);
  const writes=calls.filter(call=>call.method==='put');
  assert.equal(writes.at(-1).config.ifMatch,'"revision-1"');
  assert.equal(writes.at(-1).config.allowOverwrite,true);
  const stale=await request({method:'PUT',headers:updateHeaders,body:JSON.stringify({snapshot})});
  assert.equal(stale.statusCode,409);
  const latest=await request();
  assert.deepEqual(latest.json(),{revision:'"revision-2"',snapshot:next});
});

test('asset uploads validate type, hash, and size before touching storage', async()=>{
  const {request,calls}=fixture();
  const url=`/api/sync?kind=asset&hash=${sha(png)}`;
  const headers={'content-type':'text/plain;charset=UTF-8'};
  assert.equal((await request({method:'PUT',url,headers,body:'data:text/html;base64,PHNjcmlwdD4='})).statusCode,400);
  assert.equal((await request({method:'PUT',url,headers,body:'data:image/png;base64,?'})).statusCode,400);
  assert.equal((await request({method:'PUT',url,headers,body:png.replace('image/png','image/webp')})).statusCode,400);
  assert.equal((await request({method:'PUT',url,headers,body:'a'.repeat(1_500_001)})).statusCode,413);
  assert.equal((await request({method:'PUT',url,headers:{'content-type':'application/json'},body:png})).statusCode,415);
  assert.equal(calls.length,0);
});

test('identical assets are idempotent, immutable, and returned as plain text', async()=>{
  const {request,calls}=fixture();
  const hash=sha(png),url=`/api/sync?kind=asset&hash=${hash}`;
  const input={method:'PUT',url,headers:{'content-type':'text/plain'},body:png};
  assert.equal((await request(input)).statusCode,200);
  assert.equal((await request(input)).statusCode,200);
  const writes=calls.filter(call=>call.method==='put');
  for (const write of writes) {
    assert.equal(write.config.allowOverwrite,false);
    assert.equal(write.config.access,'private');
    assert.equal(write.config.addRandomSuffix,false);
  }
  const response=await request({url});
  assert.equal(response.statusCode,200);
  assert.equal(response.body,png);
  assert.match(response.headers['content-type'],/^text\/plain/);
  assert.match(response.headers['cache-control'],/no-store/);
  assert.equal((await request({url:`/api/sync?kind=asset&hash=${'0'.repeat(64)}`})).statusCode,404);
});

test('an existing asset with unexpected content is not acknowledged as uploaded', async()=>{
  const {request,calls,objects}=fixture();
  const url=`/api/sync?kind=asset&hash=${sha(png)}`;
  const input={method:'PUT',url,headers:{'content-type':'text/plain'},body:png};
  await request(input);
  objects.set(calls[0].path,{body:'corrupt data',etag:'"corrupt"'});
  assert.equal((await request(input)).statusCode,502);
  assert.equal((await request({url})).statusCode,502);
});

test('storage errors do not leak private implementation details', async()=>{
  const {request,blob}=fixture();
  blob.get=async()=>{throw new Error(`private token ${code}`);};
  const response=await request();
  assert.equal(response.statusCode,502);
  assert.doesNotMatch(response.body,/private token|SNOW1|stack/);
});

test('shared snapshot validator accepts asset references but rejects embedded photos', async()=>{
  const {request,calls}=fixture();
  const state=structuredClone(snapshot);
  state.wardrobe.push({id:'coat',name:'Coat',category:'jacket',color:'black',photo:png});
  const input={method:'PUT',headers:{'content-type':'application/json','if-none-match':'*'}};
  assert.equal((await request({...input,body:JSON.stringify({snapshot:state})})).statusCode,400);
  assert.equal(calls.length,0);
  state.wardrobe[0].photo=`asset:${sha(png)}`;
  assert.equal((await request({...input,body:JSON.stringify({snapshot:state})})).statusCode,200);
  assert.deepEqual((await request()).json().snapshot,state);
});

test('storage read corruption and oversized responses are never served to a device', async()=>{
  const {request,objects,calls}=fixture();
  await request();
  const path=calls[0].path;
  for(const body of ['{','null','{"version":1}', ' '.repeat(2_000_001)]) {
    objects.set(path,{body,etag:'"revision-1"'});
    assert.equal((await request()).statusCode,502);
  }
});

test('an immutable upload with a provider precondition error still verifies existing content', async()=>{
  const {request,blob}=fixture();
  const input={method:'PUT',url:`/api/sync?kind=asset&hash=${sha(png)}`,
    headers:{'content-type':'text/plain'},body:png};
  await request(input);
  blob.put=async()=>{throw new BlobPreconditionFailedError();};
  assert.equal((await request(input)).statusCode,200);
});

test('private metadata reads request identity encoding so the content and strong revision support conditional writes',async()=>{
  const {request,blob,calls}=fixture();
  const originalGet=blob.get;
  blob.get=async(path,options)=>{
    const result=await originalGet(path,options);
    // Observed private Blob behavior: compressed JSON responses weaken the ETag.
    if(result && new Headers(options.headers).get('accept-encoding')!=='identity'){
      result.blob.etag=`W/${result.blob.etag}`;
      result.headers.set('Content-Encoding','gzip');
    }
    return result;
  };
  const created=await request({method:'PUT',body:JSON.stringify({snapshot}),
    headers:{'content-type':'application/json','if-none-match':'*'}});
  assert.equal(created.statusCode,200);
  const read=await request();
  assert.equal(read.statusCode,200);
  assert.deepEqual(read.json(),{revision:created.json().revision,snapshot});
  assert.equal(read.headers.etag,created.json().revision);
  const next=structuredClone(read.json().snapshot);next.trips[0].name='changed after reading';
  const input={method:'PUT',body:JSON.stringify({snapshot:next}),
    headers:{'content-type':'application/json','if-match':read.json().revision}};
  const updated=await request(input);
  assert.equal(updated.statusCode,200);
  assert.equal((await request(input)).statusCode,409);
  assert.deepEqual((await request()).json(),{revision:updated.json().revision,snapshot:next});
  for(const call of calls.filter(call=>call.method==='get')){
    assert.equal(new Headers(call.config.headers).get('accept-encoding'),'identity');
    assert.equal(call.config.useCache,false);
  }
});
