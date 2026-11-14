import { HeadlessDesk } from './headless';
import {
  type Json,
  PAGE_CLOSED_ERROR,
  pageClosedHint,
  parseClientMessage,
  type ServerMessage,
  type StoredDesk,
  type ToolName,
} from './protocol';

export interface SocketLike {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  readonly readyState: number;
}

const OPEN = 1;
const CALL_TIMEOUT_MS = 20_000;
const MAX_SOCKETS = 4;

interface Pending {
  resolve: (payload: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * One live room. When a browser is attached, MCP calls run there so the human
 * sees them. When none is attached, the same calls run on the stored desk.
 */
export class SessionRoomCore {
  readonly sessionId: string;
  readonly siteUrl: string;
  code: string | null = null;
  #seq = 0;
  readonly #sockets: SocketLike[] = [];
  readonly #pending = new Map<string, Pending>();
  readonly #desk = new HeadlessDesk();
  #onDesk: ((desk: StoredDesk) => void) | null = null;

  constructor(sessionId: string, siteUrl: string, code: string | null = null) {
    this.sessionId = sessionId;
    this.siteUrl = siteUrl;
    this.code = code;
  }

  get browserCount(): number {
    return this.#sockets.length;
  }

  attach(socket: SocketLike): void {
    if (this.#sockets.length >= MAX_SOCKETS) {
      const oldest = this.#sockets.shift();
      try {
        oldest?.close(4000, 'replaced');
      } catch {
        /* already closed */
      }
    }
    this.#sockets.push(socket);
    if (this.code) this.#send(socket, { type: 'welcome', code: this.code });
    if (!this.#desk.empty) this.#send(socket, { type: 'run', desk: this.#desk.exportDesk() });
  }

  /** Restore a desk persisted by the Durable Object. Does not notify listeners. */
  loadDesk(desk: StoredDesk): boolean {
    return this.#desk.load(desk);
  }

  currentDesk(): StoredDesk {
    return this.#desk.exportDesk();
  }

  onDesk(fn: (desk: StoredDesk) => void): void {
    this.#onDesk = fn;
  }

  welcome(code: string): void {
    this.code = code;
    this.broadcast({ type: 'welcome', code });
  }

  detach(socket: SocketLike): void {
    const index = this.#sockets.indexOf(socket);
    if (index >= 0) this.#sockets.splice(index, 1);
    if (this.#sockets.length === 0) this.#failAll(PAGE_CLOSED_ERROR);
  }

  handleMessage(socket: SocketLike, raw: string): void {
    const message = parseClientMessage(raw);
    if (!message) return;
    if (message.type === 'result') {
      const pending = this.#pending.get(message.id);
      if (!pending) return;
      this.#pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.desk) {
        this.#desk.merge(message.desk);
        this.#publish();
      }
      pending.resolve(message.payload);
      return;
    }
    if (message.type === 'pong' || message.type === 'hello') {
      if (this.code && socket.readyState === OPEN) {
        this.#send(socket, { type: 'welcome', code: this.code });
      }
    }
  }

  async call(tool: ToolName, args: Json): Promise<unknown> {
    const socket = this.#executor();
    if (!socket) {
      const result = this.#desk.call(tool, args);
      this.#publish();
      return result;
    }
    const id = `${++this.#seq}-${Date.now().toString(36)}`;
    const payload: ServerMessage = { type: 'call', id, tool, args };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        const error = new Error('Timed out waiting for the GameClaw page.');
        (error as Error & { hint?: string }).hint = pageClosedHint(this.siteUrl);
        reject(error);
      }, CALL_TIMEOUT_MS);
      this.#pending.set(id, { resolve, reject, timer });
      try {
        this.#send(socket, payload);
      } catch (error) {
        this.#pending.delete(id);
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  #publish(): void {
    this.#onDesk?.(this.#desk.exportDesk());
  }

  #executor(): SocketLike | undefined {
    for (let i = this.#sockets.length - 1; i >= 0; i -= 1) {
      const socket = this.#sockets[i];
      if (socket && socket.readyState === OPEN) return socket;
    }
    return undefined;
  }

  broadcast(message: ServerMessage): void {
    for (const socket of this.#sockets) this.#send(socket, message);
  }

  #send(socket: SocketLike, message: ServerMessage): void {
    if (socket.readyState !== OPEN) return;
    socket.send(JSON.stringify(message));
  }

  #failAll(message: string): void {
    for (const [id, pending] of this.#pending) {
      this.#pending.delete(id);
      clearTimeout(pending.timer);
      pending.reject(new Error(message));
    }
  }

  dispose(): void {
    this.#failAll(PAGE_CLOSED_ERROR);
    for (const socket of this.#sockets) {
      try {
        socket.close(1001, 'room closed');
      } catch {
        /* ignore */
      }
    }
    this.#sockets.length = 0;
  }
}
