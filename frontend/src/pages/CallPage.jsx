import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Peer from "simple-peer";
import { socket, connectSocket } from "../lib/socket"; 
import useAuthUser from "../hooks/useAuthUser";
import { useQuery } from "@tanstack/react-query";
import { getUserProfile } from "../lib/api"; 
import PageLoader from "../components/PageLoader";
import toast from "react-hot-toast";
import { PhoneOff, Video, Mic, MicOff, VideoOff } from "lucide-react";

/**
 * ICE Server Configuration.
 * STUN servers help discover your public IP. TURN servers relay media when
 * direct peer-to-peer connections fail (symmetric NATs, corporate firewalls).
 * Without TURN, ~30% of real-world connections will fail.
 */
const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    // Free TURN servers for development/testing. 
    // For production, use a paid TURN provider (Twilio, Metered, Xirsys).
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

const CallPage = () => {
  const { id: receiverId } = useParams();
  const { authUser } = useAuthUser();
  const navigate = useNavigate();

  const [stream, setStream] = useState(null);
  const [receivingCall, setReceivingCall] = useState(false);
  const [callerSignal, setCallerSignal] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef(null);
  const endCallRef = useRef();
  const timerRef = useRef(null);

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
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    // Notify the other user that the call has ended
    if (socket.connected) {
      socket.emit("end-call", { to: receiverId });
    }
    navigate("/");
  }, [stream, navigate, receiverId]);

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
      .catch((err) => {
        console.error("Camera access error:", err);
        toast.error("Camera/Microphone access denied. Please grant permissions.");
      });

    // Cleanup: stop all tracks when component unmounts
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Call duration timer
  useEffect(() => {
    if (callAccepted) {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callAccepted]);

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

    socket.on("call-rejected", ({ reason } = {}) => {
      toast.error(reason || "Call declined");
      endCallRef.current();
    });

    socket.on("call-ended", () => {
      toast("Call ended by the other user", { icon: "📞" });
      endCallRef.current();
    });

    return () => {
      socket.off("incoming-call");
      socket.off("call-accepted");
      socket.off("ice-candidate");
      socket.off("call-rejected");
      socket.off("call-ended");
    };
  }, []);

  // CALLER LOGIC
  const startCall = () => {
    if (!stream || connectionRef.current || !socket.connected) return;

    const peer = new Peer({
      initiator: true,
      trickle: true,
      stream: stream,
      config: ICE_SERVERS,
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

    peer.on("error", (err) => {
      console.error("Peer error:", err);
      toast.error("Connection error. Please try again.");
      endCallRef.current();
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
      config: ICE_SERVERS,
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

    peer.on("error", (err) => {
      console.error("Peer error:", err);
      toast.error("Connection error. Please try again.");
      endCallRef.current();
    });

    peer.signal(callerSignal);
    connectionRef.current = peer;
  };

  // Media toggle controls
  const toggleMute = () => {
    if (stream) {
      stream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (stream) {
      stream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (loadingProfile) return <PageLoader />;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white p-4">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold">{receiverProfile?.fullName}</h2>
        <p className="text-slate-400">
          {callAccepted 
            ? `• Connected — ${formatDuration(callDuration)}` 
            : receivingCall 
              ? "Incoming call..." 
              : "Establishing connection..."}
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-6 w-full max-w-5xl">
        <div className="relative">
          <video playsInline muted ref={myVideo} autoPlay className="w-full max-w-md rounded-3xl border-2 border-slate-700 bg-black" />
          {isVideoOff && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-800 rounded-3xl">
              <VideoOff className="size-16 text-slate-500" />
            </div>
          )}
          <span className="absolute bottom-3 left-3 bg-black/60 text-xs px-2 py-1 rounded-lg">You</span>
        </div>
        {callAccepted && (
          <div className="relative">
            <video playsInline ref={userVideo} autoPlay className="w-full max-w-md rounded-3xl border-2 border-primary bg-black" />
            <span className="absolute bottom-3 left-3 bg-black/60 text-xs px-2 py-1 rounded-lg">{receiverProfile?.fullName}</span>
          </div>
        )}
      </div>

      <div className="mt-12 flex items-center gap-4">
        {/* Start Call Button */}
        {!receivingCall && !callAccepted && !connectionRef.current && (
          <button onClick={startCall} disabled={!socket.connected} className={`btn btn-primary px-12 rounded-full h-14 text-lg ${!socket.connected ? 'btn-disabled' : ''}`}>
            <Video className="size-5 mr-2" /> Start Video Call
          </button>
        )}

        {/* Answer / Decline */}
        {receivingCall && !callAccepted && (
          <div className="flex gap-4">
            <button onClick={answerCall} className="btn btn-success px-12 h-14 rounded-full text-lg">
              <Video className="size-5 mr-2" /> Answer
            </button>
            <button onClick={() => { socket.emit("reject-call", { to: receiverId }); endCall(); }} className="btn btn-error px-12 h-14 rounded-full text-lg">
              <PhoneOff className="size-5 mr-2" /> Decline
            </button>
          </div>
        )}

        {/* In-call controls */}
        {(callAccepted || connectionRef.current) && (
          <div className="flex items-center gap-3">
            <button onClick={toggleMute} className={`btn btn-circle btn-lg ${isMuted ? 'btn-warning' : 'btn-ghost border-slate-600'}`}>
              {isMuted ? <MicOff className="size-6" /> : <Mic className="size-6" />}
            </button>
            <button onClick={toggleVideo} className={`btn btn-circle btn-lg ${isVideoOff ? 'btn-warning' : 'btn-ghost border-slate-600'}`}>
              {isVideoOff ? <VideoOff className="size-6" /> : <Video className="size-6" />}
            </button>
            <button onClick={endCall} className="btn btn-error btn-circle btn-lg h-16 w-16 shadow-lg shadow-red-500/20">
              <PhoneOff className="size-6" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CallPage;