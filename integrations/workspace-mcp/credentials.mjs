import { spawn,execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run=promisify(execFile),service='software.gba.workspace.codex',account='editorial';
const quote=value=>'"'+String(value).replaceAll('\\','\\\\').replaceAll('"','\\"')+'"';
export async function credential(action,value){
 if(process.platform!=='darwin')throw Error('Esta primera entrega necesita el Llavero de macOS. No se guardarán credenciales en texto plano.');
 if(action==='read'){try{return (await run('/usr/bin/security',['find-generic-password','-s',service,'-a',account,'-w'])).stdout.trim();}catch{throw Error('Conecta tu GBA ID con workspace_connect antes de continuar.');}}
 if(action==='delete'){try{await run('/usr/bin/security',['delete-generic-password','-s',service,'-a',account]);}catch{}return;}
 if(!/^wsc_[a-f0-9]{64}$/.test(value))throw Error('Credencial inválida');
 // Feed interactive stdin: the secret never appears in process arguments.
 await new Promise((resolve,reject)=>{const child=spawn('/usr/bin/security',['-i'],{stdio:['pipe','ignore','pipe']});child.stderr.resume();child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('No pudimos guardar la conexión en el Llavero.')));child.stdin.end(`add-generic-password -U -s ${quote(service)} -a ${quote(account)} -w ${quote(value)}\nquit\n`);});
 if(await credential('read')!==value)throw Error('El Llavero no confirmó la conexión.');
}
