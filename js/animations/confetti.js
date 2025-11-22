import * as THREE from 'three';
import { state } from '../shared/state.js';
import { COLORS } from '../shared/constants.js';

export function triggerConfetti() {
    const confettiCount = 200;
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const velocities = [];
    const colors = [];

    for (let i = 0; i < confettiCount; i++) {
        positions.push(0, -2, 0);
        velocities.push(
            (Math.random() - 0.5) * 0.5,
            (Math.random() * 0.5) + 0.2,
            (Math.random() - 0.5) * 0.5
        );
        const color = new THREE.Color(COLORS[Math.floor(Math.random() * COLORS.length)]);
        colors.push(color.r, color.g, color.b);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: 0.3,
        vertexColors: true,
        transparent: true,
        opacity: 1.0
    });

    const particles = new THREE.Points(geometry, material);
    state.scene.add(particles);

    let frame = 0;
    function animateConfetti() {
        frame++;
        const positions = particles.geometry.attributes.position.array;
        for (let i = 0; i < confettiCount; i++) {
            positions[i * 3] += velocities[i * 3];
            positions[i * 3 + 1] += velocities[i * 3 + 1];
            positions[i * 3 + 2] += velocities[i * 3 + 2];

            velocities[i * 3 + 1] -= 0.01; // Gravity
            velocities[i * 3] *= 0.99; // Air resistance
            velocities[i * 3 + 2] *= 0.99;

            if (positions[i * 3 + 1] < -5) {
                velocities[i * 3 + 1] *= -0.5;
                positions[i * 3 + 1] = -5;
            }
        }
        particles.geometry.attributes.position.needsUpdate = true;

        if (frame < 300) {
            requestAnimationFrame(animateConfetti);
        } else {
            state.scene.remove(particles);
            geometry.dispose();
            material.dispose();
        }
    }
    animateConfetti();
}
