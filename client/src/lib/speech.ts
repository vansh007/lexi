/**
 * Pronunciation. Prefer a human recording from the dictionary. Otherwise use the
 * best-sounding voice installed on this device (the default voice is often the
 * robotic one, which is why we pick explicitly).
 */

let voices: SpeechSynthesisVoice[] = [];

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  const load = () => { voices = window.speechSynthesis.getVoices(); };
  load();
  window.speechSynthesis.addEventListener("voiceschanged", load);
}

function score(v: SpeechSynthesisVoice): number {
  const n = v.name.toLowerCase();
  const lang = v.lang.toLowerCase().replace("_", "-");
  if (!lang.startsWith("en")) return -1000;
  let s = 0;
  if (/natural|neural|online|enhanced|premium/.test(n)) s += 100; // Edge "Natural", macOS "Enhanced"
  if (/google/.test(n)) s += 60;                                  // Chrome's Google voices
  if (/aria|jenny|guy|ava|andrew|emma|neerja|prabhat|samantha|daniel|karen|serena|moira/.test(n)) s += 40;
  if (lang === "en-us" || lang === "en-gb" || lang === "en-in") s += 10;
  if (/espeak|compact|festival/.test(n)) s -= 200;
  return s;
}

export function bestVoice(): SpeechSynthesisVoice | undefined {
  return [...voices].sort((a, b) => score(b) - score(a))[0];
}

export function speak(word: string, audioUrl?: string, slow = false) {
  if (audioUrl && !slow) {
    new Audio(audioUrl).play().catch(() => speakSynth(word, slow));
    return;
  }
  speakSynth(word, slow);
}

function speakSynth(text: string, slow: boolean) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = bestVoice();
  if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = "en-US"; }
  u.rate = slow ? 0.6 : 0.9;
  u.pitch = 1;
  window.speechSynthesis.speak(u);
}
