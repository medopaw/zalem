import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// 移除 StrictMode 以检查实际渲染次数
createRoot(document.getElementById('root')!).render(
  <App />
);
