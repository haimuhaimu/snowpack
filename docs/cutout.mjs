const SIZE = 320;
const MAX_EDGE = 1600;
const JOB_TIMEOUT_MS = 150000;
let worker = null, active = null, idleTimer = null, nextId = 0;
const queue = [];

const aborted = () => new DOMException('已取消自动抠图。', 'AbortError');
const checkAbort = signal => { if (signal?.aborted) throw aborted(); };
function progress(callback, text) { try { callback?.(text); } catch {} }
function destroyWorker() {
  clearTimeout(idleTimer);
  if (worker) { worker.onmessage = worker.onerror = worker.onmessageerror = null; worker.terminate(); worker = null; }
}
function settle(job, error, mask) {
  clearTimeout(job.timer);
  job.signal?.removeEventListener('abort', job.abort);
  if (active === job) active = null;
  if (error) job.reject(error); else job.resolve(mask);
  queueMicrotask(pump);
}
function pump() {
  if (active) return;
  clearTimeout(idleTimer);
  const job = queue.shift();
  if (!job) { if (worker) idleTimer = setTimeout(destroyWorker, 60000); return; }
  if (job.signal?.aborted) { settle(job, aborted()); return; }
  active = job;
  try {
    if (!worker) {
      progress(job.onProgress, '正在准备本地抠图工具…');
      const instance = new Worker(new URL('./cutout-worker.mjs', import.meta.url), { type:'module' });
      worker = instance;
      instance.onmessage = event => {
        if (worker !== instance || !active || event.data.id !== active.id) return;
        const current = active;
        if (event.data.type === 'progress') progress(current.onProgress, event.data.text);
        else if (event.data.type === 'result') {
          const mask = event.data.mask;
          if (!(mask instanceof Uint8Array) || mask.length !== SIZE * SIZE) {
            destroyWorker(); settle(current, new Error('抠图结果不完整，原图仍然保留。'));
          } else settle(current, null, mask);
        } else if (event.data.type === 'error') {
          destroyWorker(); settle(current, new Error(event.data.message || '自动抠图暂时失败，原图仍然保留。'));
        }
      };
      const fail = event => {
        if (worker !== instance) return;
        event.preventDefault?.();
        const current = active;
        destroyWorker();
        if (current) settle(current, new Error('本机暂时无法运行抠图，原图仍然保留。可以重试。'));
      };
      instance.onerror = fail;
      instance.onmessageerror = fail;
    }
    job.timer = setTimeout(() => {
      if (active !== job) return;
      destroyWorker(); settle(job, new Error('自动抠图等待过久，原图仍然保留。请检查网络后重试。'));
    }, JOB_TIMEOUT_MS);
    worker.postMessage({ type:'segment', id:job.id, input:job.input }, [job.input.buffer]);
  } catch {
    destroyWorker(); settle(job, new Error('此浏览器暂时无法启动本地抠图，原图仍然保留。'));
  }
}
function infer(input, onProgress, signal) {
  return new Promise((resolve, reject) => {
    const job = { id:++nextId, input, onProgress, signal, resolve, reject };
    job.abort = () => {
      if (active === job) { destroyWorker(); settle(job, aborted()); }
      else {
        const index = queue.indexOf(job);
        if (index >= 0) { queue.splice(index, 1); settle(job, aborted()); }
      }
    };
    if (signal?.aborted) { reject(aborted()); return; }
    signal?.addEventListener('abort', job.abort, { once:true });
    queue.push(job);
    if (active) progress(onProgress, '前一张正在抠图，稍后处理这张…');
    pump();
  });
}
function decode(source, signal) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const cleanup = () => { image.onload = image.onerror = null; signal?.removeEventListener('abort', cancel); };
    const cancel = () => { cleanup(); image.src = ''; reject(aborted()); };
    image.onload = () => { cleanup(); image.naturalWidth && image.naturalHeight ? resolve(image) : reject(new Error('这张图片没有有效画面。')); };
    image.onerror = () => { cleanup(); reject(new Error('这张图片暂时读不了，原图仍然保留。')); };
    signal?.addEventListener('abort', cancel, { once:true });
    if (signal?.aborted) { cancel(); return; }
    image.src = source;
  });
}
function canvas(width, height) {
  const element = document.createElement('canvas'); element.width = width; element.height = height; return element;
}
function trimAndEncode(source) {
  const context = source.getContext('2d', { willReadFrequently:true });
  const { data, width, height } = context.getImageData(0, 0, source.width, source.height);
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4 + 3] <= 8) continue;
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  if (right < left || bottom < top || right - left < 2 || bottom - top < 2) throw new Error('未找到清晰主体，已保留原图。可以换一张背景更简单的照片。');
  left = Math.max(0, left - 2); top = Math.max(0, top - 2);
  right = Math.min(width - 1, right + 2); bottom = Math.min(height - 1, bottom + 2);
  const output = canvas(right - left + 1, bottom - top + 1);
  try {
    output.getContext('2d').drawImage(source, left, top, output.width, output.height, 0, 0, output.width, output.height);
    const result = output.toDataURL('image/png');
    if (!result.startsWith('data:image/png;base64,') || result.length < 40) throw new Error('透明图片生成失败，原图仍然保留。');
    return result;
  } finally { output.width = output.height = 1; }
}

