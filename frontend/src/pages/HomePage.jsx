import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useMemo } from "react";
import {
  getOutgoingFriendReqs,
  getRecommendedUsers,
  getUserFriends,
  sendFriendRequest,
} from "../lib/api";
import { Link } from "react-router-dom";
import { UsersIcon } from "lucide-react";
import { socket } from "../lib/socket"; 
import useAuthUser from "../hooks/useAuthUser"; 

import FriendCard from "../components/FriendCard";
import NoFriendsFound from "../components/NoFriendsFound";

const HomePage = () => {
  const queryClient = useQueryClient();
  const { authUser } = useAuthUser(); 
  const [unreadCounts, setUnreadCounts] = useState({}); 

  // --- 1. BACKGROUND UPDATING QUERIES ---
  // Re-fetches friend list in background every 10 seconds
  const { data: friends = [], isLoading: loadingFriends } = useQuery({
    queryKey: ["friends"],
    queryFn: getUserFriends,
    refetchInterval: 10000, 
    staleTime: 5000,
  });

  const { data: recommendedUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["users"],
    queryFn: getRecommendedUsers,
    staleTime: 60000, // Keeps user list fresh for 1 minute
  });

  const { data: outgoingFriendReqs = [] } = useQuery({
    queryKey: ["outgoingFriendReqs"],
    queryFn: getOutgoingFriendReqs,
    refetchOnWindowFocus: true, // Refresh when user comes back to the tab
  });

  // --- 2. AUTOMATED DATA DERIVATION ---
  // No need for useEffect/useState here; derive from cache directly
  const outgoingRequestsIds = useMemo(() => {
    return new Set(outgoingFriendReqs.map((req) => req.recipient._id));
  }, [outgoingFriendReqs]);

  // --- 3. MUTATION WITH CACHE INVALIDATION ---
  const { mutate: sendRequestMutation, isPending } = useMutation({
    mutationFn: sendFriendRequest,
    onSuccess: () => {
      // Background re-fetch all relevant lists immediately
      queryClient.invalidateQueries({ queryKey: ["outgoingFriendReqs"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
    },
  });

  // --- 4. REAL-TIME SOCKET LOGIC ---
  useEffect(() => {
    if (!socket || !authUser) return;

    const handleNewMessage = (newMessage) => {
      if (newMessage.senderId !== authUser._id) {
        setUnreadCounts((prev) => ({
          ...prev,
          [newMessage.senderId]: (prev[newMessage.senderId] || 0) + 1,
        }));
      }
    };

    socket.on("newMessage", handleNewMessage);
    return () => socket.off("newMessage");
  }, [authUser]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="container mx-auto space-y-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Your Friends</h2>
          <Link to="/notifications" className="btn btn-outline btn-sm">
            <UsersIcon className="mr-2 size-4" />
            Friend Requests
          </Link>
        </div>

        {loadingFriends ? (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : friends.length === 0 ? (
          <NoFriendsFound />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {friends.map((friend) => (
              <FriendCard 
                key={friend._id} 
                friend={friend} 
                unreadCount={unreadCounts[friend._id] || 0}
              />
            ))}
          </div>
        )}

        <section>
          <div className="mb-6 sm:mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Meet New Learners</h2>
            <p className="opacity-70">Discover perfect language exchange partners</p>
          </div>

          {loadingUsers ? (
            <div className="flex justify-center py-12"><span className="loading loading-spinner loading-lg" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recommendedUsers.map((user) => {
                const hasRequestBeenSent = outgoingRequestsIds.has(user._id);
                return (
                  <div key={user._id} className="card bg-base-200 hover:shadow-lg transition-all">
                    <div className="card-body p-5 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="avatar size-16 rounded-full overflow-hidden">
                          <img src={user.profilePic || "/avatar.png"} alt={user.fullName} />
                        </div>
                        <h3 className="font-semibold text-lg">{user.fullName}</h3>
                      </div>
                      <button
                        className={`btn w-full mt-2 ${hasRequestBeenSent ? "btn-disabled" : "btn-primary"}`}
                        onClick={() => sendRequestMutation(user._id)}
                        disabled={hasRequestBeenSent || isPending}
                      >
                        {hasRequestBeenSent ? "Sent" : "Connect"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default HomePage;