import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createConfigHandler} from '../../../api/workspace-connector-config.js';
test('public connector configuration never exposes a service key even if the anon variable is misconfigured',()=>{for(const key of ['sb_secret_private',`e30.${Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')}.signature`]){const response={status(code){this.code=code;return this;},setHeader(){},json(body){this.body=body;}};createConfigHandler({SUPABASE_URL:'https://wgihpztgwsovhykboyru.supabase.co',SUPABASE_ANON_KEY:key})({method:'GET'},response);assert.equal(response.code,503);assert.equal(JSON.stringify(response.body).includes(key),false);}});
