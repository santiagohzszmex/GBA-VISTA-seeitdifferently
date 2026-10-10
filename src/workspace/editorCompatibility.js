// Tiptap uses findLast for focus transactions; the desktop target includes Safari 14.
if (!Array.prototype.findLast) {
  Object.defineProperty(Array.prototype, 'findLast', {
    configurable: true, writable: true,
    value: function findLast(predicate, thisArg) {
      if (this == null) throw new TypeError('findLast requires an array-like value');
      if (typeof predicate !== 'function') throw new TypeError('findLast requires a predicate');
      const object = Object(this);
      const length = Math.min(Math.max(Math.trunc(Number(object.length)) || 0, 0), Number.MAX_SAFE_INTEGER);
      for (let index = length - 1; index >= 0; index--) if (predicate.call(thisArg, object[index], index, object)) return object[index];
      return undefined;
    }
  });
}
if (!Array.prototype.at) {
  Object.defineProperty(Array.prototype, 'at', {
    configurable: true, writable: true,
    value: function at(index) {
      if (this == null) throw new TypeError('at requires an array-like value');
      const object = Object(this);
      const length = Math.min(Math.max(Math.trunc(Number(object.length)) || 0, 0), Number.MAX_SAFE_INTEGER);
      let position = Math.trunc(Number(index)) || 0;
      if (position < 0) position += length;
      return position < 0 || position >= length ? undefined : object[position];
    }
  });
}
