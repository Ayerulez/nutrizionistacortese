import * as pdfjs from './vendor/pdfjs/pdf.js';
pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.js',import.meta.url).href;

// Si disegnano le pagine del PDF effettivo. Le pagine lontane dallo scroll
// restano segnaposto per non caricare tutte le canvas sul telefono.
export class PdfPreview {
 constructor(scroll,pages,count,onError){
  Object.assign(this,{scroll,pages,count,onError,zoom:1,generation:0,views:[]});
  this.observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting)this.render(this.views.find(v=>v.host===entry.target));},{root:scroll,rootMargin:'500px'});
  this.resize=new ResizeObserver(()=>{clearTimeout(this.resizeTimer);this.resizeTimer=setTimeout(()=>this.layout(),150);});this.resize.observe(scroll);
 }
 async show(buffer){
  const generation=++this.generation,scrollTop=this.scroll.scrollTop;
  this.observer.disconnect();this.views.forEach(v=>v.task?.cancel());this.views=[];
  const old=this.pdf;this.pdf=null;await old?.destroy();
  const task=pdfjs.getDocument({data:new Uint8Array(buffer.slice(0)),standardFontDataUrl:new URL('./vendor/pdfjs/fonts/',import.meta.url).href});
  const pdf=await task.promise;if(generation!==this.generation){await pdf.destroy();return;}
  this.pdf=pdf;this.pages.replaceChildren();this.count.textContent=pdf.numPages+' pagine';
  for(let i=1;i<=pdf.numPages;i++){
   const page=await pdf.getPage(i);if(generation!==this.generation)return;
   const host=document.createElement('div');host.className='document-pdf-page';host.setAttribute('role','img');host.setAttribute('aria-label','Pagina '+i+' del piano');
   const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');host.append(canvas);this.pages.append(host);
   this.views.push({page,host,canvas,generation});
  }
  this.layout();this.scroll.scrollTop=scrollTop;
 }
 layout(){
  if(!this.pdf||!this.views.length)return;
  const style=getComputedStyle(this.scroll),width=Math.max(120,this.scroll.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)-2)*this.zoom;
  this.observer.disconnect();
  for(const view of this.views){
   const base=view.page.getViewport({scale:1}),scale=width/base.width;
   if(Math.abs((view.scale||0)-scale)>.001){view.task?.cancel();view.task=null;view.painted=false;view.scale=scale;view.layoutVersion=(view.layoutVersion||0)+1;view.host.style.width=width+'px';view.host.style.height=base.height*scale+'px';view.canvas.width=1;view.canvas.height=1;}
   this.observer.observe(view.host);
  }
 }
 async render(view){
  if(!view||view.task||view.painted||view.generation!==this.generation)return;
  const version=view.layoutVersion,dpr=Math.min(window.devicePixelRatio||1,2),viewport=view.page.getViewport({scale:view.scale*dpr});
  view.canvas.width=Math.ceil(viewport.width);view.canvas.height=Math.ceil(viewport.height);
  const task=view.page.render({canvasContext:view.canvas.getContext('2d'),viewport});view.task=task;
  try{await task.promise;if(version===view.layoutVersion)view.painted=true;}
  catch(error){if(error.name!=='RenderingCancelledException'&&view.generation===this.generation)this.onError(error);}
  finally{if(view.task===task)view.task=null;}
 }
 setZoom(value){this.zoom=Number(value)||1;this.layout();}
 destroy(){this.generation++;clearTimeout(this.resizeTimer);this.resize.disconnect();this.observer.disconnect();this.views.forEach(v=>v.task?.cancel());this.pdf?.destroy();}
}
