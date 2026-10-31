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
      // Урок 03: у каждого оружия свой звук — звон меча, тяжёлый удар топора, гул молота; наковальня и заказ.
      const notes = { shield: [440, 660, 1100], heal: [523, 659, 784], 'shield-break': [740, 370], collect: [660, 990], pulse: [180, 360], dash: [240, 480], damage: [130, 90], portal: [440, 660, 880], 'guardian-hit': [220, 165], 'guardian-defeated': [392, 523, 659, 784], 'guardian-rage': [196, 147, 110], 'monster-defeated': [523, 392], secret: [784, 988, 1175], won: [440, 554, 660, 880], lost: [330, 220, 165], 'pulse-sword': [660, 990], 'pulse-axe': [220, 160, 110], 'pulse-hammer': [98, 65, 49], weapon: [392, 523], 'weapons-received': [523, 659, 784], anvil: [880, 1320], forging: [330, 440], forged: [1320, 990, 740], 'spider-hit': [196, 147], 'spider-defeated': [330, 440, 554, 660], 'spider-lunge': [120, 180], web: [1000, 1400], webbed: [600, 400], 'gate-key': [659, 784, 988, 1319], 'order-done': [523, 659, 784, 1047], 'dummy-hit': [294, 220] };
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
