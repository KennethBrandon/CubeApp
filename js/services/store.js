
import { state } from '../shared/state.js';
import { Analytics } from './analytics.js';

// Product IDs
export const PRODUCT_IDS = {
    WCA: 'com.redkb.cubevault.iap.wca',
    BIG: 'com.redkb.cubevault.iap.big',
    CUBOIDS: 'com.redkb.cubevault.iap.cuboids',
    MODS: 'com.redkb.cubevault.iap.mods'
};

class StoreService {
    constructor() {
        this.store = null;
        this.isReady = false;
        this.ownedProducts = new Set();

        // Load local persistence immediately
        this.loadPersistence();
    }

    loadPersistence() {
        try {
            const saved = localStorage.getItem('cubevault_owned_products');
            if (saved) {
                const list = JSON.parse(saved);
                list.forEach(id => this.ownedProducts.add(id));
            }
        } catch (e) {
            console.warn("Failed to load purchase persistence:", e);
        }
    }

    savePersistence() {
        try {
            localStorage.setItem('cubevault_owned_products', JSON.stringify([...this.ownedProducts]));
        } catch (e) {
            console.warn("Failed to save purchase persistence:", e);
        }
    }

    isWeb() {
        // Simple check if we are in a Cordova/Capacitor environment with the plugin loaded
        return !window.CdvPurchase;
    }

    async init() {
        if (this.isWeb()) {
            console.log("StoreService: Web environment detected. Mock mode enabled.");
            this.isReady = true;
            return;
        }

        try {
            this.store = window.CdvPurchase.store;

            // Register Products
            this.store.register([
                {
                    id: PRODUCT_IDS.WCA,
                    type: this.store.NON_CONSUMABLE,
                    platform: this.store.GOOGLE_PLAY_APP_STORE | this.store.APPLE_APP_STORE
                },
                {
                    id: PRODUCT_IDS.BIG,
                    type: this.store.NON_CONSUMABLE,
                    platform: this.store.GOOGLE_PLAY_APP_STORE | this.store.APPLE_APP_STORE
                },
                {
                    id: PRODUCT_IDS.CUBOIDS,
                    type: this.store.NON_CONSUMABLE,
                    platform: this.store.GOOGLE_PLAY_APP_STORE | this.store.APPLE_APP_STORE
                },
                {
                    id: PRODUCT_IDS.MODS,
                    type: this.store.NON_CONSUMABLE,
                    platform: this.store.GOOGLE_PLAY_APP_STORE | this.store.APPLE_APP_STORE
                }
            ]);

            // Setup Listeners
            this.store.when('product').approved(p => p.verify());
            this.store.when('product').verified(p => p.finish());
            this.store.when('product').finished(p => {
                console.log(`StoreService: Product ${p.id} purchased!`);
                this.ownedProducts.add(p.id);
                this.savePersistence();

                // Force UI update if needed (dispatch event)
                window.dispatchEvent(new CustomEvent('purchase-updated', { detail: { id: p.id } }));

                Analytics.logEvent('iap_purchase_complete', { product_id: p.id });
            });

            // Update local ownership on load
            this.store.when('product').updated(p => {
                if (p.owned) {
                    this.ownedProducts.add(p.id);
                    this.savePersistence();
                }
            });

            await this.store.initialize();
            this.isReady = true;
            console.log("StoreService: Initialized successfully.");

        } catch (e) {
            console.error("StoreService: Initialization failed", e);
        }
    }

    // Check ownership
    isOwned(productId) {
        // If web, everything is free? Or should we mock the locking?
        // User requested: Web should be free logic? 
        // Wait, User asked "How should the web only version of this work?" and I suggested "Web = Free".
        // BUT, for development (localhost), we want to test the LOCKS.
        // So: If localhost with ?mock=true, behave like mobile.
        // If regular web production, behave like free.

        // For now, let's make localhost behave like mobile so we can TEST.
        // We can add a flag later.

        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

        // If strictly web production (not local), unlock everything
        // if (this.isWeb() && !isLocal) return true; 

        // Actually, to test, we MUST enforce locks on localhost.

        return this.ownedProducts.has(productId);
    }

    async purchase(productId) {
        if (this.isWeb()) {
            // MOCK PURCHASE FLOW
            const confirm = window.confirm(`[MOCK STORE]\nDo you want to buy: ${productId}?\n(This is a fake transaction)`);
            if (confirm) {
                console.log(`Mock purchase of ${productId} successful.`);
                this.ownedProducts.add(productId);
                this.savePersistence();
                window.dispatchEvent(new CustomEvent('purchase-updated', { detail: { id: productId } }));
                Analytics.logEvent('iap_purchase_mock', { product_id: productId });
                return true;
            }
            return false;
        }

        if (!this.store) return false;

        const product = this.store.get(productId);
        if (product) {
            if (product.owned) {
                alert("You already own this!");
                this.ownedProducts.add(productId);
                this.savePersistence();
                return true;
            }

            this.store.order(productId);
        }
    }

    async restorePurchases() {
        if (this.isWeb()) {
            alert("[MOCK STORE]\nRestore Purchases triggered.\n(Nothing to restore in mock mode)");
            return;
        }

        if (this.store) {
            this.store.refresh();
            alert("Restoring purchases... if you own any items they will unlock shortly.");
        }
    }
}

export const storeService = new StoreService();
