import { Search, Bell, Settings, User, LogOut, CreditCard, Sun, Moon, Coins, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeMode } from '@/contexts/ThemeContext';
import logoImageLight from '../../assest/DNAI-Logo 1 (1).png';
import logoImageDark from '../../assest/DNAI LOGO@2x.png';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { getCreditBalance, CreditBalance } from '@/services/creditService';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

interface DashboardHeaderProps {
  title: string;
}

const DashboardHeader = ({ title }: DashboardHeaderProps) => {
  const { user, signOut } = useAuth();
  const { mode, toggleTheme } = useThemeMode();
  const navigate = useNavigate();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [creditBalance, setCreditBalance] = useState<CreditBalance | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [packageName, setPackageName] = useState<string | null>(null);
  const userInitial = user?.email?.charAt(0).toUpperCase() || 'U';

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const handleUpgradeToPro = () => {
    navigate('/billing');
  };

  // Mock notifications data with state
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'New call received', message: 'You have a new incoming call', time: '2m ago', read: false },
    { id: 2, title: 'Agent created', message: 'Your DNAI voice agent has been successfully created', time: '1h ago', read: false },
    { id: 3, title: 'Low credits warning', message: 'Your credit balance is running low', time: '3h ago', read: false },
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Mark all notifications as read when dialog opens
  useEffect(() => {
    if (notificationsOpen) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  }, [notificationsOpen]);

  // Load credit balance and avatar
  useEffect(() => {
    const loadCredits = async () => {
      if (!user) {
        setCreditsLoading(false);
        return;
      }

      try {
        const balance = await getCreditBalance(user.id);
        setCreditBalance(balance);
      } catch (error) {
        console.error('Error loading credits:', error);
      } finally {
        setCreditsLoading(false);
      }
    };

    const loadAvatar = async () => {
      if (!user) return;

      try {
        const { supabase } = await import('@/lib/supabase');
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

    const loadPackageName = async () => {
      if (!user) return;

      try {
        // Fetch active subscription with package details from subscription_packages
        const { data: subscription } = await supabase
          .from('user_subscriptions')
          .select('*, package:subscription_packages(package_name)')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (subscription?.package?.package_name) {
          setPackageName(subscription.package.package_name);
        } else {
          setPackageName(null);
        }
      } catch (error) {
        console.error('Error loading package name:', error);
        setPackageName(null);
      }
    };

    loadCredits();
    loadAvatar();
    loadPackageName();
    
    // Refresh credits and package every 30 seconds
    const interval = setInterval(() => {
      loadCredits();
      loadPackageName();
    }, 30000);
    return () => clearInterval(interval);
  }, [user]);

  return (
    <header className="flex items-center justify-between mb-10 opacity-0 animate-fade-in-up" style={{ animationFillMode: 'forwards' }}>
      <div>
        <div className="flex items-center gap-3 mb-2">
          <img 
            src={mode === 'dark' ? logoImageDark : logoImageLight} 
            alt="DNAI Logo" 
            className="h-8 w-auto object-contain"
          />
        </div>
        <h1 className="text-5xl font-bold gradient-text tracking-tight">
          {title}
        </h1>
      </div>
      
      <div className="flex items-center gap-4">
        {/* Credits Display */}
        {!creditsLoading && creditBalance && (
          <div className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all",
            creditBalance.services_paused && "bg-destructive/10 border-destructive/30",
            !creditBalance.services_paused && creditBalance.balance <= creditBalance.low_credit_threshold && "bg-warning/10 border-warning/30",
            !creditBalance.services_paused && creditBalance.balance > creditBalance.low_credit_threshold && "bg-muted/50 border-border/50"
          )}>
            <Coins className={cn(
              "w-4 h-4",
              creditBalance.services_paused && "text-destructive",
              !creditBalance.services_paused && creditBalance.balance <= creditBalance.low_credit_threshold && "text-warning",
              !creditBalance.services_paused && creditBalance.balance > creditBalance.low_credit_threshold && "text-primary"
            )} />
            <div className="flex items-baseline gap-1.5">
              <span className={cn(
                "text-lg font-bold",
                creditBalance.services_paused && "text-destructive",
                !creditBalance.services_paused && creditBalance.balance <= creditBalance.low_credit_threshold && "text-warning",
                !creditBalance.services_paused && creditBalance.balance > creditBalance.low_credit_threshold && "text-primary"
              )}>
                {creditBalance.balance.toFixed(2)}
              </span>
              <span className="text-xs text-muted-foreground">credits</span>
            </div>
            {(creditBalance.services_paused || creditBalance.balance <= creditBalance.low_credit_threshold) && (
              <AlertCircle className={cn(
                "w-4 h-4",
                creditBalance.services_paused && "text-destructive",
                !creditBalance.services_paused && "text-warning"
              )} />
            )}
          </div>
        )}
        {creditsLoading && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted/50 border border-border/50">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">Loading...</span>
          </div>
        )}

        {/* Package Name Badge */}
        {packageName && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/30">
            <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">
              {packageName}
            </Badge>
          </div>
        )}

        {/* Search */}
        <div className="relative group">
          <input 
            type="text"
            placeholder="Search calls..."
            className="w-64 py-3 pl-12 pr-4 rounded-xl bg-muted/50 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all duration-300"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors duration-300" />
        </div>

        {/* Theme Toggle */}
        <button 
          onClick={toggleTheme}
          className="p-3.5 rounded-xl bg-muted/50 border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all duration-300 hover:-translate-y-0.5 hover:glow-primary"
          title={mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {mode === 'light' ? (
            <Moon className="w-5 h-5" />
          ) : (
            <Sun className="w-5 h-5" />
          )}
        </button>

        {/* Settings */}
        <button 
          onClick={() => setSettingsOpen(true)}
          className="p-3.5 rounded-xl bg-muted/50 border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all duration-300 hover:-translate-y-0.5 hover:glow-primary"
        >
          <Settings className="w-5 h-5" />
        </button>

        {/* Notifications */}
        <button 
          onClick={() => setNotificationsOpen(true)}
          className="p-3.5 rounded-xl bg-muted/50 border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all duration-300 hover:-translate-y-0.5 relative group"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>

        {/* User Avatar with Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative group">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className="w-12 h-12 rounded-xl object-cover border-2 border-primary/20 transition-all duration-300 group-hover:scale-105 group-hover:glow-primary"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground font-bold text-xl flex items-center justify-center transition-all duration-300 group-hover:scale-105 group-hover:glow-primary">
                  {userInitial}
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-success border-2 border-background" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-popover text-popover-foreground border-border">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none text-foreground">{user?.email || 'User'}</p>
                <p className="text-xs leading-none text-muted-foreground">Admin Account</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/profile')} className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleUpgradeToPro} className="cursor-pointer">
              <CreditCard className="mr-2 h-4 w-4" />
              <span>Upgrade to Pro</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications Dialog */}
        <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}>
          <DialogContent className="bg-popover text-popover-foreground border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="text-foreground">Notifications</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                You have {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="p-3 rounded-lg border bg-muted/30 border-border/50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">{notification.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{notification.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">{notification.time}</p>
                    </div>
                    {!notification.read && (
                      <Badge variant="outline" className="ml-2">New</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Settings Dialog */}
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent className="bg-popover text-popover-foreground border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="text-foreground">Settings</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Manage your account settings and preferences
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Account</h3>
                <button
                  onClick={() => {
                    setSettingsOpen(false);
                    navigate('/profile');
                  }}
                  className="w-full text-left p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <p className="text-sm font-medium text-foreground">Profile Settings</p>
                  <p className="text-xs text-muted-foreground">Manage your profile information</p>
                </button>
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Billing</h3>
                <button
                  onClick={() => {
                    setSettingsOpen(false);
                    navigate('/billing');
                  }}
                  className="w-full text-left p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <p className="text-sm font-medium text-foreground">Billing & Subscription</p>
                  <p className="text-xs text-muted-foreground">Manage your subscription and payment</p>
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </header>
  );
};

export default DashboardHeader;
