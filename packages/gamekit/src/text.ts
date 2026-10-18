/** Terminal text helpers that are correct for CJK game output. */

const ESC = String.fromCharCode(27);
const ANSI_PATTERN = new RegExp(`${ESC}\\[[0-9;]*m`, 'g');

export function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, '');
}

function codePointWidth(codePoint: number): number {
  if (codePoint === 0) return 0;
  if (codePoint < 32 || (codePoint >= 0x7f && codePoint < 0xa0)) return 0;
  // Combining marks.
  if (codePoint >= 0x0300 && codePoint <= 0x036f) return 0;
  if (
    (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    (codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
    (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
    (codePoint >= 0xff00 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
    (codePoint >= 0x1f300 && codePoint <= 0x1f64f) ||
    (codePoint >= 0x1f900 && codePoint <= 0x1f9ff) ||
    (codePoint >= 0x20000 && codePoint <= 0x3fffd)
  ) {
    return 2;
  }
  return 1;
}

export function displayWidth(text: string): number {
  let width = 0;
  for (const char of stripAnsi(text)) width += codePointWidth(char.codePointAt(0) ?? 0);
  return width;
}

export function padEndDisplay(text: string, width: number): string {
  const current = displayWidth(text);
  return current >= width ? text : text + ' '.repeat(width - current);
}

export function truncateDisplay(text: string, width: number, ellipsis = '…'): string {
  if (displayWidth(text) <= width) return text;
  const limit = Math.max(0, width - displayWidth(ellipsis));
  let result = '';
  let used = 0;
  for (const char of text) {
    const next = codePointWidth(char.codePointAt(0) ?? 0);
    if (used + next > limit) break;
    result += char;
    used += next;
  }
  return result + ellipsis;
}

/**
 * Wrap a paragraph to a display width. Latin text breaks on spaces; CJK text
 * breaks on any character boundary. Never splits ANSI escape sequences because
 * game output is colourless at this layer.
 */
export function wrapText(text: string, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (displayWidth(paragraph) <= width) {
      lines.push(paragraph);
      continue;
    }
    let current = '';
    let currentWidth = 0;
    for (const char of paragraph) {
      if (char === ' ' && currentWidth === width) {
        lines.push(current);
        current = '';
        currentWidth = 0;
        continue;
      }
      const charWidth = codePointWidth(char.codePointAt(0) ?? 0);
      if (currentWidth + charWidth > width && current.length > 0) {
        const breakAt = current.lastIndexOf(' ');
        if (breakAt > 0 && /[A-Za-z0-9,.;:!?)]/.test(current[breakAt - 1] ?? '')) {
          const carry = current.slice(breakAt + 1);
          lines.push(current.slice(0, breakAt));
          current = carry;
          currentWidth = displayWidth(carry);
        } else {
          lines.push(current);
          current = '';
          currentWidth = 0;
        }
      }
      current += char;
      currentWidth += charWidth;
    }
    lines.push(current);
  }
  return lines;
}

export function indentBlock(lines: string[], prefix: string): string[] {
  return lines.map((line) => (line.length > 0 ? prefix + line : line));
}

export function bulletList(items: string[], bullet = '·'): string[] {
  return items.map((item) => `${bullet} ${item}`);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}
