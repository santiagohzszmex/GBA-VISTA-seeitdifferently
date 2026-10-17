import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const root=path.resolve('scripts/lapis-phase4/test-client'),fixtureRoot=process.env.LAPIS_FIXTURE_DIR||'/private/tmp/workspace-lapis-phase3-fixtures';
export default defineConfig({root,base:'./',envDir:false,plugins:[react(),{name:'isolated-synthetic-files',generateBundle(){const bytes=fs.readFileSync(path.join(fixtureRoot,'original.png'));this.emitFile({type:'asset',fileName:'__lapis/original.png',source:bytes});this.emitFile({type:'asset',fileName:'__lapis/manifest.json',source:JSON.stringify({policy:{png_max_bytes:18874368,layered_max_bytes:262144000,max_pixels:40000000,max_dimension:32768,part_bytes:8388608,session_hours:24,signed_url_seconds:300},asset:{size_bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),width:4000,height:5000}})});}}],resolve:{alias:[{find:/.*supabaseClient$/,replacement:path.join(root,'isolated.js')},{find:/.*context\/AuthContext$/,replacement:path.join(root,'isolated.js')}]},define:{'import.meta.env.DEV':true,'import.meta.env.VITE_GBA_ID_API_URL':JSON.stringify('https://blocked.invalid')},build:{outDir:path.resolve('workspace-lapis-test-dist'),emptyOutDir:true,target:'safari14'}});
