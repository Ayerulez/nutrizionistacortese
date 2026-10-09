import {sb} from './supabase.js?v=20261009-2';
import {normalizePdfOptions} from './pdf-options.js?v=20261009-2';

function explain(error) {
  if (error.code === 'PGRST205' || error.code === '42P01') {
    return new Error('Preferenze PDF non ancora attivate: esegui db/002_preferenze_pdf.sql su Supabase.');
  }
  return error;
}
export async function loadPdfPreferences(userId) {
  if (!userId) throw new Error('Accedi per caricare le preferenze di esportazione.');
  try {
    const {data} = await sb.from('preferenze_pdf').select('opzioni').eq('user_id',userId).maybeSingle().throwOnError();
    return normalizePdfOptions(data?.opzioni);
  } catch (error) { throw explain(error); }
}
export async function savePdfPreferences(userId, value) {
  if (!userId) throw new Error('Accedi per salvare le preferenze di esportazione.');
  try {
    const {data} = await sb.from('preferenze_pdf').upsert({user_id:userId,opzioni:normalizePdfOptions(value)},
      {onConflict:'user_id'}).select('opzioni').single().throwOnError();
    return normalizePdfOptions(data.opzioni);
  } catch (error) { throw explain(error); }
}
