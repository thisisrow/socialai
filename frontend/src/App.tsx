
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PostProvider } from './contexts/PostContext';
import LoginPage from './components/auth/LoginPage';
import Dashboard from './components/dashboard/Dashboard';
import PrivacyPolicy from './components/legal/PrivacyPolicy';
import { Toaster } from './components/ui/Toaster';
import Setting from './components/dashboard/Setting';
import DashboardLayout from './components/dashboard/DashboardLayout';

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-red-500 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-4 border-white"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        {user ? (
          <Route path="/*" element={<AuthenticatedApp />} />
        ) : (
          <Route path="/*" element={<LoginPage />} />
        )}
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      </Routes>
      <Toaster />
    </div>
  );
}

function AuthenticatedApp() {
  return (
    <PostProvider>
      <Routes>
        <Route path="/" element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="/setting" element={<Setting />} />
        </Route>
      </Routes>
    </PostProvider>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;