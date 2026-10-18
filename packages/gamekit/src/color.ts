export interface ColorOptions {
  enabled: boolean;
}

/** Minimal ANSI palette. Disabled for non-TTY output, NO_COLOR and --no-color. */
export class Palette {
  readonly enabled: boolean;

  constructor(options: ColorOptions) {
    this.enabled = options.enabled;
  }

  static disabled(): Palette {
    return new Palette({ enabled: false });
  }

  #wrap(open: number, close: number, text: string): string {
    if (!this.enabled) return text;
    return `\u001B[${open}m${text}\u001B[${close}m`;
  }

  bold(text: string): string {
    return this.#wrap(1, 22, text);
  }

  dim(text: string): string {
    return this.#wrap(2, 22, text);
  }

  red(text: string): string {
    return this.#wrap(31, 39, text);
  }

  green(text: string): string {
    return this.#wrap(32, 39, text);
  }

  yellow(text: string): string {
    return this.#wrap(33, 39, text);
  }

  blue(text: string): string {
    return this.#wrap(34, 39, text);
  }

  magenta(text: string): string {
    return this.#wrap(35, 39, text);
  }

  cyan(text: string): string {
    return this.#wrap(36, 39, text);
  }

  gray(text: string): string {
    return this.#wrap(90, 39, text);
  }
}

export function resolveColorEnabled(
  explicit: boolean | undefined,
  isTTY: boolean,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (explicit === false) return false;
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== '') return false;
  if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== '0') return true;
  return explicit === true || isTTY;
}
