// Preserve protobuf fields verbatim; only replace image byte payloads.
export const MAX_RAW = 192 * 1024 * 1024;
export function join(parts) { const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0)); let at=0; for(const p of parts){out.set(p,at);at+=p.length} return out; }
export function vint(n){const a=[]; do {let b=n%128;n=Math.floor(n/128);a.push(b|(n?128:0))}while(n);return Uint8Array.from(a)}
function readVar(b,at){let value=0,scale=1,start=at;while(at<b.length&&at-start<10){const c=b[at++];value+=(c&127)*scale;if(!(c&128))return {value,end:at};scale*=128}throw Error('SVGA 数据损坏：无效整数。')}
export function fields(b){const out=[];let at=0;while(at<b.length){const start=at,t=readVar(b,at);at=t.end;const id=Math.floor(t.value/8),wire=t.value%8;if(!id)throw Error('SVGA 数据损坏：无效字段。');let from=at,to;
 if(wire===0)to=readVar(b,at).end;
 else if(wire===1)to=at+8;
 else if(wire===5)to=at+4;
 else if(wire===2){const len=readVar(b,at);from=len.end;to=from+len.value}
 else throw Error('暂不支持此 SVGA 字段编码。');
 if(!Number.isSafeInteger(to)||to>b.length)throw Error('SVGA 数据被截断。');out.push({id,wire,start,from,to,raw:b.subarray(start,to),data:b.subarray(from,to)});at=to}return out}
export function lengthField(id,data){return join([vint(id*8+2),vint(data.length),data])}
export function inflateSafe(bytes){const parts=[];let size=0;const z=new globalThis.pako.Inflate();z.onData=c=>{size+=c.length;if(size>MAX_RAW)throw Error('解压后文件过大，请使用较小的 SVGA。');parts.push(c)};z.push(bytes,true);if(z.err)throw Error('SVGA 解压失败，文件可能损坏。');return join(parts)}
function metadata(raw){const f=fields(raw),p=f.find(x=>x.id===2&&x.wire===2);if(!p)throw Error('缺少 SVGA 动画参数。');const a=fields(p.data);const num=id=>{const x=a.find(x=>x.id===id);if(!x)return 0;return x.wire===5?new DataView(x.data.buffer,x.data.byteOffset,4).getFloat32(0,true):readVar(x.data,0).value};const info={width:num(1),height:num(2),fps:num(3),frames:num(4),version:'2.x'};if(!(info.width>0&&info.height>0&&info.fps>0&&info.frames>0))throw Error('SVGA 画布、帧率或帧数无效。');return info}
export async function openSvga(bytes){if(!bytes.length)throw Error('文件为空。');
 if(bytes[0]===80&&bytes[1]===75){const zip=await globalThis.JSZip.loadAsync(bytes,{checkCRC32:false});const entries=Object.values(zip.files).filter(x=>!x.dir);let total=0;for(const e of entries){total+=e._data?.uncompressedSize||0;if(total>MAX_RAW)throw Error('解压后文件过大。')}const specEntry=entries.find(e=>/(^|\/)movie\.spec$/i.test(e.name));if(!specEntry)throw Error('此 ZIP 不是 SVGA：缺少 movie.spec。');const spec=JSON.parse(await specEntry.async('string'));const m=spec.movie;if(!m?.viewBox||!Array.isArray(spec.sprites)||!(m.frames>0&&m.fps>0))throw Error('SVGA 1.x 动画数据不完整。');return {kind:'zip',zip,entries,spec,specName:specEntry.name,bytes,info:{width:m.viewBox.width,height:m.viewBox.height,fps:m.fps,frames:m.frames,version:'1.x'}}}
 if((bytes[0]&15)!==8||((bytes[0]<<8|bytes[1])%31)!==0)throw Error('无法识别 SVGA 文件头，不支持加密或损坏文件。');const raw=inflateSafe(bytes);return {kind:'zlib',raw,bytes,info:metadata(raw)};}
