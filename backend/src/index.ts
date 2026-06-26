import { WebSocketServer, WebSocket } from "ws";

const server = new WebSocketServer({ port: 8080 });

interface User {
    socket: WebSocket
    partner: User | null
    role: 'sender' | 'receiver' | null
}

const waitingQueue: User[] = []
const users = new Map<WebSocket, User>()

function matchUsers() {
    while (waitingQueue.length >= 2) {
        const user1 = waitingQueue.shift()!
        const user2 = waitingQueue.shift()!

        user1.partner = user2
        user2.partner = user1
        user1.role = 'sender'
        user2.role = 'receiver'

        user1.socket.send(JSON.stringify({ type: 'matched', role: 'sender' }))
        user2.socket.send(JSON.stringify({ type: 'matched', role: 'receiver' }))

        console.log("Matched two users")
    }
}

function disconnectFromPartner(user: User) {
    if (user.partner) {
        const partner = user.partner  
        user.partner = null  
        
        partner.socket.send(JSON.stringify({ type: 'partner_left' }))
        partner.partner = null
        partner.role = null
        waitingQueue.push(partner)
        partner.socket.send(JSON.stringify({ type: 'waiting' }))
    }
    user.role = null
}

server.on('connection', (socket) => {
    const user: User = { socket, partner: null, role: null }
    users.set(socket, user)

    socket.on('error', console.error)

    socket.on('message', (data: any) => {
        let msg: any
        try {
            msg = JSON.parse(data)
        } catch {
            console.warn("Invalid JSON, ignoring")
            return
        }

        const user = users.get(socket)!

        if (msg.type === 'join') {
            console.log("User joined queue")
            waitingQueue.push(user)
            socket.send(JSON.stringify({ type: 'waiting' }))
            matchUsers()

        } else if (msg.type === 'next') {
            console.log("User clicked next")
            disconnectFromPartner(user)
            waitingQueue.push(user)
            socket.send(JSON.stringify({ type: 'waiting' }))
            matchUsers()

        } else if (msg.type === 'createOffer') {
            user.partner?.socket.send(JSON.stringify({ type: 'createOffer', sdp: msg.sdp }))

        } else if (msg.type === 'createAnswer') {
            user.partner?.socket.send(JSON.stringify({ type: 'createAnswer', sdp: msg.sdp }))

        } else if (msg.type === 'iceCandidate') {
            user.partner?.socket.send(JSON.stringify({ type: 'iceCandidate', candidate: msg.candidate }))
        }
    })

    socket.on('close', () => {
        console.log("User disconnected")
        disconnectFromPartner(user)
        matchUsers();
        // remove from queue if still waiting
        const idx = waitingQueue.indexOf(user)
        if (idx !== -1) waitingQueue.splice(idx, 1)
        users.delete(socket)
    })
})

console.log("Signaling server running on port 8080")
