import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom"; // Added useNavigate
import useAuthUser from "../hooks/useAuthUser";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMessages, sendMessage, getUserProfile, addReaction, uploadImage, markMessagesAsRead, deleteMessage } from "../lib/api";
import { socket } from "../lib/socket"; 
import toast from "react-hot-toast";

import ChatLoader from "../components/ChatLoader";
import CallButton from "../components/CallButton";

const ChatPage = () => {
  const { id: targetUserId } = useParams();
  const { authUser } = useAuthUser();
  const navigate = useNavigate(); // For redirecting to call page
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const messageEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);

  const { data: targetUser } = useQuery({
    queryKey: ["userProfile", targetUserId],
    queryFn: () => getUserProfile(targetUserId),
    enabled: !!targetUserId,
  });

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["messages", targetUserId],
    queryFn: () => getMessages(targetUserId),
    enabled: !!targetUserId,
  });

  const filteredMessages = messages.filter(msg => 
    !search || (msg.text && msg.text.toLowerCase().includes(search.toLowerCase()))
  );

  const { mutate: sendMsg } = useMutation({
    mutationFn: (msgData) => sendMessage(targetUserId, msgData),
    onSuccess: (newMessage) => {
      queryClient.setQueryData(["messages", targetUserId], (old) => [...old, newMessage]);
      setMessage("");
    },
  });

  const { mutate: reactToMessage } = useMutation({
    mutationFn: ({ messageId, emoji }) => addReaction(messageId, emoji),
    onSuccess: (reactions, { messageId }) => {
      queryClient.setQueryData(["messages", targetUserId], (old) =>
        old.map(msg => msg._id === messageId ? { ...msg, reactions } : msg)
      );
    },
  });

  const { mutate: delMessage } = useMutation({
    mutationFn: (messageId) => deleteMessage(messageId),
    onSuccess: (deletedMessage) => {
      queryClient.setQueryData(["messages", targetUserId], (old) =>
        old.map(msg => msg._id === deletedMessage._id ? deletedMessage : msg)
      );
      toast.success("Message deleted");
    },
  });

  // Mark messages as read when opening chat
  useEffect(() => {
    if (messages.length > 0) {
      const hasUnread = messages.some(
        msg => msg.senderId === targetUserId && !msg.readAt
      );
      if (hasUnread) {
        markMessagesAsRead(targetUserId);
        // Optimistically mark as read locally
        queryClient.setQueryData(["messages", targetUserId], (old) =>
          old.map(msg => 
            msg.senderId === targetUserId && !msg.readAt 
              ? { ...msg, readAt: new Date().toISOString() } 
              : msg
          )
        );
      }
    }
  }, [messages, targetUserId, queryClient]);

  const handleInputChange = (e) => {
    setMessage(e.target.value);
    if (!socket.connected) return;
    socket.emit("typing", { to: targetUserId, typing: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing", { to: targetUserId, typing: false });
    }, 1000);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const { imageUrl } = await uploadImage(file);
      sendMsg({ image: imageUrl });
    } catch (error) {
      toast.error("Failed to upload image");
    }
  };

  // Handle initiating a call through the chat link
  const handleVideoCall = () => {
    const callUrl = `/call/${targetUserId}`;
    
    // Send a message so the receiver can join
    sendMsg({ 
      text: `🎥 Join my video call here: ${window.location.origin}${callUrl}` 
    });

    // Move caller to the call page immediately
    navigate(callUrl);
  };

  useEffect(() => {
    socket.on("typing", ({ from, typing }) => {
      if (from === targetUserId) {
        setIsTyping(typing);
      }
    });
    socket.on("messageReaction", ({ messageId, reactions }) => {
      queryClient.setQueryData(["messages", targetUserId], (old) =>
        old.map(msg => msg._id === messageId ? { ...msg, reactions } : msg)
      );
    });
    return () => {
      socket.off("typing");
      socket.off("messageReaction");
    };
  }, [targetUserId, queryClient]);

  useEffect(() => {
    if (!socket) return;
    socket.on("newMessage", (newMessage) => {
      if (newMessage.senderId === targetUserId) {
        queryClient.setQueryData(["messages", targetUserId], (old) => [...old, newMessage]);
        // Also immediately mark this new message as read since we are in the chat
        markMessagesAsRead(targetUserId);
      }
    });

    socket.on("messages-read", ({ readerId }) => {
      if (readerId === targetUserId) {
        queryClient.setQueryData(["messages", targetUserId], (old) =>
          old.map(msg => 
            msg.senderId === authUser?._id && !msg.readAt 
              ? { ...msg, readAt: new Date().toISOString() } 
              : msg
          )
        );
      }
    });

    socket.on("message-deleted", (deletedMessage) => {
      queryClient.setQueryData(["messages", targetUserId], (old) =>
        old.map(msg => msg._id === deletedMessage._id ? deletedMessage : msg)
      );
    });

    return () => {
      socket.off("newMessage");
      socket.off("messages-read");
      socket.off("message-deleted");
    };
  }, [targetUserId, queryClient, authUser?._id]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    sendMsg({ text: message });
  };

  if (isLoading || !targetUser) return <ChatLoader />;

  return (
    <div className="flex flex-col h-[93vh] bg-base-200">
      <div className="p-4 bg-base-100 border-b flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="avatar">
            <div className="w-10 rounded-full">
              <img src={targetUser.profilePic || "/avatar.png"} alt="avatar" />
            </div>
          </div>
          <span className="font-bold">{targetUser.fullName}</span>
        </div>
        {/* Trigger the handleVideoCall logic */}
        <div onClick={handleVideoCall}>
            <CallButton receiverId={targetUserId} />
        </div>
      </div>

      {isTyping && (
        <div className="px-4 py-2 text-sm text-gray-500">
          {targetUser?.fullName} is typing...
        </div>
      )}

      <div className="px-4 py-2">
        <input
          type="text"
          placeholder="Search messages..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input input-bordered w-full"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {filteredMessages.map((msg) => (
          <div key={msg._id} className={`chat ${msg.senderId === authUser._id ? "chat-end" : "chat-start"}`}>
            <div className={`chat-bubble ${msg.text?.includes("/call/") ? "bg-primary text-primary-content" : ""}`}>
                {msg.text?.includes("/call/") ? (
                    <a href={msg.text.split(" ").pop()} className="underline font-bold">
                        {msg.text}
                    </a>
                ) : (
                    <span className={msg.isDeleted ? "italic opacity-60" : ""}>
                      {msg.text}
                    </span>
                )}
                {msg.image && <img src={msg.image} alt="image" className="mt-2 max-w-full rounded" />}
                
                <div className="flex justify-between items-end mt-1 gap-2">
                  {/* Reactions */}
                  {msg.reactions && msg.reactions.length > 0 ? (
                    <div className="flex gap-1">
                      {msg.reactions.map((r, i) => (
                        <span key={i} className="text-xs bg-base-100 text-base-content rounded px-1">{r.emoji}</span>
                      ))}
                    </div>
                  ) : <div />}

                  {/* Read Receipts */}
                  {msg.senderId === authUser._id && !msg.isDeleted && (
                    <span className="text-[10px] opacity-70">
                      {msg.readAt ? "✓✓" : "✓"}
                    </span>
                  )}
                </div>
            </div>
            <div className="flex gap-1 items-center">
              {!msg.isDeleted && (
                <>
                  <button onClick={() => reactToMessage({ messageId: msg._id, emoji: "👍" })} className="btn btn-xs btn-ghost px-1">👍</button>
                  <button onClick={() => reactToMessage({ messageId: msg._id, emoji: "❤️" })} className="btn btn-xs btn-ghost px-1">❤️</button>
                  <button onClick={() => reactToMessage({ messageId: msg._id, emoji: "😂" })} className="btn btn-xs btn-ghost px-1">😂</button>
                  
                  {msg.senderId === authUser._id && (
                    <button 
                      onClick={() => delMessage(msg._id)} 
                      className="btn btn-xs btn-ghost text-error px-1 ml-2"
                      title="Delete message"
                    >
                      🗑️
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
        <div ref={messageEndRef} />
      </div>

      <form onSubmit={handleSend} className="p-4 bg-base-100 flex gap-2">
        <input
          type="text"
          className="input input-bordered flex-1"
          placeholder="Type a message..."
          value={message}
          onChange={handleInputChange}
        />
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          ref={fileInputRef}
          className="hidden"
        />
        <button type="button" onClick={() => fileInputRef.current.click()} className="btn btn-circle">
          📎
        </button>
        <button type="submit" className="btn btn-primary">Send</button>
      </form>
    </div>
  );
};

export default ChatPage;