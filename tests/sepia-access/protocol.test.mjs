import assert from 'node:assert/strict';
import {generateKeyPairSync,createPublicKey,verify} from 'node:crypto';
import {CONTRACT,validateRequest,normalizeLicense,signOffline,validateOffline,hashSecret} from '../../server/sepia/protocol.mjs';
const input={contrato:CONTRACT,revision:2,op:'session.create',datos:{aplicacion:'ultramar',versionApp:'0.1.0',nombreDispositivo:'Mac de prueba',dispositivoId:'00000000-0000-4000-8000-000000000001'}};
assert.equal(validateRequest(input).op,'session.create');
for(const bad of [{...input,rol:'Dueño'},{...input,revision:1},{...input,revision:undefined},{...input,op:'pairing.start'},{...input,contrato:'otra'},{...input,datos:{...input.datos,user_id:'otro'}},{...input,datos:{...input.datos,aplicacion:'other'}},{...input,datos:{...input.datos,nombreDispositivo:'x'.repeat(81)}}])assert.throws(()=>validateRequest(bad));
assert.equal(normalizeLicense('abcd-efgh ijkl-mnop-qrst-uvwx-yz23-4567'),'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567');
assert.throws(()=>normalizeLicense('A'.repeat(48)));assert.throws(()=>normalizeLicense('ß'+'A'.repeat(30)));
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const kid='synthetic-key'; const jwk={...publicKey.export({format:'jwk'}),kid,alg:'Ed25519',use:'sig'};
const bindings={sub:input.datos.dispositivoId,conexionId:'00000000-0000-4000-8000-000000000002',dispositivoId:input.datos.dispositivoId,licenciaId:'00000000-0000-4000-8000-000000000003',aplicacion:'ultramar'};
const now=1793662400;
for(const seconds of [86400,604800,1209600]){
 const token=signOffline({...bindings,licencia_exp:now+seconds,iat:now},privateKey,kid);
 const claims=validateOffline(token,[jwk],bindings,now);
 assert.equal(claims.exp,now+Math.min(seconds,604800));
 const [head,payload,sig]=token.split('.');
 assert.equal(JSON.parse(Buffer.from(head,'base64url')).alg,'Ed25519');
 assert.equal(verify(null,Buffer.from(head+'.'+payload),createPublicKey({key:jwk,format:'jwk'}),Buffer.from(sig,'base64url')),true);
 assert.throws(()=>validateOffline(token,[jwk],bindings,claims.exp));
 assert.throws(()=>validateOffline(token,[jwk],{...bindings,aplicacion:'workspace'},now));
 assert.throws(()=>validateOffline(token,[],bindings,now));
 const changed=Buffer.from(JSON.stringify({...claims,exp:now+9999999})).toString('base64url');
 assert.throws(()=>validateOffline(head+'.'+changed+'.'+sig,[jwk],bindings,now));
}
assert.equal(hashSecret('test').length,64);
console.log('PASS: strict protocol, product boundaries, Ed25519 signatures, bindings and exact seven-day limit.');
