// Emotion keyword lists for detection
const EMOTION_KEYWORDS: Record<string, string[]> = {
  neutral: [], // default fallback
  cheerful: [
    'happy', 'joy', 'glad', 'delighted', 'pleased', 'smile', 'great', 'wonderful',
    'awesome', 'fantastic', 'cheerful', 'wonderful', 'excellent', 'amazing', 'good news',
    'celebrate', 'congratulations', 'yay', 'hooray'
  ],
  sad: [
    'sad', 'unhappy', 'depressed', 'sorrow', 'grief', 'tears', 'cry', 'miserable',
    'heartbroken', 'disappointed', 'regret', 'sorry', 'unfortunate', 'tragic', 'gloomy',
    'melancholy', 'downhearted'
  ],
  angry: [
    'angry', 'mad', 'furious', 'outraged', 'annoyed', 'irritated', 'frustrated', 'hate',
    'rage', 'hostile', 'furious', 'resentful', 'bitter', 'enraged', 'livid'
  ],
  excited: [
    'excited', 'thrilled', 'eager', 'enthusiastic', 'pumped', 'amazing', 'wow', 'awesome',
    'incredible', 'astonishing', 'remarkable', 'extraordinary', 'fantastic', 'what an',
    "can't wait", 'looking forward'
  ],
   calm: [
     'calm', 'peaceful', 'relaxed', 'serene', 'tranquil', 'soothing', 'quiet', 'composed',
     'collected', 'steadfast', 'unruffled', 'poised', 'imperturbable'
   ],
};

/**
 * Detects emotion from text using keyword matching.
 * Returns one of: 'neutral', 'cheerful', 'sad', 'angry', 'excited', 'calm'
 */
export function detectEmotion(text: string): string {
  if (!text || text.trim().length === 0) return 'neutral';

  const lower = text.toLowerCase();
  const wordMatches = (words: string[]) => words.filter(word => lower.includes(word)).length;

  let maxEmotion = 'neutral';
  let maxScore = 0;

  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    if (emotion === 'neutral') continue;
    const score = wordMatches(keywords);
    if (score > maxScore) {
      maxScore = score;
      maxEmotion = emotion;
    }
  }

  // Require at least 2 keyword matches to avoid false positives
  if (maxScore < 2) {
    return 'neutral';
  }

  return maxEmotion;
}
