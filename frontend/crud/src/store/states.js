import { create } from "zustand"

export const store = create((set) => ({
    user: null,
    isLogin: false,
    isAuthLoading: true,

    global_login: (user) => set({ user, isLogin: true }),

    setAuthLoading: (isAuthLoading) => set({ isAuthLoading }),

    global_logout: () => set({ user: null, isLogin: false }),
}))