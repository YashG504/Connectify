import { io } from "socket.io-client";

// In production, the URL is computed from window.location
const SOCKET_URL = import.meta.env.MODE === "development" 
  ? "http://localhost:5001" 
  : "/";

export const socket = io(SOCKET_URL, {
  autoConnect: false, // Don't connect until the user is authenticated
  withCredentials: true,
});

// Helper to connect with userId
export const connectSocket = (userId) => {
  if (!socket.connected && userId) {
    socket.io.opts.query = { userId };
    socket.connect();
  }
};

// Helper to disconnect
export const disconnectSocket = () => {
  if (socket.connected) socket.disconnect();
};