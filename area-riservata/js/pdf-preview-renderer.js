import * as pdfjs from './vendor/pdfjs/pdf.js';
pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.js',import.meta.url).href;

// Pagine del PDF effettivo; canvas caricate soltanto vicino allo scroll.
export class PdfPreview {
 constructor(scroll,pages,count,onError,onMealNote){
  Object.assign(this,{scroll,pages,count,onError,onMealNote,zoom:'page',currentPage:1,generation:0,views:[]});
  this.select=document.getElementById('document-page');this.previous=document.getElementById('document-previous');this.next=document.getElementById('document-next');
  this.select.onchange=()=>this.goToPage(Number(this.select.value));this.previous.onclick=()=>this.goToPage(this.currentPage-1);this.next.onclick=()=>this.goToPage(this.currentPage+1);
  this.observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting)this.render(this.views.find(v=>v.host===entry.target));},{root:scroll,rootMargin:'500px'});
  this.resize=new ResizeObserver(()=>{clearTimeout(this.resizeTimer);this.resizeTimer=setTimeout(()=>this.layout(),100);});this.resize.observe(scroll);
  this.onScroll=()=>{if(this.scrollFrame)return;this.scrollFrame=requestAnimationFrame(()=>{this.scrollFrame=0;this.updatePage();});};scroll.addEventListener('scroll',this.onScroll,{passive:true});
 }
 position(){
  const view=this.views[this.currentPage-1];if(!view)return {page:this.currentPage,ratio:0};
  const top=this.scroll.getBoundingClientRect().top+parseFloat(getComputedStyle(this.scroll).paddingTop),rect=view.host.getBoundingClientRect();
  return {page:this.currentPage,ratio:Math.max(0,Math.min(1,(top-rect.top)/Math.max(1,rect.height)))};
 }
 async show(buffer,anchors=[]){
  const position=this.position(),generation=++this.generation;
  this.select.disabled=true;this.previous.disabled=true;this.next.disabled=true;this.scroll.setAttribute('aria-busy','true');
  this.observer.disconnect();this.views.forEach(v=>v.task?.cancel());this.views=[];
  const old=this.pdf;this.pdf=null;await old?.destroy();
  const task=pdfjs.getDocument({data:new Uint8Array(buffer.slice(0)),standardFontDataUrl:new URL('./vendor/pdfjs/fonts/',import.meta.url).href});
  const pdf=await task.promise;if(generation!==this.generation){await pdf.destroy();return;}
  this.pdf=pdf;this.pages.replaceChildren();this.count.textContent=pdf.numPages+' pagine';this.select.replaceChildren();
  for(let i=1;i<=pdf.numPages;i++){
   const page=await pdf.getPage(i);if(generation!==this.generation)return;
   const host=document.createElement('div');host.className='document-pdf-page';host.setAttribute('role',anchors.some(a=>a.page===i)?'group':'img');host.setAttribute('aria-label','Pagina '+i+' del piano');
   const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');host.append(canvas);this.pages.append(host);
   const view={page,host,canvas,generation};this.views.push(view);
   const base=page.getViewport({scale:1}),pt=72/25.4;
   for(const anchor of anchors.filter(a=>a.page===i)){
    const input=document.createElement('textarea');input.className='document-note-edit';input.value=anchor.text;input.placeholder='+ '+anchor.label;input.maxLength=2000;input.setAttribute('aria-label',anchor.label);input.dataset.mealNote=anchor.meal;input.dataset.notePosition=anchor.position;input.dataset.week=anchor.week;input.dataset.day=anchor.day;
    Object.assign(input.style,{left:anchor.x*pt/base.width*100+'%',top:anchor.y*pt/base.height*100+'%',width:anchor.width*pt/base.width*100+'%',height:anchor.height*pt/base.height*100+'%'});
    input.oninput=()=>this.onMealNote?.(anchor,input.value);host.append(input);
   }
   this.select.add(new Option(i+' / '+pdf.numPages,String(i)));
  }
  this.currentPage=Math.min(position.page,pdf.numPages);this.layout(false);this.goToPage(this.currentPage,position.ratio);this.scroll.removeAttribute('aria-busy');
 }
 layout(preserve=true){
  if(!this.pdf||!this.views.length)return;
  const position=preserve?this.position():null,style=getComputedStyle(this.scroll);
  const width=Math.max(120,this.scroll.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)-2);
  const height=Math.max(120,this.scroll.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom)-2);
  this.observer.disconnect();
  for(const view of this.views){
   const base=view.page.getViewport({scale:1}),scale=this.zoom==='page'?Math.min(width/base.width,height/base.height):width/base.width*(Number(this.zoom)||1);
   if(Math.abs((view.scale||0)-scale)>.001){view.task?.cancel();view.painted=false;view.scale=scale;view.layoutVersion=(view.layoutVersion||0)+1;view.host.style.width=base.width*scale+'px';view.host.style.height=base.height*scale+'px';}
   view.host.querySelectorAll('.document-note-edit').forEach(el=>{el.style.fontSize=Math.max(innerWidth<=760?16:11,9*scale)+'px';el.style.lineHeight=Math.max(innerWidth<=760?19:15,4.4*72/25.4*scale)+'px';});
   this.observer.observe(view.host);
  }
  if(position)this.goToPage(position.page,position.ratio);
 }
 async render(view){
  if(!view||view.rendering||view.painted||view.generation!==this.generation)return;
  view.rendering=true;
  try{while(!view.painted&&view.generation===this.generation){
   const version=view.layoutVersion,dpr=Math.min(window.devicePixelRatio||1,2),viewport=view.page.getViewport({scale:view.scale*dpr});
   view.canvas.width=Math.ceil(viewport.width);view.canvas.height=Math.ceil(viewport.height);
   const task=view.page.render({canvasContext:view.canvas.getContext('2d'),viewport});view.task=task;
   try{await task.promise;if(version===view.layoutVersion)view.painted=true;}
   catch(error){if(error.name!=='RenderingCancelledException')throw error;}
   finally{if(view.task===task)view.task=null;}
  }}catch(error){if(view.generation===this.generation)this.onError(error);}
  finally{view.rendering=false;}
 }
 goToPage(number,ratio=0){
  const page=Math.max(1,Math.min(this.views.length,Math.trunc(number)||1)),view=this.views[page-1];if(!view)return;
  const padding=parseFloat(getComputedStyle(this.scroll).paddingTop),rect=view.host.getBoundingClientRect();
  this.scroll.scrollTop+=rect.top-this.scroll.getBoundingClientRect().top-padding+rect.height*ratio;this.currentPage=page;this.updateControls();
 }
 updatePage(){
  if(!this.views.length)return;
  const top=this.scroll.getBoundingClientRect().top+parseFloat(getComputedStyle(this.scroll).paddingTop)+Math.min(50,this.scroll.clientHeight*.1);
  const index=this.views.findIndex(v=>v.host.getBoundingClientRect().bottom>top);if(index>=0){this.currentPage=index+1;this.updateControls();}
 }
 updateControls(){this.select.value=String(this.currentPage);this.select.disabled=!this.views.length;this.previous.disabled=this.currentPage<=1;this.next.disabled=this.currentPage>=this.views.length;}
 setZoom(value){this.zoom=value==='page'?'page':Number(value)||1;this.layout();}
 destroy(){this.generation++;clearTimeout(this.resizeTimer);cancelAnimationFrame(this.scrollFrame);this.scroll.removeEventListener('scroll',this.onScroll);this.resize.disconnect();this.observer.disconnect();this.views.forEach(v=>v.task?.cancel());this.pdf?.destroy();}
}
