import { useState } from "react";
import { Link, useLocation } from "react-router-dom"; // Ensure react-router-dom
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "../lib/axios"; // Ensure this path is correct
import useAuthUser from "../hooks/useAuthUser";
import useLogout from "../hooks/useLogout";
import { BellIcon, LogOutIcon, ShipWheelIcon, MapPinIcon, LanguagesIcon, BriefcaseIcon, PenIcon, CheckIcon, XIcon, ActivityIcon } from "lucide-react";
import ThemeSelector from "./ThemeSelector";
import { LANGUAGES } from "../constants"; // Ensure this exists

const Navbar = () => {
  const { authUser } = useAuthUser();
  const { logoutMutation } = useLogout();
  const queryClient = useQueryClient();
  
  const location = useLocation();
  const isChatPage = location.pathname?.startsWith("/chat");

  // FIX: Safely extract user data (handles wrapped or unwrapped data)
  const userData = authUser?.user || authUser;

  // --- EDITING STATE & LOGIC ---
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});

  const { mutate: updateProfile, isPending: isUpdating } = useMutation({
    mutationFn: async (data) => {
      const res = await axiosInstance.put("/auth/update-profile", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["authUser"] }); // Refresh data
      setIsEditing(false);
    },
  });

  const { mutate: updateStatusMutation } = useMutation({
    mutationFn: async (data) => {
      const res = await axiosInstance.put("/users/status", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
    },
  });

  const handleEdit = () => {
    setFormData({
      fullName: userData?.fullName || "",
      bio: userData?.bio || "",
      location: userData?.location || "",
      jobTitle: userData?.jobTitle || "",
      preferredLanguage: userData?.preferredLanguage || "",
      status: userData?.status || "online",
      customStatus: userData?.customStatus || "",
    });
    setIsEditing(true);
  };

  const handleSave = () => {
    updateProfile({
      fullName: formData.fullName,
      bio: formData.bio,
      location: formData.location,
      jobTitle: formData.jobTitle,
      preferredLanguage: formData.preferredLanguage,
    });
    updateStatusMutation({
      status: formData.status,
      customStatus: formData.customStatus,
    });
  };

  const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : "N/A";

  return (
    <>
      <nav className="bg-base-200 border-b border-base-300 sticky top-0 z-30 h-16 flex items-center">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between w-full">
            
            {/* LOGO */}
            {isChatPage ? (
              <div className="pl-0">
                <Link to="/" className="flex items-center gap-2.5">
                  <ShipWheelIcon className="size-9 text-primary" />
                  <span className="text-3xl font-bold font-mono bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary tracking-wider">
                    Connectify
                  </span>
                </Link>
              </div>
            ) : <div className="flex-1"></div>}

            {/* ICONS */}
            <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
              <Link to={"/notifications"}>
                <button className="btn btn-ghost btn-circle btn-sm">
                  <BellIcon className="h-6 w-6 text-base-content opacity-70" />
                </button>
              </Link>
              <ThemeSelector />
              
              {/* AVATAR TRIGGER */}
              <div 
                className="avatar cursor-pointer hover:opacity-80 transition-opacity ml-1"
                onClick={() => document.getElementById('profile_modal').showModal()}
              >
                <div className="w-9 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                  <img src={userData?.profilePic || "/avatar.png"} alt="User" onError={(e) => e.target.src="/avatar.png"} />
                </div>
              </div>

              <button className="btn btn-ghost btn-circle btn-sm" onClick={logoutMutation}>
                <LogOutIcon className="h-6 w-6 text-base-content opacity-70" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* --- PROFILE MODAL --- */}
      <dialog id="profile_modal" className="modal">
        <div className="modal-box">
          <form method="dialog">
            <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onClick={()=>setIsEditing(false)}>✕</button>
          </form>
          
          <div className="flex flex-col items-center gap-4">
            <div className="avatar">
               <div className="w-24 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                 <img src={userData?.profilePic || "/avatar.png"} alt="Profile" onError={(e) => e.target.src="/avatar.png"} />
               </div>
            </div>

            {/* EDIT BUTTONS */}
            <div className="absolute top-4 left-4">
               {!isEditing ? (
                 <button className="btn btn-ghost btn-xs text-primary" onClick={handleEdit}>
                    <PenIcon className="size-3 mr-1"/> Edit
                 </button>
               ) : (
                 <div className="flex gap-2">
                    <button className="btn btn-xs btn-success text-white" onClick={handleSave} disabled={isUpdating}>
                        <CheckIcon className="size-3 mr-1"/> Save
                    </button>
                    <button className="btn btn-xs btn-ghost text-error" onClick={()=>setIsEditing(false)}>
                        <XIcon className="size-3 mr-1"/> Cancel
                    </button>
                 </div>
               )}
            </div>

            {/* DISPLAY INFO OR EDIT FORM */}
            {!isEditing ? (
              <>
                <div className="text-center">
                  <h3 className="font-bold text-xl">{userData?.fullName}</h3>
                  <p className="text-sm opacity-50">{userData?.email}</p>
                </div>
                <div className="w-full space-y-3 mt-4">
                   <div className="flex items-center gap-3 p-3 bg-base-200 rounded-lg">
                      <MapPinIcon className="size-5 text-primary" />
                      <div><p className="text-xs opacity-50">Location</p><p className="font-medium">{userData?.location || "Unknown"}</p></div>
                   </div>
                   <div className="flex items-center gap-3 p-3 bg-base-200 rounded-lg">
                      <ActivityIcon className="size-5 text-primary" />
                      <div>
                        <p className="text-xs opacity-50">Status</p>
                        <p className="font-medium flex items-center gap-2">
                          <span className={`size-2 rounded-full ${userData?.status === 'online' ? 'bg-success' : userData?.status === 'away' ? 'bg-warning' : userData?.status === 'busy' ? 'bg-error' : 'bg-base-300'}`}></span>
                          {capitalize(userData?.status || "online")}
                          {userData?.customStatus && <span className="opacity-70 text-sm ml-1">- "{userData?.customStatus}"</span>}
                        </p>
                      </div>
                   </div>
                   <div className="flex items-center gap-3 p-3 bg-base-200 rounded-lg">
                      <BriefcaseIcon className="size-5 text-primary" />
                      <div><p className="text-xs opacity-50">Role</p><p className="font-medium">{userData?.jobTitle || "Not specified"}</p></div>
                   </div>
                   <div className="flex items-center gap-3 p-3 bg-base-200 rounded-lg">
                      <LanguagesIcon className="size-5 text-primary" />
                      <div><p className="text-xs opacity-50">Preferred Language</p><p className="font-medium">{capitalize(userData?.preferredLanguage)}</p></div>
                   </div>
                   <div className="p-3 bg-base-200 rounded-lg w-full">
                      <p className="text-xs opacity-50 mb-1">About Me</p>
                      <p className="text-sm italic">"{userData?.bio || "No bio yet..."}"</p>
                   </div>
                </div>
              </>
            ) : (
              /* EDIT FORM */
              <div className="w-full space-y-3 mt-2">
                 <input type="text" className="input input-bordered input-sm w-full" value={formData.fullName} onChange={(e)=>setFormData({...formData, fullName: e.target.value})} placeholder="Full Name" />
                 <input type="text" className="input input-bordered input-sm w-full" value={formData.location} onChange={(e)=>setFormData({...formData, location: e.target.value})} placeholder="City, Country" />
                 <input type="text" className="input input-bordered input-sm w-full" value={formData.jobTitle} onChange={(e)=>setFormData({...formData, jobTitle: e.target.value})} placeholder="Job Title / Role" />
                 <select className="select select-bordered select-sm w-full" value={formData.preferredLanguage} onChange={(e)=>setFormData({...formData, preferredLanguage: e.target.value})}>
                    <option value="">Select Preferred Language</option>
                    {LANGUAGES?.map(l=><option key={l} value={l.toLowerCase()}>{l}</option>)}
                 </select>
                 <div className="grid grid-cols-1 gap-2">
                   <select className="select select-bordered select-sm w-full" value={formData.status} onChange={(e)=>setFormData({...formData, status: e.target.value})}>
                      <option value="online">🟢 Online</option>
                      <option value="away">🟡 Away</option>
                      <option value="busy">🔴 Busy</option>
                      <option value="offline">⚪ Offline</option>
                   </select>
                   <input type="text" className="input input-bordered input-sm w-full" value={formData.customStatus} onChange={(e)=>setFormData({...formData, customStatus: e.target.value})} placeholder="What's your status? (e.g. In a meeting)" maxLength={80} />
                 </div>
                 <textarea className="textarea textarea-bordered h-20 w-full" value={formData.bio} onChange={(e)=>setFormData({...formData, bio: e.target.value})} placeholder="Bio"></textarea>
              </div>
            )}
          </div>
        </div>
        <form method="dialog" className="modal-backdrop"><button onClick={()=>setIsEditing(false)}>close</button></form>
      </dialog>
    </>
  );
};
export default Navbar;