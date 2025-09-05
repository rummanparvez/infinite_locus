import { useEffect, useRef } from 'react';
import websocketService from '../services/websocket';

export const useWebSocket = () => {
  const isConnected = useRef(false);

  useEffect(() => {
    if (!isConnected.current) {
      websocketService.connect();
      isConnected.current = true;
    }

    return () => {
      websocketService.disconnect();
      isConnected.current = false;
    };
  }, []);

  const subscribe = (event: string, callback: Function) => {
    websocketService.on(event, callback);
    
    return () => {
      websocketService.off(event, callback);
    };
  };

  const joinEvent = (eventId: string) => {
    websocketService.joinEvent(eventId);
  };

  const leaveEvent = (eventId: string) => {
    websocketService.leaveEvent(eventId);
  };

  return {
    subscribe,
    joinEvent,
    leaveEvent,
  };
};