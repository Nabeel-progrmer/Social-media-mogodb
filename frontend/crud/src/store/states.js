import { create } from "zustand";

export const store = create((set) => ({
  user: null,
  isLogin: false,
  isAuthLoading: true,
  feedPosts: [],

  setFeedPosts: (feedPosts) => set({ feedPosts }),
  mergeFeedPosts: (posts) =>
    set((state) => {
      const postsById = new Map(
        state.feedPosts.map((post) => [post._id, post]),
      );
      posts.forEach((post) =>
        postsById.set(post._id, { ...postsById.get(post._id), ...post }),
      );
      return { feedPosts: [...postsById.values()] };
    }),
  upsertFeedPost: (post) =>
    set((state) => {
      const existingIndex = state.feedPosts.findIndex(
        (item) => item._id === post?._id,
      );
      if (existingIndex < 0) return { feedPosts: [post, ...state.feedPosts] };
      const feedPosts = [...state.feedPosts];
      feedPosts[existingIndex] = { ...feedPosts[existingIndex], ...post };
      return { feedPosts };
    }),
  patchFeedPost: (postId, patch) =>
    set((state) => ({
      feedPosts: state.feedPosts.map((post) =>
        post._id === postId ? { ...post, ...patch } : post,
      ),
    })),
  removeFeedPost: (postId) =>
    set((state) => ({
      feedPosts: state.feedPosts.filter((post) => post._id !== postId),
    })),
  clearFeedPosts: () => set({ feedPosts: [] }),

  global_login: (user) => set({ user, isLogin: true }),

  setAuthLoading: (isAuthLoading) => set({ isAuthLoading }),

  global_logout: () => set({ user: null, isLogin: false, feedPosts: [] }),
}));
