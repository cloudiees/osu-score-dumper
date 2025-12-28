import { WebSocket } from "ws";

interface WebSocketWithFlags {
    ws: WebSocket,
    isCancelled: boolean
}

export default WebSocketWithFlags;