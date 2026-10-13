import { startLogin } from './login.mjs';
console.log((await startLogin()).url);
