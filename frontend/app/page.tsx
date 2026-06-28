"use client"
import { useEffect, useState, useRef } from "react"

type Status = 'idle' | 'waiting' | 'connected'

export default function OmeTV() {
    const [status, setStatus] = useState<Status>('idle')
    const [muted, setMuted] = useState(true)
    const [seconds, setSeconds] = useState(0)
    const socketRef = useRef<WebSocket | null>(null)
    const pcRef = useRef<RTCPeerConnection | null>(null)
    const localStreamRef = useRef<MediaStream | null>(null)
    const localVideoRef = useRef<HTMLVideoElement>(null)
    const remoteVideoRef = useRef<HTMLVideoElement>(null)
    const [waitingIndex, setWaitingIndex] = useState(0)
    const [cooldown, setCooldown] = useState(false)
    const waitingMessages = [
    "Finding someone...",
    "Looking around...",
    "Searching nearby...",
    "Almost there...",
    "Connecting..."
]
useEffect(() => {
    if (status !== "waiting") return

    const interval = setInterval(() => {
        setWaitingIndex((i) => (i + 1) % waitingMessages.length)
    }, 2200)

    return () => clearInterval(interval)
}, [status])
    // add this effect
useEffect(() => {
    if (status === 'waiting' || status === 'connected') {
        if (localVideoRef.current && localStreamRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current
            localVideoRef.current.play().catch(console.error)
        }
    }
}, [status])

useEffect(() => {
    if (status !== "connected") {
        setSeconds(0)
        return
    }

    const interval = setInterval(() => {
        setSeconds((s) => s + 1)
    }, 1000)

    return () => clearInterval(interval)
}, [status])
    useEffect(() => {
        const socket = new WebSocket('wss://omega-rc0t.onrender.com')
        socketRef.current = socket

        socket.onmessage = async (event: any) => {
            try {
                const message = JSON.parse(event.data)

                if (message.type === 'waiting') {
                    setStatus('waiting')
                    cleanupPeer()

                } else if (message.type === 'matched') {
                    setStatus('connected')
                    setMuted(true)
                    const pc = createPeerConnection()

                    if (message.role === 'sender') {
                        localStreamRef.current?.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current!))
                        const offer = await pc.createOffer()
                        await pc.setLocalDescription(offer)
                        socket.send(JSON.stringify({ type: 'createOffer', sdp: pc.localDescription }))
                    } else {
                        localStreamRef.current?.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current!))
                    }

                } else if (message.type === 'createOffer') {
                    const pc = pcRef.current!
                    await pc.setRemoteDescription(new RTCSessionDescription(message.sdp))
                    const answer = await pc.createAnswer()
                    await pc.setLocalDescription(answer)
                    socket.send(JSON.stringify({ type: 'createAnswer', sdp: pc.localDescription }))

                } else if (message.type === 'createAnswer') {
                    await pcRef.current?.setRemoteDescription(new RTCSessionDescription(message.sdp))

                } else if (message.type === 'iceCandidate') {
                    await pcRef.current?.addIceCandidate(message.candidate)

                } else if (message.type === 'partner_left') {
                    setStatus('waiting')
                    cleanupPeer()
                    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
                }
            } catch (e) {
                console.error(e)
            }
        }

        return () => socket.close()
    }, [])

    useEffect(() => {
    const handler = (e: KeyboardEvent) => {
        if (e.code === "Space" && status === "connected") {
            e.preventDefault()
            next()
        }
    }

    window.addEventListener("keydown", handler)

    return () => window.removeEventListener("keydown", handler)
}, [status])
    function createPeerConnection() {
        cleanupPeer()
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: "stun:stun.relay.metered.ca:80" },
                { urls: "turn:global.relay.metered.ca:80", username: "0e7fe5b1308e37408258d04e", credential: "aQA4dJ1X4pt9MCAe" },
                { urls: "turn:global.relay.metered.ca:80?transport=tcp", username: "0e7fe5b1308e37408258d04e", credential: "aQA4dJ1X4pt9MCAe" },
                { urls: "turn:global.relay.metered.ca:443", username: "0e7fe5b1308e37408258d04e", credential: "aQA4dJ1X4pt9MCAe" },
                { urls: "turns:global.relay.metered.ca:443?transport=tcp", username: "0e7fe5b1308e37408258d04e", credential: "aQA4dJ1X4pt9MCAe" },
            ],
        })
        pcRef.current = pc

        pc.onicecandidate = (e) => {
            if (e.candidate) socketRef.current?.send(JSON.stringify({ type: 'iceCandidate', candidate: e.candidate }))
        }

        pc.ontrack = (e) => {
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0]
        }

        pc.onconnectionstatechange = () => console.log("conn:", pc.connectionState)

        return pc
    }

    function cleanupPeer() {
        pcRef.current?.close()
        pcRef.current = null
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
    }

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            localStreamRef.current = stream
            if (localVideoRef.current) {
    localVideoRef.current.srcObject = stream
    await localVideoRef.current.play().catch(console.error)
}
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream
                localVideoRef.current.play().catch(console.error)
            }
            socketRef.current?.send(JSON.stringify({ type: 'join' }))
            setStatus('waiting')
        } catch (e) {
            console.error('Camera error:', e)
            alert('Camera access denied or not available')
        }
    }

  const next = () => {
    if (cooldown) return

    setCooldown(true)

    cleanupPeer()

    socketRef.current?.send(JSON.stringify({
        type: "next"
    }))

    setStatus("waiting")

    setTimeout(() => setCooldown(false), 1000)
}

    if (status === 'idle') {
        return (
            <div className="h-dvh w-full bg-black flex flex-col items-center justify-center gap-3">
                <h1 className="text-4xl font-bold text-white tracking-tight">Vynkk 😉</h1>
                <p className="text-sm text-white/30 mb-6">Anonymous video chat

No signup required.</p>
                <button
                    onClick={startCamera}
                    className="bg-white text-black font-semibold text-base px-12 py-3 rounded-full active:scale-95 transition-transform"
                >
                    Start
                </button>
                <p className="text-xs text-white/20 mt-8">
Press Space for Next
</p>
            </div>
        )
    }

    return (
        <div className="h-dvh w-full bg-black flex flex-col overflow-hidden">

            {/* videos */}
            <div className="flex-1 grid grid-cols-2 md:grid-cols-2 grid-rows-1 gap-0.5 bg-neutral-900 min-h-0 max-sm:grid-cols-1 max-sm:grid-rows-2">

                {/* local */}
                <div className="relative bg-black overflow-hidden">
                    <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300 [transform:scaleX(-1)]"
                    />
                    <span className="absolute top-3 left-3 text-[10px] font-semibold uppercase tracking-widest text-white/40 bg-black/40 backdrop-blur px-2 py-1 rounded">
                        You
                    </span>
                </div>

            
                {/* remote */}
                <div className="relative bg-black overflow-hidden">
                    
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        muted={muted}
                        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
                    />
                    <span className="absolute top-3 left-3 text-[10px] font-semibold uppercase tracking-widest text-white/40 bg-black/40 backdrop-blur px-2 py-1 rounded">
                        Stranger
                    </span>
                    {status === "connected" && (
    <span className="absolute top-3 right-3 text-xs bg-black/50 px-2 py-1 rounded text-white/70">
        {Math.floor(seconds / 60)
            .toString()
            .padStart(2, "0")}
        :
        {(seconds % 60).toString().padStart(2, "0")}
    </span>
)}


                    {/* waiting overlay */}
                    {status === 'waiting' && (
                        <div className="absolute inset-0 bg-neutral-950 flex flex-col items-center justify-center gap-4">
                            <div className="flex gap-1.5">
                                {[0, 1, 2].map(i => (
                                    <div
                                        key={i}
                                        className="w-2 h-2 rounded-full bg-white/60 animate-pulse"
                                        style={{ animationDelay: `${i * 0.2}s` }}
                                    />
                                ))}
                            </div>
                            <p className="text-xs text-white/30 tracking-widest uppercase">{waitingMessages[waitingIndex]}</p>
                        </div>
                    )}
                    
                </div>
            </div>

            {/* bottom bar */}
            <div className="bg-black border-t border-white/5 px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] flex items-center justify-center gap-3">
                {status === 'connected' && muted && (
                    <button
                        onClick={() => setMuted(false)}
                        className="bg-white text-black font-semibold text-sm px-6 py-2.5 rounded-full active:scale-95 transition-transform"
                    >
                        Unmute
                    </button>
                )}
                <button
                    onClick={next}
                    disabled={cooldown}
                    className={`${
cooldown
? "opacity-50 cursor-not-allowed"
: ""
} bg-neutral-900 ...`}
                >
                    Next
                </button>
            </div>

            {/* status */}
            <p className="text-center text-[10px] uppercase tracking-widest text-white/20 pb-2 bg-black">
                {status === 'waiting' ? 'searching' : 'connected'}
            </p>
        </div>
    )
}