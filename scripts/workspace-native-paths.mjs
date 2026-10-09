import path from 'node:path';
import { execFileSync } from 'node:child_process';

export function nativePaths(platform, target, config, readExecutable = app =>
  execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleExecutable', path.join(app, 'Contents/Info.plist')], { encoding: 'utf8' }).trim()) {
  if (!['macos', 'windows'].includes(platform) || !/^[a-z0-9_-]+$/.test(target || '')) throw Error('Invalid native platform/target');
  const release = path.join('src-tauri/target', target, 'release');
  if (platform === 'windows') return { release, executable: path.join(release, 'gba-workspace.exe') };
  const app = path.join(release, 'bundle/macos', `${config.productName}.app`);
  const name = readExecutable(app);
  if (!name || name === '.' || name === '..' || /[/\\\0]/.test(name)) throw Error('Invalid macOS bundle executable');
  return { release, app, executable: path.join(app, 'Contents/MacOS', name) };
}
