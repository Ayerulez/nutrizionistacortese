export const isDailyPlan=d=>d?.struttura_piano==='giornaliera';
export const planDays=d=>isDailyPlan(d)?[1]:[1,2,3,4,5,6,7];
export const planDuration=d=>isDailyPlan(d)?'Giornata tipo':(d?.numero_settimane||1)+' sett.';
export const dayName=(d,day,names)=>isDailyPlan(d)?'Giornata tipo':names[day-1];
