import { useEffect, useState } from 'react'
import { Alert, Avatar, Button, Card, Col, Empty, Input, Layout, Popconfirm, Row, Skeleton, Space, Statistic, Tag, Typography, message } from 'antd'
import { DeleteOutlined, EditOutlined, FileTextOutlined, SendOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { store } from '../store/states'
import '../App.css'

const { Content } = Layout
const { TextArea } = Input
const { Paragraph, Title, Text } = Typography
const API_URL = 'http://localhost:5002/api/v1'

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token') || ''}` })

function Post() {
  const navigate = useNavigate()
  const user = store((state) => state.user)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [posts, setPosts] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState('')

  const getPosts = async () => {
    try {
      setLoading(true)
      setFetchError('')
      const response = await fetch(`${API_URL}/post`, { headers: authHeaders() })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to fetch posts')
      setPosts(data.posts || [])
    } catch (error) {
      setFetchError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const savePost = async () => {
    if (!title.trim() || !description.trim()) {
      message.error('Add a title and description first')
      return
    }
    try {
      setLoading(true)
      const response = await fetch(`${API_URL}/post${editingId ? `/${editingId}` : ''}`, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ title: title.trim(), description: description.trim() }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to save post')
      message.success(editingId ? 'Post updated' : 'Post published')
      resetEditor()
      await getPosts()
    } catch (error) {
      message.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const deletePost = async (postId) => {
    try {
      setLoading(true)
      const response = await fetch(`${API_URL}/post/${postId}`, { method: 'DELETE', headers: authHeaders() })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to delete post')
      message.success('Post deleted')
      await getPosts()
    } catch (error) {
      message.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const editPost = (post) => {
    setEditingId(post._id)
    setTitle(post.title)
    setDescription(post.description)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const resetEditor = () => {
    setEditingId(null)
    setTitle('')
    setDescription('')
  }

  useEffect(() => {
    const timer = setTimeout(getPosts, 0)
    return () => clearTimeout(timer)
  }, [])

  return (
    <Layout className="app-layout">
      <Header />
      <Content className="dashboard-content">
        <section className="dashboard-hero">
          <div>
            <Text className="eyebrow">YOUR COMMUNITY SPACE</Text>
            <Title level={1}>Make something <em>worth sharing.</em></Title>
            <Paragraph className="hero-copy">A quiet corner for your thoughts, ideas, and the conversations that matter.</Paragraph>
          </div>
          <div className="hero-orbit"><span>✦</span><strong>{posts.length}</strong><small>stories shared</small></div>
        </section>

        <Row gutter={[24, 24]} align="top">
          <Col xs={24} lg={9}>
            <Card className="composer-card" bordered={false}>
              <div className="section-heading">
                <div className="section-icon"><FileTextOutlined /></div>
                <div><Text className="card-kicker">{editingId ? 'REFINE YOUR STORY' : 'START A CONVERSATION'}</Text><Title level={3}>{editingId ? 'Edit your post' : 'What is on your mind?'}</Title></div>
              </div>
              <Input className="title-input" placeholder="Give it a clear title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} showCount />
              <TextArea className="description-input" placeholder="Share a thought, an idea, or a moment..." autoSize={{ minRows: 6, maxRows: 10 }} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} showCount />
              <div className="composer-footer">
                <Text type="secondary">Be kind. Be curious.</Text>
                <Space>
                  {editingId && <Button onClick={resetEditor}>Cancel</Button>}
                  <Button type="primary" icon={editingId ? <EditOutlined /> : <SendOutlined />} loading={loading} onClick={savePost}>{editingId ? 'Save changes' : 'Publish post'}</Button>
                </Space>
              </div>
            </Card>
            <Row gutter={12} className="stats-row">
              <Col span={12}><Card bordered={false}><Statistic title="Total stories" value={posts.length} /></Card></Col>
              <Col span={12}><Card bordered={false}><Statistic title="Your space" value="Open" valueStyle={{ color: '#2c8066', fontSize: 23 }} /></Card></Col>
            </Row>
          </Col>

          <Col xs={24} lg={15}>
            <div className="feed-heading"><div><Text className="card-kicker">THE LATEST</Text><Title level={2}>Community feed</Title></div><Button type="text" onClick={getPosts}>Refresh</Button></div>
            {fetchError && <Alert message="Could not load your feed" description={fetchError === 'unauthorized' ? 'Log in first to see and create posts.' : fetchError} type="warning" showIcon action={fetchError === 'unauthorized' && <Button size="small" onClick={() => navigate('/login')}>Log in</Button>} />}
            <div className="feed-list">
              {loading && posts.length === 0 ? [1, 2, 3].map((item) => <Card key={item} className="post-card skeleton-card" bordered={false}><Skeleton active paragraph={{ rows: 3 }} /></Card>) : posts.length === 0 ? <Card bordered={false} className="empty-card"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Your feed is waiting for its first story." /></Card> : posts.map((post) => (
                <Card key={post._id} className="post-card" bordered={false}>
                  <div className="post-meta"><Avatar className="post-avatar">{user?.firstname?.[0] || 'U'}{user?.lastname?.[0] || ''}</Avatar><div><Text strong>{user ? `${user.firstname} ${user.lastname}` : 'User'}</Text><br /><Text type="secondary">Just shared something new</Text></div><Tag className="post-tag">STORY</Tag></div>
                  <Title level={3}>{post.title}</Title>
                  <Paragraph className="post-description">{post.description}</Paragraph>
                  <div className="post-actions"><Text type="secondary">A thought worth making space for.</Text><Space><Button type="text" icon={<EditOutlined />} onClick={() => editPost(post)}>Edit</Button><Popconfirm title="Delete this post?" description="This cannot be undone." onConfirm={() => deletePost(post._id)} okText="Delete" cancelText="Keep it"><Button danger type="text" icon={<DeleteOutlined />}>Delete</Button></Popconfirm></Space></div>
                </Card>
              ))}
            </div>
          </Col>
        </Row>
      </Content>
    </Layout>
  )
}

export default Post
