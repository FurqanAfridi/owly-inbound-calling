import React, { useState, useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeMode } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import MainLayout from './MainLayout';
import ProfileCompletionDialog from '@/components/ProfileCompletionDialog';

const ProtectedLayout: React.FC = () => {
  const { user, loading } = useAuth();
  const { setMode } = useThemeMode();

  // Restore saved theme preference when entering protected routes
  useEffect(() => {
    const savedMode = localStorage.getItem('themeMode') as 'light' | 'dark' | null;
    if (savedMode) {
      setMode(savedMode);
    }
  }, []);
  const [profileLoading, setProfileLoading] = useState(true);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [profileComplete, setProfileComplete] = useState(false);

  useEffect(() => {
    if (user && !loading) {
      checkProfileCompletion();
    }
  }, [user, loading]);

  const checkProfileCompletion = async () => {
    if (!user) {
      setProfileLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('metadata')
        .eq('id', user.id)
        .single();

      if (error && error.code === 'PGRST116') {
        // Profile doesn't exist yet — show company details dialog
        setShowProfileDialog(true);
        setProfileComplete(false);
        setProfileLoading(false);
        return;
      }

      if (error) {
        console.error('Error checking profile:', error);
        setProfileLoading(false);
        return;
      }

      // Check if user has already completed/skipped the company details dialog
      const dialogCompleted = data?.metadata?.profile_dialog_completed === true;

      setProfileComplete(dialogCompleted);
      setShowProfileDialog(!dialogCompleted);
      setProfileLoading(false);
    } catch (err) {
      console.error('Error checking profile completion:', err);
      setProfileLoading(false);
    }
  };

  const handleProfileComplete = () => {
    setShowProfileDialog(false);
    setProfileComplete(true);
    // Reload to ensure fresh data
    checkProfileCompletion();
  };

  if (loading || profileLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Show profile completion dialog if profile is incomplete
  if (showProfileDialog && !profileComplete) {
    return (
      <>
        {/* Show a backdrop to prevent interaction with the app */}
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50" />
        <ProfileCompletionDialog
          open={showProfileDialog}
          onComplete={handleProfileComplete}
        />
      </>
    );
  }

  return (
    <MainLayout>
      <Outlet />
    </MainLayout>
  );
};

export default ProtectedLayout;
