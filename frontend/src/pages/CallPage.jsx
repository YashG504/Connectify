import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Peer from "simple-peer";
import { socket, connectSocket } from "../lib/socket"; 
import useAuthUser from "../hooks/useAuthUser";
import { useQuery } from "@tanstack/react-query";
import { getUserProfile } from "../lib/api"; 
import PageLoader from "../components/PageLoader";
import toast from "react-hot-toast";

const CallPage = () => {
  const { id: receiverId } = useParams();
  const { authUser } = useAuthUser();
  const navigate = useNavigate();

  const [stream, setStream] = useState(null);
  const [receivingCall, setReceivingCall] = useState(false);
  const [callerSignal, setCallerSignal] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);

  const myVideo = useRef();
  const userVideo = useRef();
  // THE LOCK: Prevents the crashing loop
  const connectionRef = useRef(null);
  // Ref to hold the latest endCall function
  const endCallRef = useRef();

  const { data: receiverProfile, isLoading: loadingProfile } = useQuery({
    queryKey: ["userProfile", receiverId],
    queryFn: () => getUserProfile(receiverId),
    enabled: !!receiverId,
  });

  const endCall = useCallback(() => {
    if (connectionRef.current) {
      connectionRef.current.destroy();
      connectionRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    navigate("/");
  }, [stream, navigate]);

  // Update the ref with the latest endCall
  endCallRef.current = endCall;

  // Ensure socket is connected
  useEffect(() => {
    if (!socket.connected && authUser?._id) {
      connectSocket(authUser._id);
    }
  }, [authUser]);

  // Initialize Media once
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((s) => {
        setStream(s);
        if (myVideo.current) myVideo.current.srcObject = s;
      })
      .catch(() => toast.error("Camera access denied"));
  }, []);

  // Persistent Listeners
  useEffect(() => {
    socket.on("incoming-call", ({ offer }) => {
      setReceivingCall(true);
      setCallerSignal(offer);
    });

    socket.on("call-accepted", ({ answer }) => {
      setCallAccepted(true);
      if (connectionRef.current) connectionRef.current.signal(answer);
    });

    socket.on("ice-candidate", ({ candidate }) => {
      if (connectionRef.current) connectionRef.current.signal(candidate);
    });

    socket.on("call-rejected", () => {
      toast.error("Call declined");
      endCallRef.current();
    });

    return () => {
      socket.off("incoming-call");
      socket.off("call-accepted");
      socket.off("ice-candidate");
      socket.off("call-rejected");
    };
  }, []);

  // CALLER LOGIC: Initiated by Button to prevent "Brave vs Edge" race
  const startCall = () => {
    if (!stream || connectionRef.current || !socket.connected) return;

    const peer = new Peer({
      initiator: true,
      trickle: true,
      stream: stream,
      config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] }
    });

    peer.on("signal", (data) => {
      if (data.type === "offer") {
        socket.emit("call-user", { to: receiverId, offer: data, fromName: authUser.fullName });
      } else if (data.candidate) {
        socket.emit("ice-candidate", { to: receiverId, candidate: data });
      }
    });

    peer.on("stream", (remoteStream) => {
      if (userVideo.current) userVideo.current.srcObject = remoteStream;
    });

    connectionRef.current = peer;
  };

  const answerCall = () => {
    setCallAccepted(true);
    if (!socket.connected) return;
    const peer = new Peer({
      initiator: false,
      trickle: true,
      stream: stream,
      config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] }
    });

    peer.on("signal", (data) => {
      if (data.type === "answer") {
        socket.emit("answer-call", { to: receiverId, answer: data });
      } else if (data.candidate) {
        socket.emit("ice-candidate", { to: receiverId, candidate: data });
      }
    });

    peer.on("stream", (remoteStream) => {
      if (userVideo.current) userVideo.current.srcObject = remoteStream;
    });

    peer.signal(callerSignal);
    connectionRef.current = peer;
  };

  if (loadingProfile) return <PageLoader />;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white p-4">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold">{receiverProfile?.fullName}</h2>
        <p className="text-slate-400">{callAccepted ? "• Connected" : "Establishing connection..."}</p>
      </div>

      <div className="flex flex-wrap justify-center gap-6 w-full max-w-5xl">
        <video playsInline muted ref={myVideo} autoPlay className="w-full max-w-md rounded-3xl border-2 border-slate-700 bg-black" />
        {callAccepted && (
          <video playsInline ref={userVideo} autoPlay className="w-full max-w-md rounded-3xl border-2 border-primary bg-black" />
        )}
      </div>

      <div className="mt-12 flex flex-col items-center gap-4">
        {!receivingCall && !callAccepted && !connectionRef.current && (
          <button onClick={startCall} disabled={!socket.connected} className={`btn btn-primary px-12 rounded-full h-14 text-lg ${!socket.connected ? 'btn-disabled' : ''}`}>Start Video Call</button>
        )}

        {receivingCall && !callAccepted && (
          <div className="flex gap-4">
            <button onClick={answerCall} className="btn btn-success px-12 h-14 rounded-full text-lg">Answer</button>
            <button onClick={() => { socket.emit("reject-call", { to: receiverId }); endCall(); }} className="btn btn-error px-12 h-14 rounded-full text-lg">Decline</button>
          </div>
        )}

        {(callAccepted || connectionRef.current) && (
          <button onClick={endCall} className="btn btn-error btn-circle btn-lg h-16 w-16 shadow-lg shadow-red-500/20">End</button>
        )}
      </div>
    </div>
  );
};

export default CallPage;