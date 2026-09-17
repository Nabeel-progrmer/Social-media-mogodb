import { Avatar, Card, Layout, Space, Tag, Typography } from 'antd'
import { MailOutlined, UserOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import Header from '../components/Header'
import { store } from '../store/states'
import '../App.css'

const { Content } = Layout
const { Paragraph, Text, Title } = Typography

const Profile = () => {
    const user = store((state) => state.user)
    const fullName = user ? `${user.firstname} ${user.lastname}` : 'Your profile'
    const initials = `${user?.firstname?.[0] || ''}${user?.lastname?.[0] || ''}` || 'U'

    return (
        <Layout className="app-layout">
            <Header />
            <Content className="profile-content">
                <Link to="/" className="profile-back">Back to your space</Link>
                <Card className="profile-card" bordered={false}>
                    <div className="profile-cover" />
                    <div className="profile-card-body">
                        <Avatar className="profile-page-avatar" size={112} icon={!user && <UserOutlined />}>
                        <EditFilled />
                            {user && initials}
                        </Avatar>
                        <Tag className="profile-status" color="green">ACTIVE MEMBER</Tag>
                        <Title level={1}>{fullName}</Title>
                        <Paragraph className="profile-intro">A member of the Circle community.</Paragraph>
                        <Space className="profile-contact" size="middle">
                            <MailOutlined />
                            <Text>{user?.email || 'Email not available'}</Text>
                        </Space>
                    </div>
                </Card>
            </Content>
        </Layout>
    )
}

export default Profile