// The rules that each text of the website must pass before a publish.
// The character ranges and the word list follow skills/anti-slop/SKILL.md.
// Escapes, so that this file holds none of the characters that it bans.
const BANNED_CHARACTERS = /[\u2010-\u2015\u2018-\u201F\u2026\u2190-\u21FF\u2212\u00D7\u2022\u25A0-\u25FF\u2600-\u27BF\u{1F000}-\u{1FAFF};!]/u;
const FORBIDDEN_CLAIMS: { rule: string; pattern: RegExp }[] = [
  { rule: 'claims that the store installs nothing', pattern: /install(s|ed)? nothing|nothing to install|no installation/i },
  { rule: 'claims that the store lends glasses', pattern: /\blend(s|ing)?\b|\blent\b|\bborrow/i },
  { rule: 'claims a real payment', pattern: /real payments?|real money|charges? your card/i },
  { rule: 'claims a test with blind shoppers', pattern: /tested (it |glance )?(with|by) (a |the )?(blind|low-vision)|(blind|low-vision) (shoppers?|people|persons?|users?|testers?) (have |has )?(tested|tried|used)/i },
];
const MARKETING_WORDS = /\b(seamless|robust|powerful|cutting-edge|effortless|world-class|next-generation|revolutionary|blazing|lightning-fast|elegant|delightful|turnkey|best-in-class|state-of-the-art|game-changing|first-class|battle-tested|enterprise-grade|supercharge|unlock|unleash|empower|elevate|streamline|revolutionize)/i;
const MAX_WORDS_IN_SENTENCE = 25;

function hasLongSentence(text: string): boolean {
  return text
    .split(/(?<=[.?])\s+/)
    .some((sentence) => sentence.split(/\s+/).filter(Boolean).length > MAX_WORDS_IN_SENTENCE);
}

// Returns one line for each rule that a text breaks, in the form "<rule>: <text>".
export function copyProblems(texts: readonly string[]): string[] {
  const problems: string[] = [];
  for (const text of texts) {
    if (BANNED_CHARACTERS.test(text)) problems.push(`has a banned character: ${text}`);
    for (const claim of FORBIDDEN_CLAIMS) {
      if (claim.pattern.test(text)) problems.push(`${claim.rule}: ${text}`);
    }
    if (MARKETING_WORDS.test(text)) problems.push(`has a marketing word: ${text}`);
    if (hasLongSentence(text)) problems.push(`has a sentence of more than ${MAX_WORDS_IN_SENTENCE} words: ${text}`);
  }
  return problems;
}
