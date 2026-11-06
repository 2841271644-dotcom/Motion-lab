
const $ = (id) => document.getElementById(id);
const state = {items:[], outputs:[], selectedId:null, ffmpeg:null, ffmpegReady:false, processing:false, currentTask:null, audioFile:null, fit:'contain', previewPlayer:null, previewVideo:null,  previewLottie:null,  previewPaused:false, previewFrame:0, ratio:1,  lottieLoading:null};
const supported = ['svga','json','lottie','mp4','mov','m4v','webm','mkv','avi','gif','webp','apng','png','jpg','jpeg','bmp'];
const animated = new Set(['svga','json','lottie','mp4','mov','m4v','webm','mkv','avi','gif','webp','apng']);
function toast(msg){const el=$('toast');el.textContent=/[\u4e00-\u9fff]/.test(String(msg))?msg:friendlyError(new Error(String(msg)));el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),3200)}
function fmtBytes(n){if(!Number.isFinite(n))return '-';if(n<1024)return n+' B';if(n<1048576)return (n/1024).toFixed(1)+' KB';return (n/1048576).toFixed(2)+' MB'}
function fmtTime(s){if(!Number.isFinite(s)||s<0)s=0;const m=Math.floor(s/60),sec=Math.floor(s%60);return String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0')}
function extOf(name){return (name.split('.').pop()||'').toLowerCase()}
function safeBase(name){return name.replace(/\.[^.]+$/,'').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(0,64)||'动效'}
function selected(){return state.items.find(x=>x.id===state.selectedId)||null}
function getSettings(){const format=$('formatSelect').value;let width=Math.max(16,Math.min(4096,Math.round(Number($('widthInput').value)||300)));let height=Math.max(16,Math.min(4096,Math.round(Number($('heightInput').value)||300)));if(['mp4','webm'].includes(format)){width=Math.max(16,Math.round(width/2)*2);if($('ratioLock').checked&&state.ratio>0)height=Math.min(4096,Math.max(16,Math.round((width/state.ratio)/2)*2));else height=Math.max(16,Math.round(height/2)*2);$('widthInput').value=width;$('heightInput').value=height;updatePreviewCanvas()}return {format,width,height,fps:['png','jpg'].includes(format)?1:Number($('fpsInput').value)||15,quality:Number($('qualityInput').value)||80,bitrate:Number($('bitrateInput').value)||2500,duration:Math.max(.1,Math.min(120,Number($('durationInput').value)||2)),fullDuration:!['png','jpg'].includes(format)&&state.items.some(x=>x.animated)&&$('fullDuration').checked,start:Math.max(0,Number($('startInput').value)||0),speed:['png','jpg'].includes(format)?1:Number($('speedInput').value)||1,fit:state.fit,transparent:$('transparentBg').checked,bg:$('bgColor').value,keepAudio:$('audioMode').value==='keep',replaceAudio:$('audioMode').value==='replace'?state.audioFile:null, audioBitrate:Number($('audioBitrate').value)||128,loop:$('loopInput').checked,stripMeta:$('stripMeta').checked,webOptimize:$('webOptimize').checked,compression:'balanced'}}
function renderFileChips(){const el=$('fileList');el.innerHTML='';state.items.forEach(item=>{const b=document.createElement('button');b.className='file-chip'+(item.id===state.selectedId?' active':'');b.textContent=item.name;b.title=item.name;b.disabled=state.processing;b.onclick=()=>selectItem(item.id);el.appendChild(b)});$('fileStat').textContent='已导入 '+state.items.length+' 个素材';$('clearInputs').disabled=!state.items.length||state.processing;if(!state.processing)syncFormatCapabilities()}
function renderInfo(item){const rows=[['格式',item.ext.toUpperCase()],['文件大小',fmtBytes(item.file.size)],['画布',item.width&&item.height?item.width+' x '+item.height:'-'],['时长',item.duration?item.duration.toFixed(2)+' 秒':'-'],['帧/秒',item.fps||'-']];$('infoRow').innerHTML=rows.map(([a,b])=>`<span class="info-pill">${a}<b>${b}</b></span>`).join('')}
function setSourceDimensions(item){if(item.width&&item.height){state.ratio=item.width/item.height;$('widthInput').value=item.width;$('heightInput').value=item.height;$('ratioPreset').value='source'}if(item.duration&&item.duration>0){$('durationInput').value=Math.min(120,item.duration.toFixed(2));$('startInput').value=0}}
function selectItem(id){state.selectedId=id;const item=selected();if(!item)return;renderFileChips();renderInfo(item);$('previewFormat').textContent=item.ext.toUpperCase();$('previewStatus').textContent=item.status||'就绪';setSourceDimensions(item);renderPreview(item)}
async function addFiles(fileList){
 const incoming=Array.from(fileList||[]),added=[];
 for(const file of incoming){
  const ext=await detectFormat(file);
  if(!supported.includes(ext)){toast('无法识别文件格式：'+file.name);continue}
  if(file.size>150*1024*1024){toast('单个文件不能超过 150 MB。');continue}
  const item={id:crypto.randomUUID(),file,name:file.name,ext,size:file.size,url:URL.createObjectURL(file),width:0,height:0,duration:0,fps:0,frames:0,status:'正在读取',animated:animated.has(ext),videoItem:null};
  state.items.push(item);added.push(item);if(!state.selectedId)state.selectedId=item.id;
 }
 // Register every file first so a JSON can find images imported in the same batch.
 for(const item of added)item.ready=loadMetadata(item).catch(e=>{item.error=e?.message||String(e);item.status='导入失败';item.error=friendlyError(e);toast(item.error)});
 renderFileChips();if(added.length)toast('已导入 '+added.length+' 个文件');
}
async function loadMetadata(item){
if(item.ext==='webm'){const header=new TextDecoder('latin1').decode(await item.file.slice(0,65536).arrayBuffer());item.webmCodec=header.includes('V_VP9')?'libvpx-vp9':header.includes('V_VP8')?'libvpx':null}
if(item.ext==='webp'){item.webpAnimation=await parseWebp(item.file);item.animated=!!item.webpAnimation;if(item.webpAnimation){item.duration=item.webpAnimation.duration;item.frames=item.webpAnimation.frames.length;item.animated=true}}
if(item.ext==='png'||item.ext==='apng'){const timing=await pngTiming(item.file);item.animated=!!timing; if(timing){item.duration=timing.duration;item.frames=timing.frames}}
if(item.ext==='svga')return loadSvga(item)
if(item.ext==='json'||item.ext==='lottie')return loadLottieItem(item)
if(['mp4','mov','m4v','webm','mkv','avi'].includes(item.ext)){

return new Promise(resolve=>{const v=document.createElement('video');v.preload='metadata';v.onloadedmetadata=()=>{item.width=v.videoWidth;item.height=v.videoHeight;item.duration=Number.isFinite(v.duration)?v.duration:0;item.fps=0;item.status='就绪';if(item.id===state.selectedId){renderInfo(item);setSourceDimensions(item);renderPreview(item)}renderFileChips();resolve()};v.onerror=()=>{item.status='暂时无法预览';renderFileChips();resolve()};v.src=item.url;setTimeout(resolve,10000)});}
return new Promise(resolve=>{const img=new Image();img.onload=()=>{item.width=img.naturalWidth;item.height=img.naturalHeight;item.duration=item.duration||0;item.fps=item.animated?(item.frames&&item.duration?Math.round(item.frames/item.duration):15):0;item.status='就绪';if(item.id===state.selectedId){renderInfo(item);setSourceDimensions(item);renderPreview(item)}renderFileChips();resolve()};img.onerror=()=>{item.status='暂时无法预览';renderFileChips();resolve()};img.src=item.url;setTimeout(resolve,10000)});
}
const scriptLoads=new Map();
function loadScript(src,globalName){
 if(window[globalName])return Promise.resolve(window[globalName]);
 if(scriptLoads.has(src))return scriptLoads.get(src);
 const promise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src=src;script.async=true;
  const timer=setTimeout(()=>done(new Error(globalName+' 加载超时，请刷新后重试。')),20000);
  function done(error){clearTimeout(timer);if(error){script.remove();scriptLoads.delete(src);reject(error)}else if(window[globalName])resolve(window[globalName]);else done(new Error(globalName+' 初始化失败。'))}
  script.onload=()=>done();script.onerror=()=>done(new Error(globalName+' 加载失败。'));document.head.appendChild(script);
 });scriptLoads.set(src,promise);return promise;
}
async function ensureLottie(){if(window.lottie)return window.lottie;if(!state.lottieLoading)state.lottieLoading=loadScript('./vendor/lottie.min.js','lottie').catch(e=>{state.lottieLoading=null;throw e});return state.lottieLoading}
async function loadLottieItem(item){try{let data=null;let zip=null;if(item.ext==='lottie'){if(!window.JSZip)throw new Error('压缩组件未加载，请刷新后重试。');zip=await JSZip.loadAsync(item.file);let manifest=null;const mf=zip.file('manifest.json');if(mf){try{manifest=JSON.parse(await mf.async('string'))}catch(e){}}let path=null;const manifestPath=manifest?.animations?.[0]?.id;if(manifestPath)path='a/'+manifestPath+'.json';if(path&&zip.file(path)){}else{const names=Object.keys(zip.files).filter(n=>/\.json$/i.test(n)&&n!=='manifest.json'&&!zip.files[n].dir);path=names.find(n=>/^a\//i.test(n))||names.find(n=>/^animations\//i.test(n))||names[0]}if(!path||!zip.file(path))throw new Error('压缩包中未找到 Lottie 动画数据。');data=JSON.parse(await zip.file(path).async('string'));await embedZipLottieAssets(data,zip)}else{data=JSON.parse(await item.file.text())}
if(!data||!Array.isArray(data.layers)||!Number(data.fr)||!Number(data.op))throw new Error('JSON 文件不是有效的 Lottie 动画。');if(!zip)await embedImportedLottieAssets(data);item.lottieData=data;item.width=Number(data.w)||300;item.height=Number(data.h)||300;item.fps=Number(data.fr)||30;item.frames=Math.max(1,Number(data.op)-Number(data.ip||0));item.duration=item.frames/item.fps;item.status='就绪';if(item.id===state.selectedId){renderInfo(item);setSourceDimensions(item);renderPreview(item)}renderFileChips()}catch(e){item.status='Lottie 解析失败';item.error=e.message;renderFileChips()}}
function mimeForAsset(name){const ext=(name.split('.').pop()||'').toLowerCase();return ext==='jpg'||ext==='jpeg'?'image/jpeg':ext==='webp'?'image/webp':ext==='svg'?'image/svg+xml':'image/png'}
async function embedZipLottieAssets(data,zip){for(const asset of data.assets||[]){if(!asset.p||asset.p.startsWith('data:'))continue;const path=(asset.u||'')+asset.p;const entry=zip.file(path)||zip.file('images/'+asset.p)||zip.file('assets/'+asset.p);if(entry){const b64=await entry.async('base64');asset.p='data:'+mimeForAsset(asset.p)+';base64,'+b64;asset.u='';asset.e=1}}}
async function embedImportedLottieAssets(data){for(const asset of data.assets||[]){if(!asset.p||asset.p.startsWith('data:'))continue;const target=(asset.u||'')+asset.p;const match=state.items.find(x=>x!==selected()&&(x.name===asset.p||x.name===target));if(match){const b64=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=reject;r.readAsDataURL(match.file)});asset.p='data:'+match.file.type+';base64,'+b64;asset.u='';asset.e=1}}}
async function inspectSvgaFile(file){
 if(!file?.size)throw new Error('文件为空。');
 const h=new Uint8Array(await file.slice(0,8).arrayBuffer());
 if(h[0]===80&&h[1]===75){
  const zip=await JSZip.loadAsync(file);const specName=Object.keys(zip.files).find(n=>/(^|\/)movie\.spec$/i.test(n)&&!zip.files[n].dir);
  if(!specName)throw new Error('压缩包缺少 movie.spec，无法识别为 SVGA。');
  const spec=JSON.parse(await zip.file(specName).async('string'));
  if(!spec.movie?.viewBox||!Array.isArray(spec.sprites))throw new Error('SVGA 1.x 缺少画布或动画数据。');
  const normalized=new JSZip();const dir=specName.slice(0,-10);
  for(const [key,value] of Object.entries(spec.images||{})){
   const stem=String(value).replace(/\.png$/i,'');
   const entry=zip.file(dir+value)||zip.file(dir+stem+'.png')||zip.file(String(value))||zip.file(stem+'.png');
   if(!entry)throw new Error('SVGA 缺少图片：'+value);
   spec.images[key]=key;normalized.file(key+'.png',await entry.async('uint8array'));
  }
  normalized.file('movie.spec',JSON.stringify(spec));
  return {version:'1.x (ZIP/JSON)',kind:'zip',file:await normalized.generateAsync({type:'blob'})};
 }
 if(h.length>=2&&(h[0]&15)===8&&((h[0]<<8|h[1])%31===0))return {version:'2.x (zlib/Protobuf)',kind:'zlib'};
 throw new Error('无法识别 SVGA 文件头。请提供原始文件，改扩展名不能修复损坏或加密文件。');
}
function parserLoadSvga(parser,source,timeoutMs=20000){
  return new Promise((resolve,reject)=>{
    let settled=false;
    const timer=setTimeout(()=>finish(new Error('SVGA 解析超时（20 秒）。文件可能过大、结构异常，或浏览器内存不足。')),timeoutMs);
    function finish(err,value){if(settled)return;settled=true;clearTimeout(timer);if(err)reject(err);else if(!value)reject(new Error('解析器没有返回动画数据。'));else resolve(value)}
    try{parser.load(source,value=>finish(null,value),err=>finish(err instanceof Error?err:new Error(String(err||'未知解析错误'))))}catch(e){finish(e)}
  });
}
async function loadSvga(item){
  try{
    if(!window.SVGA||!window.SVGA.Parser)throw new Error('SVGA 播放器组件没有加载。请刷新页面以重新加载组件。');
    const detected=await inspectSvgaFile(item.file);
    item.svgaVersion=detected.version;
    const normalized=detected.file||item.file;
    const base64=bytesToBase64(new Uint8Array(await normalized.arrayBuffer()));
    const videoItem=await parserLoadSvga(new SVGA.Parser(),'data:svga/'+(detected.kind==='zip'?'1.0':'2.0')+';base64,'+base64);
    item.videoItem=videoItem;
    item.width=videoItem.videoSize?.width||300;
    item.height=videoItem.videoSize?.height||300;
    item.fps=videoItem.FPS||15;
    item.frames=videoItem.frames||0;
    item.duration=item.frames/(item.fps||15);
    item.status='就绪';
    item.error='';
    if(item.id===state.selectedId){renderInfo(item);setSourceDimensions(item);renderPreview(item)}
    renderFileChips();
  }catch(err){
    item.status='SVGA 解析失败';
    item.error=friendlyError(err);
    renderFileChips();
    toast('SVGA 解析失败：'+item.error);
    console.error('动效工坊 SVGA 诊断',item.name,item.svgaVersion||'version unknown',item.error);
  }
}
function destroyPreview(){if(state.previewPlayer){try{state.previewPlayer.stopAnimation()}catch(e){}state.previewPlayer=null}if(state.previewVideo){try{state.previewVideo.pause()}catch(e){}state.previewVideo=null}if(state.previewLottie){try{state.previewLottie.destroy()}catch(e){}state.previewLottie=null}}
async function renderLottiePreview(item,content){const lottie=await ensureLottie();if(selected()!==item||!content.isConnected)return;const holder=document.createElement('div');holder.style.cssText='width:100%;height:100%;min-height:0;overflow:hidden';content.appendChild(holder);const preserve=state.fit==='cover'?'xMidYMid slice':state.fit==='stretch'?'none':'xMidYMid meet';const anim=lottie.loadAnimation({container:holder,renderer:'canvas',loop:true,autoplay:true,animationData:JSON.parse(JSON.stringify(item.lottieData)),rendererSettings:{preserveAspectRatio:preserve,clearCanvas:true}});state.previewLottie=anim;setPlaying(true);anim.addEventListener('enterFrame',()=>{const t=Math.max(0,anim.currentFrame/(item.fps||30));updateTime(t,item.duration)})}
function drawFrameFit(ctx,img,s){const iw=img.width||img.naturalWidth||s.width,ih=img.height||img.naturalHeight||s.height;ctx.clearRect(0,0,s.width,s.height);if(!s.transparent){ctx.fillStyle=s.bg;ctx.fillRect(0,0,s.width,s.height)}let dw=s.width,dh=s.height,dx=0,dy=0;if(s.fit==='contain'){const k=Math.min(s.width/iw,s.height/ih);dw=iw*k;dh=ih*k;dx=(s.width-dw)/2;dy=(s.height-dh)/2}else if(s.fit==='cover'){const k=Math.max(s.width/iw,s.height/ih);dw=iw*k;dh=ih*k;dx=(s.width-dw)/2;dy=(s.height-dh)/2}ctx.drawImage(img,dx,dy,dw,dh)}
function getCanvasDimensions(){const width=Math.max(16,Math.min(4096,Math.round(Number($('widthInput').value)||300)));const height=Math.max(16,Math.min(4096,Math.round(Number($('heightInput').value)||300)));return {width,height}}
function updatePreviewCanvas(){const stage=$('stage');const surface=stage.querySelector('.preview-canvas');if(!surface)return;const {width,height}=getCanvasDimensions();const maxW=Math.max(100,stage.clientWidth-36);const maxH=Math.max(100,stage.clientHeight-36);const scale=Math.min(maxW/width,maxH/height);surface.style.width=Math.max(1,Math.round(width*scale))+'px';surface.style.height=Math.max(1,Math.round(height*scale))+'px';surface.style.backgroundColor=$('transparentBg').checked?'#17243a':$('bgColor').value;surface.style.backgroundImage=$('transparentBg').checked?'linear-gradient(45deg,#26354b 25%,transparent 25%),linear-gradient(-45deg,#26354b 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#26354b 75%),linear-gradient(-45deg,transparent 75%,#26354b 75%)':'none';surface.style.backgroundSize='18px 18px';surface.style.backgroundPosition='0 0,0 9px,9px -9px,-9px 0';surface.style.setProperty('--media-fit',state.fit==='stretch'?'fill':state.fit==='cover'?'cover':'contain');const label=surface.querySelector('.canvas-size');if(label)label.textContent='输出画布 '+width+' x '+height+' 像素'}
function createPreviewContent(stage){const surface=document.createElement('div');surface.className='preview-canvas';const content=document.createElement('div');content.className='preview-content';const label=document.createElement('div');label.className='canvas-size';surface.appendChild(content);surface.appendChild(label);stage.appendChild(surface);updatePreviewCanvas();return content}
function syncCanvasDimensions(changed,finalize=false){const wi=$('widthInput'),hi=$('heightInput');let w=Number(wi.value),h=Number(hi.value);if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0)return;if($('ratioLock').checked&&state.ratio>0){if(changed==='height')w=Math.round(h*state.ratio);else h=Math.round(w/state.ratio)}if(finalize){w=Math.max(16,Math.min(4096,Math.round(w)));h=Math.max(16,Math.min(4096,Math.round(h)))}if(changed!=='width'||finalize)wi.value=w;if(changed!=='height'||finalize)hi.value=h;updatePreviewCanvas()}
function renderPreview(item){destroyPreview();configurePlayback(item);state.previewPaused=false;state.previewFrame=0;const stage=$('stage');stage.classList.remove('empty');stage.innerHTML='';$('previewFormat').textContent=item.ext.toUpperCase();$('previewStatus').textContent=item.status||'就绪';const overlay=document.createElement('div');overlay.className='stage-overlay';overlay.innerHTML=`<span class="overlay-chip">源画布 ${item.width||'-'} x ${item.height||'-'}</span><span class="overlay-chip">${item.fps||'-'} 帧/秒</span>`;stage.appendChild(overlay);const content=createPreviewContent(stage);if(item.ext==='svga'&&item.videoItem&&window.SVGA){const holder=document.createElement('div');holder.className='svga-holder';holder.id='svgaLivePlayer';content.appendChild(holder);const p=new SVGA.Player(holder);p.setVideoItem(item.videoItem);p.setContentMode(state.fit==='cover'?'AspectFill':state.fit==='stretch'?'Fill':'AspectFit');p.loops=0;p.onFrame(frame=>{state.previewFrame=frame;updateTime(frame/(item.fps||15),item.duration)});p.startAnimation();state.previewPlayer=p;setPlaying(true);return}if(item.ext==='lottie'||item.ext==='json'){renderLottiePreview(item,content).catch(e=>{item.status='Lottie 预览失败';item.error=e.message;toast(e.message)});return}if(['mp4','mov','m4v','webm','mkv','avi'].includes(item.ext)){const v=document.createElement('video');v.src=item.url;v.controls=false;v.autoplay=true;v.loop=true;v.muted=true;v.playsInline=true;content.appendChild(v);state.previewVideo=v;v.onloadedmetadata=()=>updateTime(v.currentTime,v.duration);v.ontimeupdate=()=>updateTime(v.currentTime,v.duration);v.onplay=()=>{if(state.previewVideo===v)setPlaying(true)};v.onpause=()=>{if(state.previewVideo===v)setPlaying(false)};v.onerror=()=>{if(state.previewVideo===v){for(const id of ['playBtn','restartBtn','timeline'])$(id).disabled=true;$('previewHint').textContent='此视频编码无法在浏览器中预览，仍可尝试转换。';setPlaying(false)}};return}const img=document.createElement('img');img.src=item.url;img.alt=item.name;content.appendChild(img);$('timeLabel').textContent=item.animated?'动画图片自动播放':'静态图片';$('timelineFill').style.width='0%'}
function updateTime(now,duration){$('timeLabel').textContent=fmtTime(now)+' / '+fmtTime(duration);$('timeline').value=duration>0?Math.round(Math.min(1,now/duration)*1000):0}
function renderQueue(){const el=$('queueList');$('queueCount').textContent=state.outputs.length+' 个任务';const doneCount=state.outputs.filter(x=>x.status==='done').length;$('downloadAll').hidden=doneCount<2;$('downloadAll').disabled=doneCount<2||state.processing;$('clearQueue').disabled=!state.outputs.length||state.processing;if(!state.outputs.length){el.innerHTML='<div class="queue-empty">暂无任务。导入素材、设置导出参数后，即可开始处理。</div>';return}el.innerHTML='';state.outputs.forEach(task=>{const row=document.createElement('div');row.className='queue-item';const statusClass=task.status==='done'?'done':task.status==='error'?'error':'';row.innerHTML=`<div><div class="q-name" title="${escapeHtml(task.name)}">${escapeHtml(task.name)}</div><div class="q-meta">${task.sourceExt.toUpperCase()} &rarr; ${task.format.toUpperCase()} &nbsp; ${task.size?fmtBytes(task.size):''}</div></div><div class="status ${statusClass}">${task.statusLabel}</div><div class="progress"><span style="width:${task.progress||0}%"></span></div><div class="q-meta">${task.progress||0}%</div><div class="q-actions"></div>`;if(task.error){const detail=document.createElement('div');detail.className='q-meta';detail.style.cssText='grid-column:1/-1;color:#ff9a9a;white-space:pre-wrap;overflow-wrap:anywhere';detail.textContent=task.error;row.appendChild(detail)}const actions=row.querySelector('.q-actions');if(task.status==='done'){const d=document.createElement('button');d.textContent='下载文件';d.onclick=()=>downloadTask(task);actions.appendChild(d)}else if(task.status==='error'){}el.appendChild(row)})}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function ensureFFmpeg(){
 if(state.ffmpegReady)return state.ffmpeg;
 if(state.ffmpegLoading)return state.ffmpegLoading;
 state.ffmpegLoading=(async()=>{
  $('engineStat').textContent='正在加载转换引擎…';
  const {FFmpeg}=await import('./vendor/ffmpeg/index.js');const ff=new FFmpeg();
  ff.on('progress',({progress})=>{if(state.currentTask&&Number.isFinite(progress)){state.currentTask.progress=Math.max(state.currentTask.progress,Math.min(95,Math.round(progress*95)));renderQueue()}});
  ff.on('log',({message})=>{if(state.currentTask&&message){state.currentTask.logs=(state.currentTask.logs||[]).concat(message).slice(-15);state.currentTask.lastLog=message}});
  try{
   await Promise.race([ff.load({coreURL:new URL('./vendor/core/ffmpeg-core.js',import.meta.url).href,wasmURL:new URL('./vendor/core/ffmpeg-core.wasm',import.meta.url).href}),new Promise((_,reject)=>setTimeout(()=>reject(new Error('引擎加载超时，请刷新后重试。')),45000))]);
   state.ffmpeg=ff;state.ffmpegReady=true;$('engineStat').textContent='转换引擎已就绪';return ff;
  }catch(e){ff.terminate();$('engineStat').textContent='引擎加载失败，可重试';throw new Error('转换引擎加载失败，请刷新页面后重试。');}
 })();
 try{return await state.ffmpegLoading}finally{state.ffmpegLoading=null}
}
function scaleFilter(s,alphaOutput){const w=s.width,h=s.height;const alpha=!!(s.transparent&&alphaOutput);let color=alpha?'black@0':('0x'+String(s.bg||'#10182a').replace('#',''));const pre='format=rgba,';const hex=String(s.bg||'#10182a').replace('#','');const rgb=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16));const post=alpha?',format=rgba':`,geq=r='r(X,Y)*alpha(X,Y)/255+${rgb[0]}*(1-alpha(X,Y)/255)':g='g(X,Y)*alpha(X,Y)/255+${rgb[1]}*(1-alpha(X,Y)/255)':b='b(X,Y)*alpha(X,Y)/255+${rgb[2]}*(1-alpha(X,Y)/255)':a=255,format=rgba`;if(s.fit==='stretch')return `${pre}scale=${w}:${h}${post},setsar=1`;if(s.fit==='cover')return `${pre}scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}${post},setsar=1`;return `${pre}scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=${color}${post},setsar=1`}
async function writeFrames(ff,frames,prefix){for(let i=0;i<frames.length;i++){await ff.writeFile(`${prefix}${String(i).padStart(5,'0')}.png`,frames[i])}}
async function cleanupFFmpeg(ff,prefix,names=[]){try{const list=await ff.listDir('/');for(const entry of list){if((prefix&&entry.name.startsWith(prefix))||names.includes(entry.name)){try{await ff.deleteFile(entry.name)}catch(e){}}}}catch(e){}}
async function readFrames(ff,prefix,max=500){const list=await ff.listDir('/');const names=list.filter(x=>x.name.startsWith(prefix)&&x.name.endsWith('.png')).map(x=>x.name).sort();if(names.length>max)throw new Error('动画帧数超出当前内存预算，请降低尺寸、时长或帧率。');const frames=[];for(const name of names)frames.push(await ff.readFile(name));return frames}
async function renderSvgaFrames(item,s,progress,maxOutputFrames=500){
 if(!item.videoItem)throw new Error(item.error||'SVGA 尚未解析完成。');
 const count=checkedFrameCount(frameDuration(item,s),s,maxOutputFrames);
 const holder=document.createElement('div');holder.style.cssText=`position:fixed;left:-10000px;top:0;width:${item.width}px;height:${item.height}px;overflow:hidden`;document.body.appendChild(holder);
 const player=new SVGA.Player(holder);const canvas=document.createElement('canvas');canvas.width=s.width;canvas.height=s.height;const ctx=canvas.getContext('2d');const frames=[];
 try{
  player.setVideoItem(item.videoItem);player.setContentMode('AspectFit');await waitSvgaImages(player);
  for(let i=0;i<count;i++){
   const time=s.start+i/s.fps*s.speed;
   player.stepToFrame(Math.min(item.frames-1,Math.floor(time*item.fps)),false);
   drawFrameFit(ctx,holder.querySelector('canvas'),s);
   const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));if(!blob)throw new Error('SVGA 动画帧读取失败。');frames.push(new Uint8Array(await blob.arrayBuffer()));progress(Math.round((i+1)/count*45));
  }
 }finally{player.stopAnimation();holder.remove()}
 return frames;
}
async function buildSvga(frames,s){
 if(!frames.length)throw new Error('没有可导出的动画帧。');
 const type=svgaType();const count=frames.length;const images={},sprites=[];
 for(let i=0;i<count;i++){
  const key='f'+i;images[key]=frames[i];
  sprites.push({imageKey:key,frames:Array.from({length:count},(_,j)=>({alpha:i===j?1:0,layout:{x:0,y:0,width:s.width,height:s.height},transform:{a:1,b:0,c:0,d:1,tx:0,ty:0}}))});
 }
 const message={version:'2.0',params:{viewBoxWidth:s.width,viewBoxHeight:s.height,fps:s.fps,frames:count},images,sprites};
 const err=type.verify(message);if(err)throw new Error(err);
 return new Blob([pako.deflate(type.encode(type.create(message)).finish())],{type:'application/octet-stream'});
}
async function extractToFrames(ff,item,s,prefix,progress){const ext=item.ext;const input='input_'+item.id.replace(/-/g,'')+'.'+ext;await ff.writeFile(input,new Uint8Array(await item.file.arrayBuffer()));const still=isStill(item);const alphaOut=true;const vf=scaleFilter({...s,fit:s.fit},alphaOut)+`,setpts=(PTS-STARTPTS)/${s.speed},fps=${s.fps}`;let args=[];if(still)args=['-loop','1','-framerate',String(s.fps),'-t',String(s.duration||2),'-i',input];else{args=['-ss',String(s.start)];if(s.duration>0)args.push('-t',String(s.duration));args.push(...decoderArgs(item),'-i',input)}args.push('-vf',vf,'-frames:v',String(frameLimit(s)+1),'-vsync','0','-start_number','0',`${prefix}%05d.png`);const code=await ff.exec(['-y','-threads','1','-filter_threads','1','-filter_complex_threads','1',...args]);if(code!==0)throw new Error('解码失败，源文件可能损坏或使用了当前引擎不支持的编码。');let frames=await readFrames(ff,prefix,frameLimit(s));if(!frames.length)throw new Error('未解码出动画帧，请检查素材编码。');progress(65);return {frames,input}}
async function renderLottieFrames(item,s,progress,maxFrames=500){if(!item.lottieData)throw new Error('Lottie 动画尚未解析完成。');const lottie=await ensureLottie();const data=item.lottieData;const sourceDuration=item.duration||((Number(data.op)-Number(data.ip||0))/(Number(data.fr)||30));const clipDuration=s.duration>0?s.duration:Math.max(.1,sourceDuration-s.start);const count=checkedFrameCount(clipDuration/s.speed,s,maxFrames);const holder=document.createElement('div');holder.style.cssText='position:fixed;left:-10000px;top:0;width:'+item.width+'px;height:'+item.height+'px;overflow:hidden;pointer-events:none';document.body.appendChild(holder);const anim=lottie.loadAnimation({container:holder,renderer:'canvas',loop:false,autoplay:false,animationData:JSON.parse(JSON.stringify(data)),rendererSettings:{preserveAspectRatio:'xMidYMid meet',clearCanvas:true}});try{await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('Lottie 渲染超时。')),12000);anim.addEventListener('DOMLoaded',()=>{clearTimeout(t);resolve()});anim.addEventListener('data_failed',()=>{clearTimeout(t);reject(new Error('Lottie 素材图片无法加载。'))})});const sourceCanvas=holder.querySelector('canvas')||anim.renderer?.canvas;if(!sourceCanvas)throw new Error('Lottie 未生成有效画布。');const out=document.createElement('canvas');out.width=s.width;out.height=s.height;const ctx=out.getContext('2d');const frames=[];for(let i=0;i<count;i++){const time=s.start+(i/s.fps)*s.speed;if(time>=Math.min(sourceDuration,s.start+clipDuration))break;const frame=Math.min(item.frames-1,time*(Number(data.fr)||30));anim.goToAndStop(frame,true);drawFrameFit(ctx,sourceCanvas,s);const blob=await new Promise(resolve=>out.toBlob(resolve,'image/png'));if(!blob)throw new Error('无法读取 Lottie 动画帧。');frames.push(new Uint8Array(await blob.arrayBuffer()));progress(Math.round((i+1)/count*45))}if(!frames.length)throw new Error('Lottie 未生成可用动画帧。');return frames}finally{anim.destroy();holder.remove()}}
function bytesToBase64(bytes){let binary='';const chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));return btoa(binary)}
function buildLottie(frames,s){const assets=frames.map((data,i)=>({id:'image_'+i,w:s.width,h:s.height,u:'',p:'data:image/png;base64,'+bytesToBase64(data),e:1}));const layers=frames.map((data,i)=>({ddd:0,ind:i+1,ty:2,nm:'第 '+(i+1)+' 帧',refId:'image_'+i,sr:1,ks:{o:{a:0,k:100},r:{a:0,k:0},p:{a:0,k:[s.width/2,s.height/2,0]},a:{a:0,k:[s.width/2,s.height/2,0]},s:{a:0,k:[100,100,100]}},ao:0,ip:i,op:i+1,st:i,bm:0}));return new Blob([JSON.stringify({v:'5.7.4',fr:s.fps,ip:0,op:frames.length,w:s.width,h:s.height,nm:'动效工坊逐帧动画',ddd:0,assets,layers})],{type:'application/json'})}
async function convertWithFFmpegJob(item,s,task){
const prefix='f_'+item.id.replace(/-/g,'')+'_';let ff=null;const getFF=async()=>{if(!ff)ff=await ensureFFmpeg();return ff};let frames=null,inputName=null,sourceIsFrames=false,sourceIsSvga=item.ext==='svga';const maxFrames=500;const report=p=>{task.progress=Math.max(task.progress,p);renderQueue()};
if(item.ext==='webp'&&item.webpAnimation){frames=await renderWebpFrames(item,s,report,maxFrames);sourceIsFrames=true}
else if(item.ext==='lottie'||item.ext==='json'){frames=await renderLottieFrames(item,s,report,maxFrames);sourceIsFrames=true}
else if(sourceIsSvga){frames=await renderSvgaFrames(item,s,report,maxFrames);sourceIsFrames=true}
else if(s.format==='svga'||s.format==='pngseq'||s.format==='lottie'||s.format==='webp'||['webp','apng','gif'].includes(item.ext)){ff=await getFF();const result=await extractToFrames(ff,item,s,prefix,p=>{task.progress=p;renderQueue()});frames=result.frames;inputName=result.input;sourceIsFrames=true}
if(s.format==='webp'){if(!frames?.length)throw new Error('未生成可用于导出 WEBP 的动画帧。');const blob=await buildAnimatedWebp(frames,s);return {blob,ext:'webp',mime:'image/webp',size:blob.size}}
if(s.format==='svga'){if(!frames)throw new Error('未生成可用于导出 SVGA 的动画帧。');const blob=await buildSvga(frames,s);if(ff)await cleanupFFmpeg(ff,prefix,[inputName].filter(Boolean));return {blob,ext:'svga',mime:'application/octet-stream',size:blob.size}}
if(s.format==='lottie'){if(!frames)throw new Error('未生成可用于导出 Lottie 的动画帧。');const blob=buildLottie(frames,s);if(ff)await cleanupFFmpeg(ff,prefix,[inputName].filter(Boolean));return {blob,ext:'json',mime:'application/json',size:blob.size}}
if(s.format==='pngseq'){if(!frames)throw new Error('未生成可用于导出 PNG 序列的动画帧。');const zip=new JSZip();frames.forEach((data,i)=>zip.file('帧_'+String(i).padStart(5,'0')+'.png',data));const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:4}});if(ff)await cleanupFFmpeg(ff,prefix,[inputName].filter(Boolean));return {blob,ext:'zip',mime:'application/zip',size:blob.size}}
ff=await getFF();if(sourceIsFrames&&frames)await writeFrames(ff,frames,prefix);
let args=[];let srcName=inputName;if(sourceIsFrames){srcName=''}else if(!inputName){srcName='input_'+item.id.replace(/-/g,'')+'.'+item.ext;await ff.writeFile(srcName,new Uint8Array(await item.file.arrayBuffer()))}
if(sourceIsFrames){args=['-framerate',String(s.fps),'-i',prefix+'%05d.png']}else{const still=isStill(item);if(still)args=['-loop','1','-framerate',String(s.fps),'-t',String(s.duration||2),'-i',srcName];else{args=['-ss',String(s.start)];if(s.duration>0)args.push('-t',String(s.duration));args.push(...decoderArgs(item),'-i',srcName)}}
let audioInput=null;if(s.replaceAudio){audioInput='audio_'+item.id.replace(/-/g,'')+'.'+extOf(s.replaceAudio.name);await ff.writeFile(audioInput,new Uint8Array(await s.replaceAudio.arrayBuffer()));args.push('-i',audioInput)}
const transparentTarget=['webp','apng','webm'].includes(s.format);const vf=scaleFilter(s,transparentTarget)+(sourceIsFrames?'':`,setpts=(PTS-STARTPTS)/${s.speed}`)+`,fps=${s.fps}`;const q=s.compression==='quality'?Math.min(100,s.quality+10):s.compression==='small'?Math.max(10,s.quality-15):s.compression==='lossless'?100:s.quality;const crf=Math.round(40-(q/100)*32);const output='out_'+item.id.replace(/-/g,'')+'.'+s.format;
if(s.format==='mp4'){args.push('-vf',vf,'-c:v','libx264','-preset','veryfast','-crf',String(crf),'-pix_fmt','yuv420p','-b:v',String(s.bitrate)+'k');if(s.webOptimize)args.push('-movflags','+faststart');if(s.replaceAudio){args.push('-map','0:v:0','-map','1:a:0','-c:a','aac','-b:a',String(s.audioBitrate)+'k','-filter:a',`atempo=${s.speed},apad`,'-shortest')}else if(s.keepAudio&&!sourceIsFrames&&!['png','jpg','jpeg','bmp','gif','webp','apng'].includes(item.ext)){args.push('-map','0:v:0','-map','0:a?','-c:a','aac','-b:a',String(s.audioBitrate)+'k','-filter:a',`atempo=${s.speed}`)}else args.push('-an')}
else if(s.format==='webm'){args.push('-vf',vf,'-c:v','libvpx','-threads','1','-auto-alt-ref','0','-lag-in-frames','0','-crf',String(Math.max(4,Math.min(63,Math.round(63-q*.58)))),'-b:v',String(s.bitrate)+'k');if(s.transparent)args.push('-pix_fmt','yuva420p');if(s.replaceAudio){args.push('-map','0:v:0','-map','1:a:0','-c:a','libopus','-b:a',String(s.audioBitrate)+'k','-filter:a',`atempo=${s.speed},apad`,'-shortest')}else if(s.keepAudio&&!sourceIsFrames&&!['png','jpg','jpeg','bmp','gif','webp','apng'].includes(item.ext)){args.push('-map','0:v:0','-map','0:a?','-c:a','libopus','-b:a',String(s.audioBitrate)+'k','-filter:a',`atempo=${s.speed}`)}else args.push('-an')}
else if(s.format==='gif'){const gifFilter=scaleFilter(s,true)+(sourceIsFrames?'':`,setpts=(PTS-STARTPTS)/${s.speed}`)+`,fps=${s.fps}`;const colors=Math.max(16,Math.min(256,Math.round(q*2.56)));args.push('-filter_complex',`[0:v]${gifFilter},split[a][b];[a]palettegen=max_colors=${colors}:stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a[v]`,'-map','[v]','-loop',s.loop?'0':'-1','-gifflags','-offsetting','-an')}
else if(s.format==='apng'){args.push('-vf',vf,'-f','apng','-plays',s.loop?'0':'1','-compression_level','6','-an')}
else if(s.format==='png'){args.push('-vf',scaleFilter(s,true),'-frames:v','1','-an')}
else if(s.format==='jpg'){args.push('-vf',scaleFilter({...s,transparent:false},false),'-frames:v','1','-q:v',String(Math.max(2,Math.round(31-q*.29))),'-an')}
else throw new Error('不支持的输出格式：'+s.format);
if(s.stripMeta)args.push('-map_metadata','-1');args.push(output);const code=await ff.exec(['-y','-threads','1','-filter_threads','1','-filter_complex_threads','1',...args]);if(code!==0)throw new Error('编码失败，请调整输出参数或检查源文件编码。');const data=await ff.readFile(output);const mime={mp4:'video/mp4',webm:'video/webm',gif:'image/gif',webp:'image/webp',apng:'image/apng',png:'image/png',jpg:'image/jpeg'}[s.format]||'application/octet-stream';const blob=new Blob([data],{type:mime});await cleanupFFmpeg(ff,prefix,[srcName,audioInput,output].filter(Boolean));return {blob,ext:s.format,mime,size:blob.size}}
function convertStaticCanvas(item,s){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{const c=document.createElement('canvas');c.width=s.width;c.height=s.height;const ctx=c.getContext('2d');if(s.format==='jpg'||!s.transparent){ctx.fillStyle=s.bg;ctx.fillRect(0,0,c.width,c.height)}let dw=s.width,dh=s.height,dx=0,dy=0;if(s.fit==='contain'){const k=Math.min(s.width/img.width,s.height/img.height);dw=img.width*k;dh=img.height*k;dx=(s.width-dw)/2;dy=(s.height-dh)/2}else if(s.fit==='cover'){const k=Math.max(s.width/img.width,s.height/img.height);dw=img.width*k;dh=img.height*k;dx=(s.width-dw)/2;dy=(s.height-dh)/2}else{dw=s.width;dh=s.height}ctx.drawImage(img,dx,dy,dw,dh);c.toBlob(blob=>blob?resolve(blob):reject(new Error('画布导出失败。')),s.format==='jpg'?'image/jpeg':'image/png',s.quality/100)};img.onerror=()=>reject(new Error('图片解码失败。'));img.src=item.url})}
async function convertItem(item,s,task){
 s=normalizeSettings(s);
 if(s.format==='png'||s.format==='jpg'){
  if(isStill(item)){const blob=await convertStaticCanvas(item,s);return {blob,ext:s.format,mime:blob.type,size:blob.size}}
  const first={...s,format:'png',speed:1,duration:1/(s.fps||15)};
  const rendered=await convertWithFFmpeg(item,first,task);
  if(s.format==='png')return rendered;
  const url=URL.createObjectURL(rendered.blob);
  try{const blob=await convertStaticCanvas({url},s);return {blob,ext:'jpg',mime:'image/jpeg',size:blob.size}}finally{URL.revokeObjectURL(url)}
 }
 return convertWithFFmpeg(item,s,task);
}
function setTaskStatus(task,status,label){task.status=status;task.statusLabel=label;renderQueue()}
async function startProcessing(){
 if(state.processing)return;
 if(!state.items.length){toast('请先导入素材。');return}
 let batchError=null;const targets=state.items.slice();state.processing=true;setProcessingControls(true);$('convertBtn').disabled=true;$('convertBtn').textContent='正在处理…';
 try{
  await Promise.all(targets.map(item=>item.ready));
  const s=getSettings();
  if(s.format==='mp4'||s.format==='webm'){if($('audioMode').value==='replace'&&!s.replaceAudio)throw new Error('请先选择替换音频文件。');}
  for(const item of targets){
   const task={id:crypto.randomUUID(),name:safeBase($('nameInput').value||item.name)+'_'+safeBase(item.name),sourceExt:item.ext,format:s.format,status:'running',statusLabel:'正在处理',progress:0,size:0,blob:null,error:null};state.outputs.push(task);state.currentTask=task;renderQueue();
   try{
    if(item.status==='导入失败')throw new Error(item.error);
    const settings={...s};
    if(s.fullDuration&&item.animated)settings.duration=item.duration?Math.max(.1,item.duration-s.start):0;
    if(item.duration>0&&s.start>=item.duration)throw new Error('起始时间超出素材时长。');
    const result=await convertItem(item,settings,task);
    Object.assign(task,{blob:result.blob,ext:result.ext,mime:result.mime,size:result.size,progress:100,status:'done',statusLabel:'已完成',name:uniqueOutputName(task.name.replace(/_+$/,'')+'.'+result.ext,task)});
   }catch(e){task.status='error';task.statusLabel='失败';task.error=friendlyError(e)}
   renderQueue();
  }
 }catch(e){batchError=friendlyError(e);toast(batchError);}finally{state.currentTask=null;state.processing=false;$('convertBtn').disabled=false;$('convertBtn').innerHTML='&#9654; &nbsp; 开始处理';$('convertNote').textContent=batchError?'未开始处理：'+batchError:'处理完成 · '+state.outputs.filter(x=>x.status==='done').length+' 个成功';setProcessingControls(false);renderQueue();renderFileChips();}
}
function downloadTask(task){if(!task.blob)return;const url=URL.createObjectURL(task.blob);const a=document.createElement('a');a.href=url;a.download=task.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}
async function downloadAll(){const done=state.outputs.filter(x=>x.status==='done'&&x.blob);if(!done.length)return;const zip=new JSZip();done.forEach((t,i)=>zip.file(t.name||('output_'+i+'.'+t.ext),t.blob));const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:4}});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='动效导出合集.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}
function clearAll(){if(state.processing){toast('请等待当前任务处理完成。');return}state.items.forEach(x=>URL.revokeObjectURL(x.url));state.items=[];state.outputs=[];state.selectedId=null;destroyPreview();$('stage').classList.add('empty');$('stage').innerHTML='<div class="empty-state"><div class="big">&#10022;</div><strong>导入素材开始处理</strong><span>实时预览动画，查看素材参数并调整导出设置。</span></div>';$('previewFormat').textContent='暂无素材';$('previewStatus').textContent='等待导入';$('infoRow').innerHTML='';$('fileList').innerHTML='';$('fileStat').textContent='已导入 0 个素材';$('timeLabel').textContent='00:00 / 00:00';$('timeline').value=0;configurePlayback(null);renderQueue();renderFileChips()}
// Each visible control owns one action; format-dependent controls are disabled.
$('chooseFiles').onclick=()=>$('fileInput').click();
$('fileInput').onchange=e=>{addFiles(e.target.files);e.target.value=''};
$('dropzone').addEventListener('dragover',e=>{e.preventDefault();$('dropzone').classList.add('drag')});
$('dropzone').addEventListener('dragleave',()=>$('dropzone').classList.remove('drag'));
$('dropzone').addEventListener('drop',e=>{e.preventDefault();$('dropzone').classList.remove('drag');addFiles(e.dataTransfer.files)});
$('convertBtn').onclick=startProcessing;
$('downloadAll').onclick=downloadAll;
$('clearQueue').onclick=()=>{if(state.processing)return;state.outputs=[];renderQueue()};
$('clearInputs').onclick=clearInputs;
$('helpBtn').onclick=()=>$('helpDialog').showModal();
$('closeHelp').onclick=()=>$('helpDialog').close();
$('playBtn').onclick=()=>{
 const item=selected();if(!item)return;
 if(state.previewVideo){state.previewVideo.paused?state.previewVideo.play().catch(()=>toast('浏览器未允许播放，请重试。')):state.previewVideo.pause()}
 else if(state.previewPlayer){if(state.previewPaused){state.previewPlayer.stepToFrame(state.previewFrame||0,true);setPlaying(true)}else{state.previewPlayer.pauseAnimation();setPlaying(false)}}
 else if(state.previewLottie){state.previewLottie.isPaused?state.previewLottie.play():state.previewLottie.pause();setPlaying(!state.previewLottie.isPaused)}
};
$('restartBtn').onclick=()=>{
 state.previewFrame=0;
 if(state.previewVideo){state.previewVideo.currentTime=0;state.previewVideo.play().catch(()=>{})}
 else if(state.previewPlayer)state.previewPlayer.startAnimation();
 else if(state.previewLottie)state.previewLottie.goToAndPlay(0,true);
 setPlaying(true);updateTime(0,selected()?.duration||0);
};
$('timeline').oninput=e=>{
 const progress=Number(e.target.value)/1000,item=selected();if(!item)return;
 if(state.previewVideo&&Number.isFinite(state.previewVideo.duration))state.previewVideo.currentTime=progress*state.previewVideo.duration;
 else if(state.previewPlayer){state.previewFrame=Math.min(item.frames-1,Math.floor(progress*item.frames));state.previewPlayer.stepToFrame(state.previewFrame,false);setPlaying(false);updateTime(state.previewFrame/item.fps,item.duration)}
 else if(state.previewLottie){state.previewLottie.goToAndStop(Math.min(item.frames-1,progress*item.frames),true);setPlaying(false)}
};
document.querySelectorAll('.tab').forEach(el=>el.onclick=()=>{
 document.querySelectorAll('.tab').forEach(x=>{x.classList.toggle('active',x===el);x.setAttribute('aria-selected',String(x===el))});
 document.querySelectorAll('.tab-content').forEach(x=>x.classList.toggle('hidden',x.dataset.content!==el.dataset.tab));
});
document.querySelectorAll('#fitMode button').forEach(el=>el.onclick=()=>{
 document.querySelectorAll('#fitMode button').forEach(x=>x.classList.toggle('active',x===el));state.fit=el.dataset.fit;
 const item=selected();if(item)renderPreview(item);else updatePreviewCanvas();
});
$('widthInput').oninput=()=>syncCanvasDimensions('width');$('widthInput').onchange=()=>syncCanvasDimensions('width',true);
$('heightInput').oninput=()=>syncCanvasDimensions('height');$('heightInput').onchange=()=>syncCanvasDimensions('height',true);
$('ratioLock').onchange=()=>{if($('ratioLock').checked){const w=Number($('widthInput').value),h=Number($('heightInput').value);if(w>0&&h>0)state.ratio=w/h}syncCanvasDimensions('width',true)};
$('ratioPreset').onchange=()=>{
 const ratios={'1:1':1,'4:3':4/3,'3:4':3/4,'16:9':16/9,'9:16':9/16,'21:9':21/9};
 if($('ratioPreset').value==='source'){const item=selected();if(item?.width&&item?.height)state.ratio=item.width/item.height}else state.ratio=ratios[$('ratioPreset').value];
 $('ratioLock').checked=true;syncCanvasDimensions('width',true);
};
$('qualityInput').oninput=()=>$('qualityLabel').textContent=$('qualityInput').value+'%';
$('speedInput').oninput=()=>$('speedLabel').textContent=Number($('speedInput').value).toFixed(1)+' 倍';
$('chooseAudio').onclick=()=>$('audioInput').click();
$('audioInput').onchange=e=>{state.audioFile=e.target.files[0]||null;$('audioFileName').textContent=state.audioFile?state.audioFile.name:'尚未选择音频文件';e.target.value=''};
$('audioMode').onchange=syncFormatCapabilities;
$('formatSelect').onchange=syncFormatCapabilities;
$('bgColor').oninput=updatePreviewCanvas;
$('transparentBg').onchange=syncFormatCapabilities;
$('fullDuration').onchange=syncFormatCapabilities;
window.addEventListener('resize',updatePreviewCanvas);
window.addEventListener('beforeunload',()=>state.items.forEach(x=>URL.revokeObjectURL(x.url)));
syncFormatCapabilities();$('fullDuration').onchange();configurePlayback(null);renderQueue();

