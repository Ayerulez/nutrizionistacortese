export const EXPORT_SECTIONS = Object.freeze({intro:'Introduzione / intestazione',guidelines:'Linee guida',planNotes:'Note del piano',table:'Tabella della dieta',recommended:'Alimenti consigliati',discouraged:'Alimenti sconsigliati',conclusions:'Conclusioni'});
export const PDF_DEFAULTS = Object.freeze({
  version: 2, layout: 'weekly', weeks: 'all', days: [1,2,3,4,5,6,7],
  showCover:true, sectionOrder:Object.keys(EXPORT_SECTIONS),
  specialistName:'Dott.ssa Giulia Cortese',specialistRole:'Biologa Nutrizionista',
  specialistPhone:'320 145 9853',specialistEmail:'',specialistAddress:'',specialistWebsite:'nutrizionistacortese.it',
  palette: 'sage', textSize: 'standard',
  showCalories: true, showMacros: false, showQuantities: true,
  showDailyTotals: true, showTarget: true, showEmptyMeals: true,
  showAlternatives: true, showMealNotes: true,
  showIntro: true, showPlanNotes: true, showGuidelines: true,
  showConclusions: true, showRecommended: true, showDiscouraged:true,
  showLogo: true, showContacts: true, showPageNumbers: true, showDate: true,
});

// Preferenze non valide o di una versione precedente non rompono l'export.
export function normalizePdfOptions(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) value = {};
  const result = {...PDF_DEFAULTS, days: [...PDF_DEFAULTS.days],sectionOrder:[...PDF_DEFAULTS.sectionOrder]};
  for (const [key, fallback] of Object.entries(PDF_DEFAULTS)) {
    if (typeof fallback === 'boolean' && typeof value[key] === 'boolean') result[key] = value[key];
  }
  for (const [key, allowed] of Object.entries({
    layout: ['weekly','daily','both'], weeks: ['all','current'],
    palette: ['sage','grayscale'], textSize: ['standard','large'],
  })) if (allowed.includes(value[key])) result[key] = value[key];
  if (Array.isArray(value.days)) {
    const days = [...new Set(value.days.filter(d => Number.isInteger(d) && d >= 1 && d <= 7))].sort((a,b)=>a-b);
    if (days.length) result.days = days;
  }
  // Migrazione delle vecchie preferenze: il flag unico controllava entrambe le liste.
  if(typeof value.showDiscouraged!=='boolean'&&typeof value.showRecommended==='boolean')result.showDiscouraged=value.showRecommended;
  if(Array.isArray(value.sectionOrder))result.sectionOrder=[...new Set([...value.sectionOrder.filter(id=>Object.hasOwn(EXPORT_SECTIONS,id)),...PDF_DEFAULTS.sectionOrder])];
  for(const key of ['specialistName','specialistRole','specialistPhone','specialistEmail','specialistAddress','specialistWebsite']){
    if(typeof value[key]==='string')result[key]=value[key].replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,250);
  }
  return result;
}
