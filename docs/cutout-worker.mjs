import * as ort from './vendor/ort/ort.wasm.min.mjs';

ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;
ort.env.wasm.wasmPaths = new URL('./vendor/ort/', import.meta.url).href;
let sessionPromise = null;
let running = false;
const MODEL_SHA256 = '309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8';
const MODEL_BYTES = 4574861;
const report = (id, text) => self.postMessage({ type:'progress', id, text });

async function downloadModel(id) {
  report(id, '首次使用：正在下载本地抠图模型…');
  const response = await fetch(new URL('./vendor/models/u2netp.onnx', import.meta.url), { cache:'force-cache' });
  if (!response.ok) throw new Error('抠图模型下载失败，请联网后重试。原图仍然保留。');
  let buffer;
  if (response.body?.getReader) {
    const reader = response.body.getReader(), chunks = [];
    let loaded = 0, previous = -1;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value); loaded += value.length;
      const percent = Math.min(100, Math.floor(loaded / MODEL_BYTES * 100));
      if (percent !== previous) { previous = percent; report(id, `正在加载抠图模型…${percent}%`); }
      if (loaded > MODEL_BYTES) { await reader.cancel(); throw new Error('抠图模型大小异常，原图仍然保留。'); }
    }
    buffer = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
  } else buffer = new Uint8Array(await response.arrayBuffer());
  if (buffer.byteLength !== MODEL_BYTES) throw new Error('抠图模型下载不完整，请联网后重试。');
  if (self.crypto?.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    if (hash !== MODEL_SHA256) throw new Error('抠图模型校验失败，原图仍然保留。');
  }
  return buffer;
}
async function getSession(id) {
  if (!sessionPromise) sessionPromise = (async () => {
    const bytes = await downloadModel(id);
    report(id, '正在初始化本地抠图引擎…');
    return await ort.InferenceSession.create(bytes, { executionProviders:['wasm'], graphOptimizationLevel:'all', executionMode:'sequential' });
  })().catch(error => { sessionPromise = null; throw error; });
  return sessionPromise;
}
self.onmessage = async event => {
  const { type, id, input } = event.data || {};
  if (type !== 'segment') return;
  if (running || !(input instanceof Float32Array) || input.length !== 3 * 320 * 320) {
    self.postMessage({ type:'error', id, message:'抠图任务无效，请重试。' }); return;
  }
  running = true;
  let tensor, outputs;
  try {
    const session = await getSession(id);
    report(id, '正在识别装备轮廓，照片不会上传…');
    tensor = new ort.Tensor('float32', input, [1,3,320,320]);
    outputs = await session.run({ [session.inputNames[0]]:tensor });
    const data = outputs[session.outputNames[0]].data;
    if (data.length !== 320 * 320) throw new Error('抠图结果不完整，请重试。');
    let minimum = Infinity, maximum = -Infinity;
    for (let i = 0; i < data.length; i++) {
      if (!Number.isFinite(data[i])) throw new Error('暂时无法识别这张照片，原图仍然保留。');
      minimum = Math.min(minimum, data[i]); maximum = Math.max(maximum, data[i]);
    }
    if (maximum - minimum < 1e-6) throw new Error('未找到清晰主体，原图仍然保留。');
    const mask = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) mask[i] = Math.round((data[i] - minimum) / (maximum - minimum) * 255);
    self.postMessage({ type:'result', id, mask }, [mask.buffer]);
  } catch (error) {
    self.postMessage({ type:'error', id, message:error instanceof Error ? error.message : '自动抠图失败，原图仍然保留。' });
  } finally {
    tensor?.dispose?.();
    if (outputs) for (const value of Object.values(outputs)) value.dispose?.();
    running = false;
  }
};
