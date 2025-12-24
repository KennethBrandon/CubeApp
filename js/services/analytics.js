export const Analytics = {
    isInitialized: false,
    isProd: false,
    gaId: 'G-1L04D324RN', // Default to Dev
    PROD_ID: 'G-PBWS3T1BYZ',
    DEV_ID: 'G-1L04D324RN',

    init() {
        if (this.isInitialized) return;

        // Environment Detection
        // Check generic Capacitor presence (might be true on web if core is loaded)
        const hasCapacitor = window.Capacitor !== undefined;
        // Check if it's actually a native platform (Android/iOS)
        const isNative = hasCapacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();

        const prodDomains = ['kennethbrandon.github.io', 'cube.redkb.com'];
        const isProdDomain = prodDomains.includes(window.location.hostname);

        // Mobile heuristics (User Agent check as backup for some webviews)
        // const isMobileUA = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        // const isFileProtocol = window.location.protocol === 'file:' || window.location.protocol === 'capacitor:';

        // We treat it as production if:
        // 1. We are on a known production domain
        // 2. We are in a Native Capacitor environment (should exclude localhost web preview)
        // 3. Explicitly NOT localhost (unless native)

        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

        this.isProd = isProdDomain || isNative;

        // Force Dev if localhost and NOT native (safety)
        if (isLocalhost && !isNative) {
            this.isProd = false;
        }

        this.gaId = this.isProd ? this.PROD_ID : this.DEV_ID;

        // Ensure dataLayer exists
        window.dataLayer = window.dataLayer || [];

        // Inject script if missing (and if we are not in a strict environment that blocks it)
        this.loadTagManager();

        this.gtag('js', new Date());
        this.gtag('config', this.gaId, {
            'platform_type': isNative ? 'mobile_app' : 'web',
            'send_page_view': true,
            'debug_mode': !this.isProd // Enable GA debug mode in dev
        });

        console.log(`[Analytics] Initialized. Env: ${this.isProd ? 'PROD' : 'DEV'}, ID: ${this.gaId}, Platform: ${isNative ? 'Native Mobile' : 'Web'}`);
        this.isInitialized = true;
    },

    loadTagManager() {
        // Check if script is already there
        const existingScript = document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${this.gaId}"]`);
        if (existingScript) return;

        // If a different GTM script exists, try to update it or leave it be if it's the base one
        // Ideally, we want the specific ID loaded.
        const baseScript = document.querySelector('script[src*="googletagmanager.com/gtag/js"]');
        if (baseScript && !baseScript.src.includes(this.gaId)) {
            // If it's the wrong ID (e.g. dev ID in prod), swap it
            // console.log("[Analytics] Swapping GTM script source");
            baseScript.src = `https://www.googletagmanager.com/gtag/js?id=${this.gaId}`;
            return;
        }

        if (!baseScript) {
            const script = document.createElement('script');
            script.async = true;
            script.src = `https://www.googletagmanager.com/gtag/js?id=${this.gaId}`;
            document.head.appendChild(script);
        }
    },

    gtag() {
        if (window.dataLayer) {
            window.dataLayer.push(arguments);
        }
    },

    /**
     * Log a custom event
     * @param {string} eventName 
     * @param {Object} params 
     */
    logEvent(eventName, params = {}) {
        if (!this.isInitialized) this.init();

        // Add debug flag to GA event if in dev
        if (!this.isProd) {
            params.debug_mode = true;
        }

        this.gtag('event', eventName, params);

        // Log to console if not prod
        if (!this.isProd) {
            console.log(`[Analytics] Event: ${eventName}`, params);
        }
    },

    /**
     * Log a screen/page view
     * @param {string} viewName 
     */
    logView(viewName) {
        if (!this.isInitialized) this.init();
        this.gtag('event', 'screen_view', {
            'screen_name': viewName,
            'app_name': 'Cube Vault'
        });
    }
};
