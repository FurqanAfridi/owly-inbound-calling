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
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import logoImage from '../../assest/DNAI-Logo 1 (1).png';

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
    title: 'Owly',
    items: [
      { id: 'overview', label: 'Overview', icon: <LayoutTemplate className="w-5 h-5" />, path: '/dashboard' },
      { id: 'agents', label: 'Agents', icon: <GraduationCap className="w-5 h-5" />, path: '/agents' },
      { id: 'inbound-numbers', label: 'Inbound Numbers', icon: <PhoneIncoming className="w-5 h-5" />, path: '/inbound-numbers' },
      { id: 'knowledge-bases', label: 'Knowledge Bases', icon: <BookOpen className="w-5 h-5" />, path: '/knowledge-bases' },
      { id: 'calendar', label: 'Calendar', icon: <CalendarFold className="w-5 h-5" />, path: '/call-schedules' },
      { id: 'call-logs', label: 'Call logs', icon: <Headset className="w-5 h-5" />, path: '/call-history' },
      { id: 'leads', label: 'Leads', icon: <FileUser className="w-5 h-5" />, path: '/leads' },
    ],
  },
  {
    title: 'Settings',
    items: [
      { id: 'billing', label: 'Billing', icon: <CreditCard className="w-5 h-5" />, path: '/billing' },
      { id: 'profile', label: 'Profile', icon: <User className="w-5 h-5" />, path: '/profile' },
    ],
  },
];

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

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

  return (
    <aside 
      className={cn(
        "fixed left-0 top-0 h-screen bg-white flex flex-col transition-all duration-500 ease-out z-50",
        isCollapsed ? "w-20" : "w-[224px]"
      )}
      style={{ 
        fontFamily: "'Manrope', sans-serif",
        borderRight: '2px solid #e5e5e5',
        boxShadow: '1px 0 0 0 rgba(229, 229, 229, 0.5)'
      }}
    >
      {/* Logo */}
      <div className="px-4 py-4">
        <div className={cn(
          "flex items-center overflow-hidden transition-all duration-300",
          isCollapsed && "justify-center"
        )}>
          <img 
            src={logoImage} 
            alt="DNAI Logo" 
            className={cn(
              "h-14 w-auto object-contain transition-all duration-300",
              isCollapsed && "h-10"
            )}
          />
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-4">
        {sidebarSections.map((section, sectionIndex) => (
          <div key={section.title} className={cn("flex flex-col gap-[15px] items-start", sectionIndex > 0 && "mt-[25px]")}>
            {/* Section Header */}
            <div className="flex items-center px-2 py-[2px] w-full">
              <p 
                className="text-[16px] font-semibold text-[rgba(39,39,43,0.7)] leading-[20px]"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                {section.title}
              </p>
            </div>

            {/* Section Menu Items */}
            <div className="flex flex-col gap-[4px] items-start w-full">
              {section.items.map((item) => {
                const isActive = activeItem === item.id;
                const isExpanded = expandedItems.has(item.id);

                return (
                  <div key={item.id} className="flex flex-col w-full">
                    {item.hasSubmenu ? (
                      <div className="flex flex-col items-start pl-2 py-1.5 w-full">
                        <button
                          onClick={() => handleItemClick(item.path, item.hasSubmenu, item.id)}
                          className={cn(
                            "flex items-center justify-between w-full gap-2 rounded-[6px] px-2",
                            isActive && "bg-[rgba(48,134,255,0.1)]"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                              {item.icon}
                            </div>
                            {!isCollapsed && (
                              <p 
                                className={cn(
                                  "text-[16px] leading-[24px] text-[#27272b]",
                                  isActive ? "font-semibold" : "font-medium"
                                )}
                                style={{ fontFamily: "'Manrope', sans-serif" }}
                              >
                                {item.label}
                              </p>
                            )}
                          </div>
                          {!isCollapsed && (
                            <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                              {isExpanded ? (
                                <ChevronDown className="w-5 h-5 text-[#27272b]" />
                              ) : (
                                <ChevronRight className="w-5 h-5 text-[#27272b]" />
                              )}
                            </div>
                          )}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleItemClick(item.path, item.hasSubmenu, item.id)}
                        className={cn(
                          "flex items-center gap-2 px-2 py-1.5 rounded-[6px] transition-all duration-200 w-full overflow-hidden",
                          isActive 
                            ? "bg-[rgba(48,134,255,0.1)]" 
                            : "hover:bg-[rgba(0,0,0,0.02)]"
                        )}
                      >
                        <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                          {item.icon}
                        </div>
                        {!isCollapsed && (
                          <p 
                            className={cn(
                              "text-[16px] leading-[24px] text-[#27272b] whitespace-nowrap",
                              isActive ? "font-semibold" : "font-medium"
                            )}
                            style={{ fontFamily: "'Manrope', sans-serif" }}
                          >
                            {item.label}
                          </p>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Divider */}
            {sectionIndex < sidebarSections.length - 1 && (
              <div className="h-px bg-[#e5e5e5] w-full" style={{ marginTop: '10px', marginBottom: '10px' }} />
            )}
          </div>
        ))}
      </div>
    </aside>
  );
};

export default Sidebar;
