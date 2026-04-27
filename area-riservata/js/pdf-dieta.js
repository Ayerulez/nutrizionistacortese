/**
 * pdf-dieta.js — Genera PDF piano alimentare con jsPDF puro
 * Nessun html2canvas: disegna tutto programmaticamente
 */

// Logo caricato runtime via fetch

const GIORNI = ["LUN","MAR","MER","GIO","VEN","SAB","DOM"];
const MOMENTI = ['colazione','spuntino_mattina','pranzo','spuntino_pomeriggio','cena'];
const MOM_LABEL = {
  colazione:'COLAZIONE', spuntino_mattina:'SPUNTINO\nMAT.',
  pranzo:'PRANZO', spuntino_pomeriggio:'SPUNTINO\nPOM.', cena:'CENA'
};

const GREEN  = [90, 130, 96];
const LGREEN = [240, 245, 241];
const GOLD   = [200, 169, 110];
const BORDER = [200, 216, 200];
const BLACK  = [42, 42, 42];
const GREY   = [120, 120, 120];
const WHITE  = [255, 255, 255];
const YELLOW = [255, 251, 240];

function loadJsPDF() {
  return new Promise((resolve, reject) => {
    if (window.jspdf && window.jspdf.jsPDF) { resolve(window.jspdf.jsPDF); return; }
    if (window.jsPDF) { resolve(window.jsPDF); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = () => resolve(window.jspdf?.jsPDF || window.jsPDF);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function tuttiUguali(piano, sett, momento) {
  const vals = [];
  for (let g = 1; g <= 7; g++) {
    const p = piano[sett]?.[g]?.[momento];
    vals.push(p ? (p.alimento_nome + '|' + Math.round(p.quantita_g)) : '');
  }
  return vals.every(v => v === vals[0]);
}

function wrapText(doc, text, maxW) {
  if (!text) return [''];
  return doc.splitTextToSize(String(text), maxW);
}

function drawRect(doc, x, y, w, h, fillColor, strokeColor) {
  if (fillColor) { doc.setFillColor(...fillColor); doc.rect(x, y, w, h, 'F'); }
  if (strokeColor) { doc.setDrawColor(...strokeColor); doc.rect(x, y, w, h, 'S'); }
}

function textInBox(doc, lines, x, y, w, h, opts) {
  opts = opts || {};
  const size   = opts.size   || 7;
  const color  = opts.color  || BLACK;
  const bold   = opts.bold   || false;
  const align  = opts.align  || 'left';
  const lh     = size * 0.4;
  doc.setFontSize(size);
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setTextColor(...color);
  const textH = lines.length * lh;
  let ty = y + (h - textH) / 2 + lh * 0.75;
  lines.forEach(line => {
    if (align === 'center') doc.text(line, x + w / 2, ty, { align: 'center' });
    else doc.text(line, x + 1.5, ty);
    ty += lh;
  });
}

function buildPage(jsPDF, piano, sett, dieta, paziente, aliIdx, logoPdf) {
  // A4 landscape: 297 x 210 mm
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const PW = 297, PH = 210;
  const ML = 8, MR = 8, MT = 6, MB = 8;
  const W = PW - ML - MR;

  let y = MT;

  // ── LOGO ──────────────────────────────────────────────────────────
  if (logoPdf) { try { doc.addImage(logoPdf, 'JPEG', ML, y, 20, 14); } catch(e) {} }

  // ── HEADER TESTO ──────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...GREEN);
  doc.text(dieta.nome, ML + 23, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...GREY);
  doc.text('Paziente: ' + paziente.cognome + ' ' + paziente.nome +
    '   ·   Target: ' + Math.round(dieta.target_kcal) + ' kcal/giorno' +
    '   ·   Settimana ' + sett + ' di ' + dieta.numero_settimane,
    ML + 23, y + 10);
  doc.setFontSize(6.5);
  doc.text('Le grammature sono da crudo (eccetto legumi in scatola) ed al netto degli scarti.',
    ML + 23, y + 14);

  // Linea separatrice header
  y += 17;
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.5);
  doc.line(ML, y, ML + W, y);
  y += 3;

  // ── LAYOUT COLONNE ────────────────────────────────────────────────
  const labelW = 18;
  const colW   = (W - labelW) / 7;

  // Header giorni
  const hH = 6;
  drawRect(doc, ML, y, labelW, hH, LGREEN, BORDER);
  for (let g = 0; g < 7; g++) {
    const x = ML + labelW + g * colW;
    drawRect(doc, x, y, colW, hH, GREEN, BORDER);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...WHITE);
    doc.text(GIORNI[g], x + colW / 2, y + 4, { align: 'center' });
  }
  y += hH;

  // ── RIGHE PASTI ───────────────────────────────────────────────────
  // Pre-calcola altezze necessarie per ogni riga
  const momH = {};
  MOMENTI.forEach(mom => {
    const isSpunt = mom.includes('spuntino') && tuttiUguali(piano, sett, mom);
    if (isSpunt) {
      const p = piano[sett]?.[1]?.[mom];
      const lines = p ? wrapText(doc, p.alimento_nome + ' ' + Math.round(p.quantita_g) + 'g', W - labelW - 4) : ['—'];
      momH[mom] = Math.max(9, lines.length * 3 + 4);
    } else {
      let maxLines = 1;
      for (let g = 1; g <= 7; g++) {
        const p = piano[sett]?.[g]?.[mom];
        if (!p) continue;
        const lines = wrapText(doc, p.alimento_nome, colW - 3);
        let n = lines.length + 1; // +1 per grammi/kcal
        if (p.sostituti_ids?.length) n += p.sostituti_ids.length;
        if (p.note) n += 1;
        maxLines = Math.max(maxLines, n);
      }
      momH[mom] = Math.max(10, maxLines * 2.8 + 4);
    }
  });

  // Calcola totali
  const totK = {};
  for (let g = 1; g <= 7; g++) {
    let k = 0;
    MOMENTI.forEach(m => { k += piano[sett]?.[g]?.[m]?.kcal || 0; });
    totK[g] = Math.round(k);
  }

  MOMENTI.forEach(mom => {
    const rowH = momH[mom];
    const label = MOM_LABEL[mom];
    const isSpunt = mom.includes('spuntino') && tuttiUguali(piano, sett, mom);

    // Label cella sinistra
    drawRect(doc, ML, y, labelW, rowH, LGREEN, BORDER);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(...GREEN);
    const lLines = label.split('\n');
    const lY = y + rowH / 2 - (lLines.length * 2.2) / 2 + 2.2;
    lLines.forEach((l, i) => doc.text(l, ML + labelW / 2, lY + i * 2.5, { align: 'center' }));

    if (isSpunt) {
      // Riquadro unico
      const p = piano[sett]?.[1]?.[mom];
      drawRect(doc, ML + labelW, y, W - labelW, rowH, [250, 252, 250], BORDER);
      if (p) {
        const mainLines = wrapText(doc, p.alimento_nome, W - labelW - 4);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(...BLACK);
        let ty = y + 3;
        mainLines.forEach(l => { doc.text(l, ML + labelW + 2, ty); ty += 2.8; });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(...GREY);
        doc.text(Math.round(p.quantita_g) + 'g' + (p.kcal ? '  ·  ' + p.kcal + ' kcal' : ''), ML + labelW + 2, ty);
        if (p.sostituti_ids?.length) {
          ty += 2.5;
          p.sostituti_ids.forEach(sid => {
            const alt = aliIdx[sid];
            if (!alt) return;
            const qIso = alt.energia_kcal ? Math.round((p.kcal||0)/(alt.energia_kcal/100)) : Math.round(p.quantita_g);
            doc.setTextColor(...GREY);
            doc.text('↔ ' + alt.nome + ' ' + qIso + 'g', ML + labelW + 4, ty);
            ty += 2.5;
          });
        }
      } else {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(6.5);
        doc.setTextColor(...GREY);
        doc.text('Non specificato', ML + labelW + 3, y + rowH / 2);
      }
    } else {
      // Cella per ogni giorno
      for (let g = 1; g <= 7; g++) {
        const x = ML + labelW + (g - 1) * colW;
        const p = piano[sett]?.[g]?.[mom];
        drawRect(doc, x, y, colW, rowH, WHITE, BORDER);
        if (!p) continue;
        let ty = y + 3;
        const mainLines = wrapText(doc, p.alimento_nome, colW - 3);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(...BLACK);
        mainLines.forEach(l => { doc.text(l, x + 1.2, ty); ty += 2.5; });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.8);
        doc.setTextColor(...GREEN);
        doc.text(Math.round(p.quantita_g) + 'g' + (p.kcal ? ' · ' + p.kcal + 'k' : ''), x + 1.2, ty);
        ty += 2.5;
        if (p.note) {
          doc.setFontSize(5.5);
          doc.setTextColor(...GREY);
          const nLines = wrapText(doc, p.note, colW - 3);
          nLines.forEach(l => { doc.text(l, x + 1.2, ty); ty += 2.2; });
        }
        if (p.sostituti_ids?.length) {
          doc.setFontSize(5.3);
          doc.setTextColor(160, 160, 160);
          p.sostituti_ids.forEach(sid => {
            const alt = aliIdx[sid];
            if (!alt) return;
            const qIso = alt.energia_kcal ? Math.round((p.kcal||0)/(alt.energia_kcal/100)) : Math.round(p.quantita_g);
            const sLines = wrapText(doc, '↔ ' + alt.nome + ' ' + qIso + 'g', colW - 4);
            sLines.forEach(l => { doc.text(l, x + 1.5, ty); ty += 2.2; });
          });
        }
      }
    }
    y += rowH;
  });

  // ── RIGA TOTALI ───────────────────────────────────────────────────
  const totH = 5;
  drawRect(doc, ML, y, labelW, totH, GREEN, BORDER);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(...WHITE);
  doc.text('TOTALE', ML + labelW / 2, y + 3.3, { align: 'center' });
  for (let g = 1; g <= 7; g++) {
    const x = ML + labelW + (g - 1) * colW;
    const k = totK[g];
    const over = k > dieta.target_kcal * 1.05;
    const low  = k < dieta.target_kcal * 0.88;
    drawRect(doc, x, y, colW, totH, GREEN, BORDER);
    if (k > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.8);
      doc.setTextColor(over ? [255, 150, 150] : low ? [255, 220, 100] : WHITE);
      doc.text(k + ' kcal', x + colW / 2, y + 3.3, { align: 'center' });
    }
  }
  y += totH + 2;

  // ── NOTE LINEE GUIDA ──────────────────────────────────────────────
  if (dieta.linee_guida && y < PH - MB - 10) {
    doc.setDrawColor(...GREEN);
    doc.setLineWidth(0.8);
    doc.line(ML, y, ML, y + 6);
    doc.setLineWidth(0.2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...GREY);
    const lgLines = wrapText(doc, dieta.linee_guida, W - 4);
    lgLines.slice(0, 3).forEach((l, i) => doc.text(l, ML + 2.5, y + 2 + i * 2.5));
    y += Math.min(lgLines.length, 3) * 2.5 + 3;
  }

  // ── FOOTER ────────────────────────────────────────────────────────
  const fy = PH - MB;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.2);
  doc.line(ML, fy - 3, ML + W, fy - 3);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(180, 180, 180);
  doc.text('Dott.ssa Giulia Cortese · Biologa Nutrizionista · Tel. 320 145 9853', ML, fy);
  doc.text('nutrizionistacortese.it', ML + W, fy, { align: 'right' });

  return doc;
}

