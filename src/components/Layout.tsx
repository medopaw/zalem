import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Settings, Home, Bug } from 'lucide-react';
import { useDebugMode } from '../contexts/DebugContext';

function Layout() {
  const { user, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const { isDebugMode, toggleDebugMode } = useDebugMode();

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              {location.pathname !== '/home' && (
                <Link
                  to="/home"
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-900 hover:text-blue-600"
                >
                  <Home className="w-5 h-5 mr-2" />
                  <span className="font-semibold">Home</span>
                </Link>
              )}

              {isAdmin && location.pathname !== '/admin' && (
                <Link
                  to="/admin"
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-900 hover:text-blue-600"
                >
                  <Settings className="w-5 h-5 mr-2" />
                  Admin
                </Link>
              )}
            </div>
            <div className="flex items-center gap-4">
              {/* 调试模式切换按钮 */}
              <button
                onClick={toggleDebugMode}
                className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                  isDebugMode
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                title={isDebugMode ? '关闭调试模式' : '开启调试模式'}
              >
                <Bug className={`w-5 h-5 mr-1 ${isDebugMode ? 'text-purple-600' : 'text-gray-400'}`} />
                {isDebugMode ? '调试模式' : '调试'}
              </button>

              {user && (
                <>
                  <button
                    onClick={() => signOut()}
                    className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-900 hover:text-blue-600"
                  >
                    Sign Out
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-[calc(100vh-4rem)] overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
