import * as THREE from 'three';
import { state } from '../shared/state.js';
import { CUBE_SIZE, SPACING } from '../shared/constants.js';
import { animateVictory } from '../animations/victory.js';
import { soundManager } from '../core/sound.js';

export function startInspection() {
    state.isGameActive = true;
    state.isInspection = true;
    state.inspectionTimeLeft = 15;
    state.lastInspectionBeep = 16; // Reset beep tracker
    state.inspectionStartTime = Date.now(); // Use real time

    const timerLabel = document.getElementById('timer-label');
    const timerDisplay = document.getElementById('timer');

    if (timerLabel) {
        timerLabel.textContent = "INSPECTION";
        timerLabel.className = "text-orange-400 text-[10px] uppercase tracking-wider leading-none mb-1 font-bold";
    }

    if (timerDisplay) {
        timerDisplay.className = "text-6xl sm:text-7xl font-mono text-orange-500 font-bold drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)] tracking-wider leading-none";
    }

    // Run interval frequently for smooth decimal updates
    state.inspectionInterval = setInterval(() => {
        const elapsed = (Date.now() - state.inspectionStartTime) / 1000;
        const remaining = Math.max(0, 15 - elapsed);
        state.inspectionTimeLeft = remaining;

        // Sound logic for countdown (check integer thresholds)
        // We use Ceil for display/logic to match standard inspection (15...14... etc)
        // But for beeps we want to trigger when we cross the integer boundary downwards
        const currentCeil = Math.ceil(remaining);

        // Logic: if we are at 3.00 -> that's "3". 
        // Beep at 3, 2, 1.
        // 3 starts at 3.00. 
        // Let's just use the integer part for the beep logic to be simple and robust
        // If we just crossed a boundary:

        if (remaining <= 3 && remaining > 0) {
            // Check if we crossed an integer boundary since last check? 
            // Actually, let's just track the last beeped integer.
            // If remaining is 2.9, and last beep was 4 (or 16), we beep for 3.
            // Wait, standard is: 
            // 3 seconds left -> Beep
            // 2 seconds left -> Beep
            // 1 second left -> Beep
            // 0 -> Go

            // If we use Math.ceil(remaining), 2.9 is 3. 
            // So if we are <= 3.0, we should have beeped for 3?
            // Let's say we beep when we ENTER the second.
            // 3.00 -> Enter 3rd second (meaning 3 seconds remaining).

            const secondsInt = Math.ceil(remaining);
            if (secondsInt <= 3 && secondsInt < state.lastInspectionBeep) {
                soundManager.playCountdownBeep(false);
                state.lastInspectionBeep = secondsInt;
            }
        } else if (remaining === 0) {
            if (state.lastInspectionBeep > 0) {
                soundManager.playCountdownBeep(true); // Final beep
                state.lastInspectionBeep = 0;
            }
        }

        if (remaining > 0) {
            if (timerDisplay) {
                // Format: 00:SS.ms (e.g. 00:14.23)
                const sec = Math.floor(remaining);
                const ms = Math.floor((remaining - sec) * 100);
                timerDisplay.textContent = `00:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
            }
        } else {
            startTimer();
        }
    }, 10); // Update every 10ms
}

function updateTimerDisplay() {
    const elapsed = Date.now() - state.startTime;
    state.finalTimeMs = elapsed; // Store for leaderboard
    const min = Math.floor(elapsed / 60000);
    const sec = Math.floor((elapsed % 60000) / 1000);
    const ms = Math.floor((elapsed % 1000) / 10);

    const timerDisplay = document.getElementById('timer');
    if (timerDisplay) {
        timerDisplay.textContent =
            `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }
}

export function startTimer() {
    if (state.timerRunning) return;
    if (state.isInspection) {
        clearInterval(state.inspectionInterval);
        state.isInspection = false;
    }
    state.timerRunning = true;
    state.startTime = Date.now();
    const timerLabel = document.getElementById('timer-label');
    const timerDisplay = document.getElementById('timer');
    if (timerLabel) {
        timerLabel.textContent = "SOLVING";
        timerLabel.className = "text-yellow-400 text-[10px] uppercase tracking-wider leading-none mb-1 font-bold";
    }
    if (timerDisplay) {
        timerDisplay.className = "text-6xl sm:text-7xl font-mono text-yellow-400 font-bold drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)] tracking-wider leading-none";
    }

    // Update immediately to show 00:00.00
    updateTimerDisplay();

    state.timerInterval = setInterval(() => {
        updateTimerDisplay();
    }, 10);
}

export function stopTimer() {
    state.timerRunning = false;
    clearInterval(state.timerInterval);
    clearInterval(state.inspectionInterval);

    // One final update to ensure we capture the exact end time
    if (state.startTime) {
        updateTimerDisplay();
    }
}

export function checkSolved() {
    // Never check during scrambling or auto-solving
    if (state.isScrambling || state.isAutoSolving) return;
    if (!state.activePuzzle) return;

    // Conditions required for a valid game win
    const isGameValid = state.isGameActive &&
        state.moveHistory.length > 0 &&
        !state.isInspection &&
        state.hasBeenScrambled;

    if (!isGameValid) return;

    const isSolved = state.activePuzzle.isSolved();

    if (isSolved) {
        console.log("🎉 Puzzle Solved! Victory!");
        stopTimer();
        state.isGameActive = false;
        animateVictory();
    }
}
