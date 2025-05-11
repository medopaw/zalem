import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// 初始化消息处理器
import { initializeMessageHandlers } from './utils/registerMessageHandlers';
// 确保消息处理器被初始化
initializeMessageHandlers();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
