import {createHash,timingSafeEqual} from 'node:crypto';

const MAX_STATE_BYTES = 2_000_000;
const MAX_ASSET_BYTES = 1_500_000;
const STATE_PATH = 'snowpack/v1/state.json';
const ALLOWED_ORIGINS = ['https://haimuhaimu.github.io','http://127.0.0.1:8081','http://localhost:8081'];
const ALLOWED_HEADERS = ['authorization','content-type','if-match','if-none-match'];
const HASH = /^[a-f0-9]{64}$/;
const ETAG = /^"[\x21\x23-\x7e]{1,200}"$/;
const DATA_URL = /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
const sha = value => createHash('sha256').update(value).digest('hex');

class HttpError extends Error {
  constructor(status,code) {super(code);this.status=status;this.code=code;}
}
const reject = (status,code) => {throw new HttpError(status,code);};
const header = (req,name) => typeof req.headers?.[name] === 'string' ? req.headers[name] : undefined;

function send(res,status,value) {
  res.statusCode=status;
  if(status===204) return res.end();
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.end(JSON.stringify(value));
}

async function readRequest(req,maxBytes) {
  const length=header(req,'content-length');
  if(length!==undefined && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)))) reject(400,'invalid_length');
  if(Number(length)>maxBytes) reject(413,'body_too_large');
  const chunks=[];
  let size=0;
  // Do not destroy the HTTP socket on overflow; leave the response writable.
  const source=typeof req.iterator==='function' ? req.iterator({destroyOnReturn:false}) : req;
  try {
    for await (const chunk of source) {
      const buffer=Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size+=buffer.length;
      if(size>maxBytes) reject(413,'body_too_large');
      chunks.push(buffer);
    }
  } catch(error) {
    req.resume?.();
    if(error instanceof HttpError) throw error;
    reject(400,'invalid_body');
  }
  try {return new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks,size));}
  catch {reject(400,'invalid_encoding');}
}

async function readStored(result,maxBytes) {
  if(result?.statusCode!==200 || !result.stream) reject(502,'storage_unavailable');
  if(result.blob?.size>maxBytes) {
    await result.stream.cancel();
    reject(502,'invalid_stored_data');
  }
  const reader=result.stream.getReader();
  const chunks=[];
  let size=0;
  try {
    for (;;) {
      const {value,done}=await reader.read();
      if(done) break;
      size+=value.byteLength;
      if(size>maxBytes) {
        await reader.cancel();
        reject(502,'invalid_stored_data');
      }
      chunks.push(Buffer.from(value));
    }
    return new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks,size));
  } finally {reader.releaseLock();}
}

function validAsset(text,hash) {
  if(text.length>MAX_ASSET_BYTES || sha(text)!==hash) return false;
  const match=DATA_URL.exec(text);
  if(!match || match[1].length%4!==0) return false;
  // Reject permissive base64 decoding (ignored characters, padding, partial bytes).
  return Buffer.from(match[1],'base64').toString('base64')===match[1];
}

function validSnapshot(value,validateSnapshot) {
  try {return validateSnapshot(value)===true;}
  catch {return false;}
}

function precondition(req) {
  const match=header(req,'if-match');
  const none=header(req,'if-none-match');
  if(match===undefined && none===undefined) reject(428,'precondition_required');
  if(match!==undefined && none!==undefined) reject(400,'invalid_precondition');
  if(none!==undefined) {
    if(none!=='*') reject(400,'invalid_precondition');
    return {allowOverwrite:false};
  }
  if(!ETAG.test(match) || match.includes(',')) reject(400,'invalid_precondition');
  return {allowOverwrite:true,ifMatch:match};
}

function isBlobError(blob,error,name) {
  return typeof blob[name]==='function' && error instanceof blob[name];
}

