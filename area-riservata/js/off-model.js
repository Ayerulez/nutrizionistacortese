// I valori OFF sono per 100 g. Un campo mancante rimane null, mai zero.
function nutrient(value) {
  if(value==null||value==='')return null;
  const number=Number(String(value).replace(',','.'));
  return Number.isFinite(number)&&number>=0 ? number : null;
}
const CATEGORIES = [
  ['CARNI TRASFORMATE','processed-meats','deli-meats','sausages','ham','salami'],
  ['FRATTAGLIE','offal','organ-meats'],
  ['FORMAGGI','cheeses','cheese'],
  ['DOLCI','sweets','chocolates','candies','cookies','cakes','ice-creams','jams','sweet-spreads','chocolate-spreads'],
  ['ALCOOL','alcoholic-beverages','wines','beers','spirits'],
  ['CEREALI E DERIVATI','pastas','pasta','noodles','bread','breads','cereals','flours','rice','grains','biscuits','crackers','breakfast-cereals'],
  ['LEGUMI','legumes','beans','lentils','chickpeas','peas','soybeans'],
  ['VERDURA','vegetables','fresh-vegetables','frozen-vegetables'],
  ['FRUTTA','fruits','fresh-fruits','dried-fruits'],
  ['CARNE','meats','beef','chicken','pork','turkey','veal','lamb','poultry','meat'],
  ['PESCE','fish','seafood','fishes','tuna','salmon','cod','shrimps','shellfish'],
  ['LATTE E YOGURT','milks','dairy','yogurts','kefir','milk'],
  ['UOVA','eggs','egg-products'],
  ['GRASSI E CONDIMENTI','fats','oils','olive-oils','butter','margarines','condiments','sauces','dressings'],
];
function category(tags) {
  const normalized=new Set((Array.isArray(tags)?tags:[]).filter(t=>typeof t==='string').map(t=>t.toLowerCase()));
  return CATEGORIES.find(([, ...names])=>names.some(name=>normalized.has('en:'+name)))?.[0] || 'PRODOTTI VARI';
}
export function mapOffToAlimento(product) {
  const n=product?.nutriments||{};
  const text=value=>typeof value==='string'?value.trim():'';
  const kj=nutrient(n['energy-kj_100g'])??nutrient(n['energy_100g']);
  const kcal=nutrient(n['energy-kcal_100g'])??(kj==null?null:Math.round(kj/4.184*10)/10);
  const salt=nutrient(n['salt_100g']);
  const sodium=nutrient(n['sodium_100g'])??(salt==null?null:salt/2.5);
  const serving=text(product.serving_size).match(/(\d+(?:[.,]\d+)?)\s*g\b/i);
  return {
    off_code:product.code==null?null:String(product.code).trim()||null,
    nome:[text(product.product_name),text(product.brands)].filter(Boolean).join(' — ')||'Prodotto senza nome',
    categoria:category(product.categories_tags),
    energia_kcal:kcal,energia_kj:kj,
    proteine_g:nutrient(n['proteins_100g']),carboidrati_g:nutrient(n['carbohydrates_100g']),
    zuccheri_g:nutrient(n['sugars_100g']),lipidi_g:nutrient(n['fat_100g']),
    grassi_saturi_g:nutrient(n['saturated-fat_100g']),fibra_g:nutrient(n['fiber_100g']),
    sodio_mg:sodium==null?null:Math.round(sodium*1000),
    porzione_default_g:serving&&Number(serving[1].replace(',','.'))>0?Number(serving[1].replace(',','.')):100,
    abilitato:true,
  };
}
