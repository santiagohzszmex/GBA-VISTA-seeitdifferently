import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

export function nativeBuildArgs(input, host = process.platform) {
  const args = [...input];
  const targetIndex = args.indexOf('--target');
  const target = targetIndex >= 0 ? args[targetIndex + 1] : '';
  const macos = target ? target.endsWith('-apple-darwin') : host === 'darwin';
  const index = args.indexOf('--bundles');
  if (macos && index >= 0 && args[index + 1]) {
    const bundles = args[index + 1].split(',');
    if (bundles.includes('dmg') && !bundles.includes('app')) args[index + 1] = ['app', ...bundles].join(',');
  }
  return ['build', ...args];
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = spawnSync(process.execPath, [path.resolve('node_modules/@tauri-apps/cli/tauri.js'), ...nativeBuildArgs(process.argv.slice(2))], { stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}
