const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./vendor-export~renderer~react-pdf.browser.js","./rolldown-runtime.js","./vendor-blocknote.js","./vendor-react.js","./vendor-prosemirror.js","../assets/vendor-blocknote.css","./vendor-export~index.js","./renderer.js","./fontConfig.js","./useSettings.js","./vendor.js","./vendor-ui.js","./vendor-markdown.js","./vendor-katex~index~export~index~webdavSync.js","../assets/vendor.css","./prepareExportBlocks.js","./file-system.js","./utils.js","./mermaid.js","./remoteImageResolver.js","./imageStorage.js","./utools.js","./imageProcessor.js","./utoolsDbStorage.js"])))=>i.map(i=>d[i]);
import{o as e}from"./vendor-react.js";import{l as t,n,s as r}from"./prepareExportBlocks.js";import{kt as i}from"./vendor-blocknote.js";import{a}from"./mermaid.js";import{$ as o,a as s,i as c,n as l,r as u}from"./exportHtmlDocument.js";import{a as d}from"./fontConfig.js";import{a as f,i as p,r as m}from"../assets/index.js";var h=e(),g=.75,_=16,v=`#f7f6f3`,y=`#e9e9e7`,b=`#6366f1`;function x(e,t){let n=typeof e?.props?.name==`string`?e.props.name.trim():``,r=typeof e?.props?.caption==`string`?e.props.caption.trim():``;return n||r||t}function S(e){return/^https?:\/\//i.test(e)}async function C(e){let{View:t,Text:n,Link:a,Image:o}=await i(async()=>{let{View:e,Text:t,Link:n,Image:r}=await import(`./vendor-export~renderer~react-pdf.browser.js`).then(e=>e.t);return{View:e,Text:t,Link:n,Image:r}},__vite__mapDeps([0,1,2,3,4,5,6]),import.meta.url),{createDefaultPdfBlockMappings:s}=await i(async()=>{let{createDefaultPdfBlockMappings:e}=await import(`./renderer.js`);return{createDefaultPdfBlockMappings:e}},__vite__mapDeps([7,0,1,2,3,4,5,6,8]),import.meta.url),c=s(),l=_*g,u=e?.pageLocalFilePath??null,d=e?.resolveImageSrc??f,C=(e,r,i)=>{let a=r===`math`?`#5b8def`:`#7aa874`;return(0,h.jsxs)(t,{style:{padding:12*g,backgroundColor:`#fafafa`,borderRadius:4,borderLeftWidth:3,borderLeftColor:a},children:[(0,h.jsx)(n,{style:{fontSize:l*.75,color:a,marginBottom:4},children:r===`math`?`ƒ Math`:`📊 Mermaid`}),(0,h.jsx)(n,{style:{fontSize:l},children:i||` `})]},r+e.id)},w=(e,r,i,a,s=`100%`)=>(0,h.jsxs)(t,{wrap:!1,style:{alignItems:`center`,paddingVertical:4*g},children:[(0,h.jsx)(o,{src:r,style:{width:s,maxHeight:650,objectFit:`contain`}}),a?(0,h.jsx)(n,{style:{fontSize:_*.8*g,color:`#6b7280`},children:a}):null]},i+e.id),T=(e,r,i,o,s)=>{let c=(0,h.jsxs)(t,{style:{flexDirection:`row`,gap:6*g,padding:6*g,backgroundColor:`#f5f5f5`,borderRadius:4},children:[(0,h.jsx)(n,{children:i}),(0,h.jsx)(n,{children:o})]});return(0,h.jsx)(t,{wrap:!1,children:s&&S(s)?(0,h.jsx)(a,{src:s,children:c}):c},r+e.id)},E=(e,i)=>{let a=r(e.props?.icon);return(0,h.jsxs)(t,{style:{flexDirection:`row`,gap:8*g,paddingTop:8*g,paddingBottom:8*g,paddingLeft:12*g,paddingRight:12*g,borderLeftWidth:3,borderLeftColor:b,borderTopWidth:1,borderRightWidth:1,borderBottomWidth:1,borderTopColor:y,borderRightColor:y,borderBottomColor:y,backgroundColor:v,borderTopRightRadius:4,borderBottomRightRadius:4},children:[(0,h.jsx)(n,{style:{marginRight:4},children:a}),(0,h.jsx)(n,{style:{flex:1},children:i.transformInlineContent(Array.isArray(e.content)?e.content:[])})]},`callout`+e.id)},D=e=>T(e,`file`,`📎`,x(e,`未命名文件`),String(e.props?.url||``)),O=e=>T(e,`video`,`▶`,x(e,`视频`),String(e.props?.url||``)),k=e=>T(e,`audio`,`♪`,x(e,`音频`),String(e.props?.url||``)),A=c.heading,j=async(n,r,i,a,o)=>{let s=await p(n,{renderMermaidPng:e?.renderMermaidPng,renderMathPng:e?.renderMathPng});return s.kind===`png`?w(n,s.src,s.language,void 0,s.language===`math`?`70%`:`100%`):s.kind===`empty`?(0,h.jsx)(t,{wrap:!1},s.language+n.id):s.kind===`source-fallback`?C(n,s.language,s.text):c.codeBlock(n,r,i,a)},M=async(e,r,i,a,o)=>{let s=String(e?.props?.url||e?.props?.src||``),c=e.props?.caption||``,l=null;if(s)try{l=await d(s,u)}catch(e){console.error(`[pdfExport] image resolve failed:`,s,e),l=null}return l&&m(l)?w(e,l,`image`,c||void 0):(0,h.jsx)(t,{wrap:!1,style:{padding:6*g},children:(0,h.jsx)(n,{children:c||`[图片]`})},`image`+e.id)};return{...c,callout:E,file:D,video:O,audio:k,heading:A,codeBlock:j,image:M}}var w=`"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif`;function T(){return typeof window>`u`?!1:typeof window.gooseFs?.printHtmlToPdf==`function`?!0:typeof window.utools?.createBrowserWindow==`function`}function E(e){return e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`)}function D(e){return/^https?:\/\//i.test(e)}function O(e,t){let n=e.props??{},r=typeof n.name==`string`?n.name.trim():``,i=typeof n.caption==`string`?n.caption.trim():``;return r||i||t}function k(e,t,n){let r=e.props??{},i=String(r.url||r.src||``),a=O(e,n),o=typeof r.caption==`string`?r.caption.trim():``,s=o&&o!==a?`${t} ${a} ${o}`:`${t} ${a}`,c=D(i)?[{type:`link`,href:i,content:[{type:`text`,text:s,styles:{}}]}]:[{type:`text`,text:s,styles:{}}];return{...e,type:`paragraph`,props:{},content:c}}function A(e){return e.map(e=>{if(!e||typeof e!=`object`)return e;let t={...e};return t.type===`video`?Object.assign(t,k(t,`▶`,`视频`)):t.type===`file`?Object.assign(t,k(t,`📎`,`未命名文件`)):t.type===`audio`&&Object.assign(t,k(t,`♪`,`音频`)),Array.isArray(t.children)&&(t.children=A(t.children)),t})}async function j(e,t,n=!0){let r=n?`<h1>${E(e)}</h1>\n`:``,i=c(await u());return`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${E(e)}</title>
${o}
<style>
@page { size: A4; margin: 16mm; }
html, body {
  background: #ffffff;
  color: #1f2329;
}
body {
  font-family: ${w};
  max-width: 820px;
  margin: 0 auto;
  padding: 0;
  line-height: 1.65;
}
#export-content > h1 {
  font-size: 2em;
  line-height: 1.3;
  margin: 0 0 0.8em;
}
img, video { max-width: 100%; height: auto; }
.katex-display { overflow-x: auto; overflow-y: hidden; }
${i}
</style>
</head>
<body>
<main id="export-content">
${r}${l(t)}
</main>
<script>
window.__GOOSE_PRINT_READY__ = false;
<\/script>
<script type="module">
const done = () => { window.__GOOSE_PRINT_READY__ = true; };
const timeout = new Promise((resolve) => setTimeout(resolve, 6000));
try {
  await Promise.race([
    (async () => {
      const mermaid = (await import("https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs")).default;
      mermaid.initialize(${JSON.stringify({...a({mode:`light`,securityLevel:`loose`,useMaxWidth:!0}),startOnLoad:!0})});
      if (typeof mermaid.run === "function") {
        await mermaid.run();
      }
    })(),
    timeout,
  ]);
} catch (e) { console.warn("[printPdf] mermaid 加载失败:", e); }
done();
<\/script>
</body>
</html>`}async function M(e,n){return j(t(e)||`untitled`,await s(e,A(n)),!e.localFilePath)}function N(e){let t=atob(e),n=new Uint8Array(t.length);for(let e=0;e<t.length;e++)n[e]=t.charCodeAt(e);if(n.byteLength<80)throw Error(`printToPDF 返回空内容`);return new Blob([n],{type:`application/pdf`})}async function P(e){let t=window.utools;if(typeof t?.createBrowserWindow!=`function`)throw Error(`createBrowserWindow 不可用`);return new Promise((n,r)=>{let i=!1,a=null,o=(e,t)=>{if(!i){i=!0;try{a?.close?.()}catch{}e?r(e):t?n(t):r(Error(`printToPDF 失败`))}};try{let n=`data:text/html;charset=utf-8,${encodeURIComponent(e)}`;a=t.createBrowserWindow(n,{show:!1,width:820,height:1169,hasShadow:!1},()=>{(async()=>{try{let e=a?.webContents;if(typeof e?.printToPDF!=`function`)throw Error(`webContents.printToPDF 不可用`);if(typeof e.executeJavaScript==`function`){let t=Date.now();for(;Date.now()-t<8e3;){try{if(await e.executeJavaScript(`Boolean(window.__GOOSE_PRINT_READY__ === true)`))break}catch{}await new Promise(e=>setTimeout(e,150))}}else await new Promise(e=>setTimeout(e,800));let t=await e.printToPDF({printBackground:!0,preferCSSPageSize:!0}),n=t instanceof Uint8Array?t:new Uint8Array(t),r=``;for(let e=0;e<n.length;e++)r+=String.fromCharCode(n[e]);o(null,N(btoa(r)))}catch(e){o(e)}})()})}catch(e){o(e);return}setTimeout(()=>o(Error(`printToPDF 超时`)),2e4)})}async function F(e,t){if(!T())throw Error(`printToPDF 不可用`);let n=await M(e,t),r=window.gooseFs;if(typeof r?.printHtmlToPdf==`function`){let e=await r.printHtmlToPdf(n);if(!e)throw Error(`printToPDF 返回空内容`);return N(e)}return P(n)}async function I(){let{useSettings:e}=await i(async()=>{let{useSettings:e}=await import(`./useSettings.js`).then(e=>e.t);return{useSettings:e}},__vite__mapDeps([9,1,2,3,4,5,10,11,6,12,13,14,15,16,17,18,19,20,21,22,23]),import.meta.url);return e.getState().customFonts}async function L(e,t,n){let r=n??await I(),a=await d({fontFamily:e.fontFamily??`default`,customFonts:r});if(!a.ready)throw Error(`未能加载中文字体，无法生成 PDF`);let[o,{createPdfDocument:s}]=await Promise.all([i(()=>import(`./vendor-export~renderer~react-pdf.browser.js`).then(e=>e.t),__vite__mapDeps([0,1,2,3,4,5,6]),import.meta.url),i(()=>import(`./renderer.js`),__vite__mapDeps([7,0,1,2,3,4,5,6,8]),import.meta.url)]),c=await s(t,await C({pageLocalFilePath:e.localFilePath??null}),a.pageFontFamily),l=await o.pdf(c).toBlob();if(!l||l.size<80)throw Error(`react-pdf 生成了空 PDF`);return l}async function R(e,t){let r=await n(e),i=null,a;if(T())try{i=await F(e,r)}catch(e){a=e,console.warn(`[pdfExport] printToPDF 失败，降级 react-pdf:`,e)}if(!i)try{i=await L(e,r,t)}catch(e){a=e,console.error(`[pdfExport] react-pdf 导出失败:`,e)}if(!i)throw a instanceof Error?a:Error(`PDF 导出失败`);return i}export{R as renderPageToPdfBlob};