export function imageKind(b){return b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71?'png':b[0]===255&&b[1]===216?'jpeg':b[0]===82&&b[1]===73&&b[8]===87&&b[9]===69?'webp':null}
export function compressionSettings(mode='lossless',custom={}){
 const presets={lossless:{colors:256,scale:100,jpegQuality:100,level:9},balanced:{colors:256,scale:100,jpegQuality:85,level:9},strong:{colors:64,scale:100,jpegQuality:65,level:9}};
 if(mode!=='custom'){if(!presets[mode])throw Error('压缩模式无效。');return {...presets[mode]}}
 const settings={colors:128,scale:100,jpegQuality:80,level:9,...custom};
 for(const [key,min,max,label] of [['colors',8,256,'颜色数'],['scale',10,100,'素材分辨率'],['jpegQuality',1,100,'JPEG 质量'],['level',1,9,'容器压缩等级']]){
  if(!Number.isInteger(settings[key])||settings[key]<min||settings[key]>max)throw Error(`${label}请输入 ${min}–${max} 的整数。`);
 }
 return settings;
}
export async function compressSvga(source,{mode='lossless',custom={},optimizeImage=async b=>b,onProgress=()=>{}}={}){const settings=compressionSettings(mode,custom);let changed=0,images=0,candidate;
 const optimize=async b=>{if(!imageKind(b))return b;images++;const next=mode==='lossless'?b:await optimizeImage(b,mode,settings);if(next.length<b.length){changed++;return next}return b};
 if(source.kind==='zlib'){const f=fields(source.raw),out=[];for(let i=0;i<f.length;i++){const x=f[i];if(x.id===3&&x.wire===2){const entry=fields(x.data),parts=[];for(const v of entry){if(v.id===2&&v.wire===2){const next=await optimize(v.data);parts.push(next===v.data?v.raw:lengthField(2,next))}else parts.push(v.raw)}out.push(lengthField(3,join(parts)))}else out.push(x.raw);onProgress((i+1)/f.length*.9);await new Promise(r=>setTimeout(r,0))}candidate=globalThis.pako.deflate(join(out),{level:settings.level})}
 else {const zip=new globalThis.JSZip();let total=0;for(let i=0;i<source.entries.length;i++){const e=source.entries[i];let b=await e.async('uint8array');total+=b.length;if(total>MAX_RAW)throw Error('解压后文件过大。');b=await optimize(b);zip.file(e.name,b,{date:e.date,comment:e.comment});onProgress((i+1)/source.entries.length*.8)}candidate=await zip.generateAsync({type:'uint8array',compression:'DEFLATE',compressionOptions:{level:settings.level}},m=>onProgress(.8+m.percent/100*.1))}
 // Never deliver a larger file under the name of compression.
 const keptOriginal=candidate.length>=source.bytes.length;const bytes=keptOriginal?source.bytes:candidate;const checked=await openSvga(bytes);for(const k of ['width','height','fps','frames'])if(checked.info[k]!==source.info[k])throw Error('压缩校验失败：动画参数发生变化。');onProgress(1);return {bytes,changed:keptOriginal?0:changed,images,keptOriginal,info:checked.info};}
