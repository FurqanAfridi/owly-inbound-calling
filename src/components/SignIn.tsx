import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { emailService } from '../services/emailService';
import { validatePassword } from '../utils/passwordValidation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import TwoFactorLogin from './TwoFactorLogin';

// Import assets
import characterImage from '../assest/Gemini_Generated_Image_ppyqz2ppyqz2ppyq (1) 1.png';
import logoImage from '../assest/DNAI-Logo 1.png';
import googleIcon from '../assest/google.svg';
import appleIcon from '../assest/Apple.svg';
import facebookIcon from '../assest/Symbol.png.png';
import viewOffIcon from '../assest/view-off.svg';
import vector10Icon from '../assest/Vector 10.svg';
import rectangle1281Image from '../assest/Rectangle 1281.png';

const SignIn: React.FC = () => {
  const navigate = useNavigate();
  const { signIn, updatePassword } = useAuth();
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [agreeTerms, setAgreeTerms] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [show2FA, setShow2FA] = useState<boolean>(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [pendingUserEmail, setPendingUserEmail] = useState<string>('');
  
  // Password reset dialog state
  const [showPasswordResetDialog, setShowPasswordResetDialog] = useState<boolean>(false);
  const [resetPassword, setResetPassword] = useState<string>('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState<string>('');
  const [showResetPassword, setShowResetPassword] = useState<boolean>(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState<boolean>(false);
  const [resetLoading, setResetLoading] = useState<boolean>(false);
  const [resetError, setResetError] = useState<string>('');
  const [resetInitializing, setResetInitializing] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    if (!agreeTerms) {
      setError('Please agree to the Terms & Privacy');
      return;
    }

    setLoading(true);

    try {
      const { error: signInError } = await signIn(email, password);

      if (signInError) {
        let errorMessage = 'Invalid email or password';
        const errorMsg = signInError.message?.toLowerCase() || '';
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          errorMessage = 'Please enter a valid email address';
          setError(errorMessage);
          setLoading(false);
          return;
        }
        
        if (errorMsg.includes('email not confirmed') || errorMsg.includes('email_not_confirmed')) {
          errorMessage = 'Please verify your email address before signing in';
        } else if (errorMsg.includes('too many requests') || errorMsg.includes('rate limit')) {
          errorMessage = 'Too many login attempts. Please try again later';
        } else if (errorMsg.includes('invalid login credentials') || 
                   errorMsg.includes('invalid password') ||
                   errorMsg.includes('email or password')) {
          try {
            const { data: userExists, error: checkError } = await supabase.rpc('check_user_exists', {
              p_email: email.toLowerCase().trim()
            }).catch(() => ({ data: null, error: { message: 'Function not found' } }));
            
            if (!checkError && userExists === true) {
              errorMessage = 'Password is not correct';
            } else if (!checkError && userExists === false) {
              errorMessage = 'User does not exist';
            } else {
              errorMessage = 'User does not exist or password is not correct';
            }
          } catch (rpcError) {
            errorMessage = 'User does not exist or password is not correct';
          }
        } else {
          errorMessage = signInError.message || 'Invalid email or password';
        }
        
        setError(errorMessage);
        setLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: twoFactorData } = await supabase
          .from('user_2fa')
          .select('enabled, verified')
          .eq('user_id', user.id)
          .single();

        if (twoFactorData?.enabled && twoFactorData?.verified) {
          setPendingUserId(user.id);
          setPendingUserEmail(user.email || '');
          setShow2FA(true);
          setLoading(false);
          return;
        }

        await completeLogin(user, false);
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      setLoading(false);
    }
  };

  const completeLogin = async (user: any, used2FA: boolean = false) => {
    try {
      const ipResponse = await fetch('https://api.ipify.org?format=json').catch(() => null);
      const ipData = ipResponse ? await ipResponse.json() : { ip: null };
      const ipAddress = ipData.ip;

      const userAgent = navigator.userAgent;
      const deviceType = /Mobile|Android|iPhone|iPad/.test(userAgent) ? 'mobile' : 'desktop';
      const browserName = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/)?.[1] || 'Unknown';
      const osName = userAgent.match(/(Windows|Mac|Linux|Android|iOS)/)?.[1] || 'Unknown';

      await supabase.rpc('log_login_activity', {
        p_user_id: user.id,
        p_session_id: null,
        p_ip_address: ipAddress,
        p_user_agent: userAgent,
        p_login_method: used2FA ? '2fa' : 'email'
      });

      await supabase
        .from('user_profiles')
        .update({ last_login_at: new Date().toISOString(), last_active_at: new Date().toISOString() })
        .eq('id', user.id);

      try {
        const { data: previousLogins } = await supabase
          .from('login_activity')
          .select('ip_address, device_type, browser_name')
          .eq('user_id', user.id)
          .order('login_at', { ascending: false })
          .limit(5);

        const isNewDevice = !previousLogins?.some((login: { device_type: string | null; browser_name: string | null }) => 
          login.device_type === deviceType && 
          login.browser_name === browserName
        );

        if (isNewDevice && user.email) {
          await emailService.sendNewDeviceLoginEmail(user.email, {
            ip: ipAddress || undefined,
            device: `${deviceType} • ${osName} • ${browserName}`,
            location: 'Unknown',
          });
        } else if (user.email) {
          await emailService.sendLoginAlertEmail(user.email, {
            ip: ipAddress || undefined,
            device: `${deviceType} • ${osName} • ${browserName}`,
            location: 'Unknown',
            time: new Date().toLocaleString(),
          });
        }
      } catch (emailError) {
        console.error('Error sending login alert email:', emailError);
      }

      navigate('/dashboard');
    } catch (err: any) {
      console.error('Error completing login:', err);
      setError('Failed to complete login. Please try again.');
    }
  };

  const handle2FASuccess = async () => {
    if (!pendingUserId) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await completeLogin(user, true);
    }
  };

  const handle2FACancel = () => {
    supabase.auth.signOut();
    setShow2FA(false);
    setPendingUserId(null);
    setPendingUserEmail('');
    setError('Login cancelled. Please sign in again.');
  };

  useEffect(() => {
    const handlePasswordResetLink = async () => {
      try {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const type = hashParams.get('type');

        if (accessToken && type === 'recovery') {
          setResetInitializing(true);
          
          const { data, error: sessionError } = await (supabase.auth as any).setSession({
            access_token: accessToken,
            refresh_token: hashParams.get('refresh_token') || '',
          });

          if (sessionError) {
            setResetError('Invalid or expired reset link. Please request a new one.');
            setResetInitializing(false);
            window.history.replaceState(null, '', window.location.pathname);
            return;
          }

          window.history.replaceState(null, '', window.location.pathname);
          
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.email) {
            setPendingUserEmail(user.email);
          }
          
          setShowPasswordResetDialog(true);
          setResetInitializing(false);
        }
      } catch (err: any) {
        console.error('Error handling password reset link:', err);
        setResetError('An error occurred while processing the reset link. Please try again.');
        setResetInitializing(false);
        window.history.replaceState(null, '', window.location.pathname);
      }
    };

    handlePasswordResetLink();
  }, []);

  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');

    if (!resetPassword || !resetConfirmPassword) {
      setResetError('Please enter both password fields');
      return;
    }

    if (resetPassword !== resetConfirmPassword) {
      setResetError('Passwords do not match');
      return;
    }

    const passwordValidation = validatePassword(resetPassword);
    if (!passwordValidation.isValid) {
      setResetError(passwordValidation.errors.join('. '));
      return;
    }

    setResetLoading(true);

    try {
      const { error: updateError } = await updatePassword(resetPassword);

      if (updateError) {
        setResetError(updateError.message || 'Failed to update password');
        setResetLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('password_history')
          .insert({
            user_id: user.id,
            password_hash: resetPassword,
          });

        await supabase.rpc('create_notification', {
          p_user_id: user.id,
          p_type: 'password_changed',
          p_title: 'Password Changed',
          p_message: 'Your password has been successfully changed.',
        });

        if (user.email) {
          await emailService.sendPasswordChangedEmail(user.email);
        }
      }

      setShowPasswordResetDialog(false);
      setResetPassword('');
      setResetConfirmPassword('');
      setError('');
      alert('Password updated successfully! You can now sign in with your new password.');
      
      await supabase.auth.signOut();
    } catch (err: any) {
      setResetError(err.message || 'An error occurred');
      setResetLoading(false);
    }
  };

  const handleClosePasswordResetDialog = () => {
    supabase.auth.signOut();
    setShowPasswordResetDialog(false);
    setResetPassword('');
    setResetConfirmPassword('');
    setResetError('');
  };

  if (show2FA && pendingUserId) {
    return (
      <TwoFactorLogin
        userId={pendingUserId}
        userEmail={pendingUserEmail}
        onSuccess={handle2FASuccess}
        onCancel={handle2FACancel}
      />
    );
  }

  return (
    <>
      <Dialog open={showPasswordResetDialog} onOpenChange={handleClosePasswordResetDialog}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-foreground">Set New Password</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {pendingUserEmail && `Enter a new password for ${pendingUserEmail}`}
              {!pendingUserEmail && 'Enter a new password to continue'}
            </DialogDescription>
          </DialogHeader>
          
          {resetInitializing ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-muted-foreground">Verifying reset link...</span>
            </div>
          ) : (
            <form onSubmit={handlePasswordResetSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="resetPassword" className="text-foreground">New Password</Label>
                <div className="relative">
                  <Input
                    id="resetPassword"
                    type={showResetPassword ? "text" : "password"}
                    placeholder="Enter your new password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    className="pl-10 pr-10 bg-background text-foreground border-border"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <img src={viewOffIcon} alt="Toggle password" className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Password must be at least 8 characters and include at least one capital letter
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="resetConfirmPassword" className="text-foreground">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="resetConfirmPassword"
                    type={showResetConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your new password"
                    value={resetConfirmPassword}
                    onChange={(e) => setResetConfirmPassword(e.target.value)}
                    className="pl-10 pr-10 bg-background text-foreground border-border"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetConfirmPassword(!showResetConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <img src={viewOffIcon} alt="Toggle password" className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {resetError && (
                <Alert variant="destructive">
                  <AlertDescription>{resetError}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClosePasswordResetDialog}
                  className="flex-1"
                  disabled={resetLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                  disabled={resetLoading}
                >
                  {resetLoading ? 'Updating...' : 'Update Password'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <div className="signin-container">
        {/* Left Panel - Blue Section */}
        <div className="signin-left-panel">
          <div className="signin-left-gradient"></div>
          <div 
            className="signin-left-pattern"
            style={{ backgroundImage: `url(${rectangle1281Image})` }}
          ></div>
          <div className="signin-left-content">
            <h1 className="signin-hero-title">Sign in to your creative HQ of Inbound Calling</h1>
            <div 
              className="signin-underline"
              style={{ backgroundImage: `url(${vector10Icon})` }}
            ></div>
            <p className="signin-hero-description">
              Unlock the power of AI-driven social media intelligence. Create, analyze, and dominate your social presence with cutting-edge tools.
            </p>
          </div>
          <div className="signin-character-image">
            <img src={characterImage} alt="Character illustration" />
          </div>
        </div>

        {/* Right Panel - Form Section */}
        <div className="signin-logo">
          <img src={logoImage} alt="DNAI Logo" />
        </div>
        
        <div className="signin-form-wrapper">
          <div className="signin-welcome">
            <h2 className="signin-welcome-title">Welcome back!</h2>
            <p className="signin-welcome-subtitle">Good to see you again.</p>
          </div>

          <form onSubmit={handleSubmit} className="signin-form">
            <div className="signin-form-group">
              <div className="signin-form-fields">
                <div className="signin-form-field">
                  <div className="signin-label-row">
                    <Label htmlFor="email" className="signin-label">Email Address</Label>
                  </div>
                  <div className="signin-input-wrapper">
                    <Input
                      id="email"
                      type="email"
                      placeholder="123@gmail.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="signin-input"
                    />
                  </div>
                </div>

                <div className="signin-form-field">
                  <div className="signin-label-row">
                    <Label htmlFor="password" className="signin-label">Password</Label>
                    <Link to="/reset-password" className="signin-forgot-link">Forget Password?</Link>
                  </div>
                  <div className="signin-password-input">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter Your Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="signin-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="signin-eye-button"
                      style={{ backgroundImage: `url(${viewOffIcon})` }}
                    ></button>
                  </div>
                </div>
              </div>

              <div className="signin-checkbox-group">
                <input
                  type="checkbox"
                  id="terms"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="signin-checkbox"
                />
                <Label htmlFor="terms" className="signin-checkbox-label">
                  I agree to the <Link to="/terms" className="signin-terms-link">Terms & Privacy</Link>
                </Label>
              </div>
            </div>

            {error && (
              <div className="signin-error">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="signin-submit-button"
              disabled={loading}
            >
              <span className="signin-submit-button-text">{loading ? 'Signing in...' : 'Sign in'}</span>
            </Button>

            <div className="signin-form-bottom">
              <div className="signin-signup-link">
                <span className="signin-signup-text">Don't have an account? </span>
                <Link to="/signup" className="signin-signup-link-text">Sign up</Link>
              </div>

              <div className="signin-divider">
                <div 
                  className="signin-divider-line"
                  style={{ backgroundImage: `url(${vector10Icon})` }}
                ></div>
                <span className="signin-divider-text">or</span>
                <div 
                  className="signin-divider-line"
                  style={{ backgroundImage: `url(${vector10Icon})` }}
                ></div>
              </div>

              <div className="signin-social-buttons">
                <button type="button" className="signin-social-button">
                  <div 
                    className="signin-social-icon"
                    style={{ backgroundImage: `url(${googleIcon})` }}
                  ></div>
                  <span className="signin-social-button-text">Google</span>
                </button>
                <button type="button" className="signin-social-button">
                  <div 
                    className="signin-social-icon"
                    style={{ backgroundImage: `url(${appleIcon})` }}
                  ></div>
                  <span className="signin-social-button-text">Apple</span>
                </button>
                <button type="button" className="signin-social-button">
                  <div className="signin-facebook-icon">
                    <div 
                      className="signin-facebook-icon-inner"
                      style={{ backgroundImage: `url(${facebookIcon})` }}
                    ></div>
                  </div>
                  <span className="signin-social-button-text">Facebook</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default SignIn;
