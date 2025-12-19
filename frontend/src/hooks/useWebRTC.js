import { useEffect, useRef, useState } from "react";
import Peer from "simple-peer";
import { socket } from "../lib/socket";

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
    // CHANGE: set trickle to true for faster, more reliable connections
    const peer = new Peer({ 
      initiator: true, 
      trickle: true, 
      stream: localStream,
      config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] } // Help bypass firewalls
    });

    peer.on("signal", (data) => {
      if (data.type === "offer") {
        socket.emit("call-user", { 
          to: receiverId, 
          offer: data, 
          fromName: authUser.fullName 
        });
      } else {
        // This is where the ICE Candidate data is sent to the other person
        socket.emit("ice-candidate", { to: receiverId, candidate: data });
      }
    });

    peer.on("stream", (stream) => {
      setRemoteStream(stream);
    });

    socket.on("call-accepted", ({ answer }) => {
      setCallAccepted(true);
      peer.signal(answer);
    });

    connectionRef.current = peer;
  };

  const endCall = () => {
    connectionRef.current?.destroy();
    window.location.reload(); 
  };

  return { localStream, remoteStream, callAccepted, isCalling, startCall, endCall };
};