let crcTable;
function crc32(b){if(!crcTable)crcTable=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0});let c=0xffffffff;for(const v of b)c=crcTable[(c^v)&255]^(c>>>8);return (c^0xffffffff)>>>0}
function u32(n){return Uint8Array.of(n>>>24,n>>>16,n>>>8,n)}
function chunk(type,data){const b=join([new TextEncoder().encode(type),data]);return join([u32(data.length),b,u32(crc32(b))])}
// Encode RGBA PNG with per-row adaptive filters; do not flatten alpha.
export function encodePng(rgba,width,height){const stride=width*4,filtered=new Uint8Array((stride+1)*height);for(let y=0;y<height;y++){let best,score=Infinity;for(const type of [0,1,2,3,4]){const row=new Uint8Array(stride);let s=0;for(let x=0;x<stride;x++){const p=y*stride+x,a=x>=4?rgba[p-4]:0,b=y?rgba[p-stride]:0,c=y&&x>=4?rgba[p-stride-4]:0;let predictor=0;if(type===1)predictor=a;if(type===2)predictor=b;if(type===3)predictor=(a+b)>>1;if(type===4){const k=a+b-c,pa=Math.abs(k-a),pb=Math.abs(k-b),pc=Math.abs(k-c);predictor=pa<=pb&&pa<=pc?a:pb<=pc?b:c}row[x]=(rgba[p]-predictor)&255;s+=Math.min(row[x],256-row[x])}if(s<score){score=s;best=join([Uint8Array.of(type),row])}}filtered.set(best,y*(stride+1))}const header=join([u32(width),u32(height),Uint8Array.of(8,6,0,0,0)]);return join([Uint8Array.of(137,80,78,71,13,10,26,10),chunk('IHDR',header),chunk('IDAT',globalThis.pako.deflate(filtered,{level:9})),chunk('IEND',new Uint8Array())]);}
export async function optimizeBrowserImage(bytes,mode,custom={}){const settings=compressionSettings(mode,custom);if(mode==='lossless')return bytes;const blob=new Blob([bytes],{type:imageKind(bytes)==='jpeg'?'image/jpeg':'image/png'});const bitmap=await createImageBitmap(blob);try{const w=Math.max(1,Math.round(bitmap.width*settings.scale/100)),h=Math.max(1,Math.round(bitmap.height*settings.scale/100));if(w*h>4_000_000){if(mode==='custom')throw Error('素材图片过大，请降低素材分辨率后重试。');return bytes;}const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('当前浏览器不支持图片压缩。');ctx.imageSmoothingQuality='high';ctx.drawImage(bitmap,0,0,w,h);if(imageKind(bytes)==='jpeg'){const encoded=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',settings.jpegQuality/100));return encoded?new Uint8Array(await encoded.arrayBuffer()):bytes}const data=ctx.getImageData(0,0,w,h).data,levels=255;for(let i=0;i<data.length;i+=4){for(let j=0;j<3;j++)data[i+j]=data[i+3]===0?0:Math.round(Math.round(data[i+j]*levels/255)*255/levels)}const indexed=encodePalettePng(data,w,h,settings.colors),rgbaPng=encodePng(data,w,h);return mode==='custom'||indexed.length<rgbaPng.length?indexed:rgbaPng}finally{bitmap.close()}}

// Median-cut an RGBA histogram, then emit an indexed PNG with a tRNS alpha table.
// Fully transparent and fully opaque pixels are kept in separate buckets.
export function encodePalettePng(rgba,width,height,maxColors=128){
 const histogram=new Map();for(let i=0;i<rgba.length;i+=4){const a=rgba[i+3];if(!a)continue;const key=((rgba[i]>>3)<<17)|((rgba[i+1]>>3)<<12)|((rgba[i+2]>>3)<<7)|((a===255?127:(a>>2)));
 let v=histogram.get(key);if(!v){v={sum:[0,0,0,0],n:0,key};histogram.set(key,v)}v.n++;for(let j=0;j<4;j++)v.sum[j]+=rgba[i+j]}
 const points=[...histogram.values()].map(v=>({...v,c:v.sum.map(x=>x/v.n)}));
 function box(values){const lo=[255,255,255,255],hi=[0,0,0,0];let count=0;for(const p of values){count+=p.n;for(let j=0;j<4;j++){lo[j]=Math.min(lo[j],p.c[j]);hi[j]=Math.max(hi[j],p.c[j])}}const ranges=hi.map((x,j)=>(x-lo[j])*(j===3?2:1));const channel=ranges.indexOf(Math.max(...ranges));return {values,count,channel,score:ranges[channel]*Math.sqrt(count)}}
 const opaque=points.filter(p=>p.c[3]===255),semi=points.filter(p=>p.c[3]!==255);const boxes=[opaque,semi].filter(x=>x.length).map(box);
 while(boxes.length<maxColors-1){let index=-1,score=-1;for(let i=0;i<boxes.length;i++)if(boxes[i].values.length>1&&boxes[i].score>score){index=i;score=boxes[i].score}if(index<0)break;const b=boxes[index],v=b.values.sort((a,c)=>a.c[b.channel]-c.c[b.channel]);let n=0,at=0;while(at<v.length-1&&n<b.count/2)n+=v[at++].n;at=Math.max(1,at);boxes.splice(index,1,box(v.slice(0,at)),box(v.slice(at)))}
 const palette=[[0,0,0,0]],lookup=new Map();for(const b of boxes){const sums=[0,0,0,0];for(const p of b.values)for(let j=0;j<4;j++)sums[j]+=p.sum[j];const color=sums.map(v=>Math.round(v/b.count));color[3]=Math.max(1,color[3]);const index=palette.length;palette.push(color);for(const p of b.values)lookup.set(p.key,index)}
 const rows=new Uint8Array((width+1)*height);for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4,a=rgba[i+3];const key=((rgba[i]>>3)<<17)|((rgba[i+1]>>3)<<12)|((rgba[i+2]>>3)<<7)|(a===255?127:(a>>2));rows[y*(width+1)+x+1]=a?lookup.get(key):0}
 return join([Uint8Array.of(137,80,78,71,13,10,26,10),chunk('IHDR',join([u32(width),u32(height),Uint8Array.of(8,3,0,0,0)])),chunk('PLTE',Uint8Array.from(palette.flatMap(c=>c.slice(0,3)))),chunk('tRNS',Uint8Array.from(palette.map(c=>c[3]))),chunk('IDAT',globalThis.pako.deflate(rows,{level:9})),chunk('IEND',new Uint8Array())]);
}
