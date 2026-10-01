import { lazy, Suspense, useEffect } from "react";
import { Navigate, Routes, Route } from "react-router-dom";
import axios from "axios";
const Post = lazy(() => import("./pages/Post"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const NotFound = lazy(() => import("./pages/NotFound"));
import { store } from "./store/states";
import { baseUrl } from "./core";
import BrandLoader from "./components/BrandLoader";
import "./App.css";
const Profile = lazy(() => import("./pages/Profile"));
const SinglePost = lazy(() => import("./pages/SinglePost"));
const Chat = lazy(() => import("./pages/Chat"));
const Settings = lazy(() => import("./pages/Settings"));
const People = lazy(() => import("./pages/People"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));

const App = () => {
  const {
    global_login,
    global_logout,
    isAuthLoading,
    setAuthLoading,
    isLogin,
  } = store();

  useEffect(() => {
    const getProfile = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setAuthLoading(false);
        return;
      }
      try {
        const response = await axios.get(`${baseUrl}/api/v1/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        global_login(response.data.data);
      } catch {
        localStorage.removeItem("token");
        global_logout();
      } finally {
        setAuthLoading(false);
      }
    };
    getProfile();
  }, [global_login, global_logout, setAuthLoading]);

  if (isAuthLoading) return <BrandLoader label="Getting your space ready" />;

  return (
    <Suspense fallback={<BrandLoader label="Loading your space" />}>
      <Routes>
        {isLogin ? (
          <>
            <Route path="/" element={<Post />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/:userId" element={<Profile />} />
            <Route path="/post/:postId" element={<SinglePost />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/people" element={<People />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/forgot-password" element={<Navigate to="/" replace />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/signup" element={<Navigate to="/" replace />} />
            <Route path="/verify-email" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFound />} />
          </>
        ) : (
          <>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/settings" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<NotFound />} />
          </>
        )}
      </Routes>
    </Suspense>
  );
};

export default App;
