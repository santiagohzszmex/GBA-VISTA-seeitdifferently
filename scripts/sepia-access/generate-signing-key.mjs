// Operator utility. No key is created during build, startup or tests. Never pass a key as an argument.
import {generateKeyPairSync} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
const destination=process.argv[2],kid=process.argv[3];
const root=path.resolve(new URL('../../',import.meta.url).pathname);
if(!destination||!path.isAbsolute(destination)||path.resolve(destination).startsWith(root+'/')||!/^[a-zA-Z0-9._-]{1,80}$/.test(kid||''))throw Error('Uso: node scripts/sepia-access/generate-signing-key.mjs /ruta/privada/fuera-del-repo.json kid-del-entorno');
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const privateJwk=privateKey.export({format:'jwk'}),publicJwk={...publicKey.export({format:'jwk'}),kid,alg:'Ed25519',use:'sig'};
fs.writeFileSync(destination,JSON.stringify({SEPIA_OFFLINE_KID:kid,SEPIA_OFFLINE_PRIVATE_JWK:JSON.stringify(privateJwk),SEPIA_OFFLINE_PUBLIC_JWKS:JSON.stringify({keys:[publicJwk]})},null,2),{mode:0o600,flag:'wx'});
console.log('Archivo privado creado fuera del repositorio. No se mostró ninguna clave ni se configuró ningún servidor.');
