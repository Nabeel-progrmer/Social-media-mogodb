import Input from "../components/Input";
import { useState } from "react";
import Button from "../components/Button";
import { Link } from "react-router-dom";
import axios from "axios";
import { baseUrl } from "../core";
import { useNavigate } from "react-router-dom";
import { Typography } from "antd";
import BrandLoader from "../components/BrandLoader";
import { store } from "../store/states";

const { Text } = Typography;

const Login = () =>{
  const navigate = useNavigate();
    const global_login = store((state) => state.global_login)
    const [email, set_email] = useState("")
    const [passward, set_passward] = useState("")
    const [error, setError] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
  
    const handleSubmit = async (e)=>{
      e.preventDefault()
      setError("")
      setIsSubmitting(true)
      try {
        const resp = await axios.post(`${baseUrl}/api/v1/login`,{
          email : email,
          passward : passward,
        })
        const token = resp.data.data
        localStorage.setItem("token", token)
        global_login(resp.data.user)
        navigate("/")
      } catch (error) {
        console.error(error);
        setError(error.response?.data?.message || "Login failed")
        setIsSubmitting(false)
      }
    }

    if (isSubmitting) return <BrandLoader label="Signing you in" />

    return(
      <main className="auth-page">
        <div className="auth-visual login-visual">
          <span className="visual-stamp">C / 01</span>
          <div><p className="visual-quote">“Good ideas become better when they have somewhere to land.”</p><Text>Welcome back to your corner of the internet.</Text></div>
        </div>
        <form className="auth-form login-form" onSubmit={handleSubmit}>
          <p className="auth-kicker">WELCOME BACK</p>
          <h2>Good to see you.</h2>
          <p className="auth-subtitle">Pick up where you left off.</p>
          <Input placeholder="Email address" type="email" value={email} onChange={(e) => set_email(e.target.value)} required />
          <Input placeholder="Password" type="password" value={passward} onChange={(e) => set_passward(e.target.value)} required />
          {error && <p className="form-error" role="alert">{error}</p>}
          <Button>Log in</Button>
          <p className="auth-footer">New here? <Link to="/signup">Create an account</Link></p>
        </form>
      </main>
    )
}

export default Login