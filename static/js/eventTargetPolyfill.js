'use strict';

const EventTargetPolyfill = (() => {
  try {
    new class extends EventTarget { constructor() { super(); } }();
    return EventTarget;
  } catch (err) {
    // Crude, but works well enough.
    return class {
      constructor() {
        const delegate = document.createDocumentFragment();
        for (const fn of ['addEventListener', 'dispatchEvent', 'removeEventListener']) {
          this[fn] = (...args) => delegate[fn](...args);
        }
      }
    };
  }
})();

module.exports = EventTargetPolyfill;
