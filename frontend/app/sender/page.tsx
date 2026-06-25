"use client"
import { useEffect, useState, useRef } from "react"

export default function VideoCall() {
    const [socket, setSocket] = useState<WebSocket | null>(null)
    const [muted, setMuted] = useState(true)
    const pcRef = useRef<RTCPeerConnection | null>(null)
    const localVideoRef = useRef<HTMLVideoElement>(null)
    const remoteVideoRef = useRef<HTMLVideoElement>(null)

    useEffect(() => {
        const socket = new WebSocket('ws://localhost:8080')
        setSocket(socket)

        socket.onopen = () => {
            socket.send(JSON.stringify({ type: 'sender' }))
        }

        socket.onmessage = async (event: any) => {
            try {
                const message = JSON.parse(event.data)

                if (message.type === "createOffer") {
                    const pc = new RTCPeerConnection()
                    pcRef.current = pc

                    pc.onicecandidate = (e) => {
                        if (e.candidate) socket.send(JSON.stringify({ type: "iceCandidate", candidate: e.candidate }))
                    }

                    pc.ontrack = (e) => {
                        if (e.track.kind === 'video') {
                            const stream = e.streams[0] ?? new MediaStream([e.track])
                            if (remoteVideoRef.current) {
                                remoteVideoRef.current.srcObject = stream
                                remoteVideoRef.current.play().catch(console.error)
                            }
                        }
                    }

                    await pc.setRemoteDescription(new RTCSessionDescription(message.sdp))
                    const answer = await pc.createAnswer()
                    await pc.setLocalDescription(answer)
                    socket.send(JSON.stringify({ type: "createAnswer", sdp: pc.localDescription }))

                } else if (message.type === "createAnswer") {
                    await pcRef.current?.setRemoteDescription(new RTCSessionDescription(message.sdp))

                } else if (message.type === "iceCandidate") {
                    await pcRef.current?.addIceCandidate(message.candidate)
                }
            } catch (e) {
                console.error(e)
            }
        }

        setSocket(socket)
    }, [])

    const sendVideo = async () => {
        if (!socket) return

        const pc = new RTCPeerConnection()
        pcRef.current = pc

        pc.onnegotiationneeded = async () => {
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            socket.send(JSON.stringify({ type: 'createOffer', sdp: pc.localDescription }))
        }

        pc.onicecandidate = (e) => {
            if (e.candidate) socket.send(JSON.stringify({ type: "iceCandidate", candidate: e.candidate }))
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })

        if (localVideoRef.current) localVideoRef.current.srcObject = stream

        const video = document.createElement('video')
        video.srcObject = stream
        video.play()

        const canvas = document.createElement('canvas')
        canvas.width = 640
        canvas.height = 480
        const ctx = canvas.getContext('2d')!

        const draw = () => {
            ctx.save()
            ctx.scale(-1, 1)
            ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height)
            ctx.restore()
            requestAnimationFrame(draw)
        }
        video.onloadedmetadata = () => draw()

        const flippedStream = canvas.captureStream(30)
        stream.getAudioTracks().forEach(track => flippedStream.addTrack(track))
        flippedStream.getTracks().forEach(track => pc.addTrack(track, flippedStream))
    }

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex gap-4">
                <div className="flex flex-col items-center gap-2">
                    <span>You</span>
                    <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{ width: '640px', height: '480px', background: 'black' }}
                    />
                </div>
                <div className="flex flex-col items-center gap-2">
                    <span>Remote</span>
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        muted={muted}
                        style={{ width: '640px', height: '480px', background: 'black' }}
                    />
                </div>
            </div>
            <div className="flex gap-2">
                <button onClick={sendVideo}>Send Video</button>
                <button onClick={() => setMuted(false)}>Unmute</button>
            </div>
        </div>
    )
}