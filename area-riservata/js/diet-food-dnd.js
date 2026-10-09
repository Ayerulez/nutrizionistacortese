// Trascinamenti interni al catalogo: nessun dato ricevuto dall'esterno viene importato.
export function installFoodDragDrop({picker,containers,isEnabled,getFood,getOffProduct,getDietId,onDrop,onError}){
 const mime='application/x-studio-cortese-food';let active=null,pending=false,frame=0,point=null;
 const highlight=target=>{document.querySelectorAll('.food-drop-target').forEach(el=>{if(el!==target)el.classList.remove('food-drop-target');});target?.classList.add('food-drop-target');};
 const stop=()=>{cancelAnimationFrame(frame);frame=0;point=null;};
 const clear=()=>{active=null;stop();highlight(null);document.body.classList.remove('food-dragging');};
 function scroll(){
  if(!active||!point){stop();return;}
  const table=document.getElementById('piano-cont'),r=table?.getBoundingClientRect();
  if(r&&point.y>=r.top&&point.y<=r.bottom&&point.x>=r.left&&point.x<=r.right){
   const dx=point.x<r.left+42?-12:point.x>r.right-42?12:0;if(dx)table.scrollLeft+=dx;
  }
  if(point.y<100)window.scrollBy(0,-12);else if(point.y>innerHeight-70)window.scrollBy(0,12);
  frame=requestAnimationFrame(scroll);
 }
 picker.addEventListener('dragstart',e=>{
  const item=e.target.closest('[data-faid],.fpk-off-item');
  if(!item||!isEnabled()||pending){e.preventDefault();return;}
  const food=item.dataset.faid?getFood(item.dataset.faid):null,product=getOffProduct(item);
  if(!food&&!product){e.preventDefault();return;}
  active={token:crypto.randomUUID(),dietId:getDietId(),food,product};
  e.dataTransfer.effectAllowed='copy';e.dataTransfer.setData(mime,active.token);
  e.dataTransfer.setData('text/plain',food?.nome||product.nome);
  document.body.classList.add('food-dragging');
 });
 picker.addEventListener('dragend',clear);
 for(const container of containers){
  container.addEventListener('dragover',e=>{
   if(!active||pending||!isEnabled()||!e.dataTransfer.types.includes(mime))return;
   const target=e.target.closest('[data-food-slot]');if(!target)return;
   e.preventDefault();e.dataTransfer.dropEffect='copy';highlight(target);point={x:e.clientX,y:e.clientY};if(!frame)frame=requestAnimationFrame(scroll);
  });
  container.addEventListener('dragleave',e=>{const target=e.target.closest('[data-food-slot]');if(target&&!target.contains(e.relatedTarget))highlight(null);});
  container.addEventListener('drop',async e=>{
   const target=e.target.closest('[data-food-slot]');
   if(!target||!active||pending||!isEnabled()||e.dataTransfer.getData(mime)!==active.token)return;
   e.preventDefault();e.stopPropagation();const source=active,slot={s:+target.dataset.s,g:+target.dataset.g,m:target.dataset.m};
   clear();pending=true;target.classList.add('food-drop-pending');target.setAttribute('aria-busy','true');
   try{await onDrop(source,slot);}catch(error){onError(error);}finally{pending=false;target.classList.remove('food-drop-pending');target.removeAttribute('aria-busy');}
  });
 }
 document.addEventListener('dragover',e=>{if(active&&!e.target.closest('[data-food-slot]')){highlight(null);stop();}});
 window.addEventListener('blur',clear);
}
