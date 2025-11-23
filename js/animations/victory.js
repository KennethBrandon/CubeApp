import { state } from '../shared/state.js';
import { triggerConfetti } from './confetti.js';
import { showWinModal } from '../ui/ui.js';
import { performMove } from '../game/moves.js';
import { soundManager } from '../core/sound.js';

export function animateVictory() {
    soundManager.playVictorySound();
    triggerConfetti();
    playSolveAnimation(() => {
        setTimeout(() => {
            showWinModal();
        }, 500);
    });
}

export function playSolveAnimation(onComplete = null) {
    // Reset pivot
    state.pivot.rotation.set(0, 0, 0);
    state.pivot.position.set(0, 0, 0);
    state.scene.add(state.pivot);

    // Attach all cubies to pivot
    state.allCubies.forEach(c => state.pivot.attach(c));

    let startTime = Date.now();
    const duration = 2000; // 2 seconds spin
    const startRot = state.pivot.rotation.y;
    const targetRot = startRot + Math.PI * 4; // 2 full spins

    // Jump effect
    const startY = state.pivot.position.y;
    const jumpHeight = 2;

    state.isAnimating = true;

    function loop() {
        const now = Date.now();
        let progress = (now - startTime) / duration;
        if (progress > 1) progress = 1;

        const ease = 1 - Math.pow(1 - progress, 3); // Cubic out

        // Spin
        state.pivot.rotation.y = startRot + (targetRot - startRot) * ease;

        // Jump (Parabolic)
        // y = 4 * h * x * (1-x)
        state.pivot.position.y = startY + 4 * jumpHeight * progress * (1 - progress);

        if (progress < 1) {
            requestAnimationFrame(loop);
        } else {
            // Detach and reset
            state.pivot.updateMatrixWorld();
            const cubies = state.pivot.children.slice();
            cubies.forEach(c => state.scene.attach(c));

            state.pivot.rotation.set(0, 0, 0);
            state.pivot.position.set(0, 0, 0);

            state.isAnimating = false;
            if (onComplete) onComplete();
        }
    }
    loop();
}
