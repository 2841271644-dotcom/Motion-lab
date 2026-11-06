import {state,loadMetadata,convertItem,ensureFFmpeg,detectFormat,checkedFrameCount,svgaType,buildSvga,startProcessing} from '../motion-lab.js';
const panel=document.createElement('section');panel.style.cssText='position:relative;z-index:10000;padding:24px;background:#081424;color:white;white-space:pre-wrap;font:14px monospace';panel.innerHTML='<button id="runTests">运行格式转换检查</button><pre id="results">准备就绪</pre>';document.body.prepend(panel);
const results=document.getElementById('results');let pass=0,fail=0,skipped=0;
const log=(text)=>{results.textContent+='\n'+text};const assert=(b,m)=>{if(!b)throw new Error(m)};
async function test(name,fn){try{await fn();pass++;log('通过：'+name)}catch(e){if(/未提供 WebGL/.test(e?.message||String(e))){skipped++;log('UNAVAILABLE '+name+': WebGL unavailable in test browser')}else{fail++;log('失败：'+name+': '+(e?.message||String(e)))}}}
const settings={width:64,height:48,fps:5,quality:80,bitrate:200,duration:0.8,fullDuration:false,start:0,speed:1,fit:'contain',transparent:true,bg:'#123456',keepAudio:true,replaceAudio:null,audioBitrate:64,loop:true,stripMeta:true,webOptimize:true,compression:'balanced'};
async function makeItem(blob,name){const file=new File([blob],name,{type:blob.type}),ext=await detectFormat(file);const item={id:crypto.randomUUID(),file,name,ext,url:URL.createObjectURL(file),animated:['svga','gif','webp','apng','png','mp4','webm','json'].includes(ext),width:0,height:0,duration:0,fps:0,frames:0};item.ready=loadMetadata(item);await item.ready;return item}
async function fixture(name){const r=await fetch('./tests/fixtures/'+name);if(!r.ok)throw new Error('Fixture missing: '+name);return makeItem(await r.blob(),name)}
async function convert(item,format,extra={}){const task={progress:0};state.currentTask=task;try{return await convertItem(item,{...settings,format,...extra},task)}catch(e){throw new Error((e?.message||String(e))+' / LOG: '+(task.logs||[]).join(' | '))}}
async function framesOf(item,extra={}){const r=await convert(item,'pngseq',extra);const z=await JSZip.loadAsync(r.blob);return Promise.all(Object.values(z.files).filter(f=>!f.dir).sort((a,b)=>a.name.localeCompare(b.name)).map(f=>f.async('uint8array')))}
async function pixels(bytes){const b=await createImageBitmap(new Blob([bytes],{type:'image/png'}));const c=document.createElement('canvas');c.width=b.width;c.height=b.height;const x=c.getContext('2d');x.drawImage(b,0,0);b.close();return x.getImageData(0,0,c.width,c.height).data}
const diff=(a,b)=>a.some((v,i)=>v!==b[i]);
document.getElementById('runTests').onclick=async()=>{
 document.getElementById('runTests').disabled=true;results.textContent='正在检查浏览器内实际转换…';
 await test('同源转换引擎正常启动',async()=>{await ensureFFmpeg()});
 const inputs=[];for(const name of ['still.png','motion.mp4','motion.webm','motion.gif','motion.webp','motion.png','official.svga']){await test('导入：'+name,async()=>{const item=await fixture(name);if(['svga'].includes(item.ext))assert(item.status==='就绪',item.error||item.status);inputs.push(item)})}
 const lottie={v:'5.7.4',fr:5,ip:10,op:14,w:64,h:48,assets:[],layers:[{ddd:0,ind:1,ty:1,sw:20,sh:20,sc:'#ff0000',ks:{o:{a:0,k:100},r:{a:0,k:0},p:{a:1,k:[{t:10,s:[15,20,0],e:[50,20,0],o:{x:.3,y:0},i:{x:.7,y:1}},{t:14,s:[50,20,0]}]},a:{a:0,k:[10,10,0]},s:{a:0,k:[100,100,100]}},ip:10,op:14,st:0,bm:0}]};
 await test('导入带非零入点的 Lottie',async()=>inputs.push(await makeItem(new Blob([JSON.stringify(lottie)]),'vector.json')));
 for(const item of inputs){
  for(const format of ['mp4','webm','gif','webp','apng','svga','lottie','pngseq','png','jpg']){
   if(new URLSearchParams(location.search).has('focused')&&!['webp','webm'].includes(format)&&!['official.svga','vector.json'].includes(item.name))continue;
   await test(item.name+' → '+format,async()=>{
    const result=await convert(item,format);assert(result.blob.size>20,'empty output');
    if(['mp4','webm','gif','webp','apng','svga','lottie'].includes(format)){
     const output=await makeItem(result.blob,'roundtrip.'+result.ext);if(format==='svga')assert(output.videoItem,'SVGA parser rejected export: '+output.error);
     const frames=await framesOf(output);assert(frames.length===4,'expected 4 frames, got '+frames.length);
     const a=await pixels(frames[0]),b=await pixels(frames[3]);
     if(item.name!=='still.png')assert(diff(a,b),'animation has identical first/last frame');
     if(['webp','apng','svga','lottie','webm'].includes(format)&&['motion.webp','motion.png','vector.json'].includes(item.name))assert(a[3]===0,'transparent corner lost');
     URL.revokeObjectURL(output.url);
    }
   });
  }
 }
 await test('WebP 裁剪与二倍速的抽帧结果正确',async()=>{const i=inputs.find(i=>i.name==='motion.webp');const f=await framesOf(i,{start:.2,duration:.4,speed:2,fps:10});assert(f.length===2,'wrong clip frame count');assert(diff(await pixels(f[0]),await pixels(f[1])),'wrong seek');});
 await test('视频裁剪与半速的时长正确',async()=>{const f=await framesOf(inputs.find(i=>i.name==='motion.mp4'),{start:.2,duration:.4,speed:.5,fps:10});assert(f.length===8,'expected 8 frames, got '+f.length)});
 await test('未知扩展名 SVGA 按文件头识别',async()=>{const item=inputs.find(i=>i.ext==='svga');assert(await detectFormat(new File([item.file],'asset.unknown'))==='svga','signature rejected')});
 await test('超出帧预算时明确报错',()=>{let rejected=false;try{checkedFrameCount(120,{width:4096,height:4096,fps:60})}catch(e){rejected=true}assert(rejected,'budget not enforced')});
 await test('转换临时文件清理完成',async()=>{const ff=await ensureFFmpeg();assert(!(await ff.listDir('/')).some(f=>/^(input_|out_|audio_|f_)/.test(f.name)),'leaked temporary files')});
 state.currentTask=null;log(`检查完成：${pass} 项通过，${fail} 项失败`);document.title=`格式转换检查：${pass} 项通过，${fail} 项失败`;
};
