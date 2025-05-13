import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { DebugProvider } from './contexts/DebugContext';
import { ErrorReportProvider } from './contexts/ErrorReportContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Home from './pages/Home';
import Admin from './pages/Admin';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import ErrorNotification from './components/ErrorNotification';
import { initBackgroundTasks } from './services/background/initBackgroundTasks';
import { initializeSystem } from './utils/initializeSystem';
import { getErrorReporter, ErrorLevel } from './services/error/ErrorReporter';

const queryClient = new QueryClient();

function App() {
  // 在应用启动时初始化系统
  useEffect(() => {
    // 初始化后台任务
    console.log(`Initializing background tasks in ${process.env.NODE_ENV} environment`);
    initBackgroundTasks();

    // 初始化系统
    console.log('Initializing system in App');

    // 使用延迟初始化，确保所有React组件都已完全加载
    // React组件加载是异步的，需要等待它们完全加载后再初始化系统
    const initTimer = setTimeout(() => {
      try {
        // 直接调用初始化函数
        const success = initializeSystem();
        if (success) {
          console.log('System initialized successfully in App');
        }
      } catch (error) {
        // 显示错误信息到控制台
        console.error('Error during system initialization:', error);

        // 使用错误报告服务报告错误
        getErrorReporter().reportToUI({
          title: '系统初始化失败',
          message: error instanceof Error ? error.message : '未知错误',
          level: ErrorLevel.CRITICAL,
          details: error instanceof Error ? error.stack : undefined,
          context: 'SystemInitialization'
        });
      }
    }, 2000); // 延长延迟时间到2秒，确保所有组件已完全加载

    // 清理定时器
    return () => clearTimeout(initTimer);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DebugProvider>
          <ErrorReportProvider>
            <Router>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<Layout />}>
                  <Route index element={<Navigate to="/home" replace />} />
                  <Route
                    path="home"
                    element={
                      <ProtectedRoute>
                        <Home />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="admin"
                    element={
                      <AdminRoute>
                        <Admin />
                      </AdminRoute>
                    }
                  />
                </Route>
              </Routes>
              {/* 全局错误通知组件 */}
              <ErrorNotification />
            </Router>
          </ErrorReportProvider>
        </DebugProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
