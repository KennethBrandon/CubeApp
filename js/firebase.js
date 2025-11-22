import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot } from 'firebase/firestore';
import { state } from './state.js';
import { renderLeaderboardUI } from './ui.js';

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
        snapshot.forEach(doc => {
            const data = { id: doc.id, ...doc.data() };
            // Filter by puzzle type
            const puzzleStr = typeof targetPuzzle === 'string' ? targetPuzzle : `${targetPuzzle}x${targetPuzzle}`;
            const dataPuzzle = data.puzzleType || '3x3'; // Default to 3x3 for old entries
            if (dataPuzzle === puzzleStr) {
                rawData.push(data);
            }
        });

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
    const puzzleSize = state.cubeDimensions.x === state.cubeDimensions.y && state.cubeDimensions.y === state.cubeDimensions.z
        ? state.cubeSize
        : `${state.cubeDimensions.x}x${state.cubeDimensions.y}x${state.cubeDimensions.z}`;

    const puzzleType = typeof puzzleSize === 'string' ? puzzleSize : `${puzzleSize}x${puzzleSize}`;

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
        document.getElementById('leaderboard-modal').classList.remove('hidden');
    } catch (e) {
        console.error("Error adding score: ", e);
        alert("Failed to submit score. Try again.");
    }
}

export { leaderboardData };
