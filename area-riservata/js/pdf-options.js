export const PDF_DEFAULTS = Object.freeze({
  version: 1, layout: 'weekly', weeks: 'all', days: [1,2,3,4,5,6,7],
  palette: 'sage', textSize: 'standard',
  showCalories: true, showMacros: false, showQuantities: true,
  showDailyTotals: true, showTarget: true, showEmptyMeals: true,
  showAlternatives: true, showMealNotes: true,
  showIntro: true, showPlanNotes: true, showGuidelines: true,
  showConclusions: true, showRecommended: true,
  showLogo: true, showContacts: true, showPageNumbers: true, showDate: true,
});

// Preferenze non valide o di una versione precedente non rompono l'export.
export function normalizePdfOptions(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) value = {};
  const result = {...PDF_DEFAULTS, days: [...PDF_DEFAULTS.days]};
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
  return result;
}
