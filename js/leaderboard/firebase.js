import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot } from 'firebase/firestore';
import { state } from '../shared/state.js';
import { renderLeaderboardUI, updateActivePuzzleTab, renderLeaderboardTabs } from '../ui/ui.js';
import { MirrorCube } from '../puzzles/MirrorCube.js';

// --- Firebase Setup ---
// We need to access the global config which is injected in index.html
// Since we are in a module, we can access window.__firebase_config
const firebaseConfig = JSON.parse(window.__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof window.__app_id !== 'undefined' ? window.__app_id : 'rubiks-cube';

// Auth Flow - Using Anonymous Authentication (no setup required)
export const initAuth = async () => {
    await signInAnonymously(auth);
};

onAuthStateChanged(auth, (user) => {
    state.currentUser = user;
    if (user) {
        fetchLeaderboard();
    }
});

const leaderboardData = [];

export function fetchLeaderboard(puzzleSize = null) {
    if (!state.currentUser) return;

    // Use provided puzzle size, or fall back to current cube size, or default to 3x3
    const targetPuzzle = puzzleSize || state.selectedLeaderboardPuzzle || state.cubeSize || 3;

    // Unsubscribe from previous leaderboard if exists
    if (state.leaderboardUnsubscribe) {
        state.leaderboardUnsubscribe();
        state.leaderboardUnsubscribe = null;
    }

    // Use original single collection with puzzleType filtering
    const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'leaderboard');

    state.leaderboardUnsubscribe = onSnapshot(colRef, (snapshot) => {
        const rawData = [];
        const allTypes = new Set();

        snapshot.forEach(doc => {
            const data = { id: doc.id, ...doc.data() };

            // Collect type
            const pType = data.puzzleType || '3x3'; // Default to 3x3
            allTypes.add(pType);

            // Filter by puzzle type
            const puzzleStr = typeof targetPuzzle === 'string' ? targetPuzzle : `${targetPuzzle}x${targetPuzzle}`;
            // Handle legacy 3x3 vs 3
            // If target is "3", match "3x3" or "3x3x3"?
            // data.puzzleType is likely "3x3x3" for new ones, "3x3" for old?
            // Let's normalize comparison

            // Actually, let's just use exact match for now, assuming submitScore is consistent.
            // But wait, submitScore uses: `${puzzleSize}x${puzzleSize}` for cubic.
            // If puzzleSize is 3, type is "3x3".

            if (pType === puzzleStr) {
                rawData.push(data);
            }

            // Also match "3" with "3x3" if needed?
            if (puzzleStr === '3' && pType === '3x3') rawData.push(data);
            if (puzzleStr === '3x3' && pType === '3') rawData.push(data);
        });

        // Render Tabs
        renderLeaderboardTabs(Array.from(allTypes), targetPuzzle);

        rawData.sort((a, b) => a.timeMs - b.timeMs);

        leaderboardData.length = 0;
        leaderboardData.push(...rawData.slice(0, 20));

        if (!document.getElementById('leaderboard-modal').classList.contains('hidden')) {
            renderLeaderboardUI(leaderboardData, targetPuzzle);
        }
    }, (error) => {
        console.error("Leaderboard snapshot error:", error);
    });
}

export async function submitScore(name, timeMs, timeString, scramble, solution) {
    if (!state.currentUser || !name) return;

    // Determine puzzle type for this score
    let puzzleSize;
    if (state.cubeDimensions.x === state.cubeDimensions.y && state.cubeDimensions.y === state.cubeDimensions.z) {
        puzzleSize = state.cubeSize;
    } else {
        // Sort dimensions descending for consistency (e.g. 3x2x1)
        const dims = [state.cubeDimensions.x, state.cubeDimensions.y, state.cubeDimensions.z].sort((a, b) => b - a);
        puzzleSize = `${dims[0]}x${dims[1]}x${dims[2]}`;
    }

    let puzzleType = typeof puzzleSize === 'string' ? puzzleSize : `${puzzleSize}x${puzzleSize}`;

    if (state.activePuzzle instanceof MirrorCube) {
        // Ensure we use the full dimensions string for mirror cubes (e.g. mirror-3x3x3)
        // If puzzleType is just "3x3", convert to "3x3x3" first
        if (puzzleType.indexOf('x') === -1) {
            puzzleType = `${puzzleType}x${puzzleType}x${puzzleType}`;
        } else if (puzzleType.split('x').length === 2) {
            // Handle 2x2 case which might come as "2x2" -> "2x2x2"
            // Actually line 84 in original code was `${puzzleSize}x${puzzleSize}` which is 2x2.
            // We want 3 dims for mirror.
            const parts = puzzleType.split('x');
            puzzleType = `${parts[0]}x${parts[1]}x${parts[0]}`; // Assuming cubic if 2 dims?
            // Wait, the logic above:
            // if cubic -> puzzleSize = state.cubeSize (e.g. 3)
            // else -> puzzleSize = "3x2x1"

            // So if cubic, puzzleType becomes "3x3".
            // We want "3x3x3" for mirror prefix consistency.
            const s = state.cubeSize;
            puzzleType = `${s}x${s}x${s}`;
        }

        // Re-evaluate puzzleType for cubic mirror to be safe
        if (state.cubeDimensions.x === state.cubeDimensions.y && state.cubeDimensions.y === state.cubeDimensions.z) {
            const s = state.cubeSize;
            puzzleType = `${s}x${s}x${s}`;
        }

        puzzleType = `mirror-${puzzleType}`;
    }

    // Use original single collection
    const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'leaderboard');

    try {
        await addDoc(colRef, {
            name: name.substring(0, 15),
            timeMs: timeMs,
            timeString: timeString,
            scramble: scramble,
            solution: solution,
            puzzleType: puzzleType,
            date: new Date().toISOString(),
            userId: state.currentUser.uid
        });

        document.getElementById('solved-modal').classList.add('hidden');
        state.selectedLeaderboardPuzzle = puzzleSize;
        fetchLeaderboard(puzzleSize);
        updateActivePuzzleTab(puzzleSize);
        document.getElementById('leaderboard-modal').classList.remove('hidden');
    } catch (e) {
        console.error("Error adding score: ", e);
        alert("Failed to submit score. Try again.");
    }
}

export { leaderboardData };
