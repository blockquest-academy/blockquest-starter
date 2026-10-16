export function createAudio() {
  let context;
  let enabled = false;
  return {
    get enabled() { return enabled; },
    toggle() {
      enabled = !enabled;
      if (enabled) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) { context ||= new AudioContext(); context.resume().catch(() => {}); }
      }
      return enabled;
    },
    play(event) {
      if (!enabled || !context) return;
      const notes = { shield: [440, 660, 1100], heal: [523, 659, 784], 'shield-break': [740, 370], collect: [660, 990], pulse: [180, 360], dash: [240, 480], damage: [130, 90], portal: [440, 660, 880], won: [440, 554, 660, 880], lost: [330, 220, 165] };
      (notes[event] || []).forEach((frequency, i) => {
        const osc = context.createOscillator(), gain = context.createGain();
        const at = context.currentTime + i * 0.075;
        osc.type = event === 'damage' ? 'triangle' : 'sine'; osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(0.055, at + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, at + 0.17);
        osc.connect(gain); gain.connect(context.destination); osc.start(at); osc.stop(at + 0.2);
      });
    },
  };
}
