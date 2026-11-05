// MOTION LAB 同源 FFmpeg 工作线程入口。
// 正式部署时优先加载 GitHub Pages 同源的本地 npm 依赖；CDN 仅作为备用。
const localModule = new URL('./vendor/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/worker.js', self.location.href).href;
const workerModules = [
  localModule,
  'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/worker.js',
  'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/worker.js',
  'https://fastly.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/worker.js',
  'https://gcore.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/worker.js'
];
const timeout = (promise, ms) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error('工作线程模块连接超时（' + Math.round(ms / 1000) + ' 秒）')), ms))
]);
let lastError = null;
for (const moduleUrl of workerModules) {
  try {
    await timeout(import(moduleUrl), 8000);
    if (typeof self.onmessage === 'function') break;
    throw new Error('模块已加载，但没有注册消息处理器。');
  } catch (error) {
    lastError = error;
  }
}
if (typeof self.onmessage !== 'function') {
  throw new Error('FFmpeg 工作线程模块加载失败：' + (lastError?.message || '所有备用地址均不可用。'));
}
