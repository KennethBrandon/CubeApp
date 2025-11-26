export const CUBE_SIZE = 1;
export const SPACING = 0.02; // Gap between cubies
export const ANIMATION_SPEED = 140; // ms per turn
export const SCRAMBLE_MOVES = 25;
export const SCRAMBLE_SPEED = 50;
export const SNAP_SPEED = 200;

// Colors (Right, Left, Top, Bottom, Front, Back)
export const COLORS = [
    0xb90000, // Right (Red)
    0xff5900, // Left (Orange)
    0xffffff, // Top (White)
    0xffd500, // Bottom (Yellow)
    0x009b48, // Front (Green)
    0x0045ad  // Back (Blue)
];
export const CORE_COLOR = 0x111111;
export const STICKER_BORDER_RADIUS = 0.15;

// Shaders
export const stickerVertexShader = `
    varying vec3 vNormal;
    varying vec2 vUv;
    void main() {
        vNormal = normal;
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

export const stickerFragmentShader = `
    uniform vec3 color;
    uniform float borderRadius;
    uniform float opacity;
    varying vec2 vUv;

    void main() {
        vec2 uv = vUv - 0.5;
        float rx = abs(uv.x);
        float ry = abs(uv.y);
        float maxSize = 0.5;
        vec2 d = abs(uv) - vec2(maxSize - borderRadius);
        float dist = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - borderRadius;
        float alpha = 1.0 - smoothstep(0.0, 0.015, dist);
        if (alpha < 0.1) discard;
        gl_FragColor = vec4(color, alpha * opacity);
    }
`;
