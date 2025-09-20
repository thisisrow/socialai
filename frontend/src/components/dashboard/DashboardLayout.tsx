import { Outlet, useOutletContext, useLocation } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import { useState, useEffect } from 'react';

type ContextType = { activeTab: string; setActiveTab: (tab: string) => void };

export default function DashboardLayout() {
  const [activeTab, setActiveTab] = useState('posts');
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    if (path === '/') {
      setActiveTab('posts');
    } else if (path === '/setting') {
      setActiveTab('settings');
    }
  }, [location]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="flex-1 p-6 ml-64">
          <Outlet context={{ activeTab, setActiveTab }} />
        </main>
      </div>
    </div>
  );
}

export function useDashboardContext() {
  return useOutletContext<ContextType>();
}
