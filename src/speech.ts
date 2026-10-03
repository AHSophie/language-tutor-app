/**
 * Speech synthesis, recognition, and pronunciation scoring utilities.
 */

// Global type augmentation for Web Speech Recognition API
declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

/**
 * Normalizes text for comparison:
 * - Lowercase
 * - Remove punctuation (including ¿, ¡, commas, periods, etc.)
 * - Collapse and trim whitespace
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[¿¡!?,.;:"'()\[\]\-_—/\\`~@#$%^&*+={}|<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Compute the Levenshtein distance between two strings at the character level.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const dp: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    dp[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j - 1] + 1, // substitution
          dp[i][j - 1] + 1,     // insertion
          dp[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return dp[b.length][a.length];
}

/**
 * Calculates character-level similarity between 0 and 1.
 * Handles minor accent omissions gracefully while maintaining strictness.
 */
export function calculateSimilarity(target: string, recognized: string): number {
  const normTarget = normalizeText(target);
  const normRec = normalizeText(recognized);

  if (normTarget === normRec) return 1.0;
  if (!normTarget.length || !normRec.length) return 0.0;

  const maxLen = Math.max(normTarget.length, normRec.length);
  const dist = levenshteinDistance(normTarget, normRec);
  let similarity = Math.max(0, 1 - dist / maxLen);

  // Fallback check: if browser speech-to-text dropped diacritics (e.g. "dias" vs "días")
  const stripAccents = (str: string) =>
    str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const unaccentedTarget = stripAccents(normTarget);
  const unaccentedRec = stripAccents(normRec);

  if (unaccentedTarget === unaccentedRec) {
    similarity = Math.max(similarity, 0.98);
  } else {
    const unaccentedDist = levenshteinDistance(unaccentedTarget, unaccentedRec);
    const unaccentedSim = Math.max(0, 1 - unaccentedDist / Math.max(unaccentedTarget.length, unaccentedRec.length));
    similarity = Math.max(similarity, unaccentedSim * 0.98);
  }

  return similarity;
}

export interface ScoredResult {
  bestScore: number;
  bestTranscript: string;
}

/**
 * Evaluates recognition alternatives against the target word.
 * Returns the highest score and corresponding transcript.
 */
export function scorePronunciation(target: string, alternatives: string[]): ScoredResult {
  if (!alternatives || alternatives.length === 0) {
    return { bestScore: 0, bestTranscript: '' };
  }

  const normTarget = normalizeText(target);
  let bestScore = -1;
  let bestTranscript = alternatives[0];

  for (const alt of alternatives) {
    const normAlt = normalizeText(alt);
    let score = 0;
    if (normAlt === normTarget) {
      score = 100;
    } else {
      const sim = calculateSimilarity(normTarget, normAlt);
      score = Math.round(sim * 100);
    }

    if (score > bestScore) {
      bestScore = score;
      bestTranscript = alt;
    }
  }

  return {
    bestScore: Math.min(100, Math.max(0, bestScore)),
    bestTranscript,
  };
}

/**
 * Checks if SpeechRecognition is available in the current browser.
 */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * Speaks a Spanish word using window.speechSynthesis (lang "es-MX", rate 0.8).
 */
export function speakSpanishWord(
  text: string,
  onStart?: () => void,
  onEnd?: () => void,
  onError?: (err: unknown) => void
): () => void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onError?.(new Error('SpeechSynthesis not supported'));
    return () => {};
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'es-MX';
  utterance.rate = 0.8;

  // Pick best available Spanish voice
  const voices = window.speechSynthesis.getVoices();
  const spanishVoice =
    voices.find((v) => v.lang === 'es-MX') ||
    voices.find((v) => v.lang.startsWith('es-')) ||
    voices.find((v) => v.lang.toLowerCase().includes('es'));

  if (spanishVoice) {
    utterance.voice = spanishVoice;
  }

  if (onStart) utterance.onstart = onStart;
  if (onEnd) utterance.onend = onEnd;
  if (onError) utterance.onerror = onError;

  window.speechSynthesis.speak(utterance);

  return () => {
    window.speechSynthesis.cancel();
  };
}