function syncFormatCapabilities(){
 const format=$('formatSelect').value,video=['mp4','webm'].includes(format),alpha=!['mp4','jpg'].includes(format),single=['png','jpg'].includes(format),hasTimed=!state.items.length||state.items.some(x=>x.animated);
 const enable=(id,on,why)=>{const el=$(id);el.disabled=!on;el.title=on?'':why};
 enable('qualityInput',['mp4','webm','gif','webp','jpg'].includes(format),'当前格式使用无损位图或原始帧，画质滑块不适用');
 enable('bitrateInput',video,'只有视频格式使用视频码率');enable('fpsInput',!['png','jpg'].includes(format),'单帧图片没有输出帧率');
 enable('webOptimize',format==='mp4','仅 MP4 支持网页渐进播放优化');
 enable('stripMeta',video,'当前格式只包含重新编码的画面数据，不携带源文件元数据');
 enable('loopInput',['gif','webp','apng'].includes(format),'当前格式不使用文件级循环次数设置');
 if(!alpha){if(!$('transparentBg').disabled)state.preferredTransparency=$('transparentBg').checked;$('transparentBg').checked=false}
 else if($('transparentBg').disabled)$('transparentBg').checked=state.preferredTransparency??true;
 enable('transparentBg',alpha,'此格式不保留透明背景，将使用所选背景颜色');
 enable('startInput',hasTimed,'单张静态图片没有起始时间');enable('speedInput',!single,'单帧图片不使用播放速度');enable('fullDuration',!single&&hasTimed,'当前素材或输出格式没有可用的完整动画时长');enable('durationInput',!single&&(!hasTimed||!$('fullDuration').checked),'单帧图片不设置时长；动画需关闭完整时长后编辑');enable('bgColor',!$('transparentBg').checked,'关闭透明背景后可选择填充颜色');
 enable('audioMode',video,'当前格式不支持音轨');enable('audioBitrate',video&&$('audioMode').value!=='mute','仅有声视频需要音频码率');
 $('audioFileField').hidden=!video||$('audioMode').value!=='replace';
 const hints={mp4:'MP4 使用所选背景颜色，可设置音轨、视频码率和网页播放优化。',webm:'WEBM 支持透明画面和音轨。',png:'仅导出起始位置的一帧，帧率、倍速、时长、循环和音频不适用。',jpg:'仅导出起始位置的一帧，使用所选背景颜色；可调整图片画质。'};$('formatHint').textContent=hints[format]||'按所选尺寸和帧率导出无声动画；不适用的设置已禁用。';
 updatePreviewCanvas();
}
function configurePlayback(item){
 const controllable=!!item&&((item.ext==='svga'&&item.videoItem)||(['json','lottie'].includes(item.ext)&&item.lottieData)||['mp4','mov','m4v','webm','mkv','avi'].includes(item.ext));
 for(const id of ['playBtn','restartBtn','timeline'])$(id).disabled=!controllable;
 $('previewHint').textContent=!item?'导入素材后显示预览。':controllable?'可播放、暂停、从头播放，或拖动进度条定位。视频预览默认静音。':item.animated?'动画图片由浏览器自动播放；播放与定位控件不适用于此预览。':'当前素材为静态图片。';
 setPlaying(false);$('timeline').value=0;
}
function setPlaying(playing){state.previewPaused=!playing;$('playBtn').textContent=playing?'暂停':'播放';$('playBtn').title=playing?'暂停预览':'继续播放预览'}
function clearInputs(){
 if(state.processing)return;
 const outputs=state.outputs;clearAll();state.outputs=outputs;renderQueue();
}
function friendlyError(error){
 const message=error?.message||String(error||'');
 if(/[\u4e00-\u9fff]/.test(message))return message;
 if(/memory|out of bounds|RuntimeError|Aborted/i.test(message))return '转换引擎资源不足，已重置引擎。请减小画布尺寸或缩短处理时长后重试。';
 if(/network|fetch|load|timeout/i.test(message))return '组件或素材加载失败，请刷新页面后重试。';
 return '处理失败。请确认素材完整、编码受支持，或调整输出参数后重试。';
}