export async function esportaPianoPDF(dieta, paziente, piano, aliIdx) {
  const jsPDF = await loadJsPDF();
  if (!jsPDF) { alert('Impossibile caricare jsPDF'); return; }

  // Carica logo via fetch (evita problemi con addImage e base64 embedded)
  let logoPdf = null;
  try {
    const resp = await fetch('images/logo.png');
    if (resp.ok) {
      const blob = await resp.blob();
      logoPdf = await new Promise(res => {
        const rd = new FileReader();
        rd.onload = e => res(e.target.result);
        rd.readAsDataURL(blob);
      });
    }
  } catch(e) { console.warn('Logo non caricato:', e); }

  const nomefile = 'Piano_' + paziente.cognome + '_' + paziente.nome + '.pdf';
  const mainDoc = buildPage(jsPDF, piano, 1, dieta, paziente, aliIdx, logoPdf);
  for (let s = 2; s <= dieta.numero_settimane; s++) {
    mainDoc.addPage([297, 210], 'landscape');
    drawPageOnDoc(mainDoc, piano, s, dieta, paziente, aliIdx, logoPdf);
  }
  mainDoc.save(nomefile);
}

// Versione che disegna su doc esistente invece di crearne uno nuovo
function drawPageOnDoc(doc, piano, sett, dieta, paziente, aliIdx, logoPdf) {
  const PW = 297, PH = 210, ML = 8, MR = 8, MT = 6, MB = 8;
  const W = PW - ML - MR;
  let y = MT;
  if (logoPdf) { try { doc.addImage(logoPdf, 'JPEG', ML, y, 20, 14); } catch(e) {} }
  doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(...GREEN);
  doc.text(dieta.nome, ML+23, y+5);
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(...GREY);
  doc.text('Paziente: '+paziente.cognome+' '+paziente.nome+
    '   ·   Target: '+Math.round(dieta.target_kcal)+' kcal/g'+
    '   ·   Settimana '+sett+' di '+dieta.numero_settimane, ML+23, y+10);
  doc.setFontSize(6.5);
  doc.text('Le grammature sono da crudo (eccetto legumi in scatola) ed al netto degli scarti.', ML+23, y+14);
  y += 17;
  doc.setDrawColor(...GREEN); doc.setLineWidth(0.5); doc.line(ML,y,ML+W,y); y+=3;
  const labelW=18, colW=(W-labelW)/7, hH=6;
  drawRect(doc,ML,y,labelW,hH,LGREEN,BORDER);
  for(let g=0;g<7;g++){
    const x=ML+labelW+g*colW;
    drawRect(doc,x,y,colW,hH,GREEN,BORDER);
    doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(...WHITE);
    doc.text(GIORNI[g],x+colW/2,y+4,{align:'center'});
  }
  y+=hH;
  const totK={};
  for(let g=1;g<=7;g++){let k=0;MOMENTI.forEach(m=>{k+=piano[sett]?.[g]?.[m]?.kcal||0;});totK[g]=Math.round(k);}
  MOMENTI.forEach(mom=>{
    const isSpunt=mom.includes('spuntino')&&tuttiUguali(piano,sett,mom);
    let maxLines=1;
    if(!isSpunt){for(let g=1;g<=7;g++){const p=piano[sett]?.[g]?.[mom];if(!p)continue;const ln=wrapText(doc,p.alimento_nome,colW-3);let n=ln.length+1;if(p.sostituti_ids?.length)n+=p.sostituti_ids.length;if(p.note)n+=1;maxLines=Math.max(maxLines,n);}}
    else{const p=piano[sett]?.[1]?.[mom];const ln=p?wrapText(doc,p.alimento_nome,W-labelW-4):['—'];maxLines=ln.length+1;}
    const rowH=Math.max(10,maxLines*2.8+4);
    const label=MOM_LABEL[mom];
    drawRect(doc,ML,y,labelW,rowH,LGREEN,BORDER);
    doc.setFont('helvetica','bold'); doc.setFontSize(5.5); doc.setTextColor(...GREEN);
    const ll=label.split('\n'); const lY=y+rowH/2-(ll.length*2.2)/2+2.2;
    ll.forEach((l,i)=>doc.text(l,ML+labelW/2,lY+i*2.5,{align:'center'}));
    if(isSpunt){
      const p=piano[sett]?.[1]?.[mom];
      drawRect(doc,ML+labelW,y,W-labelW,rowH,[250,252,250],BORDER);
      if(p){let ty=y+3;const ml=wrapText(doc,p.alimento_nome,W-labelW-4);doc.setFont('helvetica','bold');doc.setFontSize(7);doc.setTextColor(...BLACK);ml.forEach(l=>{doc.text(l,ML+labelW+2,ty);ty+=2.8;});doc.setFont('helvetica','normal');doc.setFontSize(6);doc.setTextColor(...GREY);doc.text(Math.round(p.quantita_g)+'g'+(p.kcal?'  ·  '+p.kcal+' kcal':''),ML+labelW+2,ty);if(p.sostituti_ids?.length){ty+=2.5;p.sostituti_ids.forEach(sid=>{const alt=aliIdx[sid];if(!alt)return;const qi=alt.energia_kcal?Math.round((p.kcal||0)/(alt.energia_kcal/100)):Math.round(p.quantita_g);doc.setTextColor(...GREY);doc.text('↔ '+alt.nome+' '+qi+'g',ML+labelW+4,ty);ty+=2.5;});}}
    }else{
      for(let g=1;g<=7;g++){const x=ML+labelW+(g-1)*colW;const p=piano[sett]?.[g]?.[mom];drawRect(doc,x,y,colW,rowH,WHITE,BORDER);if(!p)continue;let ty=y+3;const ml=wrapText(doc,p.alimento_nome,colW-3);doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.setTextColor(...BLACK);ml.forEach(l=>{doc.text(l,x+1.2,ty);ty+=2.5;});doc.setFont('helvetica','normal');doc.setFontSize(5.8);doc.setTextColor(...GREEN);doc.text(Math.round(p.quantita_g)+'g'+(p.kcal?' · '+p.kcal+'k':''),x+1.2,ty);ty+=2.5;if(p.note){doc.setFontSize(5.5);doc.setTextColor(...GREY);wrapText(doc,p.note,colW-3).forEach(l=>{doc.text(l,x+1.2,ty);ty+=2.2;});}if(p.sostituti_ids?.length){doc.setFontSize(5.3);doc.setTextColor(160,160,160);p.sostituti_ids.forEach(sid=>{const alt=aliIdx[sid];if(!alt)return;const qi=alt.energia_kcal?Math.round((p.kcal||0)/(alt.energia_kcal/100)):Math.round(p.quantita_g);wrapText(doc,'↔ '+alt.nome+' '+qi+'g',colW-4).forEach(l=>{doc.text(l,x+1.5,ty);ty+=2.2;});});}}}
    y+=rowH;
  });
  const totH=5;drawRect(doc,ML,y,labelW,totH,GREEN,BORDER);
  doc.setFont('helvetica','bold');doc.setFontSize(5.5);doc.setTextColor(...WHITE);
  doc.text('TOTALE',ML+labelW/2,y+3.3,{align:'center'});
  for(let g=1;g<=7;g++){const x=ML+labelW+(g-1)*colW;const k=totK[g];drawRect(doc,x,y,colW,totH,GREEN,BORDER);if(k>0){doc.setFont('helvetica','bold');doc.setFontSize(5.8);doc.setTextColor(k>dieta.target_kcal*1.05?[255,150,150]:k<dieta.target_kcal*0.88?[255,220,100]:WHITE);doc.text(k+' kcal',x+colW/2,y+3.3,{align:'center'});}}
  y+=totH+2;
  if(dieta.linee_guida&&y<PH-MB-10){doc.setDrawColor(...GREEN);doc.setLineWidth(0.8);doc.line(ML,y,ML,y+6);doc.setLineWidth(0.2);doc.setFont('helvetica','normal');doc.setFontSize(6.5);doc.setTextColor(...GREY);wrapText(doc,dieta.linee_guida,W-4).slice(0,3).forEach((l,i)=>doc.text(l,ML+2.5,y+2+i*2.5));}
  const fy=PH-MB;doc.setDrawColor(...BORDER);doc.setLineWidth(0.2);doc.line(ML,fy-3,ML+W,fy-3);
  doc.setFont('helvetica','normal');doc.setFontSize(6);doc.setTextColor(180,180,180);
  doc.text('Dott.ssa Giulia Cortese · Biologa Nutrizionista · Tel. 320 145 9853',ML,fy);
  doc.text('nutrizionistacortese.it',ML+W,fy,{align:'right'});
}
