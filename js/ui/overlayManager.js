
export class OverlayManager {
    constructor() {
        this.stack = [];
        this.isNavigating = false;

        // Bind popstate event
        window.addEventListener('popstate', (event) => this.handlePopState(event));
    }

    /**
     * Opens an overlay (modal).
     * @param {string} id - The DOM ID of the overlay element.
     * @param {Function} onClose - Optional callback to run when the overlay closes.
     */
    open(id, onClose = null) {
        const element = document.getElementById(id);
        if (!element) {
            console.error(`OverlayManager: Element with id '${id}' not found.`);
            return;
        }

        // Check if already open at the top to prevent duplicates
        if (this.stack.length > 0 && this.stack[this.stack.length - 1].id === id) {
            return;
        }

        // Push state to history
        history.pushState({ overlayId: id }, '', '');

        // Add to stack
        this.stack.push({ id, element, onClose });

        // Show element
        element.classList.remove('hidden');

        // Handle specific animation classes if needed (e.g., opacity for fade-in)
        // For now, we assume the CSS handles transitions or the calling code handles specific class toggles.
        // But looking at existing code, 'solved-modal' uses opacity-0.
        // We might need a more generic way, or let the caller handle the visual opening?
        // To keep it simple and compatible with existing logic, we'll just remove 'hidden'.
        // The calling code might need to handle fade-ins *after* calling open, or we standardise it here.
        // Let's stick to just removing 'hidden' for now, as some modals might have specific flex/block needs.

        // Special handling for fade-in modals (like solved-modal)
        if (element.classList.contains('opacity-0')) {
            // Force reflow
            void element.offsetWidth;
            element.classList.remove('opacity-0');
        }
    }

    /**
     * Closes the top-most overlay.
     * Can be called manually (e.g., close button click).
     */
    close() {
        if (this.stack.length === 0) return;

        // If we are here, it means we want to close the modal.
        // If this was triggered by a back button, handlePopState would be called instead.
        // So if we call close() manually, we should also go back in history to keep it in sync.

        if (!this.isNavigating) {
            history.back();
        }
    }

    /**
     * Handles the browser back button (popstate).
     */
    handlePopState(event) {
        if (this.stack.length === 0) return;

        this.isNavigating = true;

        // The state has already been popped by the browser.
        // We just need to hide the UI element that was at the top of our stack.
        const top = this.stack.pop();

        if (top) {
            this.hideElement(top.element);
            if (top.onClose) top.onClose();
        }

        this.isNavigating = false;
    }

    hideElement(element) {
        // Special handling for fade-out
        if (element.id === 'solved-modal' || element.id === 'puzzle-selector-modal') {
            element.classList.add('opacity-0');
            setTimeout(() => {
                element.classList.add('hidden');
            }, 300); // 300ms matches typical transition duration
        } else {
            element.classList.add('hidden');
        }
    }
}

export const overlayManager = new OverlayManager();
