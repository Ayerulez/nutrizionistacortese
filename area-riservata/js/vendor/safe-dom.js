import DOMPurify from './vendor/purify.es.mjs';

// I dati del DB e di Open Food Facts sono testo, anche quando contengono HTML.
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// Seconda barriera per tutti i frammenti HTML composti dall'applicazione.
export function setHTML(element, markup) {
  if (!element) return;
  // I frammenti tr/td vanno analizzati nel contesto di una tabella.
  // Una sanitizzazione nel solo body perderebbe righe e relativi attributi data-*.
  const tag=element.tagName.toLowerCase();
  const wrappers={table:['table'],thead:['table','thead'],tbody:['table','tbody'],tfoot:['table','tfoot'],
    tr:['table','tbody','tr'],td:['table','tbody','tr','td'],th:['table','tbody','tr','th'],select:['select']};
  const chain=wrappers[tag]||[];
  const source=chain.map(t=>`<${t}>`).join('')+String(markup??'')+[...chain].reverse().map(t=>`</${t}>`).join('');
  const fragment=DOMPurify.sanitize(source,{
    USE_PROFILES:{html:true},RETURN_DOM_FRAGMENT:true,ALLOW_DATA_ATTR:true,
    FORBID_TAGS:['style','link','meta','base','iframe','object','embed'],FORBID_ATTR:['srcdoc'],
  });
  const content=chain.length?fragment.querySelector(chain.join(' > ')):fragment;
  const options=tag==='select'?[...(content?.querySelectorAll('option')||[])]:[];
  const selected=options.findIndex(o=>o.hasAttribute('selected'));
  element.replaceChildren(...(content?.childNodes||[]));
  if(options.length)element.selectedIndex=selected>=0?selected:0;
}

export function guard(handler) {
  return function (...args) {
    try {
      Promise.resolve(handler.apply(this, args)).catch(reportError);
    } catch (error) { reportError(error); }
  };
}

export function reportError(error) {
  const el = document.getElementById('toast');
  if (el) {
    el.textContent = 'Errore: ' + (error?.message || 'Operazione non riuscita');
    el.className = 'toast error show';
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 6000);
  }
  document.getElementById('loading-overlay')?.classList.remove('show');
}

window.addEventListener('unhandledrejection',e=>reportError(e.reason));
