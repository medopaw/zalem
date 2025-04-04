import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user || !isAdmin) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
}

export default AdminRoute;
