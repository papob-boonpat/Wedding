import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getBackendUrl(): string {
  if (typeof window !== 'undefined') {
    // When accessing Next.js dev server on port 3000 (via localhost or LAN IP like 192.168.x.x:3000)
    // automatically target the backend on the same host machine on port 3100
    if (window.location.port === '3000') {
      return `${window.location.protocol}//${window.location.hostname}:3100`;
    }
    // In production / k3s Ingress / reverse proxy, everything is served on the same origin
    return window.location.origin;
  }

  return process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3100';
}

export function getSocket(): Socket {
  if (typeof window === 'undefined') {
    return {} as Socket;
  }

  if (!socket) {
    const backendUrl = getBackendUrl();
    console.log('[Socket.io] Initializing connection to backend:', backendUrl);

    socket = io(backendUrl, {
      path: '/socket.io',
      transports: ['polling', 'websocket'], // Polling first ensures instant handshake across LAN/Safari, then upgrades to websocket
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socket.on('connect', () => {
      console.log('✅ [Socket.io] Connected successfully with ID:', socket?.id);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ [Socket.io] Connection error:', error.message, 'Target URL:', backendUrl);
    });

    socket.on('disconnect', (reason) => {
      console.warn('⚠️ [Socket.io] Disconnected:', reason);
    });
  }

  return socket;
}
