import {createHash,randomBytes,randomUUID,sign,verify,createPublicKey} from 'node:crypto';
export const CONTRACT='gba.sepia.acceso/1.0';
export const ORIGIN='https://gba.software';
export const WEEK=604800;
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const OPAQUE=/^[A-Za-z0-9_-]{43}$/;
export const hashSecret=s=>createHash('sha256').update(s).digest('hex');
export const opaque=()=>randomBytes(32).toString('base64url');
export function symbols(size,alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'){return Array.from(randomBytes(size),b=>alphabet[b&31]).join('');}
export function fail(code='invalid_request',status=400){throw Object.assign(new Error(code),{code,status});}
export function strict(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))fail();}
export function text(value,max,min=1){if(typeof value!=='string'||value.trim().length<min||value.length>max||/[\u0000-\u001f\u007f]/.test(value))fail();return value;}
export function normalizeLicense(value){if(typeof value!=='string'||value.length>100||!/^[A-Za-z2-7 \t\r\n-]+$/.test(value))fail('license_invalid_or_used',422);const s=value.replace(/[ \t\r\n-]/g,'').toUpperCase();if(!/^[A-Z2-7]{32}$/.test(s))fail('license_invalid_or_used',422);return s;}
export function validateRequest(b){
 strict(b,['contrato','revision','op','datos']);if(b.contrato!==CONTRACT||b.revision!==2)fail('contract_unsupported');
 const fields={'session.create':['aplicacion','versionApp','nombreDispositivo','dispositivoId'],'session.status':[],'session.logout':[],'license.activate':['codigo']};
 if(!Object.hasOwn(fields,b.op))fail();strict(b.datos,fields[b.op]);
 if(b.op==='session.create'){if(!['workspace','ultramar'].includes(b.datos.aplicacion)||!UUID.test(b.datos.dispositivoId))fail();text(b.datos.versionApp,64);text(b.datos.nombreDispositivo,80);}
 if(b.op==='license.activate')normalizeLicense(b.datos.codigo);
 return b;
}
const encode=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
export function signOffline(values,key,kid){
 const {iat,licencia_exp,aplicacion}=values;
 if(!Number.isSafeInteger(iat)||!Number.isSafeInteger(licencia_exp)||licencia_exp<=iat||!['workspace','ultramar'].includes(aplicacion))fail('service_unavailable',503);
 const header={alg:'Ed25519',typ:'gba-sepia-offline+jwt',kid};
 const claims={iss:ORIGIN,aud:aplicacion+'-desktop',sub:values.sub,jti:randomUUID(),conexionId:values.conexionId,dispositivoId:values.dispositivoId,producto:'sepia',edicion:'01',licenciaId:values.licenciaId,aplicacion,iat,nbf:iat,exp:Math.min(iat+WEEK,licencia_exp),licencia_exp};
 const bytes=encode(header)+'.'+encode(claims);return bytes+'.'+sign(null,Buffer.from(bytes),key).toString('base64url');
}
// Reference verifier for the handoff vectors. Native clients must implement secure time/storage separately.
export function validateOffline(token,keys,expected,now){
 if(typeof token!=='string'||token.length>8192)throw Error('Invalid JWS');
 const parts=token.split('.');if(parts.length!==3||parts.some(p=>!/^[A-Za-z0-9_-]+$/.test(p)))throw Error('Invalid JWS');
 const [h,p,s]=parts,header=JSON.parse(Buffer.from(h,'base64url')),claims=JSON.parse(Buffer.from(p,'base64url'));
 if(header.alg!=='Ed25519'||header.typ!=='gba-sepia-offline+jwt'||Object.keys(header).some(k=>!['alg','typ','kid'].includes(k)))throw Error('Invalid header');
 const key=keys.find(k=>k.kid===header.kid&&k.kty==='OKP'&&k.crv==='Ed25519'&&!k.d);
 if(!key||!verify(null,Buffer.from(h+'.'+p),createPublicKey({key,format:'jwk'}),Buffer.from(s,'base64url')))throw Error('Invalid signature');
 if(claims.iss!==ORIGIN||claims.producto!=='sepia'||claims.edicion!=='01'||claims.aud!==expected.aplicacion+'-desktop'||Object.entries(expected).some(([k,v])=>claims[k]!==v))throw Error('Invalid bindings');
 for(const k of ['iat','nbf','exp','licencia_exp'])if(!Number.isSafeInteger(claims[k]))throw Error('Invalid time');
 if(claims.iat!==claims.nbf||claims.exp<=claims.iat||claims.exp>claims.iat+WEEK||claims.exp>claims.licencia_exp||now<claims.nbf||now>=claims.exp)throw Error('Expired/invalid time');
 return claims;
}
