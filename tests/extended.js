import {state,loadMetadata,convertItem,ensureFFmpeg,detectFormat,addFiles,startProcessing,clearAll} from '../motion-lab.js';
const $=id=>document.getElementById(id),panel=document.createElement('section');panel.style.cssText='padding:20px;background:#10223a;color:white;font:14px sans-serif';panel.innerHTML='<h2>加强复查</h2><button class="btn blue" id="extendedRun">运行加强复查</button><p id="extendedSummary">准备就绪</p><details open id="extendedDetails"><summary>检查明细</summary><pre id="extendedResults"></pre></details>';document.body.prepend(panel);
let pass=0,fail=0;const log=t=>$('extendedResults').textContent+='\n'+t,assert=(b,m)=>{if(!b)throw new Error(m)};
async function test(name,fn){try{await fn();pass++;log('通过：'+name)}catch(e){fail++;log('失败：'+name+'：'+(e?.message||e))}$('extendedSummary').textContent=`已检查：${pass} 项通过，${fail} 项失败`}
const s={width:96,height:64,fps:5,quality:80,bitrate:400,duration:.8,fullDuration:false,start:0,speed:1,fit:'contain',transparent:true,bg:'#ffffff',keepAudio:true,replaceAudio:null,audioBitrate:64,loop:true,stripMeta:true,webOptimize:true,compression:'balanced'};
async function makeItem(blob,name){const file=new File([blob],name),ext=await detectFormat(file);const i={id:crypto.randomUUID(),file,name,ext,url:URL.createObjectURL(file),animated:!['jpg','jpeg','bmp'].includes(ext),width:0,height:0,duration:0,fps:0,frames:0};await loadMetadata(i);return i}
async function fixture(name){const r=await fetch('./tests/fixtures/'+name);assert(r.ok,'素材缺失');return makeItem(await r.blob(),name)}
async function cv(i,format,extra={}){const task={progress:0};state.currentTask=task;return convertItem(i,{...s,format,...extra},task)}
async function frames(i,extra={}){const r=await cv(i,'pngseq',extra),z=await JSZip.loadAsync(r.blob);return Promise.all(Object.keys(z.files).sort().map(n=>z.file(n).async('uint8array')))}
async function pixels(bytes){const image=await createImageBitmap(new Blob([bytes])),c=document.createElement('canvas');c.width=image.width;c.height=image.height;const x=c.getContext('2d');x.drawImage(image,0,0);image.close();return x.getImageData(0,0,c.width,c.height).data}
const names=['extended/motion.mov','extended/motion.m4v','extended/motion.mkv','extended/motion.avi','extended/still.bmp','still.jpg','still.webp','lossy.webp','extended/legacy.svga','extended/vector.lottie'];
$('extendedRun').onclick=async()=>{
 $('extendedRun').disabled=true;clearAll();const inputs=[];
 for(const name of names)await test('补充导入：'+name,async()=>{const i=await fixture(name);if(['svga','lottie'].includes(i.ext))assert(i.status==='就绪',i.error||i.status);inputs.push(i)});
 for(const i of inputs)for(const format of ['mp4','webm','gif','webp','apng','svga','lottie','pngseq','png','jpg'])await test(i.name+' → '+format,async()=>{
  const r=await cv(i,format);assert(r.blob.size>20,'输出为空');
  if(['mp4','webm','gif','webp','apng','svga','lottie'].includes(format)){
   const output=await makeItem(r.blob,'roundtrip.'+r.ext),f=await frames(output);assert(f.length===4,'预计 4 帧，实际 '+f.length);
   if(i.animated){const a=await pixels(f[0]),b=await pixels(f.at(-1));assert(a.some((v,j)=>v!==b[j]),'动画无帧变化')}
  }else if(format==='png'||format==='jpg'){const im=await createImageBitmap(r.blob);assert(im.width===96&&im.height===64,'尺寸错误');im.close()}
 });
 if(new URLSearchParams(location.search).has('private')){
 // This fixture is local-only, excluded from delivery and public hosting.
 await test('之前无常规扩展名的 SVGA 原文件可解析',async()=>{const r=await fetch('./tests/private-fixtures/actual-sample.bin');assert(r.ok,'原文件未能读取');state.realCheckItem=await makeItem(await r.blob(),'实际素材.unknown');assert(state.realCheckItem.ext==='svga'&&state.realCheckItem.videoItem,state.realCheckItem.error||'解析失败');log('原文件参数：'+state.realCheckItem.width+'×'+state.realCheckItem.height+'，'+state.realCheckItem.frames+' 帧，'+state.realCheckItem.fps+' 帧/秒')});
 if(state.realCheckItem){const real=state.realCheckItem,start=Math.min(real.duration*.25,Math.max(0,real.duration-.5));for(const format of ['mp4','webm','gif','webp','apng','svga','lottie','pngseq','png','jpg'])await test('实际 SVGA 原文件 → '+format,async()=>{const r=await cv(real,format,{width:160,height:160,fps:8,start,duration:.5});assert(r.blob.size>20,'输出为空');if(['mp4','webm','gif','webp','apng','svga','lottie'].includes(format)){const o=await makeItem(r.blob,'real.'+r.ext),f=await frames(o,{width:160,height:160,fps:8,start:0,duration:.5});assert(Math.abs(f.length-4)<=1,'原文件转换帧数异常')}})}
 }else log('实际原文件检查已跳过：安装包不包含私有原文件。');
 const original=await fixture('official.svga'),audioResponse=await fetch('./tests/fixtures/extended/short.wav'),audio=new File([await audioResponse.blob()],'short.wav');
 for(const format of ['mp4','webm'])await test('替换短音频不截短 '+format+' 动画',async()=>{const r=await cv(original,format,{duration:1.6,replaceAudio:audio});const o=await makeItem(r.blob,'audio.'+r.ext),f=await frames(o,{duration:1.6});assert(f.length===8,'动画被截短，实际 '+f.length+' 帧')});
 const still=await fixture('still.png');await test('小数尺寸和异常参数被规范化',async()=>{const r=await cv(still,'mp4',{width:63.7,height:47.4,quality:200,bitrate:-1,fps:5});const i=await makeItem(r.blob,'normalized.mp4');assert(i.width===64&&i.height===48,'尺寸未规范化')});
 await test('损坏文件失败后可以继续处理',async()=>{const file=new File(['broken'],'bad.mp4'),bad={id:crypto.randomUUID(),file,name:file.name,ext:'mp4',animated:true};let failed=false;try{await cv(bad,'webp')}catch(e){failed=true}assert(failed,'损坏素材被误判成功');assert((await cv(still,'webp')).blob.size>20,'后续任务失败')});
 for(let n=0;n<20;n++)await test('连续转换第 '+(n+1)+' 次',async()=>{const i=inputs[n%inputs.length],format=['webp','mp4','svga','apng'][n%4],r=await cv(i,format);assert(r.blob.size>20,'连续处理输出为空')});
 await test('FFmpeg 临时文件全部清理',async()=>{const ff=await ensureFFmpeg();assert(!(await ff.listDir('/')).some(x=>/^(input_|out_|audio_|f_)/.test(x.name)),'临时文件泄漏')});
 await test('同名素材的结果不会互相覆盖',async()=>{state.currentTask=null;clearAll();const file=still.file;await addFiles([new File([file],'同名素材.png'),new File([file],'同名素材.png'),new File([file],'同名素材.png')]);await Promise.all(state.items.map(i=>i.ready));$('formatSelect').value='png';$('formatSelect').dispatchEvent(new Event('change'));await startProcessing();assert(state.outputs.length===3&&state.outputs.every(t=>t.status==='done'),'批量转换失败');assert(new Set(state.outputs.map(t=>t.name)).size===3,'输出文件名冲突');log('同名输出：'+state.outputs.map(t=>t.name).join('，'))});
 state.currentTask=null;$('extendedSummary').textContent=`加强复查完成：${pass} 项通过，${fail} 项失败`;$('extendedDetails').open=false;document.title=$('extendedSummary').textContent;
};
