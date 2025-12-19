// 1. NODE.JS POLYFILLS (Must be at the very top for Simple-Peer)
import { Buffer } from "buffer";
import process from "process";

// Assign to window object so older libraries can find them
window.Buffer = Buffer;
window.process = process;
window.global = window;

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom"; // Ensure 'react-router-dom' is installed
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "./index.css";
import App from "./App.jsx";

// 2. CONFIGURE QUERY CLIENT
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true, // Automatically re-fetches when user returns to tab
      refetchInterval: 30000,     // Auto-refresh all queries every 30 seconds
      refetchIntervalInBackground: true, // Continue polling even when tab is not active
      staleTime: 1000 * 60 * 2,    // Data is considered fresh for 2 minutes
      retry: 1,
    },
  },
});

// 3. RENDER CORE
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>
);