import { Search, Bell, Settings, Sun, Moon, Menu, LogOut, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeMode } from '@/contexts/ThemeContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import SearchResults from './SearchResults';

interface DashboardHeaderProps {
  title: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read_at: string | null;
  created_at: string;
}

const DashboardHeader = ({ title }: DashboardHeaderProps) => {
  const { user, signOut } = useAuth();
  const { mode, toggleTheme } = useThemeMode();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const userInitial = user?.email?.charAt(0).toUpperCase() || 'U';

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  // Load avatar
  useEffect(() => {
    const loadAvatar = async () => {
      if (!user) return;

      try {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('avatar_url')
          .eq('id', user.id)
          .single();

        if (profile?.avatar_url) {
          setAvatarUrl(profile.avatar_url);
        }
      } catch (error) {
        console.error('Error loading avatar:', error);
      }
    };

    loadAvatar();
  }, [user]);

  // Load notifications
  useEffect(() => {
    const loadNotifications = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
          console.error('Error loading notifications:', error);
          return;
        }

        if (data) {
          setNotifications(data);
          setUnreadCount(data.filter((n: Notification) => !n.read_at).length);
        }
      } catch (error) {
        console.error('Error loading notifications:', error);
      }
    };

    loadNotifications();

    // Refresh notifications every 30 seconds
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Mark notifications as read when dialog opens
  useEffect(() => {
    if (notificationsOpen && notifications.length > 0) {
      const unreadIds = notifications.filter((n: Notification) => !n.read_at).map((n: Notification) => n.id);
      if (unreadIds.length > 0) {
        supabase
          .from('notifications')
          .update({ read_at: new Date().toISOString() })
          .in('id', unreadIds)
          .then(() => {
            setNotifications(prev => prev.map((n: Notification) => ({ ...n, read_at: new Date().toISOString() })));
            setUnreadCount(0);
          });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notificationsOpen]);

  // Keyboard shortcut for search (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 100);
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
        setSearchQuery('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setSearchOpen(true);
    }
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (value.trim()) {
      setSearchOpen(true);
    } else {
      setSearchOpen(false);
    }
  };

  return (
    <>
      <header 
        className="backdrop-blur-[6px] bg-[rgba(255,255,255,0.4)] border-b border-[#e4e4e8] rounded-tl-[12px] rounded-tr-[12px] px-[25px] py-[10px] mb-6"
        style={{ fontFamily: "'Manrope', sans-serif" }}
      >
        <div className="flex items-center justify-between w-full">
          {/* Left Section: Menu Button, Divider, Search */}
          <div className="flex items-center gap-[26px]">
            {/* Menu Button */}
            <button className="w-4 h-4 flex items-center justify-center hover:opacity-70 transition-opacity">
              <Menu className="w-4 h-4 text-[#27272b]" />
            </button>

            {/* Vertical Divider */}
            <div className="bg-[#e4e4e8] h-4 w-px" />

            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="relative w-[384px] h-9">
              <div className="absolute inset-0 bg-white border border-[#d4d4da] rounded-[6px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]" />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4">
                <Search className="w-4 h-4 text-[#737373]" />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={handleSearchInputChange}
                onFocus={() => {
                  if (searchQuery.trim()) {
                    setSearchOpen(true);
                  }
                }}
                className="absolute inset-0 pl-10 pr-[45px] bg-transparent border-none outline-none text-[14px] text-[#27272b] placeholder:text-[#737373] rounded-[6px]"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              />
              {/* Keyboard Shortcut Indicator */}
              <div className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#e4e4e7] rounded-[4px] px-1.5 py-0.5 flex items-center gap-1">
                <div className="w-3 h-3 flex items-center justify-center">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <span className="text-[12px] font-normal text-[#27272b] leading-[16px]" style={{ fontFamily: "'Consolas', monospace" }}>
                  k
                </span>
              </div>
            </form>
          </div>

          {/* Right Section: Notifications, Theme Toggle, Settings, Divider, Avatar */}
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-5">
              {/* Notifications Button */}
              <button 
                onClick={() => setNotificationsOpen(true)}
                className="relative w-9 h-9 rounded-[6px] flex items-center justify-center hover:bg-[rgba(0,0,0,0.02)] transition-colors"
              >
                <Bell className="w-4 h-4 text-[#27272b]" />
                {unreadCount > 0 && (
                  <div className="absolute top-0 right-0 w-2 h-2 bg-[#e7000b] rounded-full" />
                )}
              </button>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="w-4 h-4 flex items-center justify-center hover:opacity-70 transition-opacity"
              >
                {mode === 'light' ? (
                  <Sun className="w-4 h-4 text-[#27272b]" />
                ) : (
                  <Moon className="w-4 h-4 text-[#27272b]" />
                )}
              </button>

              {/* Settings Button */}
              <button
                onClick={() => navigate('/profile')}
                className="w-4 h-4 flex items-center justify-center hover:opacity-70 transition-opacity"
              >
                <Settings className="w-4 h-4 text-[#27272b]" />
              </button>
            </div>

            {/* Vertical Divider */}
            <div className="bg-[#e4e4e8] h-4 w-px" />

            {/* User Avatar */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="relative w-8 h-8 rounded-full overflow-hidden hover:opacity-80 transition-opacity">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#e4e4e8] flex items-center justify-center text-[#27272b] text-sm font-medium">
                      {userInitial}
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.email || 'User'}</p>
                    <p className="text-xs leading-none text-muted-foreground">Admin Account</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')} className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/billing')} className="cursor-pointer">
                  <span>Billing</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleLogout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Notifications Dialog */}
      <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <DialogContent className="max-w-md" style={{ fontFamily: "'Manrope', sans-serif" }}>
          <DialogHeader>
            <DialogTitle className="text-[18px] font-bold">Notifications</DialogTitle>
            <DialogDescription className="text-[14px] text-[#737373]">
              {unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up!'}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto space-y-2 mt-4">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-[14px] text-[#737373]">
                No notifications yet
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg border ${
                    !notification.read_at 
                      ? 'bg-[rgba(48,134,255,0.05)] border-[rgba(48,134,255,0.2)]' 
                      : 'bg-white border-[#e5e5e5]'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-[14px] font-semibold text-[#27272b]">{notification.title}</p>
                      <p className="text-[12px] text-[#737373] mt-1">{notification.message}</p>
                      <p className="text-[12px] text-[#737373] mt-1">
                        {new Date(notification.created_at).toLocaleString()}
                      </p>
                    </div>
                    {!notification.read_at && (
                      <Badge variant="outline" className="ml-2 bg-[#0b99ff] text-white border-none">
                        New
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          </DialogContent>
        </Dialog>

        {/* Search Results Dialog */}
        <SearchResults
          query={searchQuery}
          open={searchOpen}
          onClose={() => {
            setSearchOpen(false);
            setSearchQuery('');
          }}
        />
      </>
    );
  };
  
  export default DashboardHeader;
