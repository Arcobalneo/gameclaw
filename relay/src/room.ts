import {
  type Json,
  PAGE_CLOSED_ERROR,
  parseClientMessage,
  pageClosedHint,
  type ServerMessage,
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
 * One live room: browser tabs attached as sockets, MCP tool calls forwarded
 * to the most recently attached tab (the executor). Engines stay in the browser.
 */
export class SessionRoomCore {
  readonly sessionId: string;
  readonly siteUrl: string;
  code: string | null = null;
  #seq = 0;
  readonly #sockets: SocketLike[] = [];
  readonly #pending = new Map<string, Pending>();

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
      const error = new Error(PAGE_CLOSED_ERROR);
      (error as Error & { hint?: string }).hint = pageClosedHint(this.siteUrl);
      throw error;
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
