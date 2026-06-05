import { useEffect, useRef, useState } from "react";
import Peer from "simple-peer";
import { socket } from "../lib/socket";

/**
 * ICE Server Configuration with TURN servers.
 * Required for real-world WebRTC connections behind NATs/firewalls.
 */
const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
};

export const useWebRTC = (receiverId, authUser) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const [isCalling, setIsCalling] = useState(false);

  const connectionRef = useRef();

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        setLocalStream(stream);
      })
      .catch(err => console.error("Media Error:", err));

    // Listen for incoming network paths (ICE)
    socket.on("ice-candidate", ({ candidate }) => {
      if (connectionRef.current) {
        connectionRef.current.signal(candidate);
      }
    });

    return () => {
      socket.off("ice-candidate");
    };
  }, []);

  const startCall = () => {
    setIsCalling(true);
    const peer = new Peer({ 
      initiator: true, 
      trickle: true, 
      stream: localStream,
      config: ICE_SERVERS,
    });

    peer.on("signal", (data) => {
      if (data.type === "offer") {
        socket.emit("call-user", { 
          to: receiverId, 
          offer: data, 
          fromName: authUser.fullName 
        });
      } else {
        socket.emit("ice-candidate", { to: receiverId, candidate: data });
      }
    });

    peer.on("stream", (stream) => {
      setRemoteStream(stream);
    });

    peer.on("error", (err) => {
      console.error("Peer connection error:", err);
    });

    socket.on("call-accepted", ({ answer }) => {
      setCallAccepted(true);
      peer.signal(answer);
    });

    connectionRef.current = peer;
  };

  const endCall = () => {
    if (connectionRef.current) {
      connectionRef.current.destroy();
      connectionRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    setCallAccepted(false);
    setIsCalling(false);
    setLocalStream(null);
    setRemoteStream(null);
  };

  return { localStream, remoteStream, callAccepted, isCalling, startCall, endCall };
};