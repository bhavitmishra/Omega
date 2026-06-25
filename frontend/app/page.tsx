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
                        // sender creates offer
                        localStreamRef.current?.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current!))
                        const offer = await pc.createOffer()
                        await pc.setLocalDescription(offer)
                        socket.send(JSON.stringify({ type: 'createOffer', sdp: pc.localDescription }))
                    } else {
                        // receiver waits for offer, but adds tracks too for two-way
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
      {
        urls: "stun:stun.relay.metered.ca:80",
      },
      {
        urls: "turn:global.relay.metered.ca:80",
        username: "0e7fe5b1308e37408258d04e",
        credential: "aQA4dJ1X4pt9MCAe",
      },
      {
        urls: "turn:global.relay.metered.ca:80?transport=tcp",
        username: "0e7fe5b1308e37408258d04e",
        credential: "aQA4dJ1X4pt9MCAe",
      },
      {
        urls: "turn:global.relay.metered.ca:443",
        username: "0e7fe5b1308e37408258d04e",
        credential: "aQA4dJ1X4pt9MCAe",
      },
      {
        urls: "turns:global.relay.metered.ca:443?transport=tcp",
        username: "0e7fe5b1308e37408258d04e",
        credential: "aQA4dJ1X4pt9MCAe",
      },
  ],
        })
        pcRef.current = pc

        pc.onicecandidate = (e) => {
            if (e.candidate) {
                socketRef.current?.send(JSON.stringify({ type: 'iceCandidate', candidate: e.candidate }))
            }
        }

        pc.ontrack = (e) => {
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = e.streams[0]
            }
        }

        pc.onconnectionstatechange = () => {
            console.log("conn:", pc.connectionState)
        }

        return pc
    }

    function cleanupPeer() {
        pcRef.current?.close()
        pcRef.current = null
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
    }

    const startCamera = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        localStreamRef.current = stream
        if (localVideoRef.current) localVideoRef.current.srcObject = stream

        // join queue
        socketRef.current?.send(JSON.stringify({ type: 'join' }))
        setStatus('waiting')
    }

    const next = () => {
        cleanupPeer()
        socketRef.current?.send(JSON.stringify({ type: 'next' }))
        setStatus('waiting')
    }

    return (
        <div className="flex flex-col items-center gap-4 p-4">
            <div className="flex gap-4">
                <div className="flex flex-col items-center gap-1">
                    <span className="text-sm text-gray-400">You</span>
                    <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{ width: '480px', height: '360px', background: 'black', borderRadius: '8px' }}
                    />
                </div>
                <div className="flex flex-col items-center gap-1">
                    <span className="text-sm text-gray-400">Stranger</span>
                    <div style={{ position: 'relative', width: '480px', height: '360px' }}>
                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            muted={muted}
                            style={{ width: '480px', height: '360px', background: 'black', borderRadius: '8px' }}
                        />
                        {status === 'waiting' && (
                            <div style={{
                                position: 'absolute', inset: 0, display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                background: '#111', borderRadius: '8px', color: 'white'
                            }}>
                                Finding someone...
                            </div>
                        )}
                        {status === 'idle' && (
                            <div style={{
                                position: 'absolute', inset: 0, display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                background: '#111', borderRadius: '8px', color: 'white'
                            }}>
                                Click Start to begin
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex gap-3">
                {status === 'idle' && (
                    <button
                        onClick={startCamera}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg"
                    >
                        Start
                    </button>
                )}
                {status !== 'idle' && (
                    <>
                        <button
                            onClick={next}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg"
                        >
                            Next
                        </button>
                        {muted && status === 'connected' && (
                            <button
                                onClick={() => setMuted(false)}
                                className="px-6 py-2 bg-gray-600 text-white rounded-lg"
                            >
                                Unmute
                            </button>
                        )}
                    </>
                )}
            </div>

            <div className="text-sm text-gray-500">
                {status === 'idle' && 'Press Start to find a stranger'}
                {status === 'waiting' && 'Looking for someone...'}
                {status === 'connected' && 'Connected!'}
            </div>
        </div>
    )
}
