import { Avatar, Button, Layout, Tag } from 'antd'
import { LogoutOutlined } from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import { store } from '../store/states'

const { Header: AntHeader } = Layout


const Header = () => {
  const navigate = useNavigate()
  const { user, global_logout } = store()

  const logout = () => {
    localStorage.removeItem('token')
    global_logout()
    navigate('/login')
  }

  return (
    <AntHeader className="app-header">
      <div className="header-user">
        {user && <Link to="/profile" className="user-name">{user.firstname} {user.lastname}</Link>}
      </div>
      <Link to="/" className="brand-mark header-logo"><span className="brand-dot" /> circle</Link>
      <div className="header-actions">
        <Tag color="green" className="live-tag">● LIVE</Tag>
        <Avatar className="profile-avatar">{user?.firstname?.[0] || 'C'}{user?.lastname?.[0] || 'M'}</Avatar>
        <Button type="text" icon={<LogoutOutlined />} onClick={logout}>Logout</Button>
      </div>
    </AntHeader>
  )
}

export default Header
