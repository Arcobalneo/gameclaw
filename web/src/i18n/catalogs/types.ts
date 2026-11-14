/** One game's translation memory: exact phrases, interpolated patterns, and a glossary. */
export interface Pattern {
  /** Canonical Chinese template. Numbered slots `{0}`, `{1}`, … match runtime interpolations. */
  zh: string;
  /** English template using the same `{n}` slots. Slot values are translated before insert. */
  en: string;
  /**
   * Optional per-slot kinds. `n` is a number, `term` prefers a glossary hit,
   * `text` is a free string that is itself translated.
   */
  slots?: Array<'n' | 'term' | 'text'>;
}

export interface GameCatalog {
  /** Longest-match glossary (names, short labels, particles used in labels). */
  terms: Record<string, string>;
  /** Full phrases with no interpolations. */
  exact: Record<string, string>;
  /** Interpolated sentences authored in the engine as template literals. */
  patterns: Pattern[];
}
