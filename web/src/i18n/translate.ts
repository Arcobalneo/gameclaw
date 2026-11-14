import { type GameCatalog, getCatalog, type Pattern } from './catalogs';
import { type Lang, lang } from './index';

export const CJK = /[\u3400-\u9fff]/;

const ABORT_EN = 'Abort this run and settle honestly';
const ABORT = { zh: '放弃本局', en: 'Abort run' } as const;

interface CompiledPattern {
  re: RegExp;
  en: string;
  kinds: Array<'n' | 'term' | 'text'>;
}

interface Compiled {
  exact: Map<string, string>;
  termKeys: string[];
  terms: Record<string, string>;
  patterns: CompiledPattern[];
}

const cache = new Map<string, Compiled>();

const NUMBER = '[+-]?\\d+(?:\\.\\d+)?(?:\\/\\d+)?%?';

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compilePattern(p: Pattern): CompiledPattern {
  const kinds: Array<'n' | 'term' | 'text'> = [];
  const zh = p.zh;
  const pieces: Array<{ kind: 'lit'; text: string } | { kind: 'slot'; index: number }> = [];
  let last = 0;
  let slotIndex = 0;
  for (const m of zh.matchAll(/\{(\d+)\}/g)) {
    pieces.push({ kind: 'lit', text: zh.slice(last, m.index) });
    const kind = p.slots?.[slotIndex] ?? p.slots?.[Number(m[1])] ?? 'text';
    kinds.push(kind);
    pieces.push({ kind: 'slot', index: slotIndex });
    slotIndex += 1;
    last = m.index + m[0].length;
  }
  pieces.push({ kind: 'lit', text: zh.slice(last) });
  let src = '^';
  for (let i = 0; i < pieces.length; i += 1) {
    const piece = pieces[i];
    if (!piece) continue;
    if (piece.kind === 'lit') {
      src += escapeRe(piece.text);
      continue;
    }
    const kind = kinds[piece.index] ?? 'text';
    const restIsEmpty = pieces.slice(i + 1).every((x) => x.kind === 'lit' && x.text === '');
    if (kind === 'n') src += `(${NUMBER})`;
    else src += restIsEmpty ? '([\\s\\S]*?)' : '([\\s\\S]+?)';
  }
  src += '$';
  return { re: new RegExp(src), en: p.en, kinds };
}

function compile(catalog: GameCatalog): Compiled {
  const terms = { ...catalog.terms };
  return {
    exact: new Map(Object.entries(catalog.exact)),
    termKeys: Object.keys(terms).sort((a, b) => b.length - a.length),
    terms,
    patterns: catalog.patterns.map(compilePattern),
  };
}

function compiled(gameId: string): Compiled {
  let c = cache.get(gameId);
  if (!c) {
    c = compile(getCatalog(gameId));
    cache.set(gameId, c);
  }
  return c;
}

/** Test helper: drop compiled catalogs after hot-reloading fixtures. */
export function resetTranslateCache(): void {
  cache.clear();
}

function applyTerms(c: Compiled, text: string): string {
  if (!text) return text;
  if (!CJK.test(text)) return text;
  let out = '';
  let i = 0;
  outer: while (i < text.length) {
    for (const k of c.termKeys) {
      if (k && text.startsWith(k, i)) {
        const repl = c.terms[k] ?? k;
        if (out && /[A-Za-z0-9)]$/.test(out) && /^[A-Za-z]/.test(repl)) out += ' ';
        out += repl;
        i += k.length;
        continue outer;
      }
    }
    out += text[i];
    i += 1;
  }
  return out
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.:;!?%)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim();
}

function fill(template: string, slots: string[]): string {
  return template.replace(/\{(\d+)\}/g, (_, i: string) => slots[Number(i)] ?? '');
}

function translateSlots(
  gameId: string,
  values: string[],
  kinds: CompiledPattern['kinds'],
): string[] {
  return values.map((v, i) => {
    const kind = kinds[i] ?? 'text';
    if (kind === 'n') return v;
    return translate(gameId, v, 'en');
  });
}

function tryPatterns(gameId: string, c: Compiled, text: string): string | null {
  for (const p of c.patterns) {
    const m = p.re.exec(text);
    if (!m) continue;
    const slots = translateSlots(gameId, m.slice(1), p.kinds);
    const out = tidy(applyTerms(c, fill(p.en, slots)));
    if (out && !CJK.test(out)) return out;
  }
  return null;
}

