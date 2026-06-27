"use client"
import { useEffect, useState, useRef } from "react"

type Status = 'idle' | 'waiting' | 'connected'

export default function OmeTV() {
    const [status, setStatus] = useState<Status>('idle')
    const [muted, setMuted] = useState(true)
    const socketRef = useRef<WebSocket | null>(null)
    const pcRef = useRef<RTCPeerConnection | null>(null)
    const localStreamRef = useRef<MediaStream | null>(null)
    const localVideoRef = useRef<HTMLVideoElement>(null)
    const remoteVideoRef = useRef<HTMLVideoElement>(null)

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
        cleanupPeer()
        socketRef.current?.send(JSON.stringify({ type: 'next' }))
        setStatus('waiting')
    }

    if (status === 'idle') {
        return (
            <div className="h-dvh w-full bg-black flex flex-col items-center justify-center gap-3">
                <h1 className="text-4xl font-bold text-white tracking-tight">omega</h1>
                <p className="text-sm text-white/30 mb-6">Talk to strangers</p>
                <button
                    onClick={startCamera}
                    className="bg-white text-black font-semibold text-base px-12 py-3 rounded-full active:scale-95 transition-transform"
                >
                    Start
                </button>
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
                        className="absolute inset-0 w-full h-full object-cover [transform:scaleX(-1)]"
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
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                    <span className="absolute top-3 left-3 text-[10px] font-semibold uppercase tracking-widest text-white/40 bg-black/40 backdrop-blur px-2 py-1 rounded">
                        Stranger
                    </span>

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
                            <p className="text-xs text-white/30 tracking-widest uppercase">Finding someone</p>
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
                    className="bg-neutral-900 border border-white/10 text-white font-semibold text-sm px-8 py-2.5 rounded-full active:scale-95 transition-transform"
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