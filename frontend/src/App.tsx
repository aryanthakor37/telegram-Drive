import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DriveProvider } from './context/DriveContext';
import Login from './pages/Login';
import DashboardLayout from './layouts/DashboardLayout';
import MyFiles from './pages/dashboard/MyFiles';
import RecentFiles from './pages/dashboard/RecentFiles';
import StarredFiles from './pages/dashboard/StarredFiles';
import Trash from './pages/dashboard/Trash';
import Settings from './pages/dashboard/Settings';
import CategoryFiles from './pages/dashboard/CategoryFiles';
import SharePage from './pages/public/SharePage';
import { Toaster } from 'react-hot-toast';

// Route guard for authenticated pages
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-brand-500/30 border-t-brand-500 rounded-full animate-spin"></div>
          <p className="text-dark-400 text-sm font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !user.telegramConnected) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Route guard for guest-only pages (login)
const GuestRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-500/30 border-t-brand-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (user && user.telegramConnected) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <DriveProvider>
        <Router>
          <Routes>
            {/* Guest Routes */}
            <Route
              path="/login"
              element={
                <GuestRoute>
                  <Login />
                </GuestRoute>
              }
            />

            {/* Public Routes */}
            <Route path="/share/:token" element={<SharePage />} />

            {/* Protected Dashboard Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              {/* Nested Dashboard Pages */}
              <Route index element={<MyFiles />} />
              <Route path="recent" element={<RecentFiles />} />
              <Route path="starred" element={<StarredFiles />} />
              <Route path="trash" element={<Trash />} />
              <Route path="settings" element={<Settings />} />
              <Route path="category/:categoryName" element={<CategoryFiles />} />
            </Route>

            {/* Fallback redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
        <Toaster 
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#1e293b', // slate-800
              color: '#fff',
              borderRadius: '12px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
              fontSize: '13px',
              fontWeight: 500,
            },
            success: {
              iconTheme: {
                primary: '#10b981', // emerald-500
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444', // red-500
                secondary: '#fff',
              },
            },
          }} 
        />
      </DriveProvider>
    </AuthProvider>
  );
};

export default App;