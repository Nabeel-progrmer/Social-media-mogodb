import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ConfigProvider theme={{
      token: {
        colorPrimary: '#d56745',
        colorInfo: '#d56745',
        colorText: '#193431',
        colorTextSecondary: '#6a7773',
        colorBgContainer: '#fffdf8',
        borderRadius: 10,
        fontFamily: "'DM Sans', sans-serif",
      },
    }}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ConfigProvider>
  
  </StrictMode>,
)
