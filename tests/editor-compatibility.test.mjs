import assert from 'node:assert/strict';
const descriptors = { at: Object.getOwnPropertyDescriptor(Array.prototype, 'at'), findLast: Object.getOwnPropertyDescriptor(Array.prototype, 'findLast') };
try {
  delete Array.prototype.at; delete Array.prototype.findLast;
  await import('../src/workspace/editorCompatibility.js');
  assert.equal([1, 2, 3].at(-1), 3);
  assert.equal([1].at(-2), undefined);
  assert.equal([1].at(Infinity), undefined);
  assert.equal([1, 2, 3, 4].findLast(value => value % 2 === 0), 4);
  const visited = []; [, 1].findLast((value, index) => { visited.push([index, value]); return false; });
  assert.deepEqual(visited, [[1, 1], [0, undefined]]);
  assert.equal(Array.prototype.findLast.call({ 0: 'a', 1: 'b', length: 2 }, value => value === 'a'), 'a');
  assert.throws(() => Array.prototype.at.call(null), TypeError);
  assert.throws(() => [].findLast(null), TypeError);
  console.log('PASS: 8 Safari 14 editor compatibility checks with native methods removed.');
} finally { for (const [name, descriptor] of Object.entries(descriptors)) if (descriptor) Object.defineProperty(Array.prototype, name, descriptor); else delete Array.prototype[name]; }
