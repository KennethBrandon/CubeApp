import { registerPlugin } from '@capacitor/core';
const Network = registerPlugin('Network', {
    web: () => import('./web.js').then(m => new m.NetworkWeb()),
});
export * from './definitions.js';
export { Network };
//# sourceMappingURL=index.js.map