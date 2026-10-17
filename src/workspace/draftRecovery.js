const PREFIX = 'gba-workspace-opal-draft:';
export const recoveryKey = (actorId, taskId) => `${PREFIX}${actorId}:${taskId}`;
export function readRecovery(actorId, taskId, storage = localStorage, now = Date.now()) {
  try { const value = JSON.parse(storage.getItem(recoveryKey(actorId,taskId)) || 'null'); return value?.actorId === actorId && value.taskId === taskId && now - value.updatedAt < 86_400_000 && (value.payload?.content_document || value.payload?.image===true && value.payload.note_document?.type==='doc') ? value : null; } catch { return null; }
}
export function writeRecovery(actorId, taskId, payload, revision, baseVersion, storage = localStorage) {
  storage.setItem(recoveryKey(actorId,taskId),JSON.stringify({actorId,taskId,payload,revision,baseVersion,updatedAt:Date.now()}));
}
export function clearRecovery(actorId, taskId, storage = localStorage) { storage.removeItem(recoveryKey(actorId,taskId)); }
