import { Network } from '@capacitor/network';
import { state } from '../shared/state.js';

export async function initNetworkMonitoring() {
    try {
        const status = await Network.getStatus();
        state.isNetworkOnline = status.connected;

        Network.addListener('networkStatusChange', status => {
            state.isNetworkOnline = status.connected;
            // Dispatch window event for UI updates
            window.dispatchEvent(new Event('network-status-change'));
        });
    } catch (e) {
        console.warn("Network plugin not available, falling back to navigator.onLine", e);
        // Fallback for web/desktop if plugin fails or not present
        state.isNetworkOnline = navigator.onLine;
        window.addEventListener('online', () => {
            state.isNetworkOnline = true;
            window.dispatchEvent(new Event('network-status-change'));
        });
        window.addEventListener('offline', () => {
            state.isNetworkOnline = false;
            window.dispatchEvent(new Event('network-status-change'));
        });
    }
}

export function isOnline() {
    // Use our state which is updated by listeners
    return state.isNetworkOnline && !state.isSimulatedOffline;
}