/** Local-only background removal. On failure/abort reject; callers keep the original photo. */
export async function removeBackground(photoDataURL, { onProgress, signal } = {}) {
  checkAbort(signal);
  if (typeof photoDataURL !== 'string' || !/^data:image\/(?:png|jpeg|webp);base64,/i.test(photoDataURL)) throw new TypeError('请选择本机 JPG、PNG 或 WebP 图片。');
  progress(onProgress, '正在读取照片…');
  const image = await decode(photoDataURL, signal);
  checkAbort(signal);
  const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const source = canvas(width, height), small = canvas(SIZE, SIZE);
  try {
    const context = source.getContext('2d', { willReadFrequently:true });
    context.drawImage(image, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height);
    let transparent = 0;
    for (let i = 3; i < pixels.data.length; i += 4) if (pixels.data[i] < 250) transparent++;
    if (transparent > width * height * 0.005) {
      progress(onProgress, '照片已有透明背景，正在整理边缘…');
      const result = trimAndEncode(source); checkAbort(signal); return result;
    }
    const inputContext = small.getContext('2d', { willReadFrequently:true });
    inputContext.drawImage(source, 0, 0, SIZE, SIZE);
    const rgba = inputContext.getImageData(0, 0, SIZE, SIZE).data;
    const count = SIZE * SIZE, input = new Float32Array(count * 3);
    let maximum = 0;
    for (let i = 0; i < rgba.length; i += 4) maximum = Math.max(maximum, rgba[i], rgba[i + 1], rgba[i + 2]);
    maximum = Math.max(maximum, 1e-6);
    const mean = [0.485, 0.456, 0.406], deviation = [0.229, 0.224, 0.225];
    for (let p = 0; p < count; p++) for (let channel = 0; channel < 3; channel++) input[channel * count + p] = (rgba[p * 4 + channel] / maximum - mean[channel]) / deviation[channel];
    const mask = await infer(input, onProgress, signal);
    checkAbort(signal); progress(onProgress, '正在生成透明贴纸…');
    const maskPixels = inputContext.createImageData(SIZE, SIZE);
    for (let i = 0; i < count; i++) {
      maskPixels.data[i * 4] = maskPixels.data[i * 4 + 1] = maskPixels.data[i * 4 + 2] = 255;
      maskPixels.data[i * 4 + 3] = mask[i];
    }
    inputContext.putImageData(maskPixels, 0, 0);
    context.globalCompositeOperation = 'destination-in';
    context.drawImage(small, 0, 0, width, height);
    context.globalCompositeOperation = 'source-over';
    const result = trimAndEncode(source); checkAbort(signal); return result;
  } finally { source.width = source.height = small.width = small.height = 1; image.src = ''; }
}