// Import by signature: SVGA assets frequently arrive without a .svga suffix.
async function detectFormat(file){
 const b=new Uint8Array(await file.slice(0,32).arrayBuffer());
 const text=new TextDecoder().decode(b);
 if(text.startsWith('RIFF')&&text.slice(8,12)==='WEBP')return 'webp';
 if(text.startsWith('GIF8'))return 'gif';
 if(b[0]===137&&text.slice(1,4)==='PNG')return 'png';
 if(b[0]===255&&b[1]===216)return 'jpg';
 if(['pag','vap'].includes(extOf(file.name)))return '';
 if(text.slice(4,8)==='ftyp')return 'mp4';
 if(text.startsWith('PAG'))return '';
 if(b.length>=2&&(b[0]&15)===8&&((b[0]<<8|b[1])%31===0))return 'svga';
 if(b[0]===80&&b[1]===75){
  try{const zip=await JSZip.loadAsync(file);if(Object.keys(zip.files).some(n=>/(^|\/)movie\.spec$/i.test(n)))return 'svga';if(zip.file('manifest.json'))return 'lottie'}catch(e){}
 }
 return extOf(file.name);
}
function checkedFrameCount(duration,s,max=500){
 const count=Math.max(1,Math.ceil(duration*s.fps-1e-7));
 // Uncompressed frame buffers + canvases + WASM copies must fit a browser tab.
 const limit=Math.min(max,frameLimit(s));
 if(count>limit)throw new Error(`此设置需要 ${count} 帧，当前尺寸最多支持 ${limit} 帧。请降低尺寸、帧率或处理时长后重试。`);
 return count;
}
function frameDuration(item,s){return Math.max(0,Math.min(s.duration||item.duration-s.start,item.duration-s.start))/s.speed}
async function waitSvgaImages(player){
 // SVGA's setVideoItem does not await bitmap decoding. Await the bitmap cache,
 // otherwise its first frames can be empty even though parsing succeeded.
 const deadline=performance.now()+15000;
 while(!player._renderer?._prepared){
  if(performance.now()>deadline)throw new Error('SVGA 图片解码超时，请检查素材图片数据。');
  await new Promise(r=>setTimeout(r,10));
 }
}
function svgaType(){
 if(svgaType.cached)return svgaType.cached;
 const fields=(data)=>({fields:data});const f=(type,id,extra={})=>({type,id,...extra});
 const schema={nested:{MovieParams:fields({viewBoxWidth:f('float',1),viewBoxHeight:f('float',2),fps:f('int32',3),frames:f('int32',4)}),Layout:fields({x:f('float',1),y:f('float',2),width:f('float',3),height:f('float',4)}),Transform:fields({a:f('float',1),b:f('float',2),c:f('float',3),d:f('float',4),tx:f('float',5),ty:f('float',6)}),FrameEntity:fields({alpha:f('float',1),layout:f('Layout',2),transform:f('Transform',3)}),SpriteEntity:fields({imageKey:f('string',1),frames:f('FrameEntity',2,{rule:'repeated'})}),MovieEntity:fields({version:f('string',1),params:f('MovieParams',2),images:f('bytes',3,{keyType:'string'}),sprites:f('SpriteEntity',4,{rule:'repeated'})})}};
 return svgaType.cached=protobuf.Root.fromJSON(schema).lookupType('MovieEntity');
}
async function convertWithFFmpeg(item,s,task){
 for(let attempt=0;attempt<2;attempt++){
  try{return await convertWithFFmpegJob(item,s,task)}
  catch(error){
   const fatal=/RuntimeError|memory access|out of bounds|Aborted|unreachable/i.test(String(error));
   if(fatal){state.ffmpeg?.terminate();state.ffmpeg=null;state.ffmpegReady=false;$('engineStat').textContent='引擎已重置';}
   if(fatal&&attempt===0){task.progress=0;task.retryCount=1;task.statusLabel='正在重试';renderQueue();continue}
   throw new Error(error?.message||String(error));
  }finally{
   if(state.ffmpegReady){const id=item.id.replace(/-/g,'');await cleanupFFmpeg(state.ffmpeg,'f_'+id+'_',['input_'+id+'.'+item.ext,'audio_'+id+'.'+extOf(s.replaceAudio?.name||''),'out_'+id+'.'+s.format]);}
  }
 }
}
async function pngTiming(file){
 const b=new Uint8Array(await file.arrayBuffer()),v=new DataView(b.buffer);let frames=0,duration=0;
 for(let p=8;p+12<=b.length;){const len=v.getUint32(p);if(p+12+len>b.length)break;const type=new TextDecoder().decode(b.subarray(p+4,p+8));
  if(type==='fcTL'&&len>=26){duration+=(v.getUint16(p+28)||1)/(v.getUint16(p+30)||100);frames++}p+=12+len;
 }
 return frames?{frames,duration}:null;
}
async function parseWebp(file){
 const b=new Uint8Array(await file.arrayBuffer()),v=new DataView(b.buffer);const tag=(p)=>new TextDecoder().decode(b.subarray(p,p+4));
 const u24=p=>b[p]|b[p+1]<<8|b[p+2]<<16;let width=0,height=0,animated=false,duration=0;const frames=[];
 if(tag(0)!=='RIFF'||tag(8)!=='WEBP')return null;
 for(let p=12;p+8<=b.length;){const len=v.getUint32(p+4,true),start=p+8,end=start+len;if(end>b.length)throw new Error('WebP 数据块不完整。');const t=tag(p);
  if(t==='VP8X'&&len>=10){animated=!!(b[start]&2);width=u24(start+4)+1;height=u24(start+7)+1}
  if(t==='ANMF'&&len>=16){
   const ms=u24(start+12)||100;const chunks=b.slice(start+16,end);const hasAlpha=new TextDecoder().decode(chunks.subarray(0,4))==='ALPH';
   const ext=hasAlpha?18:0,buffer=new Uint8Array(12+ext+chunks.length);buffer.set(new TextEncoder().encode('RIFF'),0);new DataView(buffer.buffer).setUint32(4,buffer.length-8,true);buffer.set(new TextEncoder().encode('WEBP'),8);
   if(hasAlpha){buffer.set(new TextEncoder().encode('VP8X'),12);new DataView(buffer.buffer).setUint32(16,10,true);buffer[20]=16;const w=u24(start+6),h=u24(start+9);for(let j=0;j<3;j++){buffer[24+j]=(w>>>(j*8))&255;buffer[27+j]=(h>>>(j*8))&255}}
   buffer.set(chunks,12+ext);
   frames.push({x:u24(start)*2,y:u24(start+3)*2,width:u24(start+6)+1,height:u24(start+9)+1,start:duration,end:duration+ms/1000,dispose:!!(b[start+15]&1),replace:!!(b[start+15]&2),blob:new Blob([buffer],{type:'image/webp'})});duration+=ms/1000;
  }p=end+(len&1);
 }
 return animated&&frames.length?{width,height,frames,duration}:null;
}
async function renderWebpFrames(item,s,progress,maxFrames=500){
 const animation=item.webpAnimation,count=checkedFrameCount(frameDuration(item,s),s,maxFrames);
 const source=document.createElement('canvas');source.width=animation.width;source.height=animation.height;const ctx=source.getContext('2d');
 const out=document.createElement('canvas');out.width=s.width;out.height=s.height;const dest=out.getContext('2d');let index=-1;const frames=[];
 for(let i=0;i<count;i++){
  const time=s.start+i/s.fps*s.speed;
  while(index+1<animation.frames.length&&(index<0||animation.frames[index].end<=time+1e-8)){
   if(index>=0&&animation.frames[index].dispose){const prev=animation.frames[index];ctx.clearRect(prev.x,prev.y,prev.width,prev.height)}
   const f=animation.frames[++index];if(f.replace)ctx.clearRect(f.x,f.y,f.width,f.height);
   const bitmap=await createImageBitmap(f.blob);ctx.drawImage(bitmap,f.x,f.y);bitmap.close();
  }
  drawFrameFit(dest,source,s);const blob=await new Promise(r=>out.toBlob(r,'image/png'));if(!blob)throw new Error('WebP 动画帧无法读取。');frames.push(new Uint8Array(await blob.arrayBuffer()));progress(Math.round((i+1)/count*45));
 }
 return frames;
}

