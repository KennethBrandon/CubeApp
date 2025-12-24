export class SoundManager {
    constructor() {
        this.audioCtx = null;
        this.isMuted = localStorage.getItem('cubeVault_isMuted') === 'true';
    }

    init() {
        if (!this.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContext();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        localStorage.setItem('cubeVault_isMuted', this.isMuted);
        return this.isMuted;
    }

    playTone(frequency, type, duration, startTime = 0, volume = 0.1) {
        if (this.isMuted || !this.audioCtx) return;

        const osc = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();

        osc.type = type;
        osc.frequency.value = frequency;

        osc.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);

        const now = this.audioCtx.currentTime + startTime;

        gainNode.gain.setValueAtTime(volume, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.start(now);
        osc.stop(now + duration);
    }

    playCountdownBeep(isFinal) {
        // High pitch for final beep (Go!), lower for 3, 2, 1
        const freq = isFinal ? 880 : 440;
        this.playTone(freq, 'sine', 0.1, 0, 0.2);
    }

    playMoveSound() {
        if (this.isMuted || !this.audioCtx) return;

        // Synthesize a "swish" or "click"
        // White noise burst with low pass filter
        const bufferSize = this.audioCtx.sampleRate * 0.05; // 50ms
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.audioCtx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1000;

        const gainNode = this.audioCtx.createGain();
        gainNode.gain.setValueAtTime(0.05, this.audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.05);

        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);

        noise.start();
    }

    playVictorySound() {
        // "Ta-da!" - Major triad arpeggio
        // C4, E4, G4, C5
        const now = 0;
        this.playTone(523.25, 'triangle', 0.2, now, 0.2);       // C5
        this.playTone(659.25, 'triangle', 0.2, now + 0.1, 0.2); // E5
        this.playTone(783.99, 'triangle', 0.4, now + 0.2, 0.2); // G5
        this.playTone(1046.50, 'triangle', 0.8, now + 0.4, 0.3); // C6
    }

    playResetSound() {
        // "Dun dun" - Descending interval
        this.playTone(150, 'sawtooth', 0.3, 0, 0.1);
        this.playTone(100, 'sawtooth', 0.4, 0.2, 0.1);
    }
}

export const soundManager = new SoundManager();
