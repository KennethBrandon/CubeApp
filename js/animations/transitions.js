import * as THREE from 'three';
import { state } from '../shared/state.js';

export function animateWrapperReset(duration = 500) {
    if (!state.cubeWrapper) return;

    state.isAnimating = true;
    const startQuat = state.cubeWrapper.quaternion.clone();
    const targetQuat = new THREE.Quaternion(); // Identity
    const startTime = Date.now();

    function loop() {
        const now = Date.now();
        let progress = (now - startTime) / duration;
        if (progress > 1) progress = 1;

        // Ease out cubic
        const ease = 1 - Math.pow(1 - progress, 3);

        state.cubeWrapper.quaternion.copy(startQuat).slerp(targetQuat, ease);

        if (progress < 1) {
            requestAnimationFrame(loop);
        } else {
            state.cubeWrapper.quaternion.set(0, 0, 0, 1);
            state.cubeWrapper.updateMatrixWorld(true);
            state.isAnimating = false;
        }
    }
    loop();
}

export function playCubeAnimation(reverse = false, onComplete = null, fade = true) {
    state.isAnimating = true;
    state.pivot.rotation.set(0, 0, 0);
    state.pivot.position.set(0, 0, 0);
    state.cubeWrapper.add(state.pivot); // Use cubeWrapper
    state.allCubies.forEach(c => state.pivot.attach(c));
    const spinDuration = 800; // Quick animation
    const spinRotations = 2 * Math.PI * 2; // 2 full rotations
    const jumpHeight = 2.5; // Height of jump
    const startTime = Date.now();

    function loop() {
        const now = Date.now();
        let progress = (now - startTime) / spinDuration;
        if (progress > 1) progress = 1;

        // If reverse, flip the progress
        const effectiveProgress = reverse ? (1 - progress) : progress;

        // Spin with ease
        const spinEase = effectiveProgress < 0.5 ? 2 * effectiveProgress * effectiveProgress : 1 - Math.pow(-2 * effectiveProgress + 2, 2) / 2;
        state.pivot.rotation.y = -spinRotations * spinEase;

        // Jump up with ease-out (decelerate as it reaches peak)
        const jumpEase = 1 - Math.pow(1 - effectiveProgress, 2);
        state.pivot.position.y = jumpHeight * jumpEase;

        // Opacity Animation
        if (fade) {
            let currentOpacity = 1.0;
            if (!reverse) {
                // Fading OUT (0 -> 1 progress)
                if (progress > 0.5) {
                    currentOpacity = 1.0 - (progress - 0.5) * 2.0;
                }
            } else {
                // Fading IN
                if (effectiveProgress > 0.5) {
                    currentOpacity = (1.0 - effectiveProgress) * 2.0;
                } else {
                    currentOpacity = 1.0;
                }
            }

            // Apply opacity
            state.allCubies.forEach(group => {
                group.children.forEach(mesh => {
                    if (mesh.material) {
                        if (mesh.userData.isSticker) {
                            mesh.material.uniforms.opacity.value = currentOpacity;
                        } else {
                            mesh.material.opacity = currentOpacity;
                        }
                    }
                });
            });
        }

        if (progress < 1) {
            requestAnimationFrame(loop);
        } else {
            // Reset pivot
            state.allCubies.forEach(c => state.cubeWrapper.attach(c)); // Attach back to cubeWrapper
            state.pivot.rotation.set(0, 0, 0);
            state.pivot.position.set(0, 0, 0);

            // Ensure full opacity at end
            state.allCubies.forEach(group => {
                group.children.forEach(mesh => {
                    if (mesh.material) {
                        if (mesh.userData.isSticker) {
                            mesh.material.uniforms.opacity.value = 1.0;
                        } else {
                            mesh.material.opacity = 1.0;
                        }
                    }
                });
            });

            state.isAnimating = false;
            if (onComplete) onComplete();
        }
    }
    loop();
}
