import express from "express";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
// Signalling server --> will support createOffer , createAnswer , addIceCandidate
const server = new WebSocketServer({ port: 8080 });
const clients = new Set();
server.on('connection', (socket) => {
    clients.add(socket);
    socket.send("This is the message from the signalling server");
    socket.on('message', (message) => {
        clients.forEach((client) => {
            if (client !== socket && client.readyState === WebSocket.OPEN) {
                const text = message.toString();
                client.send(`message - ${text} `);
            }
        });
    });
    socket.on('close', () => {
        clients.delete(socket);
    });
});
console.log("WebSocket server is running on port 8080");
//# sourceMappingURL=index.js.map