/**
 * Server clients only call Auth (`getUser`). @supabase/supabase-js still
 * constructs a Realtime socket, and that throws on Node.js 20 and whenever
 * the runtime has no native WebSocket (including some Edge middleware
 * runtimes) unless a transport is provided. This constructor is never connected.
 */
export class AuthOnlyRealtimeTransport {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;
  readonly readyState = 3;
  readonly url: string;
  readonly protocol = "";
  onopen: ((this: WebSocket, ev: Event) => unknown) | null = null;
  onmessage: ((this: WebSocket, ev: MessageEvent) => unknown) | null = null;
  onclose: ((this: WebSocket, ev: CloseEvent) => unknown) | null = null;
  onerror: ((this: WebSocket, ev: Event) => unknown) | null = null;

  constructor(address: string | URL, _protocols?: string | string[]) {
    this.url = typeof address === "string" ? address : address.toString();
  }

  close(_code?: number, _reason?: string) {}
  send(_data?: string | ArrayBufferLike | Blob | ArrayBufferView) {}
  addEventListener(_type: string, _listener: EventListener) {}
  removeEventListener(_type: string, _listener: EventListener) {}
}

export const authOnlyRealtime = {
  transport: AuthOnlyRealtimeTransport,
};
