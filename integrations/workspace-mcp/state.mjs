import { mkdir,chmod,readFile,writeFile,rename,open,unlink,realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
export const home=process.env.WORKSPACE_CONNECTOR_HOME||path.join(homedir(),'Library','Application Support','GBA','Workspace Connector');
export async function initialize(dir=home){await mkdir(dir,{recursive:true,mode:0o700});await chmod(dir,0o700);return dir;}
export async function readState(name,dir=home){return JSON.parse(await readFile(path.join(dir,name),'utf8'));}
export async function saveState(name,value,dir=home){await initialize(dir);const target=path.join(dir,name);const tmp=`${target}.${process.pid}.tmp`;await writeFile(tmp,JSON.stringify(value,null,2),{mode:0o600});await rename(tmp,target);}
export async function lock(name,work,dir=home){await initialize(dir);const location=path.join(dir,`${name}.lock`);let handle;
 try{handle=await open(location,'wx',0o600);await handle.writeFile(String(process.pid));}
 catch(error){if(error.code!=='EEXIST')throw error;const pid=Number(await readFile(location,'utf8'));try{process.kill(pid,0);}catch(failure){if(failure.code==='ESRCH'){await unlink(location);return lock(name,work,dir);}}throw Error('Este lote ya está en ejecución. Espera a que termine.');}
 try{return await work();}finally{await handle.close();await unlink(location);}}
export async function confined(root,relative){const canonical=await realpath(root);const candidate=path.resolve(canonical,relative);const resolved=await realpath(candidate);const rel=path.relative(canonical,resolved);if(!rel||rel.startsWith(`..${path.sep}`)||rel==='..'||path.isAbsolute(rel))throw Error('El archivo debe estar dentro de la carpeta autorizada.');return resolved;}
