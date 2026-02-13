import React, { useState, useEffect, useMemo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '@/components/dashboard/Sidebar';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import { useDialog } from '@/contexts/DialogContext';
import AddInboundNumber from '@/components/AddInboundNumber';
import { useAuth } from '@/contexts/AuthContext';

interface MainLayoutProps {
  children?: React.ReactNode;
  title?: string;
}

// Route to page title mapping
const routeToTitle: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/create-agent': 'Create Voice Agent',
  '/edit-agent': 'Edit Voice Agent',
  '/agents': 'Voice Agents',
  '/profile': 'Profile',
  '/inbound-numbers': 'Inbound Numbers',
  '/call-schedules': 'Call Schedules',
  '/call-history': 'Call History',
  '/leads': 'Leads',
  '/billing': 'Billing',
  '/email': 'Email Management',
  '/ai-prompt': 'AI Prompt Generator',
  '/documentation': 'Documentation',
};

const MainLayout: React.FC<MainLayoutProps> = ({ children, title }) => {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { addInboundNumberDialog, setAddInboundNumberDialog } = useDialog();
  const { user } = useAuth();

  // Determine page title based on current route
  const pageTitle = useMemo(() => {
    // If title prop is provided, use it (for backward compatibility)
    if (title) return title;

    // Check if it's an edit agent route
    if (location.pathname.startsWith('/edit-agent/')) {
      return 'Edit Voice Agent';
    }

    // Get title from route mapping
    return routeToTitle[location.pathname] || 'Dashboard';
  }, [location.pathname, title]);

  // Detect sidebar collapse from the Sidebar component
  useEffect(() => {
    const sidebar = document.querySelector('aside');
    if (sidebar) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === 'class') {
            setSidebarCollapsed(sidebar.classList.contains('w-20') || sidebar.classList.contains('w-[80px]'));
          }
        });
      });
      observer.observe(sidebar, { attributes: true });
      return () => observer.disconnect();
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className={`${sidebarCollapsed ? 'ml-20' : 'ml-[240px]'} p-8 transition-all duration-500`}>
        <DashboardHeader title={pageTitle} />
        {children || <Outlet />}
      </main>

      {/* Persistent Add Inbound Number Dialog - stays open across navigation */}
      {user && (
        <AddInboundNumber
          open={addInboundNumberDialog.open}
          onClose={() => setAddInboundNumberDialog(false)}
          onSuccess={() => {
            setAddInboundNumberDialog(false);
            // Trigger a refresh event that InboundNumbers can listen to
            window.dispatchEvent(new CustomEvent('inboundNumbersRefresh'));
          }}
          editingNumber={addInboundNumberDialog.editingNumber}
        />
      )}
    </div>
  );
};

export default MainLayout;
