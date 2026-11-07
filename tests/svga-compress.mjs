import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {openSvga,compressSvga,fields,join,lengthField,vint,inflateSafe,encodePng,encodePalettePng,compressionSettings,imageDimensions} from '../svga-compress/core.mjs';
const require=createRequire(import.meta.url);globalThis.pako=require('../vendor/pako.min.js');globalThis.JSZip=require('../vendor/jszip.min.js');
let checks=0;const ok=(x,m)=>{assert.ok(x,m);checks++};
for(const path of ['tests/fixtures/official.svga','tests/fixtures/extended/legacy.svga']){
 const b=new Uint8Array(readFileSync(path)),s=await openSvga(b),r=await compressSvga(s);ok(r.bytes.length<=b.length,'result never larger');assert.deepEqual((await openSvga(r.bytes)).info,s.info);checks++;
 if(s.kind==='zlib'){assert.deepEqual(inflateSafe(r.bytes),s.raw);checks++}else{const out=await JSZip.loadAsync(r.bytes);for(const e of s.entries){assert.deepEqual(await out.file(e.name).async('uint8array'),await e.async('uint8array'));checks++}}
 console.log(path, s.info, b.length,'->',r.bytes.length);
}
// Deliberately include future protobuf and audio fields; preserve them byte for byte.
const original=await openSvga(new Uint8Array(readFileSync('tests/fixtures/official.svga')));
const raw=join([original.raw,lengthField(90,new TextEncoder().encode('future-field')),lengthField(5,Uint8Array.of(8,1,16,2))]);
const source=await openSvga(pako.deflate(raw,{level:1}));const before=fields(raw);
const r=await compressSvga(source,{mode:'balanced',optimizeImage:async b=>b});const after=fields(inflateSafe(r.bytes));
assert.deepEqual(after.map(x=>x.raw),before.map(x=>x.raw));checks++;
for(const b of [new Uint8Array(),Uint8Array.of(1,2,3),pako.deflate(Uint8Array.of(10,255,255))]){await assert.rejects(()=>openSvga(b));checks++}
await assert.rejects(()=>compressSvga(original,{mode:'invalid'}));checks++;
const rgba=Uint8Array.from({length:16*16*4},(_,i)=>i%256);const png=encodePng(rgba,16,16);writeFileSync('/tmp/compress-test.png',png);writeFileSync('/tmp/compress-test.rgba',rgba);
ok(png[0]===137,'png signature');
console.log('PASS',checks,'checks');

for(const custom of [{colors:7},{colors:257},{jpegQuality:0},{level:10},{colors:12.5}]){await assert.rejects(()=>compressSvga(original,{mode:'custom',custom}));checks++}
for(const level of [1,5,9]){const r=await compressSvga(source,{mode:'custom',custom:{colors:37,jpegQuality:47,level},optimizeImage:async (b,m,s)=>{assert.equal(m,'custom');assert.deepEqual(s,{colors:37,jpegQuality:47,level});checks++;return b}});assert.deepEqual(inflateSafe(r.bytes),source.raw);checks++}
console.log('PASS',checks,'including custom validation, settings forwarding and container levels');

// A scale value saved by the previous release must never affect output.
assert.deepEqual(compressionSettings('custom',{scale:10}),{colors:128,jpegQuality:80,level:9});checks++;
const noisy=new Uint8Array(64*48*4);let seed=12345;for(let i=0;i<noisy.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;noisy[i]=i%4===3?255:seed>>>24}
const inputPng=encodePng(noisy,64,48),sameSize=encodePalettePng(noisy,64,48,16),resized=encodePng(new Uint8Array(4*4*4),4,4);
const embedded=await openSvga(pako.deflate(join([raw,lengthField(3,join([lengthField(1,new TextEncoder().encode('test-image')),lengthField(2,inputPng)]))]),{level:1}));
const zip=new JSZip();zip.file('movie.spec',JSON.stringify({movie:{viewBox:{width:64,height:48},fps:5,frames:4},sprites:[],images:{test:'test.png'}}));zip.file('test.png',inputPng);zip.file('audio.bin',Uint8Array.of(1,2,3,4));
const zipped=await openSvga(await zip.generateAsync({type:'uint8array',compression:'STORE'}));
for(const s of [embedded,zipped]){
 await assert.rejects(()=>compressSvga(s,{mode:'custom',custom:{scale:10},optimizeImage:async()=>resized}),/素材像素尺寸发生变化/);checks++;
 const out=await compressSvga(s,{mode:'custom',custom:{scale:10},optimizeImage:async()=>sameSize});const parsed=await openSvga(out.bytes);assert.equal(out.changed,1);checks++;
 assert.deepEqual(parsed.info,s.info);checks++;
 if(s.kind==='zlib'){
  const img=fields(fields(parsed.raw).filter(f=>f.id===3).at(-1).data).find(f=>f.id===2).data;
  assert.deepEqual(imageDimensions(img),{width:64,height:48});checks++;
  assert.deepEqual(fields(parsed.raw).filter(f=>f.id!==3).map(f=>f.raw),fields(s.raw).filter(f=>f.id!==3).map(f=>f.raw));checks++;
 }else{
  assert.deepEqual(imageDimensions(await parsed.zip.file('test.png').async('uint8array')),{width:64,height:48});checks++;
  for(const name of ['movie.spec','audio.bin']){assert.deepEqual(await parsed.zip.file(name).async('uint8array'),await s.zip.file(name).async('uint8array'));checks++}
 }
}
console.log('PASS',checks,'checks including fixed image dimensions, obsolete scale and resized-output rejection');
