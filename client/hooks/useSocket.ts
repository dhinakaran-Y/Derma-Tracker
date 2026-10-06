'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket, disconnectSocket, DermaSocketEvents } from '../lib/socket';

export type SocketEventName = keyof DermaSocketEvents | (string & {});

export interface UseSocketOptions {
  token?: string;
  autoConnect?: boolean;
}

export interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  error: Error | null;
  emit: (event: string, ...args: any[]) => void;
  on: (event: string, handler: (...args: any[]) => void) => () => void;
  reconnect: () => void;
  disconnect: () => void;
}

/**
 * useSocket: React lifecycle hook for Socket.io client.
 * Manages socket connection state, error handling, emission, and cleanup.
 */
export function useSocket(options?: UseSocketOptions): UseSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const s = getSocket(options?.token);
    setSocket(s);
    setIsConnected(s.connected);

    const handleConnect = () => {
      setIsConnected(true);
      setError(null);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleConnectError = (err: Error) => {
      setError(err);
      setIsConnected(false);
    };

    s.on('connect', handleConnect);
    s.on('disconnect', handleDisconnect);
    s.on('connect_error', handleConnectError);

    // Sync immediate state if already connected
    if (s.connected) {
      setIsConnected(true);
    }

    return () => {
      s.off('connect', handleConnect);
      s.off('disconnect', handleDisconnect);
      s.off('connect_error', handleConnectError);
    };
  }, [options?.token]);

  const emit = useCallback((event: string, ...args: any[]) => {
    if (socket) {
      socket.emit(event, ...args);
    }
  }, [socket]);

  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    const targetSocket = socket || (typeof window !== 'undefined' ? getSocket() : null);
    if (!targetSocket) return () => {};

    targetSocket.on(event, handler);
    return () => {
      targetSocket.off(event, handler);
    };
  }, [socket]);

  const reconnect = useCallback(() => {
    if (socket) {
      if (!socket.connected) {
        socket.connect();
      }
    } else if (typeof window !== 'undefined') {
      const s = getSocket(options?.token);
      setSocket(s);
    }
  }, [socket, options?.token]);

  const disconnect = useCallback(() => {
    disconnectSocket();
    setSocket(null);
    setIsConnected(false);
  }, []);

  return {
    socket,
    isConnected,
    error,
    emit,
    on,
    reconnect,
    disconnect,
  };
}

/**
 * useSocketEvent: Declarative hook to listen to a specific Socket.io event.
 * Uses a ref for the handler to avoid stale closures without constantly re-subscribing.
 *
 * @param event Socket event name (e.g. 'queue:updated', 'billing:updated')
 * @param handler Callback invoked when the event is received
 * @param enabled Optional flag to toggle the subscription on/off (defaults to true)
 */
export function useSocketEvent<T = any>(
  event: SocketEventName,
  handler: (data: T, ...extra: any[]) => void,
  enabled: boolean = true
) {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const socket = getSocket();

    const listener = (data: T, ...extra: any[]) => {
      if (handlerRef.current) {
        handlerRef.current(data, ...extra);
      }
    };

    socket.on(event, listener);

    return () => {
      socket.off(event, listener);
    };
  }, [event, enabled]);
}

export default useSocket;
