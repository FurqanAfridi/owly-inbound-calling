import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  PhoneIncoming, 
  Calendar, 
  History, 
  UserPlus,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  BookOpen
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useThemeMode } from '@/contexts/ThemeContext';
import logoImageLight from '../../assest/DNAI-Logo 1 (1).png';
import logoImageDark from '../../assest/DNAI LOGO@2x.png';

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  badge?: string;
}

const sidebarItems: SidebarItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="sidebar-item-icon" />, path: '/dashboard' },
  { id: 'voice-agents', label: 'Voice Agents', icon: <Users className="sidebar-item-icon" />, path: '/agents' },
  { id: 'inbound-numbers', label: 'Inbound Numbers', icon: <PhoneIncoming className="sidebar-item-icon" />, path: '/inbound-numbers' },
  { id: 'knowledge-bases', label: 'Knowledge Bases', icon: <BookOpen className="sidebar-item-icon" />, path: '/knowledge-bases' },
  { id: 'call-schedules', label: 'Call Schedules', icon: <Calendar className="sidebar-item-icon" />, path: '/call-schedules' },
  { id: 'call-history', label: 'Call History', icon: <History className="sidebar-item-icon" />, path: '/call-history' },
  { id: 'leads', label: 'Leads', icon: <UserPlus className="sidebar-item-icon" />, path: '/leads' },
];

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { mode } = useThemeMode();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const getActiveItem = () => {
    const currentPath = location.pathname;
    return sidebarItems.find(item => item.path === currentPath)?.id || 'dashboard';
  };

  const activeItem = getActiveItem();

  const handleItemClick = (path: string) => {
    navigate(path);
  };

  const handleUpgradeToPro = () => {
    navigate('/billing');
  };

  return (
    <aside 
      className={cn(
        "fixed left-0 top-0 h-screen bg-sidebar flex flex-col transition-all duration-500 ease-out z-50",
        "border-r border-border/30",
        isCollapsed ? "w-20" : "w-72"
      )}
    >
      {/* Logo/Brand */}
      <div className="p-6 border-b border-border/30">
        <div className={cn(
          "flex items-center gap-4 transition-all duration-300",
          isCollapsed && "justify-center"
        )}>
          <img 
            src={mode === 'dark' ? logoImageDark : logoImageLight} 
            alt="DNAI Logo" 
            className={cn(
              "h-12 w-auto object-contain transition-all duration-300",
              isCollapsed && "h-10"
            )}
          />
          {!isCollapsed && (
            <div className="animate-slide-in-left">
              <p className="text-xs text-muted-foreground font-mono">CALL CENTER</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {sidebarItems.map((item, index) => (
          <button
            key={item.id}
            onClick={() => handleItemClick(item.path)}
            className={cn(
              "sidebar-item w-full group",
              activeItem === item.id && "sidebar-item-active",
              isCollapsed && "justify-center px-3"
            )}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className={cn(
              "transition-all duration-300",
              activeItem === item.id ? "text-primary" : "text-muted-foreground group-hover:text-primary"
            )}>
              {item.icon}
            </div>
            {!isCollapsed && (
              <div className="flex items-center justify-between flex-1">
                <span className="text-base font-medium">
                  {item.label}
                </span>
                {item.badge && (
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-accent text-accent-foreground">
                    {item.badge}
                  </span>
                )}
              </div>
            )}
          </button>
        ))}
      </nav>

      {/* Pro Upgrade Card */}
      {!isCollapsed && (
        <div className="p-4">
          <div className="glow-border rounded-2xl p-4 relative overflow-hidden">
            <div className="absolute top-2 right-2">
              <Sparkles className="w-5 h-5 text-accent animate-bounce-subtle" />
            </div>
            <h3 className="text-sm font-bold text-foreground mb-1">Upgrade to Pro</h3>
            <p className="text-xs text-muted-foreground mb-3">Unlock unlimited DNAI agents</p>
            <button 
              onClick={handleUpgradeToPro}
              className="w-full py-2 px-4 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold text-sm transition-all duration-300 hover:shadow-lg hover:glow-primary"
            >
              Upgrade Now
            </button>
          </div>
        </div>
      )}

      {/* Collapse Toggle */}
      <div className="p-4 border-t border-border/30">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="sidebar-item w-full justify-center group"
        >
          <div className="transition-transform duration-300 group-hover:scale-110">
            {isCollapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <>
                <ChevronLeft className="w-5 h-5" />
              </>
            )}
          </div>
          {!isCollapsed && <span className="text-sm font-medium">Collapse</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
