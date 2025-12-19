import { create } from "zustand";

export const useThemeStore = create((set) => ({
  theme: localStorage.getItem("connectify-theme") || "coffee",
  setTheme: (theme) => {
    localStorage.setItem("connectify-theme", theme);
    set({ theme });
  },
  onlineUsers: new Set(),
  setOnlineUsers: (users) => set({ onlineUsers: new Set(users) }),
  addOnlineUser: (userId) => set((state) => ({ onlineUsers: new Set([...state.onlineUsers, userId]) })),
  removeOnlineUser: (userId) => set((state) => {
    const newSet = new Set(state.onlineUsers);
    newSet.delete(userId);
    return { onlineUsers: newSet };
  }),
}));
