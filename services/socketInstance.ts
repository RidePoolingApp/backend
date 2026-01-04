import SocketService from "./socketService";

let socketService: SocketService | null = null;

export function initSocketService(): SocketService {
  if (!socketService) {
    socketService = new SocketService();
  }
  return socketService;
}

export function getSocketService(): SocketService {
  if (!socketService) {
    throw new Error("Socket service not initialized. Call initSocketService first.");
  }
  return socketService;
}
