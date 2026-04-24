import { io } from 'socket.io-client';

const WS_URL = 'http://localhost:8080';

let socket = null;

const websocket = {
    connect: (onMessageReceived) => {
        if (socket?.connected) return;

        socket = io(WS_URL, {
            transports: ['websocket', 'polling'],
            withCredentials: false,
            reconnection: true,
            reconnectionDelay: 1500
        });

        socket.on('connect', () => {
            console.log('Connected to WebSocket');
        });

        socket.on('message', (payload) => {
            if (onMessageReceived) onMessageReceived(payload);
        });

        socket.on('connect_error', (error) => {
            console.error('WebSocket connection error:', error.message);
        });
    },

    disconnect: () => {
        if (socket) {
            socket.disconnect();
            socket = null;
        }
    }
};

export default websocket;
