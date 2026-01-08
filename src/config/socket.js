import socket from 'socket.io-client';


let socketInstance = null;


export const initializeSocket = (projectId) => {

    socketInstance = socket(import.meta.env.VITE_API_URL, {
        auth: {
            token: localStorage.getItem('token')
        },
        query: {
            projectId
        }
    });

    return socketInstance;

}

export const receiveMessage = (eventName, cb) => {
    if (!socketInstance) {
        console.warn(`Attempted to listen to ${eventName} before socket initialization.`);
        return;
    }
    socketInstance.on(eventName, cb);
}

export const sendMessage = (eventName, data) => {
    if (!socketInstance) {
        console.warn(`Attempted to send ${eventName} before socket initialization.`);
        return;
    }
    socketInstance.emit(eventName, data);
}

export const getSocket = () => {
    return socketInstance;
}