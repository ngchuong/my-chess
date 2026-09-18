// Âm thanh tổng hợp bằng Web Audio API — không cần file âm thanh đi kèm.
// AudioContext chỉ được tạo khi cần (và trình duyệt chỉ cho phát sau một
// tương tác của người dùng, điều mà việc click quân cờ đã đảm bảo).
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!audioContext) {
        audioContext = new AudioContextClass();
    }
    if (audioContext.state === 'suspended') {
        void audioContext.resume();
    }
    return audioContext;
}

interface Tone {
    frequency: number;
    startOffset: number;
    duration: number;
    type?: OscillatorType;
    peakGain?: number;
}

function playTones(tones: Tone[]) {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    for (const tone of tones) {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + tone.startOffset;
        const end = start + tone.duration;
        const peak = tone.peakGain ?? 0.15;

        oscillator.type = tone.type ?? 'sine';
        oscillator.frequency.setValueAtTime(tone.frequency, start);

        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(peak, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);

        oscillator.connect(gain);
        gain.connect(ctx.destination);

        oscillator.start(start);
        oscillator.stop(end + 0.02);
    }
}

export function playMoveSound() {
    playTones([{ frequency: 440, startOffset: 0, duration: 0.06, type: 'triangle', peakGain: 0.08 }]);
}

export function playCaptureSound() {
    playTones([
        { frequency: 180, startOffset: 0, duration: 0.12, type: 'square', peakGain: 0.14 },
        { frequency: 90, startOffset: 0.03, duration: 0.18, type: 'sawtooth', peakGain: 0.1 },
    ]);
}

export function playCheckSound() {
    playTones([
        { frequency: 880, startOffset: 0, duration: 0.12, type: 'square', peakGain: 0.12 },
        { frequency: 880, startOffset: 0.16, duration: 0.12, type: 'square', peakGain: 0.12 },
    ]);
}
