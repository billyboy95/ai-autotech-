import { PUBLISHED_PRICES } from "./knowledge";

/** Post-processing: strip AI tells, enforce length, split into bubbles and compute typing delays. */

const BANNED: Array<[RegExp, string]> = [
  [/\bhow (may|can) i (assist|help) you( today)?\??/gi, ""],
  [/\bcertainly[!,.]?\s*/gi, ""],
  [/\babsolutely[!,.]\s*/gi, ""],
  [/\bgreat question[!,.]?\s*/gi, ""],
  [/\bi understand your concern[s]?[,.!]?\s*/gi, ""],
  [/\bi apologi[sz]e for (any|the) inconvenience( caused)?[,.!]?\s*/gi, "Sorry about that. "],
  [/\bfeel free to\b/gi, "you can"],
  [/\bdon'?t hesitate to\b/gi, "just"],
  [/\bi'?d be (happy|glad|delighted) to\b/gi, "I can"],
  [/\brest assured,?\s*/gi, ""],
  [/\bkindly\s+/gi, ""],
  [/\btailored solutions?\b/gi, "a setup that fits"],
  [/\bcomprehensive\s+/gi, ""],
  [/\bseamless(ly)?\s*/gi, ""],
  [/\bleverag(e|ing)\b/gi, "use"],
  [/\bdelve into\b/gi, "look at"],
  [/\bstreamline your operations\b/gi, "save you time"],
  [/\bas an ai( language model)?,?\s*/gi, ""],
  [/\bi hope this (message )?finds you well[.!]?\s*/gi, ""],
  [/\bthank you for reaching out[.!]?\s*/gi, "Thanks for the message. "],
];

const EMOJI = /\p{Extended_Pictographic}(\uFE0F|\u200D\p{Extended_Pictographic})*/gu;

export type Humanized = { bubbles: string[]; flags: string[] };

export function findUnpublishedAmounts(text: string) {
  const amounts = text.match(/\bR\s?\d[\d,\s.]*\d(k)?\b|\bR\s?\d\b/gi) ?? [];
  const bad = amounts.filter(
    (a) => !PUBLISHED_PRICES.some((p) => a.replace(/\s/g, "").toLowerCase() === p.replace(/\s/g, "").toLowerCase()),
  );
  const percents = text.match(/\b\d{1,3}\s?%/g) ?? [];
  const dollars = text.match(/\$\s?\d+/g) ?? [];
  return [...bad, ...percents, ...dollars];
}

export function humanize(raw: string, opts: { allowEmoji?: boolean; maxWords?: number } = {}): Humanized {
  const flags: string[] = [];
  let text = raw.replace(/\r/g, "").trim();

  // Strip wrapping quotes / JSON-ish artefacts.
  text = text.replace(/^["'“”]+|["'“”]+$/g, "").trim();

  // Markdown: bold/italics/headers/links.
  if (/[*_#`]/.test(text)) flags.push("markdown");
  text = text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|\s)\*(\S.+?)\*(?=\s|$)/g, "$1$2")
    .replace(/(^|\s)_(\S.+?)_(?=\s|$)/g, "$1$2")
    .replace(/^#+\s*/gm, "")
    .replace(/`/g, "")
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "$1 $2");

  // Lists → flowing sentences.
  const lines = text.split("\n");
  if (lines.some((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l))) {
    flags.push("list");
    text = lines
      .map((l) => l.replace(/^\s*([-*•]|\d+[.)])\s+/, "").trim())
      .filter(Boolean)
      .join(", ")
      .replace(/:\s*,/g, ":")
      .replace(/,\s*\|\|/g, " ||");
  }

  // Dashes: em/en dashes and spaced hyphens used as dashes.
  if (/[—–]/.test(text)) flags.push("dash");
  text = text
    .replace(/\s*[—–]\s*(?=\S)/g, ", ")
    .replace(/\s+-\s+/g, ", ")
    .replace(/,\s*,/g, ",");

  // Corporate / AI phrases.
  for (const [re, rep] of BANNED) {
    if (re.test(text)) {
      flags.push(`phrase:${re.source.slice(0, 24)}`);
      text = text.replace(re, rep);
    }
    re.lastIndex = 0;
  }

  // Emojis: at most one, and only when allowed.
  const emojis = text.match(EMOJI) ?? [];
  if (emojis.length > (opts.allowEmoji ? 1 : 0)) {
    flags.push("emoji");
    let kept = 0;
    text = text.replace(EMOJI, (m) => (opts.allowEmoji && kept++ < 1 ? m : ""));
  }

  // Exclamation overload.
  text = text.replace(/!{2,}/g, "!");
  const bangs = (text.match(/!/g) ?? []).length;
  if (bangs > 1) {
    let seen = 0;
    text = text.replace(/!/g, () => (seen++ === 0 ? "!" : "."));
  }

  // Split into bubbles.
  let bubbles = text
    .split(/\s*\|\|\s*|\n{2,}/)
    .map((b) => b.replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").replace(/\s+([,.?!])/g, "$1").trim())
    .map((b) => b.replace(/^[,.\s]+/, "").trim())
    .filter((b) => b.length > 0);

  // Capitalise the first letter after we removed a leading phrase (keep lowercase if the whole bubble is lowercase-styled).
  bubbles = bubbles.map((b) => (/^[a-z]/.test(b) && /[A-Z]/.test(b.slice(1, 40)) ? b[0].toUpperCase() + b.slice(1) : b));

  // Max 2 bubbles: merge extras into the second.
  if (bubbles.length > 2) {
    flags.push("too_many_bubbles");
    bubbles = [bubbles[0], bubbles.slice(1).join(" ")];
  }

  // Only one question per reply: keep the first question, drop later question sentences.
  const qCount = bubbles.join(" ").split("?").length - 1;
  if (qCount > 1) {
    flags.push("multi_question");
    let kept = false;
    bubbles = bubbles
      .map((b) =>
        b
          .split(/(?<=[.?!])\s+/)
          .filter((sentence) => {
            if (!sentence.trim().endsWith("?")) return true;
            if (kept) return false;
            kept = true;
            return true;
          })
          .join(" "),
      )
      .filter(Boolean);
  }

  // Length cap.
  const maxWords = opts.maxWords ?? 70;
  const words = bubbles.join(" ").split(/\s+/).length;
  if (words > maxWords) {
    flags.push("too_long");
    bubbles = bubbles.map((b) => trimToSentences(b, Math.floor(maxWords / bubbles.length)));
  }

  // Trailing full stop on a single short casual bubble is fine; strip trailing spaces.
  bubbles = bubbles.map((b) => b.trim()).filter(Boolean);
  return { bubbles, flags };
}

function trimToSentences(text: string, maxWords: number) {
  const sentences = text.split(/(?<=[.?!])\s+/);
  const out: string[] = [];
  let count = 0;
  for (const s of sentences) {
    const n = s.split(/\s+/).length;
    if (count + n > maxWords && out.length) break;
    out.push(s);
    count += n;
  }
  // Keep a trailing question if we cut it off.
  const last = sentences[sentences.length - 1];
  if (last.endsWith("?") && !out.includes(last)) {
    if (out.length > 1) out.pop();
    out.push(last);
  }
  return out.join(" ");
}

/** Realistic typing delay for a bubble (ms). Roughly 40 wpm thumbs + a short think, clamped. */
export function typingDelayMs(text: string, index: number) {
  const base = index === 0 ? 1200 : 700;
  const perChar = 45;
  return Math.min(9000, Math.max(1500, base + text.length * perChar));
}
