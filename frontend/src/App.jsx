import { useEffect } from "react";
import { Navigate, Route, Routes, useNavigate, useLocation } from "react-router-dom";
import { Toaster, toast } from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";

// Pages
import HomePage from "./pages/HomePage.jsx";
import SignUpPage from "./pages/SignUpPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import NotificationsPage from "./pages/NotificationsPage.jsx";
import CallPage from "./pages/CallPage.jsx";
import ChatPage from "./pages/ChatPage.jsx";
import OnboardingPage from "./pages/OnboardingPage.jsx";

// Components & Hooks
import PageLoader from "./components/PageLoader.jsx";
import useAuthUser from "./hooks/useAuthUser.js";
import Layout from "./components/Layout.jsx";
import { useThemeStore } from "./store/useThemeStore.js"; 
import { socket, connectSocket, disconnectSocket } from "./lib/socket.js";

const App = () => {
  const { isLoading, authUser } = useAuthUser();
  const { theme } = useThemeStore();
  const navigate = useNavigate();
  const location = useLocation(); // Required to detect the current page
  const queryClient = useQueryClient();
  const { addOnlineUser, removeOnlineUser } = useThemeStore();

  const isAuthenticated = Boolean(authUser);
  const isOnboarded = authUser?.isOnboarded;

  // --- REAL-TIME SIGNALING LISTENER ---
  useEffect(() => {
    if (!socket || !isAuthenticated) return;

    // Listen for friend requests
    socket.on("friend-request", () => {
      queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
    });
    // Listen for online status
    socket.on("user-online", (userId) => {
      addOnlineUser(userId);
    });
    socket.on("user-offline", (userId) => {
      removeOnlineUser(userId);
    });
    // Listen for calls from other users via custom WebSockets
    socket.on("incoming-call", ({ from, fromName }) => {
      
      // --- THE CALL GUARD ---
      // If the user is already on a call page, ignore the signaling in App.jsx
      // to prevent the "blinking" infinite render loop
      if (location.pathname.startsWith("/call")) return;

      toast((t) => (
        <div className="flex flex-col gap-3 p-2">
          <div className="flex items-center gap-3">
            <div className="bg-success size-2 animate-ping rounded-full" />
            <span className="font-bold text-sm">{fromName} is calling...</span>
          </div>
          <div className="flex gap-2">
            <button 
              className="btn btn-success btn-xs flex-1" 
              onClick={() => {
                toast.dismiss(t.id);
                navigate(`/call/${from}`); 
              }}
            >
              Answer
            </button>
            <button 
              className="btn btn-error btn-xs flex-1" 
              onClick={() => {
                // Inform the caller the request was declined
                socket.emit("reject-call", { to: from });
                toast.dismiss(t.id);
              }}
            >
              Decline
            </button>
          </div>
        </div>
      ), { 
        duration: Infinity, 
        position: "top-center" 
      });
    });

    return () => {
      socket.off("friend-request");
      socket.off("user-online");
      socket.off("user-offline");
      socket.off("incoming-call");
      socket.off("call-accepted");
      socket.off("ice-candidate");
      socket.off("call-rejected");
    };
  }, [navigate, location.pathname, isAuthenticated]); // Re-run when location changes

  // --- CONNECT SOCKET WHEN AUTHENTICATED ---
  useEffect(() => {
    if (isAuthenticated && authUser?._id) {
      connectSocket(authUser._id);
    } else {
      disconnectSocket();
    }

    return () => disconnectSocket();
  }, [isAuthenticated, authUser]);

  if (isLoading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-base-200 transition-colors duration-300" data-theme={theme}>
      <Routes>
        <Route
          path="/"
          element={
            isAuthenticated && isOnboarded ? (
              <Layout showSidebar={true}>
                <HomePage />
              </Layout>
            ) : (
              <Navigate to={!isAuthenticated ? "/login" : "/onboarding"} />
            )
          }
        />
        
        <Route
          path="/friends"
          element={
            isAuthenticated && isOnboarded ? (
              <Layout showSidebar={true}>
                <HomePage />
              </Layout>
            ) : (
              <Navigate to={!isAuthenticated ? "/login" : "/onboarding"} />
            )
          }
        />

        <Route
          path="/signup"
          element={!isAuthenticated ? <SignUpPage /> : <Navigate to={isOnboarded ? "/" : "/onboarding"} />}
        />
        <Route
          path="/login"
          element={!isAuthenticated ? <LoginPage /> : <Navigate to={isOnboarded ? "/" : "/onboarding"} />}
        />
        
        <Route
          path="/onboarding"
          element={
            isAuthenticated ? (
              !isOnboarded ? <OnboardingPage /> : <Navigate to="/" />
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        <Route
          path="/notifications"
          element={
            isAuthenticated && isOnboarded ? (
              <Layout showSidebar={true}>
                <NotificationsPage />
              </Layout>
            ) : (
              <Navigate to={!isAuthenticated ? "/login" : "/onboarding"} />
            )
          }
        />

        <Route
          path="/chat/:id"
          element={
            isAuthenticated && isOnboarded ? (
              <Layout showSidebar={false}>
                <ChatPage />
              </Layout>
            ) : (
              <Navigate to={!isAuthenticated ? "/login" : "/onboarding"} />
            )
          }
        />

        <Route
          path="/call/:id"
          element={
            isAuthenticated && isOnboarded ? (
              <CallPage />
            ) : (
              <Navigate to={!isAuthenticated ? "/login" : "/onboarding"} />
            )
          }
        />
      </Routes>

      <Toaster />
    </div>
  );
};

export default App;