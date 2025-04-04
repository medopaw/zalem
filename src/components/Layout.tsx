import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Settings } from 'lucide-react';

function Layout() {
  const { user, isAdmin, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              {isAdmin && (
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
