import { Link, useLocation, useNavigate } from "react-router-dom";
import useAuthUser from "../hooks/useAuthUser";
import { BellIcon, HomeIcon, ShipWheelIcon, UsersIcon, LockIcon } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getFriendRequests, getChannels, createChannel } from "../lib/api";
import toast from "react-hot-toast";

const Sidebar = () => {
  const { authUser } = useAuthUser();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentPath = location.pathname;

  const { data: friendRequests } = useQuery({
    queryKey: ["friendRequests"],
    queryFn: getFriendRequests,
    enabled: !!authUser, // Only fetch if authenticated
  });

  const { data: channels = [] } = useQuery({
    queryKey: ["channels"],
    queryFn: getChannels,
    enabled: !!authUser,
  });

  const { mutate: createChannelMutation } = useMutation({
    mutationFn: createChannel,
    onSuccess: (newChannel) => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      document.getElementById('create_channel_modal').close();
      toast.success("Channel created!");
      navigate(`/channel/${newChannel._id}`);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to create channel");
    }
  });

  const notificationCount = friendRequests?.incomingReqs?.length || 0;

  return (
    <aside className="w-64 bg-base-200 border-r border-base-300 hidden lg:flex flex-col h-screen sticky top-0">
      <div className="p-5 border-b border-base-300">
        <Link to="/" className="flex items-center gap-2.5">
          <ShipWheelIcon className="size-9 text-primary" />
          <span className="text-3xl font-bold font-mono bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary  tracking-wider">
            Connectify
          </span>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        <Link
          to="/"
          className={`btn btn-ghost justify-start w-full gap-3 px-3 normal-case ${
            currentPath === "/" ? "btn-active" : ""
          }`}
        >
          <HomeIcon className="size-5 text-base-content opacity-70" />
          <span>Home</span>
        </Link>

        <Link
          to="/friends"
          className={`btn btn-ghost justify-start w-full gap-3 px-3 normal-case ${
            currentPath === "/friends" ? "btn-active" : ""
          }`}
        >
          <UsersIcon className="size-5 text-base-content opacity-70" />
          <span>Friends</span>
        </Link>

        <Link
          to="/notifications"
          className={`btn btn-ghost justify-start w-full gap-3 px-3 normal-case ${
            currentPath === "/notifications" ? "btn-active" : ""
          }`}
        >
          <div className="relative">
            <BellIcon className="size-5 text-base-content opacity-70" />
            {notificationCount > 0 && (
              <span className="badge badge-primary badge-xs absolute -top-1 -right-1">
                {notificationCount}
              </span>
            )}
          </div>
          <span>Notifications</span>
        </Link>
      </nav>

      {/* CHANNELS SECTION */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="flex items-center justify-between text-xs font-semibold opacity-50 mb-2 px-3">
          <span>CHANNELS</span>
          <button 
            className="hover:text-primary transition-colors"
            onClick={() => document.getElementById('create_channel_modal').showModal()}
          >
            + ADD
          </button>
        </div>
        
        <div className="space-y-0.5">
          {channels.map((channel) => (
            <Link
              key={channel._id}
              to={`/channel/${channel._id}`}
              className={`btn btn-sm btn-ghost justify-start w-full normal-case font-normal ${
                currentPath === `/channel/${channel._id}` ? "bg-base-300" : ""
              }`}
            >
              <span className="opacity-50 text-sm mr-1">
                {channel.isPrivate ? <LockIcon className="size-3 inline" /> : "#"}
              </span>
              <span className="truncate">{channel.name}</span>
            </Link>
          ))}
          {channels.length === 0 && (
            <div className="px-3 py-2 text-xs opacity-50 text-center border border-dashed border-base-300 rounded-lg mt-2">
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
              <label className="label">
                <span className="label-text">Channel Name</span>
              </label>
              <input 
                type="text" 
                name="channelName"
                placeholder="e.g. general, announcements" 
                className="input input-bordered w-full" 
                required 
                minLength={3}
                pattern="^[a-zA-Z0-9_-]+$"
                title="Only letters, numbers, dashes, and underscores allowed"
              />
            </div>
            
            <div className="form-control">
              <label className="label cursor-pointer">
                <span className="label-text flex items-center gap-2">
                  <LockIcon className="size-4" />
                  Make Private
                </span>
                <input 
                  type="checkbox" 
                  name="isPrivate"
                  className="toggle toggle-primary" 
                />
              </label>
              <span className="text-xs opacity-50 px-1 mt-1">Private channels can only be joined by invitation.</span>
            </div>
            
            <div className="modal-action">
              <button type="button" className="btn" onClick={() => document.getElementById('create_channel_modal').close()}>Cancel</button>
              <button type="submit" className="btn btn-primary">Create Channel</button>
            </div>
          </form>
        </div>
      </dialog>

      {/* USER PROFILE SECTION */}
      <div className="p-4 border-t border-base-300 mt-auto">
        <div className="flex items-center gap-3">
          <div className="avatar">
            <div className="w-10 rounded-full">
              <img src={authUser?.profilePic} alt="User Avatar" />
            </div>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">{authUser?.fullName}</p>
            <p className="text-xs text-success flex items-center gap-1">
              <span className="size-2 rounded-full bg-success inline-block" />
              Online
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};
export default Sidebar;
