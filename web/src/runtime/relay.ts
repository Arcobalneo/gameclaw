import { sessionWsUrl } from './config';
import type { LocalSession } from './session';

export type RelayStatus = 'connecting' | 'open' | 'reconnecting' | 'offline';

type Json = Record<string, unknown>;

export interface RelayClient {
  status: RelayStatus;
  stop(): void;
  reconnect(): void;
}

export function connectRelay(opts: {
  session: () => LocalSession;
  execute: (tool: string, args: Json) => Promise<unknown>;
  onWelcome: (code: string) => void;
  onStatus: (status: RelayStatus) => void;
}): RelayClient {
  let ws: WebSocket | null = null;
  let stopped = false;
  let everOpen = false;
  let delay = 500;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  const client: RelayClient = {
    status: 'connecting',
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = null;
      ws?.close();
      ws = null;
    },
    reconnect() {
      if (timer) clearTimeout(timer);
      delay = 500;
      if (ws) {
        ws.close();
        ws = null;
      }
      setStatus(everOpen ? 'reconnecting' : 'connecting');
      open();
    },
  };

  const setStatus = (status: RelayStatus) => {
    client.status = status;
    opts.onStatus(status);
  };

  const schedule = () => {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    setStatus(everOpen ? 'reconnecting' : 'offline');
    timer = setTimeout(open, everOpen ? delay : Math.min(delay, 2000));
    delay = Math.min(delay * 2, 8000);
  };

  const open = () => {
    if (stopped) return;
    const { id } = opts.session();
    let socket: WebSocket;
    try {
      socket = new WebSocket(sessionWsUrl(id));
    } catch {
      schedule();
      return;
    }
    ws = socket;
    if (!everOpen) setStatus('connecting');
    socket.addEventListener('open', () => {
      if (ws !== socket) return;
      everOpen = true;
      delay = 500;
      setStatus('open');
      socket.send(JSON.stringify({ type: 'hello' }));
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'pong' }));
      }, 25_000);
    });
    socket.addEventListener('message', (event) => {
      if (ws !== socket) return;
      void onMessage(socket, String(event.data));
    });
    socket.addEventListener('close', () => {
      if (ws !== socket) return;
      ws = null;
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = null;
      if (!stopped) schedule();
    });
    socket.addEventListener('error', () => {
      /* close handler will reconnect */
    });
  };

  const onMessage = async (socket: WebSocket, raw: string) => {
    let message: { type?: string; id?: string; tool?: string; args?: Json; code?: string };
    try {
      message = JSON.parse(raw) as typeof message;
    } catch {
      return;
    }
    if (message.type === 'welcome' && typeof message.code === 'string') {
      opts.onWelcome(message.code);
      return;
    }
    if (
      message.type === 'call' &&
      typeof message.id === 'string' &&
      typeof message.tool === 'string'
    ) {
      let payload: unknown;
      try {
        payload = await opts.execute(message.tool, message.args ?? {});
      } catch (error) {
        payload = {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'result', id: message.id, payload }));
      }
    }
  };

  open();
  return client;
}