export function createSyncHandler({blob,validateSnapshot,tokenHash,allowedOrigins=ALLOWED_ORIGINS}) {
  const origins=new Set(allowedOrigins);
  return async function syncHandler(req,res) {
    res.setHeader('Cache-Control','private, no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Vary','Origin');
    try {
      const origin=header(req,'origin');
      if(origin!==undefined && !origins.has(origin)) reject(403,'origin_denied');
      if(origin) {
        res.setHeader('Access-Control-Allow-Origin',origin);
        res.setHeader('Access-Control-Expose-Headers','ETag');
      }
      if(req.method==='OPTIONS') {
        const method=header(req,'access-control-request-method');
        const requested=header(req,'access-control-request-headers')?.split(',').map(value=>value.trim().toLowerCase()) || [];
        if(!origin || !['GET','PUT'].includes(method) || requested.some(name=>!ALLOWED_HEADERS.includes(name))) reject(403,'preflight_denied');
        res.setHeader('Access-Control-Allow-Methods','GET, PUT, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type, If-Match, If-None-Match');
        return send(res,204);
      }
      if(!HASH.test(tokenHash || '')) reject(503,'service_unavailable');
      const authorization=header(req,'authorization');
      if(!/^Bearer SNOW1-[A-Za-z0-9_-]{43}$/.test(authorization || '')) reject(401,'unauthorized');
      const supplied=Buffer.from(sha(authorization.slice(7)),'hex');
      if(!timingSafeEqual(supplied,Buffer.from(tokenHash,'hex'))) reject(401,'unauthorized');
      if(!['GET','PUT'].includes(req.method)) {
        res.setHeader('Allow','GET, PUT, OPTIONS');
        reject(405,'method_not_allowed');
      }
      const query=new URL(req.url,'https://sync.invalid').searchParams;
      const kind=query.get('kind');
      if(query.getAll('kind').length!==1 || !['state','asset'].includes(kind)) reject(400,'invalid_resource');
      const hash=query.get('hash');
      if(kind==='asset' && (query.getAll('hash').length!==1 || !HASH.test(hash || ''))) reject(400,'invalid_hash');
      const path=kind==='state' ? STATE_PATH : `snowpack/v1/assets/${hash}.txt`;
      if(req.method==='GET') {
        // Compression may weaken the download ETag. Keep content and its strong
        // conditional-write revision from the same uncached identity response.
        const result=await blob.get(path,{access:'private',useCache:false,headers:{'Accept-Encoding':'identity'}});
        if(!result) {
          if(kind==='state') return send(res,200,{revision:null,snapshot:null});
          reject(404,'asset_not_found');
        }
        const text=await readStored(result,kind==='state' ? MAX_STATE_BYTES : MAX_ASSET_BYTES);
        if(kind==='asset') {
          if(!validAsset(text,hash)) reject(502,'invalid_stored_data');
          res.statusCode=200;
          res.setHeader('Content-Type','text/plain; charset=utf-8');
          return res.end(text);
        }
        let snapshot;
        try {snapshot=JSON.parse(text);} catch {reject(502,'invalid_stored_data');}
        if(!validSnapshot(snapshot,validateSnapshot) || !ETAG.test(result.blob.etag || '')) reject(502,'invalid_stored_data');
        res.setHeader('ETag',result.blob.etag);
        return send(res,200,{revision:result.blob.etag,snapshot});
      }
      const condition=kind==='state' ? precondition(req) : {allowOverwrite:false};
      const contentType=header(req,'content-type')?.split(';')[0].trim().toLowerCase();
      if(contentType!==(kind==='state' ? 'application/json' : 'text/plain')) reject(415,'unsupported_media_type');
      const text=await readRequest(req,kind==='state' ? MAX_STATE_BYTES : MAX_ASSET_BYTES);
      let body=text;
      if(kind==='state') {
        let parsed;
        try {parsed=JSON.parse(text);} catch {reject(400,'invalid_json');}
        if(!parsed || typeof parsed!=='object' || Array.isArray(parsed) || Object.keys(parsed).length!==1 ||
          !Object.hasOwn(parsed,'snapshot') || !validSnapshot(parsed.snapshot,validateSnapshot)) reject(400,'invalid_snapshot');
        body=JSON.stringify(parsed.snapshot);
      } else if(!validAsset(text,hash)) reject(400,'invalid_asset');
      try {
        const result=await blob.put(path,body,{access:'private',addRandomSuffix:false,
          contentType:kind==='state' ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
          cacheControlMaxAge:60,...condition});
        if(kind==='state') {
          if(!ETAG.test(result.etag || '')) reject(502,'storage_unavailable');
          res.setHeader('ETag',result.etag);
          return send(res,200,{revision:result.etag});
        }
        return send(res,200,{hash});
      } catch(error) {
        if(kind==='state' && isBlobError(blob,error,'BlobPreconditionFailedError')) reject(409,'revision_conflict');
        // SDK 2.9 has no AlreadyExists error class. Confirm the resulting storage
        // state instead of interpreting provider text (also safe after a lost ack).
        if(!condition.allowOverwrite) {
          const existing=await blob.get(path,{access:'private',useCache:false,headers:{'Accept-Encoding':'identity'}});
          if(!existing) throw error;
          if(kind==='state') {
            await existing.stream?.cancel();
            reject(409,'revision_conflict');
          }
          if(!validAsset(await readStored(existing,MAX_ASSET_BYTES),hash)) reject(502,'invalid_stored_data');
          return send(res,200,{hash});
        }
        throw error;
      }
    } catch(error) {
      // Never return or log provider errors, credentials, or personal content.
      return send(res,error instanceof HttpError ? error.status : 502,
        {error:error instanceof HttpError ? error.code : 'storage_unavailable'});
    }
  };
}
