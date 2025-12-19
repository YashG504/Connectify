import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { acceptFriendRequest, getFriendRequests } from "../lib/api";
import { BellIcon, ClockIcon, MessageSquareIcon, UserCheckIcon } from "lucide-react";
import NoNotificationsFound from "../components/NoNotificationsFound";
import toast from "react-hot-toast";

const NotificationsPage = () => {
  const queryClient = useQueryClient();

  // --- 1. BACKGROUND UPDATING QUERY ---
  const { data: friendRequests, isLoading } = useQuery({
    queryKey: ["friendRequests"],
    queryFn: getFriendRequests,
    // Background re-fetch every 15 seconds to catch new incoming requests
    refetchInterval: 15000, 
    // Auto-update when the user returns to the browser tab
    refetchOnWindowFocus: true, 
  });

  // --- 2. MUTATION WITH GLOBAL CACHE INVALIDATION ---
  const { mutate: acceptRequestMutation, isPending } = useMutation({
    mutationFn: acceptFriendRequest,
    onSuccess: () => {
      // Refresh the current notification list
      queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
      // Update the friend list globally so it reflects on the HomePage immediately
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      toast.success("Connection accepted!");
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to accept request");
    }
  });

  const incomingRequests = friendRequests?.incomingReqs || [];
  const acceptedRequests = friendRequests?.acceptedReqs || [];

  if (isLoading) {
    return (
      <div className="flex justify-center py-12 h-screen items-center">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="container mx-auto max-w-4xl space-y-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-6">Notifications</h1>

        <>
          {/* INCOMING FRIEND REQUESTS */}
          {incomingRequests.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <UserCheckIcon className="h-5 w-5 text-primary" />
                Friend Requests
                <span className="badge badge-primary ml-2">{incomingRequests.length}</span>
              </h2>

              <div className="space-y-3">
                {incomingRequests.map((request) => (
                  <div
                    key={request._id}
                    className="card bg-base-200 shadow-sm hover:shadow-md transition-all duration-300"
                  >
                    <div className="card-body p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="avatar w-14 h-14 rounded-full bg-base-300 overflow-hidden">
                            <img src={request.sender.profilePic || "/avatar.png"} alt={request.sender.fullName} />
                          </div>
                          <div>
                            <h3 className="font-semibold">{request.sender.fullName}</h3>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              <span className="badge badge-secondary badge-sm">
                                Native: {request.sender.nativeLanguage}
                              </span>
                              <span className="badge badge-outline badge-sm">
                                Learning: {request.sender.learningLanguage}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          className="btn btn-primary btn-sm px-6 rounded-full"
                          onClick={() => acceptRequestMutation(request._id)}
                          disabled={isPending}
                        >
                          {isPending ? <span className="loading loading-spinner loading-xs"></span> : "Accept"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ACCEPTED REQS NOTIFICATIONS */}
          {acceptedRequests.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <BellIcon className="h-5 w-5 text-success" />
                New Connections
              </h2>

              <div className="space-y-3">
                {acceptedRequests.map((notification) => (
                  <div key={notification._id} className="card bg-base-100 border border-base-300 shadow-sm">
                    <div className="card-body p-4">
                      <div className="flex items-start gap-3">
                        <div className="avatar mt-1 size-10 rounded-full overflow-hidden">
                          <img
                            src={notification.recipient.profilePic || "/avatar.png"}
                            alt={notification.recipient.fullName}
                          />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold">{notification.recipient.fullName}</h3>
                          <p className="text-sm my-1 opacity-80">
                            {notification.recipient.fullName} accepted your friend request. You can now start chatting!
                          </p>
                          <p className="text-xs flex items-center opacity-60">
                            <ClockIcon className="h-3 w-3 mr-1" />
                            Recently
                          </p>
                        </div>
                        <div className="badge badge-success badge-outline gap-1">
                          <MessageSquareIcon className="h-3 w-3" />
                          Connected
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {incomingRequests.length === 0 && acceptedRequests.length === 0 && (
            <NoNotificationsFound />
          )}
        </>
      </div>
    </div>
  );
};

export default NotificationsPage;