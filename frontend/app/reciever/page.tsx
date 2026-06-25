"use client";
import { useEffect, useRef, useState } from "react";

export default function Reciever() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null); // ✅ ref instead of state
    const [muted, setMuted] = useState(true)    
    useEffect(() => {
        const socket = new WebSocket('ws://localhost:8080')
        
        socket.onopen = () => {
            socket.send(JSON.stringify({ type: "reciever" }));
        };
        
        socket.onmessage = async (event: any) => {
            try {
                const message = JSON.parse(event.data);
                
                if (message.type === "createOffer") {
                    const pc = new RTCPeerConnection();
                    pcRef.current = pc; 
                    pc.onconnectionstatechange = () => console.log("conn:", pc.connectionState)
pc.oniceconnectionstatechange = () => console.log("ice:", pc.iceConnectionState)

                    pc.onicecandidate = (event) => {
                        if (event.candidate) {
                            socket.send(JSON.stringify({ type: "iceCandidate", candidate: event.candidate }));
                        }
                    };

                    pc.ontrack = (event) => {
    console.log("track received!", event.track)
    if (event.track.kind === 'video') {
        const stream = event.streams[0] ?? new MediaStream([event.track])
        if (videoRef.current) {
            videoRef.current.srcObject = stream
            videoRef.current.play().catch(console.error)
        }
    }
}
                    await pc.setRemoteDescription(new RTCSessionDescription(message.sdp));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    socket.send(JSON.stringify({ type: "createAnswer", sdp: pc.localDescription }));

                } else if (message.type === "iceCandidate") {
                    await pcRef.current?.addIceCandidate(message.candidate) // ✅ ref is always current
                }
            } catch (e) {
                console.error(e);
            }
        };
    }, []);

    

    return (
        <div>
          

<video 
    ref={videoRef} 
    autoPlay 
    playsInline
    muted={muted}
    style={{ width: '640px', height: '480px', background: 'black' }} 
/>
<button onClick={() => setMuted(false)}>Unmute</button>
        </div>
    );
}