export {state, addFiles, loadMetadata, convertItem, ensureFFmpeg, buildSvga, renderSvgaFrames, buildLottie, parseWebp, detectFormat, checkedFrameCount, svgaType, startProcessing, clearAll, getSettings, selectItem, clearInputs, syncFormatCapabilities, renderPreview};
function frameLimit(s){return Math.min(500,Math.max(1,Math.floor(192*1024*1024/(s.width*s.height*4))))}
function decoderArgs(item){return item.ext==='webm'&&item.webmCodec?['-c:v',item.webmCodec]:[]}

function isStill(item){return ['png','jpg','jpeg','bmp','webp','apng'].includes(item.ext)&&!item.animated}

function setProcessingControls(busy){
 document.querySelectorAll('.settings input,.settings select,.settings button').forEach(el=>el.disabled=busy);
 $('chooseFiles').disabled=busy;$('clearInputs').disabled=busy||!state.items.length;
 if(!busy){syncFormatCapabilities();$('fullDuration').onchange()}
}

// Use the browser's static WebP encoder and a standards-compliant ANMF muxer.
// No libwebp_anim state persists across conversion jobs in the WASM heap.
async function buildAnimatedWebp(frames,s){
 const canvas=document.createElement('canvas');canvas.width=s.width;canvas.height=s.height;const ctx=canvas.getContext('2d');
 const chunks=[];let hasAlpha=false;
 for(let i=0;i<frames.length;i++){
  const bitmap=await createImageBitmap(new Blob([frames[i]],{type:'image/png'}));ctx.clearRect(0,0,s.width,s.height);ctx.drawImage(bitmap,0,0);bitmap.close();
  const blob=await new Promise(r=>canvas.toBlob(r,'image/webp',s.quality/100));
  if(!blob||blob.type!=='image/webp')throw new Error('此浏览器不支持 WEBP 编码，请使用支持 WEBP 的浏览器。');
  const bytes=new Uint8Array(await blob.arrayBuffer()),view=new DataView(bytes.buffer);const payload=[];
  for(let p=12;p+8<=bytes.length;){const size=view.getUint32(p+4,true),end=p+8+size;if(end>bytes.length)throw new Error('WEBP 编码结果不完整。');const name=new TextDecoder().decode(bytes.subarray(p,p+4));
   if(name==='VP8X')hasAlpha=hasAlpha||!!(bytes[p+8]&16);
   if(name==='ALPH')hasAlpha=true;
   if(name==='VP8L')hasAlpha=hasAlpha||!!(bytes[p+12]&16);
   if(['ALPH','VP8 ','VP8L'].includes(name))payload.push(bytes.slice(p,end+(size&1)));
   p=end+(size&1);
  }
  if(!payload.length)throw new Error('WEBP 编码未生成有效图像数据。');
  const header=new Uint8Array(16);writeU24(header,6,s.width-1);writeU24(header,9,s.height-1);writeU24(header,12,Math.max(1,Math.round((i+1)*1000/s.fps)-Math.round(i*1000/s.fps)));header[15]=2;
  chunks.push(webpChunk('ANMF',concatBytes([header,...payload])));
 }
 const extended=new Uint8Array(10);extended[0]=2|(hasAlpha?16:0);writeU24(extended,4,s.width-1);writeU24(extended,7,s.height-1);
 const animation=new Uint8Array(6);new DataView(animation.buffer).setUint16(4,s.loop?0:1,true);
 const data=concatBytes([new TextEncoder().encode('WEBP'),webpChunk('VP8X',extended),webpChunk('ANIM',animation),...chunks]);
 const header=new Uint8Array(8);header.set(new TextEncoder().encode('RIFF'));new DataView(header.buffer).setUint32(4,data.length,true);
 return new Blob([header,data],{type:'image/webp'});
}
function writeU24(bytes,offset,value){for(let j=0;j<3;j++)bytes[offset+j]=(value>>>(j*8))&255}
function concatBytes(parts){const out=new Uint8Array(parts.reduce((sum,p)=>sum+p.length,0));let offset=0;for(const part of parts){out.set(part,offset);offset+=part.length}return out}
function webpChunk(name,payload){const out=new Uint8Array(8+payload.length+(payload.length&1));out.set(new TextEncoder().encode(name));new DataView(out.buffer).setUint32(4,payload.length,true);out.set(payload,8);return out}

