import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutTemplate,
  GraduationCap,
  PhoneIncoming,
  CalendarFold,
  Headset,
  FileUser,
  BookOpen,
  CreditCard,
  User,
  Mail,
  Sparkles,
  ChevronDown,
  ChevronRight,
  LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import logoImage from '../../assest/DNAI-Logo 1 (1).png';
import logoImageDark from '../../assest/DNAI LOGO@2x.png';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeMode } from '@/contexts/ThemeContext';

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  hasSubmenu?: boolean;
}

interface SidebarSection {
  title: string;
  items: SidebarItem[];
}

const sidebarSections: SidebarSection[] = [
  {
    title: 'Overview',
    items: [
      { id: 'overview', label: 'Dashboard', icon: <LayoutTemplate className="w-5 h-5" />, path: '/dashboard' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { id: 'agents', label: 'Agents', icon: <GraduationCap className="w-5 h-5" />, path: '/agents' },
      { id: 'inbound-numbers', label: 'Phone Numbers', icon: <PhoneIncoming className="w-5 h-5" />, path: '/inbound-numbers' },
      { id: 'knowledge-bases', label: 'Knowledge Bases', icon: <BookOpen className="w-5 h-5" />, path: '/knowledge-bases' },
      { id: 'email', label: 'Emails', icon: <Mail className="w-5 h-5" />, path: '/email' },
      { id: 'ai-prompt', label: 'AI Prompt', icon: <Sparkles className="w-5 h-5" />, path: '/ai-prompt' },
      { id: 'calendar', label: 'Calendar', icon: <CalendarFold className="w-5 h-5" />, path: '/call-schedules' },
    ],
  },
  {
    title: 'Analytics',
    items: [
      { id: 'call-logs', label: 'Call History', icon: <Headset className="w-5 h-5" />, path: '/call-history' },
      { id: 'leads', label: 'Leads', icon: <FileUser className="w-5 h-5" />, path: '/leads' },
    ],
  },
  {
    title: 'Account',
    items: [
      { id: 'billing', label: 'Billing', icon: <CreditCard className="w-5 h-5" />, path: '/billing' },
      { id: 'profile', label: 'Settings', icon: <User className="w-5 h-5" />, path: '/profile' },
      { id: 'documentation', label: 'Documentation', icon: <BookOpen className="w-5 h-5" />, path: '/documentation' },
    ],
  },
];

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const { signOut } = useAuth();
  const { mode } = useThemeMode();

  const getActiveItem = () => {
    const currentPath = location.pathname;
    for (const section of sidebarSections) {
      const item = section.items.find(item => {
        if (item.path === currentPath) return true;
        // Handle edit-agent route
        if (item.id === 'agents' && currentPath.startsWith('/edit-agent')) return true;
        if (item.id === 'agents' && currentPath.startsWith('/create-agent')) return true;
        return false;
      });
      if (item) return item.id;
    }
    return 'overview';
  };

  const activeItem = getActiveItem();

  const handleItemClick = (path: string, hasSubmenu?: boolean, id?: string) => {
    if (hasSubmenu && id) {
      setExpandedItems(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
        return newSet;
      });
    } else {
      navigate(path);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-sidebar-background flex flex-col transition-all duration-300 ease-in-out z-50 border-r border-sidebar-border",
        isCollapsed ? "w-20" : "w-[240px]"
      )}
      style={{ fontFamily: "'Manrope', sans-serif" }}
    >
      {/* Logo */}
      <div className="h-20 flex items-center px-6 border-b border-sidebar-border/50">
        <div className={cn(
          "flex items-center align-self: anchor-center gap-2 overflow-hidden transition-all duration-300",
          isCollapsed ? "justify-center w-full px-0" : ""
        )}>
          {isCollapsed ? (
            <div className="h-10 w-10 bg-sidebar-primary/10 rounded-lg flex items-center justify-center text-sidebar-primary">
              <Sparkles className="w-6 h-6" />
            </div>
          ) : (
            <img
              src={mode === 'dark' ? logoImageDark : logoImage}
              alt="DNAI Logo"
              className="h-14 w-auto object-contain"
            />
          )}
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-6 scrollbar-thin scrollbar-thumb-sidebar-border">
        {sidebarSections.map((section, sectionIndex) => (
          <div key={section.title} className="flex flex-col gap-[0rem]">
            {/* Section Header */}
            {!isCollapsed && (
              <div className="px-3">
                <p className="text-[13px] font-bold text-sidebar-foreground/50 uppercase tracking-wider">
                  {section.title}
                </p>
              </div>
            )}

            {/* Section Menu Items */}
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = activeItem === item.id;
                const isExpanded = expandedItems.has(item.id);

                return (
                  <div key={item.id} className="w-full">
                    <button
                      onClick={() => handleItemClick(item.path, item.hasSubmenu, item.id)}
                      className={cn(
                        "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all duration-200 group relative",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-foreground font-semibold shadow-sm"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground font-medium",
                        isCollapsed && "justify-center px-2"
                      )}
                      title={isCollapsed ? item.label : undefined}
                    >
                      <div className={cn(
                        "w-[22px] h-[22px] flex items-center justify-center shrink-0",
                        isActive ? "text-sidebar-primary" : "text-sidebar-foreground/70 group-hover:text-sidebar-foreground"
                      )}>
                        {item.icon}
                      </div>

                      {!isCollapsed && (
                        <>
                          <span className="text-[15px] truncate flex-1 text-left leading-[22px] tracking-tight">
                            {item.label}
                          </span>
                          {item.hasSubmenu && (
                            <div className="w-4 h-4 shrink-0">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </div>
                          )}
                        </>
                      )}

                      {/* Active Indicator Strip for Collapsed Mode */}
                      {isCollapsed && isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 bg-sidebar-primary rounded-r-full" />
                      )}
                    </button>

                    {/* Submenu (if needed in future) */}
                    {item.hasSubmenu && isExpanded && !isCollapsed && (
                      <div className="ml-9 mt-1 space-y-1 border-l-2 border-sidebar-border pl-2">
                        {/* Submenu items would go here */}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Divider between sections if not last */}
            {sectionIndex < sidebarSections.length - 1 && (
              <div className="h-px bg-sidebar-border/50 mx-2 my-2" />
            )}
          </div>
        ))}
      </div>

      {/* Footer / User Profile */}
      <div className="p-4 border-t border-sidebar-border bg-sidebar-background">
        <button
          onClick={handleLogout}
          className={cn(
            "flex items-center gap-3 w-full px-3 py-2 rounded-xl transition-all duration-200 group text-sidebar-foreground/70 hover:bg-destructive/10 hover:text-destructive",
            isCollapsed && "justify-center px-2"
          )}
          title="Logout"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!isCollapsed && <span className="text-sm font-medium">Logout</span>}
        </button>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-10 bg-sidebar-background border border-sidebar-border rounded-full p-1 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent shadow-sm z-50 hidden md:flex"
        >
          {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3 rotate-90" />}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
