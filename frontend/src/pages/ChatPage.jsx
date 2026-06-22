import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import useAuthUser from "../hooks/useAuthUser";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMessages, sendMessage, getUserProfile, addReaction, uploadImage, uploadFile, markMessagesAsRead, deleteMessage, pinMessage, getPinnedMessages, getThreadReplies, sendFileMessage } from "../lib/api";
import { useTranslateMessage, useSummarizeChat } from "../hooks/useAI";
import { useThemeStore } from "../store/useThemeStore";
import { socket } from "../lib/socket"; 
import toast from "react-hot-toast";
import EmojiPicker from "emoji-picker-react";
import {
  ArrowLeftIcon,
  SmileIcon,
  ImagePlusIcon,
  SendIcon,
  GlobeIcon,
  Trash2Icon,
  SparklesIcon,
  VideoIcon,
  XIcon,
  PinIcon,
  MessageSquareIcon,
  PaperclipIcon,
  FileTextIcon,
  DownloadIcon,
} from "lucide-react";

import ChatLoader from "../components/ChatLoader";

// Notification sound
const playNotificationSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {}
};

const ChatPage = () => {
  const { id: targetUserId } = useParams();
  const { authUser } = useAuthUser();
  const navigate = useNavigate();
  const { onlineUsers } = useThemeStore();
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const queryClient = useQueryClient();
  const messageEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const emojiPickerRef = useRef(null);

  // AI States
  const [translations, setTranslations] = useState({});
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [summaryText, setSummaryText] = useState(null);

  // Thread states
  const [threadParent, setThreadParent] = useState(null);
  const [threadReplies, setThreadReplies] = useState([]);
  const [threadMsg, setThreadMsg] = useState("");
  const [loadingThread, setLoadingThread] = useState(false);

  // Pinned messages
  const [showPinned, setShowPinned] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState([]);

  // File input ref
  const docInputRef = useRef(null);

  const isOnline = onlineUsers.has(targetUserId);

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

  const { mutate: sendMsg, isPending: isSending } = useMutation({
    mutationFn: (msgData) => sendMessage(targetUserId, msgData),
    onSuccess: (newMessage) => {
      queryClient.setQueryData(["messages", targetUserId], (old) => [...(old || []), newMessage]);
      queryClient.invalidateQueries({ queryKey: ["friendsDM"] });
      setMessage("");
      setShowEmojiPicker(false);
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

  // AI Mutations
  const { mutate: translateMsg, isPending: isTranslating } = useTranslateMessage();
  const { mutate: summarizeChat, isPending: isSummarizing } = useSummarizeChat(targetUserId);

  const handleTranslate = (msgId, text, language) => {
    translateMsg(
      { text, targetLanguage: language },
      {
        onSuccess: (data) => {
          setTranslations(prev => ({ ...prev, [msgId]: data.translatedText }));
        }
      }
    );
  };

  const handleSummarize = () => {
    setSummaryModalOpen(true);
    setSummaryText(null);
    summarizeChat(undefined, {
      onSuccess: (data) => { setSummaryText(data.summary); }
    });
  };

  // Pin message handler
  const handlePin = async (messageId) => {
    try {
      const updated = await pinMessage(messageId);
      queryClient.setQueryData(["messages", targetUserId], (old) =>
        old.map(msg => msg._id === messageId ? { ...msg, isPinned: updated.isPinned } : msg)
      );
      toast.success(updated.isPinned ? "Message pinned" : "Message unpinned");
    } catch { toast.error("Failed to pin message"); }
  };

  // Show pinned messages
  const handleShowPinned = async () => {
    try {
      const pins = await getPinnedMessages(targetUserId);
      setPinnedMessages(pins);
      setShowPinned(true);
    } catch { toast.error("Failed to load pinned messages"); }
  };

  // Open thread
  const handleOpenThread = async (parentMsg) => {
    setThreadParent(parentMsg);
    setLoadingThread(true);
    try {
      const replies = await getThreadReplies(parentMsg._id);
      setThreadReplies(replies);
    } catch { toast.error("Failed to load thread"); }
    setLoadingThread(false);
  };

  // Send thread reply
  const handleSendThreadReply = async (e) => {
    e.preventDefault();
    if (!threadMsg.trim() || !threadParent) return;
    try {
      const reply = await sendMessage(targetUserId, { text: threadMsg, parentMessageId: threadParent._id });
      setThreadReplies(prev => [...prev, reply]);
      setThreadMsg("");
      // Update parent threadCount in main messages
      queryClient.setQueryData(["messages", targetUserId], (old) =>
        old.map(msg => msg._id === threadParent._id ? { ...msg, threadCount: (msg.threadCount || 0) + 1 } : msg)
      );
    } catch { toast.error("Failed to send reply"); }
  };

  // File upload handler
  const handleDocUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("File too large (max 10MB)"); return; }
    try {
      const { fileUrl, fileName, fileSize, fileType } = await uploadFile(file);
      await sendFileMessage(targetUserId, { fileUrl, fileName, fileSize, fileType });
      queryClient.invalidateQueries({ queryKey: ["messages", targetUserId] });
    } catch { toast.error("Failed to upload file"); }
  };

  // Link preview helper
  const renderTextWithLinks = (text) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
      if (urlRegex.test(part)) {
        urlRegex.lastIndex = 0;
        return (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="link link-info break-all">
            {part}
          </a>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  // File size formatter
  const formatFileSize = (bytes) => {
    if (!bytes) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  // Mark messages as read when opening chat
  useEffect(() => {
    if (messages.length > 0) {
      const hasUnread = messages.some(
        msg => msg.senderId === targetUserId && !msg.readAt
      );
      if (hasUnread) {
        markMessagesAsRead(targetUserId);
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

  const handleVideoCall = () => {
    const callUrl = `/call/${targetUserId}`;
    sendMsg({ text: `🎥 Join my video call here: ${window.location.origin}${callUrl}` });
    navigate(callUrl);
  };

  const handleEmojiClick = (emojiData) => {
    setMessage(prev => prev + emojiData.emoji);
  };

  // Close emoji picker on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    socket.on("typing", ({ from, typing }) => {
      if (from === targetUserId) setIsTyping(typing);
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
        // Only add to main chat if it's NOT a thread reply
        if (!newMessage.parentMessageId) {
          queryClient.setQueryData(["messages", targetUserId], (old) => [...(old || []), newMessage]);
        } else {
          // If it's a thread reply, update the parent's threadCount
          queryClient.setQueryData(["messages", targetUserId], (old) =>
            (old || []).map(msg => msg._id === newMessage.parentMessageId
              ? { ...msg, threadCount: (msg.threadCount || 0) + 1 }
              : msg
            )
          );
          // If thread panel is open for this parent, add the reply
          if (threadParent && threadParent._id === newMessage.parentMessageId) {
            setThreadReplies(prev => [...prev, newMessage]);
          }
        }
        markMessagesAsRead(targetUserId);
        playNotificationSound();
      }
      // Refresh sidebar DM previews
      queryClient.invalidateQueries({ queryKey: ["friendsDM"] });
    });

    socket.on("messages-read", ({ readerId }) => {
      if (readerId === targetUserId) {
        queryClient.setQueryData(["messages", targetUserId], (old) =>
          (old || []).map(msg => 
            msg.senderId === authUser?._id && !msg.readAt 
              ? { ...msg, readAt: new Date().toISOString() } 
              : msg
          )
        );
      }
    });

    socket.on("message-deleted", (deletedMessage) => {
      queryClient.setQueryData(["messages", targetUserId], (old) =>
        (old || []).map(msg => msg._id === deletedMessage._id ? deletedMessage : msg)
      );
      queryClient.invalidateQueries({ queryKey: ["friendsDM"] });
    });

    socket.on("message-pinned", ({ messageId, isPinned }) => {
      queryClient.setQueryData(["messages", targetUserId], (old) =>
        (old || []).map(msg => msg._id === messageId ? { ...msg, isPinned } : msg)
      );
    });

    return () => {
      socket.off("newMessage");
      socket.off("messages-read");
      socket.off("message-deleted");
      socket.off("message-pinned");
    };
  }, [targetUserId, queryClient, authUser?._id, threadParent]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    sendMsg({ text: message });
  };

  // Helper: format time
  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Helper: should show date separator
  const shouldShowDateSep = (msg, idx) => {
    if (idx === 0) return true;
    const prev = filteredMessages[idx - 1];
    const prevDate = new Date(prev.createdAt).toLocaleDateString();
    const curDate = new Date(msg.createdAt).toLocaleDateString();
    return prevDate !== curDate;
  };

  const formatDateSep = (date) => {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  };

  if (isLoading || !targetUser) return <ChatLoader />;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-base-200">
      {/* ---- CHAT HEADER ---- */}
      <div className="px-4 py-3 bg-base-100 border-b border-base-300 flex justify-between items-center z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <Link to="/" className="btn btn-ghost btn-circle btn-sm lg:hidden">
            <ArrowLeftIcon className="size-5" />
          </Link>
          <div className="avatar">
            <div className="w-10 rounded-full ring ring-offset-base-100 ring-offset-1 ring-1 ring-base-300">
              <img src={targetUser.profilePic || "/avatar.png"} alt="avatar" />
            </div>
          </div>
          <div>
            <h3 className="font-bold text-sm">{targetUser.fullName}</h3>
            <p className={`text-xs flex items-center gap-1 ${isOnline ? "text-success" : "opacity-50"}`}>
              <span className={`size-1.5 rounded-full inline-block ${isOnline ? "bg-success" : "bg-base-300"}`} />
              {isTyping ? <span className="text-info animate-pulse">typing...</span> : isOnline ? "Online" : "Offline"}
            </p>
          </div>
        </div>
        
        <div className="flex gap-1.5 items-center">
          <button onClick={() => setShowSearch(!showSearch)} className="btn btn-ghost btn-circle btn-sm" title="Search messages">
            🔍
          </button>
          <button onClick={handleShowPinned} className="btn btn-ghost btn-circle btn-sm" title="Pinned messages">
            <PinIcon className="size-4" />
          </button>
          <button onClick={handleSummarize} className="btn btn-ghost btn-circle btn-sm" title="AI Summarize">
            <SparklesIcon className="size-4 text-info" />
          </button>
          <button onClick={handleVideoCall} className="btn btn-ghost btn-circle btn-sm" title="Video Call">
            <VideoIcon className="size-4" />
          </button>
        </div>
      </div>

      {/* ---- SEARCH BAR (collapsible) ---- */}
      {showSearch && (
        <div className="px-4 py-2 bg-base-100 border-b border-base-300 flex gap-2">
          <input
            type="text"
            placeholder="Search in conversation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input input-bordered input-sm flex-1"
            autoFocus
          />
          <button onClick={() => { setSearch(""); setShowSearch(false); }} className="btn btn-ghost btn-sm btn-circle">
            <XIcon className="size-4" />
          </button>
        </div>
      )}

      {/* ---- MESSAGES AREA ---- */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {filteredMessages.length === 0 && !search ? (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-60">
            <div className="text-6xl mb-4">👋</div>
            <p className="text-lg font-semibold">Start a conversation!</p>
            <p className="text-sm">Send your first message to {targetUser.fullName}</p>
          </div>
        ) : filteredMessages.length === 0 && search ? (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-60">
            <p className="text-lg">No messages match "{search}"</p>
          </div>
        ) : (
          filteredMessages.map((msg, idx) => {
            const isMe = msg.senderId === authUser._id;
            const isCallLink = msg.text?.includes("/call/");
            return (
              <div key={msg._id}>
                {/* Date separator */}
                {shouldShowDateSep(msg, idx) && (
                  <div className="flex items-center justify-center my-4">
                    <div className="divider text-xs opacity-50">{formatDateSep(msg.createdAt)}</div>
                  </div>
                )}

                <div className={`chat ${isMe ? "chat-end" : "chat-start"} group`}>
                  {/* Avatar */}
                  <div className="chat-image avatar">
                    <div className="w-8 rounded-full">
                      <img
                        src={isMe ? (authUser.profilePic || "/avatar.png") : (targetUser.profilePic || "/avatar.png")}
                        alt="avatar"
                      />
                    </div>
                  </div>

                  {/* Header with time */}
                  <div className="chat-header mb-0.5 text-xs opacity-50 flex gap-2 items-center">
                    <span className="font-medium">{isMe ? "You" : targetUser.fullName}</span>
                    <time>{formatTime(msg.createdAt)}</time>
                  </div>

                  {/* Bubble */}
                  <div className={`chat-bubble max-w-xs sm:max-w-md ${isCallLink ? "bg-primary text-primary-content" : ""} ${msg.isPinned ? "ring-1 ring-warning/50" : ""}`}>
                    {msg.isPinned && <div className="text-[10px] opacity-60 mb-1 flex items-center gap-1"><PinIcon className="size-2.5" /> Pinned</div>}
                    {isCallLink ? (
                      <a href={msg.text.split(" ").pop()} className="underline font-bold flex items-center gap-2">
                        <VideoIcon className="size-4" /> {msg.text}
                      </a>
                    ) : (
                      <div className="flex flex-col">
                        <span className={msg.isDeleted ? "italic opacity-60" : "whitespace-pre-wrap"}>
                          {msg.isDeleted ? msg.text : renderTextWithLinks(msg.text)}
                        </span>
                        {translations[msg._id] && (
                          <div className="text-xs mt-1.5 pt-1.5 border-t border-current/10 opacity-80 italic">
                            🌐 {translations[msg._id]}
                          </div>
                        )}
                      </div>
                    )}
                    {msg.image && <img src={msg.image} alt="shared" className="mt-2 max-w-full rounded-lg" />}
                    {msg.file && msg.file.url && (
                      <a href={msg.file.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 mt-2 p-2 bg-base-300/30 rounded-lg hover:bg-base-300/50 transition-colors">
                        <FileTextIcon className="size-8 text-info flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{msg.file.name}</p>
                          <p className="text-xs opacity-50">{formatFileSize(msg.file.size)}</p>
                        </div>
                        <DownloadIcon className="size-4 opacity-50" />
                      </a>
                    )}
                  </div>

                  {/* Footer: reactions + read receipts + thread count */}
                  <div className="chat-footer flex items-center gap-1 mt-0.5">
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className="flex gap-0.5">
                        {msg.reactions.map((r, i) => (
                          <span key={i} className="text-xs bg-base-200 rounded-full px-1.5 py-0.5">{r.emoji}</span>
                        ))}
                      </div>
                    )}
                    {msg.threadCount > 0 && (
                      <button onClick={() => handleOpenThread(msg)} className="text-[10px] text-info hover:underline flex items-center gap-0.5 ml-1">
                        <MessageSquareIcon className="size-2.5" /> {msg.threadCount} {msg.threadCount === 1 ? "reply" : "replies"}
                      </button>
                    )}
                    {isMe && !msg.isDeleted && (
                      <span className="text-[10px] opacity-50 ml-1">
                        {msg.readAt ? "✓✓" : "✓"}
                      </span>
                    )}
                  </div>

                  {/* Hover actions */}
                  {!msg.isDeleted && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 mt-0.5">
                      <button onClick={() => reactToMessage({ messageId: msg._id, emoji: "👍" })} className="btn btn-xs btn-ghost px-1">👍</button>
                      <button onClick={() => reactToMessage({ messageId: msg._id, emoji: "❤️" })} className="btn btn-xs btn-ghost px-1">❤️</button>
                      <button onClick={() => reactToMessage({ messageId: msg._id, emoji: "😂" })} className="btn btn-xs btn-ghost px-1">😂</button>
                      <button onClick={() => handleOpenThread(msg)} className="btn btn-xs btn-ghost px-1" title="Reply in thread"><MessageSquareIcon className="size-3" /></button>
                      <button onClick={() => handlePin(msg._id)} className="btn btn-xs btn-ghost px-1" title={msg.isPinned ? "Unpin" : "Pin"}><PinIcon className="size-3" /></button>
                      
                      {msg.text && !isCallLink && (
                        <div className="dropdown dropdown-top dropdown-end">
                          <div tabIndex={0} role="button" className="btn btn-xs btn-ghost px-1">
                            <GlobeIcon className="size-3" />
                          </div>
                          <ul tabIndex={0} className="dropdown-content z-[1] menu p-1 shadow-lg bg-base-100 rounded-box w-28 text-xs">
                            <li><a onClick={() => handleTranslate(msg._id, msg.text, "English")}>English</a></li>
                            <li><a onClick={() => handleTranslate(msg._id, msg.text, "Spanish")}>Spanish</a></li>
                            <li><a onClick={() => handleTranslate(msg._id, msg.text, "Hindi")}>Hindi</a></li>
                            <li><a onClick={() => handleTranslate(msg._id, msg.text, "French")}>French</a></li>
                          </ul>
                        </div>
                      )}

                      {isMe && (
                        <button onClick={() => delMessage(msg._id)} className="btn btn-xs btn-ghost px-1 text-error" title="Delete">
                          <Trash2Icon className="size-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messageEndRef} />
      </div>

      {/* ---- TYPING INDICATOR ---- */}
      {isTyping && (
        <div className="px-4 py-1.5 text-xs text-info flex items-center gap-2">
          <span className="loading loading-dots loading-xs"></span>
          {targetUser?.fullName} is typing...
        </div>
      )}

      {/* ---- INPUT AREA ---- */}
      <div className="p-3 bg-base-100 border-t border-base-300 relative">
        {/* Emoji picker */}
        {showEmojiPicker && (
          <div ref={emojiPickerRef} className="absolute bottom-16 left-3 z-50">
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              theme="auto"
              height={350}
              width={300}
              searchPlaceholder="Search emoji..."
              previewConfig={{ showPreview: false }}
            />
          </div>
        )}

        <form onSubmit={handleSend} className="flex gap-2 items-center">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="btn btn-ghost btn-circle btn-sm"
          >
            <SmileIcon className="size-5 text-base-content/70" />
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current.click()}
            className="btn btn-ghost btn-circle btn-sm"
          >
            <ImagePlusIcon className="size-5 text-base-content/70" />
          </button>
          <input type="file" accept="image/*" onChange={handleFileChange} ref={fileInputRef} className="hidden" />

          <button type="button" onClick={() => docInputRef.current.click()} className="btn btn-ghost btn-circle btn-sm" title="Attach file">
            <PaperclipIcon className="size-5 text-base-content/70" />
          </button>
          <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar" onChange={handleDocUpload} ref={docInputRef} className="hidden" />

          <input
            type="text"
            className="input input-bordered flex-1 rounded-full px-5 bg-base-200/50"
            placeholder="Type a message..."
            value={message}
            onChange={handleInputChange}
            onFocus={() => setShowEmojiPicker(false)}
          />

          <button
            type="submit"
            className="btn btn-primary btn-circle btn-sm shadow-md"
            disabled={!message.trim() || isSending}
          >
            <SendIcon className="size-4" />
          </button>
        </form>
      </div>

      {/* ---- SUMMARIZATION MODAL ---- */}
      {summaryModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
              <SparklesIcon className="size-5 text-info" /> AI Chat Summary
            </h3>
            <div className="py-4 whitespace-pre-wrap max-h-96 overflow-y-auto text-sm leading-relaxed">
              {isSummarizing ? (
                <div className="flex flex-col items-center justify-center gap-3 my-8">
                  <span className="loading loading-spinner loading-lg text-info"></span>
                  <p className="text-sm opacity-60">Analyzing conversation...</p>
                </div>
              ) : summaryText ? (
                summaryText
              ) : (
                "Could not generate summary."
              )}
            </div>
            <div className="modal-action mt-0">
              <button className="btn btn-sm" onClick={() => setSummaryModalOpen(false)}>Close</button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setSummaryModalOpen(false)}></div>
        </div>
      )}

      {/* ---- PINNED MESSAGES MODAL ---- */}
      {showPinned && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2"><PinIcon className="size-5" /> Pinned Messages</h3>
            <div className="max-h-80 overflow-y-auto space-y-2">
              {pinnedMessages.length === 0 ? (
                <p className="text-sm opacity-50 text-center py-4">No pinned messages</p>
              ) : pinnedMessages.map(pin => (
                <div key={pin._id} className="p-3 bg-base-200 rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{pin.text}</p>
                  <p className="text-xs opacity-40 mt-1">{new Date(pin.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
            <div className="modal-action mt-2">
              <button className="btn btn-sm" onClick={() => setShowPinned(false)}>Close</button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowPinned(false)}></div>
        </div>
      )}

      {/* ---- THREAD PANEL ---- */}
      {threadParent && (
        <div className="fixed inset-y-0 right-0 w-80 sm:w-96 bg-base-100 border-l border-base-300 z-50 flex flex-col shadow-2xl">
          <div className="p-3 border-b border-base-300 flex items-center justify-between">
            <h3 className="font-bold text-sm flex items-center gap-2"><MessageSquareIcon className="size-4" /> Thread</h3>
            <button onClick={() => setThreadParent(null)} className="btn btn-ghost btn-circle btn-xs"><XIcon className="size-4" /></button>
          </div>
          {/* Parent message */}
          <div className="p-3 border-b border-base-300 bg-base-200/50">
            <p className="text-xs font-medium opacity-50">{threadParent.senderId === authUser._id ? "You" : targetUser?.fullName}</p>
            <p className="text-sm whitespace-pre-wrap mt-1">{threadParent.text}</p>
          </div>
          {/* Replies */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {loadingThread ? (
              <div className="flex justify-center py-8"><span className="loading loading-spinner loading-sm" /></div>
            ) : threadReplies.length === 0 ? (
              <p className="text-xs opacity-50 text-center py-4">No replies yet</p>
            ) : threadReplies.map(reply => (
              <div key={reply._id} className="flex gap-2">
                <div className="avatar flex-shrink-0"><div className="w-6 rounded-full"><img src={reply.senderId?.profilePic || (reply.senderId === authUser._id ? authUser.profilePic : "/avatar.png")} alt="" /></div></div>
                <div>
                  <p className="text-xs font-medium">{reply.senderId?.fullName || (reply.senderId === authUser._id ? "You" : "User")}</p>
                  <p className="text-sm whitespace-pre-wrap">{reply.text}</p>
                  <p className="text-[10px] opacity-40 mt-0.5">{formatTime(reply.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
          {/* Thread reply input */}
          <form onSubmit={handleSendThreadReply} className="p-3 border-t border-base-300 flex gap-2">
            <input type="text" className="input input-bordered input-sm flex-1 rounded-full" placeholder="Reply..." value={threadMsg} onChange={(e) => setThreadMsg(e.target.value)} />
            <button type="submit" className="btn btn-primary btn-sm btn-circle" disabled={!threadMsg.trim()}><SendIcon className="size-3" /></button>
          </form>
        </div>
      )}
    </div>
  );
};

export default ChatPage;