function uniqueOutputName(name,task){
 const occupied=new Set(state.outputs.filter(x=>x!==task&&x.status==='done').map(x=>x.name.normalize('NFC').toLowerCase()));
 const dot=name.lastIndexOf('.'),base=dot<0?name:name.slice(0,dot),ext=dot<0?'':name.slice(dot);let candidate=name,index=2;
 while(occupied.has(candidate.normalize('NFC').toLowerCase()))candidate=base+'_'+(index++)+ext;
 return candidate;
}
function normalizeSettings(s){
 const number=(value,fallback,min,max)=>{const n=Number(value);return Math.max(min,Math.min(max,Number.isFinite(n)?n:fallback))};
 const out={...s,width:Math.round(number(s.width,300,16,4096)),height:Math.round(number(s.height,300,16,4096)),fps:number(s.fps,15,1,60),quality:number(s.quality,80,10,100),bitrate:number(s.bitrate,2500,250,50000),audioBitrate:number(s.audioBitrate,128,64,320),start:number(s.start,0,0,Number.MAX_SAFE_INTEGER),duration:number(s.duration,2,0,Number.MAX_SAFE_INTEGER),speed:number(s.speed,1,.5,2)};
 if(['mp4','webm'].includes(out.format)){out.width=Math.min(4096,Math.round(out.width/2)*2);out.height=Math.min(4096,Math.round(out.height/2)*2)}
 if(['mp4','jpg'].includes(out.format))out.transparent=false;
 if(!/^#[0-9a-f]{6}$/i.test(out.bg||''))out.bg='#10182a';
 if(!['mp4','webm','gif','webp','apng','svga','lottie','pngseq','png','jpg'].includes(out.format))throw new Error('不支持的输出格式。');
 return out;
}
