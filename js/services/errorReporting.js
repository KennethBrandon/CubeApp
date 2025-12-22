import { Analytics } from './analytics.js';

export const ErrorReporting = {
    isInitialized: false,

    init() {
        if (this.isInitialized) return;

        // Global uncaught exceptions
        window.onerror = (message, source, lineno, colno, error) => {
            this.report(error || message, {
                type: 'uncaught_exception',
                source,
                lineno,
                colno
            });
            // Return false to let default handler run (print to console)
            return false;
        };

        // Unhandled promise rejections
        window.onunhandledrejection = (event) => {
            this.report(event.reason, {
                type: 'unhandled_rejection'
            });
        };

        this.isInitialized = true;
        console.log('[ErrorReporting] Initialized');
    },

    /**
     * Report an error to analytics
     * @param {Error|string} error 
     * @param {Object} context 
     */
    report(error, context = {}) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : null;

        console.error('[ErrorReporting] Captured:', errorMsg, context);

        Analytics.logEvent('exception', {
            description: errorMsg,
            fatal: context.fatal || false,
            stack: errorStack ? errorStack.substring(0, 500) : undefined, // Truncate stack
            ...context
        });
    }
};
