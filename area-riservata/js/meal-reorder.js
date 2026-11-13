// Un trascinamento può scambiare soltanto alimenti dello stesso pasto.
export function installMealReordering({containers,getDietId,getItem,onSwap,onPromote,onError}){
 const mime='application/x-cortese-meal-order';let active=null;
 const position=row=>({s:+row.dataset.s,g:+row.dataset.g,m:row.dataset.m,index:+row.dataset.mealItem});
 const same=(a,b)=>a.s===b.s&&a.g===b.g&&a.m===b.m;
 const clear=()=>{active=null;document.querySelectorAll('.meal-swap-target').forEach(el=>el.classList.remove('meal-swap-target'));};
 for(const container of containers){
  container.addEventListener('click',e=>{
   const move=e.target.closest('[data-move-food]'),promote=e.target.closest('[data-promote-food]');if(!move&&!promote)return;
   const row=(move||promote).closest('[data-meal-item]');if(!row)return;e.preventDefault();e.stopPropagation();
   const p=position(row);Promise.resolve().then(()=>move?onSwap(p,p.index+Number(move.dataset.moveFood)):onPromote(p,promote.dataset.promoteFood)).catch(onError);
  },true);
  container.addEventListener('dragstart',e=>{
   const handle=e.target.closest('[data-meal-handle]');if(!handle)return;
   const row=handle.closest('[data-meal-item]'),p=position(row),item=getItem(p);if(!item){e.preventDefault();return;}
   active={...p,dietId:getDietId(),item,token:crypto.randomUUID()};e.stopPropagation();e.dataTransfer.effectAllowed='move';e.dataTransfer.setData(mime,active.token);e.dataTransfer.setData('text/plain',item.alimento_nome||'Alimento');
  });
  container.addEventListener('dragover',e=>{
   if(!active||!e.dataTransfer.types.includes(mime))return;const row=e.target.closest('[data-meal-item]');if(!row||!same(active,position(row)))return;
   e.preventDefault();e.dataTransfer.dropEffect='move';document.querySelectorAll('.meal-swap-target').forEach(el=>el.classList.remove('meal-swap-target'));row.classList.add('meal-swap-target');
  });
  container.addEventListener('dragleave',e=>{const row=e.target.closest('[data-meal-item]');if(row&&!row.contains(e.relatedTarget))row.classList.remove('meal-swap-target');});
  container.addEventListener('drop',e=>{
   const row=e.target.closest('[data-meal-item]');if(!active||!row||e.dataTransfer.getData(mime)!==active.token)return;
   const source=active,target=position(row);clear();e.preventDefault();e.stopPropagation();
   if(source.dietId!==getDietId()||getItem(source)!==source.item||!same(source,target))return;
   Promise.resolve(onSwap(source,target.index)).catch(onError);
  });
  container.addEventListener('dragend',clear);
 }
 window.addEventListener('blur',clear);
}
