import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import axios from "axios";
import Post from "./pages/Post";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import NotFound from "./pages/NotFound";
import { store } from "./store/states";
import { baseUrl } from "./core";
import BrandLoader from "./components/BrandLoader";
import "./App.css";
import Profile from "./pages/Profile";

const App = () => {
  const { global_login, global_logout, isAuthLoading, setAuthLoading, isLogin } = store();

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
    <Routes>
      {isLogin ? (
        <>
          <Route path="/" element={<Post />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<NotFound />} />
        </>
      ) : (
        <>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="*" element={<NotFound />} />
        </>
      )}
    </Routes>
  );
};

export default App;