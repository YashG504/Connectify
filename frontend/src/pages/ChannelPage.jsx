import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getChannelMessages, sendChannelMessage, inviteToChannel, getUserFriends, getChannels } from "../lib/api";
import { useTranslateMessage, useSummarizeChannel } from "../hooks/useAI";
import useAuthUser from "../hooks/useAuthUser";
import EmojiPicker from "emoji-picker-react";
import {
  ImagePlusIcon,
  LoaderIcon,
  SendIcon,
  XIcon,
  ArrowLeftIcon,
  HashIcon,
  UsersIcon,
  UserPlusIcon,
  LockIcon,
  SmileIcon,
  SparklesIcon,
  GlobeIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { socket } from "../lib/socket";

const ChannelPage = () => {
  const { id: channelId } = useParams();
  const { authUser } = useAuthUser();
  const queryClient = useQueryClient();
  
  const [newMessage, setNewMessage] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [translations, setTranslations] = useState({});
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [summaryText, setSummaryText] = useState(null);
  const fileInputRef = useRef(null);
  const messageEndRef = useRef(null);
  const emojiPickerRef = useRef(null);

  // Fetch the active channel details
  const { data: channels = [] } = useQuery({
    queryKey: ["channels"],
    queryFn: getChannels,
  });
  
  const channel = channels.find(c => c._id === channelId);

  // Fetch channel messages
  const { data: messages, isLoading: loadingMessages } = useQuery({
    queryKey: ["channelMessages", channelId],
    queryFn: () => getChannelMessages(channelId),
    enabled: !!channelId,
  });

  // Fetch friends to invite
  const { data: friends = [] } = useQuery({
    queryKey: ["friends"],
    queryFn: getUserFriends,
  });

  const { mutate: inviteMutation, isPending: inviting } = useMutation({
    mutationFn: (userId) => inviteToChannel(channelId, userId),
    onSuccess: () => {
      toast.success("User invited successfully!");
      queryClient.invalidateQueries({ queryKey: ["channels"] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to invite user");
    }
  });

  const { mutate: sendMessageMutation, isPending } = useMutation({
    mutationFn: (messageData) => sendChannelMessage(channelId, messageData),
    onSuccess: () => {
      setNewMessage("");
      setImagePreview(null);
      setShowEmojiPicker(false);
      queryClient.invalidateQueries({ queryKey: ["channelMessages", channelId] });
    },
  });

  // AI
  const { mutate: translateMsg } = useTranslateMessage();
  const { mutate: summarizeChannel, isPending: isSummarizing } = useSummarizeChannel(channelId);

  const handleTranslate = (msgId, text, language) => {
    translateMsg(
      { text, targetLanguage: language },
      { onSuccess: (data) => setTranslations(prev => ({ ...prev, [msgId]: data.translatedText })) }
    );
  };

  const handleSummarize = () => {
    setSummaryModalOpen(true);
    setSummaryText(null);
    summarizeChannel(undefined, {
      onSuccess: (data) => setSummaryText(data.summary),
    });
  };

  // REAL-TIME LISTENER FOR NEW CHANNEL MESSAGES
  useEffect(() => {
    if (!socket || !channelId) return;

    socket.on("newChannelMessage", (message) => {
      if (message.channelId === channelId) {
        queryClient.setQueryData(["channelMessages", channelId], (old) => {
          if (!old) return [message];
          if (old.find((m) => m._id === message._id)) return old;
          return [...old, message];
        });
      }
    });

    return () => {
      socket.off("newChannelMessage");
    };
  }, [channelId, queryClient]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

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

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() && !imagePreview) return;
    sendMessageMutation({ text: newMessage, image: imagePreview });
  };

  const handleEmojiClick = (emojiData) => {
    setNewMessage(prev => prev + emojiData.emoji);
  };

  if (!channel) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] items-center justify-center p-4">
        <span className="loading loading-spinner loading-lg text-primary"></span>
        <p className="mt-4">Loading channel...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-base-100 rounded-xl overflow-hidden glass-panel">
      {/* HEADER */}
      <div className="bg-base-200 border-b border-base-300 px-4 py-3 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-3">
          <Link to="/" className="btn btn-ghost btn-circle btn-sm">
            <ArrowLeftIcon className="size-5" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="bg-primary/20 p-2 rounded-lg">
              {channel.isPrivate ? (
                <LockIcon className="size-5 text-primary" />
              ) : (
                <HashIcon className="size-5 text-primary" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-sm">{channel.name}</h3>
              <p className="text-xs opacity-70 flex items-center gap-1">
                <UsersIcon className="size-3" />
                {channel.members?.length || 0} Members
                {channel.description && <span className="hidden sm:inline"> · {channel.description}</span>}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-1.5 items-center">
          <button onClick={handleSummarize} className="btn btn-ghost btn-circle btn-sm" title="AI Summarize">
            <SparklesIcon className="size-4 text-info" />
          </button>

          {/* INVITE BUTTON */}
          {(!channel.isPrivate || channel.admins?.includes(authUser._id)) && (
            <button 
              className="btn btn-sm btn-outline btn-primary shadow-sm"
              onClick={() => document.getElementById('invite_modal').showModal()}
            >
              <UserPlusIcon className="size-4 mr-1" />
              Invite
            </button>
          )}
        </div>
      </div>

      {/* INVITE MODAL */}
      <dialog id="invite_modal" className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-lg mb-4">Invite friends to #{channel.name}</h3>
          
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {friends.length === 0 ? (
              <p className="text-sm opacity-60 text-center py-4">No friends found to invite.</p>
            ) : (
              friends.map(friend => {
                const isMember = channel.members?.includes(friend._id);
                return (
                  <div key={friend._id} className="flex items-center justify-between p-2 hover:bg-base-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="avatar">
                        <div className="w-10 rounded-full">
                          <img src={friend.profilePic || "/avatar.png"} alt="avatar" />
                        </div>
                      </div>
                      <span className="font-medium">{friend.fullName}</span>
                    </div>
                    
                    <button 
                      className={`btn btn-sm ${isMember ? 'btn-disabled' : 'btn-primary'}`}
                      onClick={() => inviteMutation(friend._id)}
                      disabled={isMember || inviting}
                    >
                      {isMember ? "Joined" : "Invite"}
                    </button>
                  </div>
                );
              })
            )}
          </div>
          
          <div className="modal-action">
            <form method="dialog">
              <button className="btn">Close</button>
            </form>
          </div>
        </div>
      </dialog>

      {/* MESSAGES AREA */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1 bg-base-100/50">
        {loadingMessages ? (
          <div className="flex justify-center h-full items-center">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : messages?.length === 0 ? (
          <div className="flex flex-col h-full items-center justify-center text-center opacity-60">
            <HashIcon className="size-16 mb-4 text-base-300" />
            <p className="text-lg">Welcome to #{channel.name}</p>
            <p className="text-sm">Be the first to say hello!</p>
          </div>
        ) : (
          messages?.map((msg) => {
            const isMe = msg.senderId?._id === authUser._id;
            return (
              <div key={msg._id} className={`chat ${isMe ? "chat-end" : "chat-start"} group`}>
                <div className="chat-image avatar">
                  <div className="w-8 rounded-full shadow-sm">
                    <img src={msg.senderId?.profilePic || "/avatar.png"} alt="avatar" />
                  </div>
                </div>
                
                <div className="chat-header mb-0.5 text-xs opacity-50 flex gap-2">
                  <span className="font-medium">{msg.senderId?.fullName}</span>
                  <time>{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
                </div>

                <div className={`chat-bubble max-w-xs sm:max-w-md ${isMe ? "bg-primary text-primary-content" : "bg-base-200"}`}>
                  {msg.image && (
                    <img src={msg.image} alt="Attachment" className="max-w-[200px] rounded-lg mb-2" />
                  )}
                  {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
                  {translations[msg._id] && (
                    <div className="text-xs mt-1.5 pt-1.5 border-t border-current/10 opacity-80 italic">
                      🌐 {translations[msg._id]}
                    </div>
                  )}
                </div>

                {/* Hover actions for translate */}
                {msg.text && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 mt-0.5">
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
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messageEndRef} />
      </div>

      {/* INPUT AREA */}
      <div className="bg-base-200 p-3 border-t border-base-300 relative">
        {imagePreview && (
          <div className="relative inline-block mb-3">
            <img src={imagePreview} alt="Preview" className="h-24 w-24 object-cover rounded-lg border-2 border-primary" />
            <button
              className="absolute -top-2 -right-2 btn btn-circle btn-xs btn-error"
              onClick={() => setImagePreview(null)}
            >
              <XIcon className="size-3" />
            </button>
          </div>
        )}

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

        <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
          <button
            type="button"
            className="btn btn-ghost btn-circle btn-sm"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          >
            <SmileIcon className="size-5 text-base-content/70" />
          </button>

          <input type="file" accept="image/*" hidden ref={fileInputRef} onChange={handleImageChange} />
          <button
            type="button"
            className="btn btn-ghost btn-circle btn-sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPending}
          >
            <ImagePlusIcon className="size-5 text-base-content/70" />
          </button>
          
          <input
            type="text"
            className="input input-bordered flex-1 rounded-full px-5 bg-base-100"
            placeholder={`Message #${channel?.name || "channel"}`}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onFocus={() => setShowEmojiPicker(false)}
            disabled={isPending}
          />
          
          <button 
            type="submit" 
            className="btn btn-circle btn-primary btn-sm shadow-md" 
            disabled={(!newMessage.trim() && !imagePreview) || isPending}
          >
            {isPending ? (
              <LoaderIcon className="size-4 animate-spin" />
            ) : (
              <SendIcon className="size-4" />
            )}
          </button>
        </form>
      </div>

      {/* SUMMARIZATION MODAL */}
      {summaryModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
              <SparklesIcon className="size-5 text-info" /> Channel Summary
            </h3>
            <div className="py-4 whitespace-pre-wrap max-h-96 overflow-y-auto text-sm leading-relaxed">
              {isSummarizing ? (
                <div className="flex flex-col items-center justify-center gap-3 my-8">
                  <span className="loading loading-spinner loading-lg text-info"></span>
                  <p className="text-sm opacity-60">Analyzing channel...</p>
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
    </div>
  );
};

export default ChannelPage;
