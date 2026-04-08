/**
 * useSocket – React hook for Socket.IO real-time events
 * Provides a shared connection that auto-registers the wallet address.
 * Authenticates via JWT token from localStorage.
 *
 * Usage:
 *   const { socket, connected, on, off } = useSocket();
 *   useEffect(() => { on('notification:new', handler); return () => off('notification:new', handler); }, []);
 */
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { getToken } from '../utils/safeStorage';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:4001';

const SocketContext = createContext(null);

export function SocketProvider({ children, walletAddress }) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = getToken();

    // Only connect if we have a JWT token (authenticated user)
    if (!token) {
      return;
    }

    // Create socket connection with JWT auth
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      // Register wallet address for targeted notifications
      if (walletAddress) {
        socket.emit('register', walletAddress);
      }
    });

    socket.on('connect_error', (err) => {
      console.warn('Socket connection error:', err.message);
      // If auth fails, don't keep retrying with bad credentials
      if (err.message.includes('Authentication')) {
        socket.disconnect();
      }
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [walletAddress]);

  // Re-register when wallet address changes
  useEffect(() => {
    if (socketRef.current?.connected && walletAddress) {
      socketRef.current.emit('register', walletAddress);
    }
  }, [walletAddress]);

  const on = useCallback((event, handler) => {
    socketRef.current?.on(event, handler);
  }, []);

  const off = useCallback((event, handler) => {
    socketRef.current?.off(event, handler);
  }, []);

  const emit = useCallback((event, data) => {
    socketRef.current?.emit(event, data);
  }, []);

  const value = {
    socket: socketRef.current,
    connected,
    on,
    off,
    emit
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) {
    // Return a no-op object when used outside provider (graceful fallback)
    return { socket: null, connected: false, on: () => {}, off: () => {}, emit: () => {} };
  }
  return ctx;
}