function tidy(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.:;!?%)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/[，]/g, ', ')
    .replace(/[：]/g, ': ')
    .replace(/[；]/g, '; ')
    .replace(/[（]/g, ' (')
    .replace(/[）]/g, ')')
    .replace(/[、]/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

function lookupExact(c: Compiled, text: string): string | undefined {
  const direct = c.exact.get(text);
  if (direct) return direct;
  const trimmed = text.trim();
  if (trimmed !== text) {
    const hit = c.exact.get(trimmed);
    if (hit) return hit;
  }
  if (/[。．.]$/.test(trimmed)) {
    const hit = c.exact.get(trimmed.replace(/[。．.]$/, ''));
    if (hit) return /[。.]$/.test(hit) ? hit : `${hit}.`;
  } else {
    const hit = c.exact.get(`${trimmed}。`) ?? c.exact.get(`${trimmed}.`);
    if (hit) return hit.replace(/[。．.]$/, '');
  }
  return undefined;
}

const SPLIT = /\s*[·|｜]\s*|\n+/;

/**
 * Translate one engine-authored Chinese string into `target`.
 * Engines stay deterministic; this is the loc layer at the web/host/canvas boundary.
 */
function tryCjkTail(gameId: string, text: string): string | null {
  const starts: number[] = [];
  for (let i = 1; i < text.length; i += 1) {
    const ch = text[i];
    const prev = text[i - 1];
    if (ch && prev && CJK.test(ch) && !CJK.test(prev)) starts.push(i);
  }
  for (const start of starts) {
    const head = text.slice(0, start).trim();
    const tail = text.slice(start).trim();
    if (!head || CJK.test(head) || tail.length < 2) continue;
    const b = translate(gameId, tail, 'en');
    if (CJK.test(b)) continue;
    return tidy(`${head} ${b}`);
  }
  return null;
}

function tryHeadTail(gameId: string, text: string): string | null {
  const cuts: number[] = [];
  for (const m of text.matchAll(/[。；→：]/g)) cuts.push(m.index);
  for (let i = cuts.length - 1; i >= 0; i -= 1) {
    const idx = cuts[i];
    if (idx === undefined || idx <= 0 || idx >= text.length) continue;
    const head = text.slice(0, idx).trim();
    const mark = text[idx];
    const tail = text.slice(idx + 1).trim();
    if (head.length < 2 || !tail) continue;
    const a = translate(gameId, head, 'en');
    if (CJK.test(a)) continue;
    const b = translate(gameId, tail, 'en');
    if (CJK.test(b)) continue;
    const joiner = mark === '→' ? ' → ' : mark === '；' ? '; ' : mark === '：' ? ': ' : ' ';
    return tidy(`${a}${joiner}${b}`);
  }
  return null;
}

function tryExactPrefix(gameId: string, c: Compiled, text: string): string | null {
  let best: { zh: string; en: string } | null = null;
  for (const [zh, en] of c.exact) {
    if (zh.length < 4 || zh.length >= text.length) continue;
    if (!text.startsWith(zh)) continue;
    if (!best || zh.length > best.zh.length) best = { zh, en };
  }
  if (!best) return null;
  const rest = text.slice(best.zh.length).trim();
  if (!rest) return best.en;
  const restEn = translate(gameId, rest, 'en');
  if (CJK.test(restEn)) return null;
  return tidy(`${best.en} ${restEn}`);
}

export function translate(gameId: string, text: string, target: Lang = lang()): string {
  if (!text) return text;
  if (text === ABORT_EN || text === '放弃本局' || text === '放弃本局并诚实结算')
    return ABORT[target];
  if (target === 'zh') return text;
  if (!CJK.test(text)) return text;

  const bullet = text.match(/^(-\s+)/);
  if (bullet) {
    const rest = translate(gameId, text.slice(bullet[0].length), target);
    if (!CJK.test(rest)) return `${bullet[0]}${rest}`;
  }

  const c = compiled(gameId);
  const exact = lookupExact(c, text);
  if (exact) return exact;

  let patterned = tryPatterns(gameId, c, text);
  if (!patterned && !/[。．.]$/.test(text)) patterned = tryPatterns(gameId, c, `${text}。`);
  if (patterned) return patterned;

  const prefixed = tryExactPrefix(gameId, c, text);
  if (prefixed) return prefixed;

  const headed = tryHeadTail(gameId, text);
  if (headed) return headed;

  const island = tryCjkTail(gameId, text);
  if (island) return island;

  // Clause split: "A · B" / pipes / colons / newlines, when every part translates cleanly.
  if (SPLIT.test(text) || /[：:]/.test(text) || text.includes('｜')) {
    const parts = text.split(/\s*[·|｜]\s*|\n+|：|:(?!\d)/);
    if (parts.length > 1) {
      const translated = parts.map((p) => translate(gameId, p.trim(), 'en'));
      if (translated.every((p) => !CJK.test(p))) {
        const joiner = /[：:]/.test(text) && !/[·|｜]/.test(text) ? ': ' : ' · ';
        return translated.filter(Boolean).join(joiner);
      }
    }
  }

  // Semicolon / period clauses, only when every clause translates cleanly.
  if (/[；。]/.test(text) && text.length > 12) {
    const parts = text
      .split(/[；。]/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length > 1) {
      const translated = parts.map((p) => translate(gameId, p, 'en'));
      if (translated.every((p) => !CJK.test(p))) {
        const joiner = /。/.test(text) ? '. ' : '; ';
        return translated.join(joiner).replace(/\s+\./g, '.');
      }
    }
  }

  // Short labels: glossary only, and only if nothing CJK remains.
  if (text.length <= 24) {
    const out = tidy(applyTerms(c, text));
    if (out && !CJK.test(out)) return out;
  } else {
    const out = tidy(applyTerms(c, text));
    if (out && !CJK.test(out)) return out;
  }

  const truncated = tryTruncated(gameId, text);
  if (truncated) return truncated;

  return text;
}

/** When a harvest/timeline line is cut mid-clause with an ellipsis, keep the last fully translated sentence. */
function tryTruncated(gameId: string, text: string): string | null {
  const m = text.match(/^(.*?)(…|\.\.\.)$/u);
  if (!m?.[1]) return null;
  const base = m[1];
  const cuts: number[] = [];
  for (const m of base.matchAll(/[。．.!;；]/g)) cuts.push(m.index);
  for (let i = cuts.length - 1; i >= 0; i -= 1) {
    const idx = cuts[i];
    if (idx === undefined) continue;
    const head = base.slice(0, idx + 1).trim();
    if (head.length < 4) continue;
    const a = translate(gameId, head, 'en');
    if (!CJK.test(a)) return tidy(`${a}…`);
  }
  return null;
}

/** True when `text` can be shown in English without leftover Chinese. */
export function translatable(gameId: string, text: string): boolean {
  return !CJK.test(translate(gameId, text, 'en'));
}

/** Compatibility alias used by the existing renderer (`term`). */
export const term = translate;
