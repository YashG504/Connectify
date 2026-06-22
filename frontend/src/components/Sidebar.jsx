import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import useAuthUser from "../hooks/useAuthUser";
import {
  BellIcon,
  HomeIcon,
  ShipWheelIcon,
  UsersIcon,
  LockIcon,
  HashIcon,
  SearchIcon,
  XIcon,
  MenuIcon,
  PlusIcon,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getFriendRequests, getChannels, createChannel, getFriendsWithLastMessage, searchMessages } from "../lib/api";
import { useThemeStore } from "../store/useThemeStore";
import toast from "react-hot-toast";

const Sidebar = () => {
  const { authUser } = useAuthUser();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentPath = location.pathname;
  const { onlineUsers } = useThemeStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [globalResults, setGlobalResults] = useState(null);
  const [searching, setSearching] = useState(false);

  const { data: friendRequests } = useQuery({
    queryKey: ["friendRequests"],
    queryFn: getFriendRequests,
    enabled: !!authUser,
  });

  const { data: channels = [] } = useQuery({
    queryKey: ["channels"],
    queryFn: getChannels,
    enabled: !!authUser,
  });

  const { data: friendsDM = [] } = useQuery({
    queryKey: ["friendsDM"],
    queryFn: getFriendsWithLastMessage,
    enabled: !!authUser,
    refetchInterval: 30000,
  });

  // Calculate total unreads and update document.title
  const totalUnread = friendsDM.reduce((sum, friend) => sum + (friend.unreadCount || 0), 0);
  useEffect(() => {
    if (totalUnread > 0) {
      document.title = `(${totalUnread}) Connectify`;
    } else {
      document.title = "Connectify";
    }
  }, [totalUnread]);

  const { mutate: createChannelMutation } = useMutation({
    mutationFn: createChannel,
    onSuccess: (newChannel) => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      document.getElementById('create_channel_modal')?.close();
      toast.success("Channel created!");
      navigate(`/channel/${newChannel._id}`);
      setMobileOpen(false);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to create channel");
    }
  });

  const notificationCount = friendRequests?.incomingReqs?.length || 0;

  // Local filter for sidebar
  const filteredFriends = friendsDM.filter(f =>
    f.fullName?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredChannels = channels.filter(c =>
    c.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Global search handler
  const handleGlobalSearch = async (e) => {
    e.preventDefault();
    if (!globalSearch.trim() || globalSearch.trim().length < 2) return;
    setSearching(true);
    try {
      const results = await searchMessages(globalSearch);
      setGlobalResults(results);
    } catch {
      toast.error("Search failed");
    } finally {
      setSearching(false);
    }
  };

  const truncate = (str, len = 30) => {
    if (!str) return "";
    return str.length > len ? str.substring(0, len) + "…" : str;
  };

  const formatTime = (date) => {
    if (!date) return "";
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return "now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const sidebarContent = (
    <>
      {/* LOGO */}
      <div className="p-4 border-b border-base-300">
        <Link to="/" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
          <ShipWheelIcon className="size-8 text-primary" />
          <span className="text-2xl font-bold font-mono bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary tracking-wider">
            Connectify
          </span>
        </Link>
      </div>

      {/* GLOBAL SEARCH */}
      <div className="p-3 border-b border-base-300">
        <form onSubmit={handleGlobalSearch}>
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 opacity-40" />
            <input
              type="text"
              placeholder="Search messages..."
              value={globalSearch}
              onChange={(e) => {
                setGlobalSearch(e.target.value);
                if (!e.target.value.trim()) setGlobalResults(null);
              }}
              className="input input-bordered input-sm w-full pl-9 rounded-full bg-base-200/50"
            />
          </div>
        </form>
      </div>

      {/* GLOBAL SEARCH RESULTS */}
      {globalResults !== null && (
        <div className="border-b border-base-300 max-h-48 overflow-y-auto">
          <div className="flex items-center justify-between px-3 pt-2 pb-1">
            <span className="text-xs font-semibold opacity-50">
              {globalResults.length} result{globalResults.length !== 1 ? "s" : ""}
            </span>
            <button onClick={() => { setGlobalResults(null); setGlobalSearch(""); }} className="btn btn-ghost btn-xs">
              <XIcon className="size-3" />
            </button>
          </div>
          {searching ? (
            <div className="flex justify-center p-3"><span className="loading loading-spinner loading-sm" /></div>
          ) : globalResults.length === 0 ? (
            <p className="text-xs opacity-50 text-center py-3">No messages found</p>
          ) : (
            globalResults.map((msg) => {
              const otherUser = msg.senderId._id === authUser._id ? msg.receiverId : msg.senderId;
              return (
                <Link
                  key={msg._id}
                  to={`/chat/${otherUser?._id}`}
                  onClick={() => { setGlobalResults(null); setGlobalSearch(""); setMobileOpen(false); }}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-base-300/50 transition-colors"
                >
                  <div className="avatar">
                    <div className="w-6 rounded-full">
                      <img src={otherUser?.profilePic || "/avatar.png"} alt="" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{msg.senderId?.fullName}</p>
                    <p className="text-xs opacity-50 truncate">{truncate(msg.text, 40)}</p>
                  </div>
                  <span className="text-[10px] opacity-40">{formatTime(msg.createdAt)}</span>
                </Link>
              );
            })
          )}
        </div>
      )}

      {/* SIDEBAR FILTER */}
      {globalResults === null && (
        <div className="px-3 pt-2">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 opacity-30" />
            <input
              type="text"
              placeholder="Filter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input input-bordered input-xs w-full pl-8 rounded-full bg-base-200/30"
            />
          </div>
        </div>
      )}

      {/* NAVIGATION */}
      <nav className="px-3 pt-2 space-y-0.5">
        <Link
          to="/"
          onClick={() => setMobileOpen(false)}
          className={`btn btn-ghost justify-start w-full gap-3 px-3 normal-case btn-sm ${currentPath === "/" ? "btn-active" : ""}`}
        >
          <HomeIcon className="size-4 text-base-content opacity-70" />
          <span>Home</span>
        </Link>

        <Link
          to="/friends"
          onClick={() => setMobileOpen(false)}
          className={`btn btn-ghost justify-start w-full gap-3 px-3 normal-case btn-sm ${currentPath === "/friends" ? "btn-active" : ""}`}
        >
          <UsersIcon className="size-4 text-base-content opacity-70" />
          <span>Friends</span>
        </Link>

        <Link
          to="/notifications"
          onClick={() => setMobileOpen(false)}
          className={`btn btn-ghost justify-start w-full gap-3 px-3 normal-case btn-sm ${currentPath === "/notifications" ? "btn-active" : ""}`}
        >
          <div className="relative">
            <BellIcon className="size-4 text-base-content opacity-70" />
            {notificationCount > 0 && (
              <span className="badge badge-primary badge-xs absolute -top-1.5 -right-1.5 text-[9px]">
                {notificationCount}
              </span>
            )}
          </div>
          <span>Notifications</span>
        </Link>
      </nav>

      {/* DIRECT MESSAGES SECTION */}
      <div className="flex-1 overflow-y-auto px-3 pb-2 mt-2">
        <div className="flex items-center justify-between text-xs font-semibold opacity-40 mb-1.5 px-2 uppercase tracking-wider">
          <span>Direct Messages</span>
        </div>
        
        <div className="space-y-0.5">
          {filteredFriends.length === 0 && searchQuery ? (
            <div className="px-3 py-2 text-xs opacity-50 text-center">No results</div>
          ) : filteredFriends.length === 0 ? (
            <div className="px-3 py-2 text-xs opacity-50 text-center">No conversations yet</div>
          ) : (
            filteredFriends.map((friend) => {
              const isActive = currentPath === `/chat/${friend._id}`;
              const friendOnline = onlineUsers.has(friend._id);
              const lastMsg = friend.lastMessage;
              return (
                <Link
                  key={friend._id}
                  to={`/chat/${friend._id}`}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all hover:bg-base-300/50 ${
                    isActive ? "bg-base-300 font-medium" : ""
                  }`}
                >
                  <div className="avatar relative flex-shrink-0">
                    <div className="w-8 rounded-full">
                      <img src={friend.profilePic || "/avatar.png"} alt={friend.fullName} />
                    </div>
                    {friendOnline && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-success border-2 border-base-200 rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm truncate">{friend.fullName}</span>
                      {lastMsg && (
                        <span className="text-[10px] opacity-40 flex-shrink-0 ml-1">{formatTime(lastMsg.createdAt)}</span>
                      )}
                    </div>
                    {lastMsg && (
                      <p className="text-xs opacity-50 truncate">
                        {lastMsg.isDeleted ? "Message deleted" : lastMsg.image ? "📷 Photo" : lastMsg.file?.name ? `📎 ${lastMsg.file.name}` : truncate(lastMsg.text, 25)}
                      </p>
                    )}
                  </div>
                  {friend.unreadCount > 0 && (
                    <span className="badge badge-primary badge-xs flex-shrink-0">{friend.unreadCount}</span>
                  )}
                </Link>
              );
            })
          )}
        </div>

        {/* CHANNELS SECTION */}
        <div className="flex items-center justify-between text-xs font-semibold opacity-40 mt-3 mb-1.5 px-2 uppercase tracking-wider">
          <span>Channels</span>
          <button 
            className="hover:text-primary transition-colors hover:opacity-100"
            onClick={() => document.getElementById('create_channel_modal')?.showModal()}
          >
            <PlusIcon className="size-3.5" />
          </button>
        </div>
        
        <div className="space-y-0.5">
          {filteredChannels.map((channel) => (
            <Link
              key={channel._id}
              to={`/channel/${channel._id}`}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-all hover:bg-base-300/50 ${
                currentPath === `/channel/${channel._id}` ? "bg-base-300 font-medium" : ""
              }`}
            >
              <span className="opacity-50 text-sm">
                {channel.isPrivate ? <LockIcon className="size-3 inline" /> : <HashIcon className="size-3 inline" />}
              </span>
              <span className="truncate">{channel.name}</span>
            </Link>
          ))}
          {channels.length === 0 && (
            <div className="px-3 py-2 text-xs opacity-50 text-center border border-dashed border-base-300 rounded-lg mt-1">
              No channels yet
            </div>
          )}
        </div>
      </div>

      {/* CREATE CHANNEL MODAL */}
      <dialog id="create_channel_modal" className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-lg mb-4">Create a new channel</h3>
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              const name = e.target.channelName.value;
              const isPrivate = e.target.isPrivate.checked;
              createChannelMutation({ name, isPrivate });
              e.target.reset();
            }}
            className="space-y-4"
          >
            <div className="form-control">
              <label className="label"><span className="label-text">Channel Name</span></label>
              <input type="text" name="channelName" placeholder="e.g. general" className="input input-bordered w-full" required minLength={3} />
            </div>
            <div className="form-control">
              <label className="label cursor-pointer">
                <span className="label-text flex items-center gap-2"><LockIcon className="size-4" /> Make Private</span>
                <input type="checkbox" name="isPrivate" className="toggle toggle-primary" />
              </label>
            </div>
            <div className="modal-action">
              <button type="button" className="btn" onClick={() => document.getElementById('create_channel_modal')?.close()}>Cancel</button>
              <button type="submit" className="btn btn-primary">Create</button>
            </div>
          </form>
        </div>
      </dialog>

      {/* USER PROFILE */}
      <div className="p-3 border-t border-base-300 mt-auto">
        <div className="flex items-center gap-3">
          <div className="avatar">
            <div className="w-9 rounded-full">
              <img src={authUser?.profilePic} alt="User Avatar" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{authUser?.fullName}</p>
            <p className="text-xs text-success flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-success inline-block" />
              Online
            </p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 btn btn-ghost btn-circle btn-sm"
        style={{ display: currentPath.startsWith("/chat") || currentPath.startsWith("/channel") || currentPath.startsWith("/call") ? "none" : undefined }}
      >
        <MenuIcon className="size-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        w-72 bg-base-200 border-r border-base-300 flex flex-col h-screen
        fixed lg:sticky top-0 z-50
        transition-transform duration-300 ease-in-out
        ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden absolute top-3 right-3 btn btn-ghost btn-circle btn-xs z-10"
        >
          <XIcon className="size-4" />
        </button>
        {sidebarContent}
      </aside>
    </>
  );
};
export default Sidebar;
