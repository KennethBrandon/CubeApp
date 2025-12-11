import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot } from 'firebase/firestore';
import { state } from '../shared/state.js';
import { renderLeaderboardUI, updateActivePuzzleTab } from '../ui/ui.js';
import { MirrorCube } from '../puzzles/MirrorCube.js';
import { Molecube } from '../puzzles/Molecube.js';
import { VoidCube } from '../puzzles/VoidCube.js';
import { AcornsMod } from '../puzzles/AcornsMod.js';
import { TheChildMod } from '../puzzles/TheChildMod.js';
import { StlPuzzleMod } from '../puzzles/StlPuzzleMod.js';

// --- Firebase Setup ---
// We need to access the global config which is injected in index.html
// Since we are in a module, we can access window.__firebase_config
const firebaseConfig = JSON.parse(window.__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof window.__app_id !== 'undefined' ? window.__app_id : 'cube-app';

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
            state.availablePuzzleTypes.add(pType);

            // Filter by puzzle type
            // Normalize target puzzle for comparison
            // We want to match:
            // 1. Exact match
            // 2. Legacy "NxN" vs "NxNxN"
            // 3. Permutations (e.g. "3x2x2" vs "2x2x3")

            const targetStr = String(targetPuzzle);
            const targetIsMirror = targetStr.startsWith('mirror-');
            const targetBase = targetStr.replace('mirror-', '');

            // Helper to get sorted dims string
            const getSortedDims = (str) => {
                if (!str) return "";
                const s = String(str).trim();
                const parts = s.split('x');

                // Handle single number "3" -> "3x3x3"
                if (parts.length === 1) {
                    if (parts[0].match(/^\d+$/)) return `${parts[0]}x${parts[0]}x${parts[0]}`;
                    return s;
                }

                // Handle "3x3" -> "3x3x3"
                if (parts.length === 2 && parts[0] === parts[1]) {
                    return `${parts[0]}x${parts[0]}x${parts[0]}`;
                }

                // Handle 3 dims - Sort numerically if possible
                if (parts.length === 3) {
                    // Check if all are numbers
                    if (parts.every(p => p.match(/^\d+$/))) {
                        return parts.sort((a, b) => parseInt(b) - parseInt(a)).join('x');
                    }
                    // Fallback to string sort for non-numbers
                    return parts.sort().join('x');
                }
                return s;
            };

            const targetSorted = getSortedDims(targetBase);

            // Check if this doc matches
            const pTypeStr = String(pType);
            const pTypeIsMirror = pTypeStr.startsWith('mirror-');

            if (targetIsMirror !== pTypeIsMirror) return; // Must match mirror status

            const pTypeBase = pTypeStr.replace('mirror-', '');
            const pTypeSorted = getSortedDims(pTypeBase);

            // Debug logging for troubleshooting (temporary)
            // if (targetSorted.includes('2x2') && pTypeSorted.includes('2x2')) {
            //    console.log(`[LB Match] Target: ${targetStr} (${targetSorted}) vs Record: ${pTypeStr} (${pTypeSorted}) -> Match: ${targetSorted === pTypeSorted}`);
            // }

            if (targetSorted === pTypeSorted) {
                rawData.push(data);
            }
        });

        // Render Tabs (Removed)
        // renderLeaderboardTabs(Array.from(allTypes), targetPuzzle);

        rawData.sort((a, b) => a.timeMs - b.timeMs);

        leaderboardData.length = 0;
        leaderboardData.push(...rawData.slice(0, 20));

        const lbModal = document.getElementById('leaderboard-modal');
        if (lbModal && !lbModal.classList.contains('hidden')) {
            renderLeaderboardUI(leaderboardData, targetPuzzle);
        }
    }, (error) => {
        console.error("Leaderboard snapshot error:", error);
    });
}

export async function submitScore(name, timeMs, timeString, scramble, solution) {
    if (!state.currentUser || !name) return null;

    // Determine puzzle type for this score
    let puzzleType;

    // Check for special puzzle types first
    if (state.activePuzzle instanceof Molecube) {
        puzzleType = 'molecube';
    } else if (state.activePuzzle instanceof VoidCube) {
        puzzleType = 'voidcube';
    } else if (state.activePuzzle instanceof AcornsMod) {
        puzzleType = 'acorns';
    } else if (state.activePuzzle instanceof TheChildMod) {
        puzzleType = 'thechild';
    } else if (state.activePuzzle instanceof TheChildMod) {
        puzzleType = 'thechild';
    } else if (state.activePuzzle instanceof StlPuzzleMod) {
        // Use the ID from the mod (e.g. "baby_yoda")
        puzzleType = state.activePuzzle.puzzleId;
    } else {
        // Standard dimensional logic
        let puzzleSize;
        if (state.cubeDimensions.x === state.cubeDimensions.y && state.cubeDimensions.y === state.cubeDimensions.z) {
            // Standard Cubic
            const s = state.cubeSize;
            puzzleSize = `${s}x${s}x${s}`;
        } else {
            // Cuboid - Sort dimensions descending for consistency (e.g. 3x2x2)
            // This ensures 2x2x3 and 3x2x2 are saved identically
            const dims = [state.cubeDimensions.x, state.cubeDimensions.y, state.cubeDimensions.z].sort((a, b) => b - a);
            puzzleSize = `${dims[0]}x${dims[1]}x${dims[2]}`;
        }

        puzzleType = puzzleSize;

        if (state.activePuzzle instanceof MirrorCube) {
            puzzleType = `mirror-${puzzleType}`;
        }
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

        state.selectedLeaderboardPuzzle = puzzleType;
        return puzzleType;
    } catch (e) {
        console.error("Error adding score: ", e);
        alert("Failed to submit score. Try again.");
        return null;
    }
}

export async function getPotentialRank(puzzleType, timeMs) {
    if (!state.currentUser) {
        console.log("getPotentialRank: No user logged in");
        return null;
    }

    console.log(`getPotentialRank: Checking rank for type=${puzzleType}, time=${timeMs}`);

    const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'leaderboard');

    try {
        // Querying with multiple where clauses (puzzleType == X AND timeMs < Y) requires a composite index in Firestore.
        // To avoid forcing the user to create an index, we will fetch all scores for this puzzle type
        // and filter client-side. This is safe as long as the leaderboard size per puzzle is reasonable (< a few thousand).

        const { query, where, getDocs } = await import('firebase/firestore');

        const q = query(
            colRef,
            where("puzzleType", "==", puzzleType)
        );

        console.log("getPotentialRank: Fetching docs...");
        const snapshot = await getDocs(q);
        console.log(`getPotentialRank: Fetched ${snapshot.size} docs for puzzleType ${puzzleType}`);

        // Count how many are strictly faster (lower timeMs)
        let betterScoresCount = 0;
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.timeMs < timeMs) {
                betterScoresCount++;
            }
        });

        console.log(`getPotentialRank: Found ${betterScoresCount} better scores. Rank = ${betterScoresCount + 1}`);

        return betterScoresCount + 1;

    } catch (e) {
        console.error("Error calculating rank:", e);
        return null; // UI handles null as "Unknown" or similar, but previously "Rank 1". We should fix UI too.
    }
}

export { leaderboardData };
