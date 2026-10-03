export const SURVEY_KEY = 'vista-partners';
export const SURVEY_VERSION = 1;
export const SURVEY_PATH = '/encuesta/partners';
export const STORAGE_KEY = 'vista:survey:partners:v1';

export const OPTIONS = {
  roles: [['player','Jugador'],['admin','Administrador o propietario'],['creator','Creador de contenido'],['new','Estoy conociendo este mundo'],['other','Otra perspectiva']],
  frequency: [['first','Es mi primera visita'],['rare','Menos de una vez por semana'],['weekly','Algunas veces por semana'],['daily','Casi todos los días']],
  content: [['news','Noticias y periódicos'],['tutorials','Videos y tutoriales'],['servers','Servidores para descubrir'],['events','Eventos'],['stories','Historias de comunidades y naciones'],['other','Otro contenido']],
  server_info: [['players','Jugadores activos'],['rules','Reglas'],['economy','Mecánicas y economía'],['map','Mapa'],['schedule','Idioma y horarios'],['reviews','Opiniones de jugadores'],['join','Cómo entrar'],['other','Otra información']],
  placements: [['free','Ficha gratuita'],['directory','Ficha destacada de pago'],['hero','Hero de pantalla completa'],['campaign','Campaña de contenido'],['unsure','Todavía no lo sé']],
  goal: [['visibility','Dar a conocer el servidor'],['visits','Visitas a su web o Discord'],['players','Atraer nuevos jugadores'],['launch','Promocionar un lanzamiento o evento'],['other','Otro objetivo']],
  budget_status: [['amount','Tengo una cantidad en mente'],['none','No pagaría actualmente'],['unsure','Necesito conocer mejor la propuesta']],
  payment: [['card','Tarjeta'],['transfer','Transferencia bancaria'],['mercadopago','Mercado Pago'],['paypal','PayPal'],['cash','Efectivo en un establecimiento'],['other','Otro medio'],['unsure','No lo sé']],
};
export const QUESTION_LABELS = {roles:'Perfil de participación',country:'País',frequency:'Frecuencia de visita',content:'Contenido deseado',server_info:'Información para elegir servidor',placements:'Opciones de Partners',goal:'Objetivo de promoción',budget_status:'Presupuesto',payment:'Medios de pago'};
export const ADMIN_KEYS = ['placements','goal','goal_other','budget_status','budget_amount','currency','currency_other','payment','payment_other'];
export const COUNTRY_CODES = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
const regionNames = new Intl.DisplayNames(['es'],{type:'region'});
export const COUNTRIES = COUNTRY_CODES.map(code=>[code,regionNames.of(code)]).sort((a,b)=>a[1].localeCompare(b[1],'es'));
export const countryName = code => COUNTRIES.find(([key])=>key===code)?.[1] || (code==='none'?'Prefiere no responder':code==='other'?'Otro país':code || '—');
export const optionLabel = (key,value) => OPTIONS[key]?.find(([id])=>id===value)?.[1] || value;
export const isAdminResponse = answers => answers.roles?.includes('admin');
export function stepsFor(answers) {
  return ['roles','vista','country','frequency','content','server_info','partners',...(isAdminResponse(answers)?['placements','goal','budget','payment']:[]),'comment','review'];
}
export function cleanAnswers(answers) {
  const cleaned = {...answers};
  if(!isAdminResponse(cleaned)) ADMIN_KEYS.forEach(key=>delete cleaned[key]);
  if(cleaned.budget_status!=='amount') ['budget_amount','currency','currency_other'].forEach(key=>delete cleaned[key]);
  for(const key of ['roles','content','server_info','goal','payment']) if(!(Array.isArray(cleaned[key])?cleaned[key].includes('other'):cleaned[key]==='other')) delete cleaned[`${key}_other`];
  if(cleaned.country!=='other') delete cleaned.country_other;
  if(cleaned.currency!=='OTHER') delete cleaned.currency_other;
  for(const key of Object.keys(cleaned)) if(typeof cleaned[key]==='string') cleaned[key]=cleaned[key].trim();
  return cleaned;
}
export function stepError(step,answers) {
  const arrayRequired=['roles','content','server_info','placements','payment'];
  if(arrayRequired.includes(step) && !answers[step]?.length) return 'Elige al menos una opción para continuar.';
  if(['content','server_info'].includes(step) && answers[step]?.length>3) return 'Elige un máximo de tres opciones.';
  if(['country','frequency','goal'].includes(step) && !answers[step]) return 'Elige una opción para continuar.';
  if(answers[step]==='other' && !answers[`${step}_other`]?.trim()) return 'Cuéntanos cuál en el campo de texto.';
  if(answers[step]?.includes?.('other') && Array.isArray(answers[step]) && !answers[`${step}_other`]?.trim()) return 'Cuéntanos cuál en el campo de texto.';
  if(step==='budget') {
    if(!answers.budget_status) return 'Elige una opción para continuar.';
    if(answers.budget_status==='amount') {
      if(answers.budget_amount==='' || answers.budget_amount==null || !Number.isFinite(Number(answers.budget_amount)) || Number(answers.budget_amount)<0 || Number(answers.budget_amount)>10000000) return 'Escribe una cantidad válida, incluyendo cero si corresponde.';
      if(!['MXN','USD','EUR','OTHER'].includes(answers.currency)) return 'Elige la moneda de tu presupuesto.';
      if(answers.currency==='OTHER'&&!/^[A-Za-z]{3}$/.test(answers.currency_other?.trim()||'')) return 'Escribe el código de tres letras de la moneda, por ejemplo COP.';
    }
  }
  if(step==='comment' && (answers.comment||'').length>2000) return 'El comentario puede tener hasta 2000 caracteres.';
  return '';
}
export const safeCsvCell = value => {
  const text=String(value??'');
  return '"'+(/^[\s]*[=+\-@]/.test(text)?"'"+text:text).replaceAll('"','""')+'"';
};
export function tally(rows,key) {
  const eligible=rows.filter(row=>row.answers[key]!=null);
  const counts=new Map();
  eligible.forEach(row=>(Array.isArray(row.answers[key])?row.answers[key]:[row.answers[key]]).forEach(value=>counts.set(value,(counts.get(value)||0)+1)));
  return {total:eligible.length,values:[...counts].sort((a,b)=>b[1]-a[1])};
}
