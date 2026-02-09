import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../App.css';
import characterImage from '../assest/resetpassword.png';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { emailService } from '../services/emailService';

const SetNewPassword: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { updatePassword } = useAuth();
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [initializing, setInitializing] = useState<boolean>(true);

  useEffect(() => {
    // Handle password reset link redirect from Supabase
    const handlePasswordReset = async () => {
      try {
        // Check for hash fragments in URL (Supabase password reset link format)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const type = hashParams.get('type');

        // If we have a recovery token in the URL, exchange it for a session
        if (accessToken && type === 'recovery') {
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: hashParams.get('refresh_token') || '',
          });

          if (sessionError) {
            setError('Invalid or expired reset link. Please request a new one.');
            setInitializing(false);
            setTimeout(() => {
              navigate('/reset-password');
            }, 3000);
            return;
          }

          // Clear the hash from URL
          window.history.replaceState(null, '', window.location.pathname);
          setInitializing(false);
          return;
        }

        // If no hash params, check if email was passed via state (from OTP flow)
        if (location.state?.email) {
          // Check if user has a valid session
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            setError('Session expired. Please request a new password reset.');
            setInitializing(false);
            setTimeout(() => {
              navigate('/reset-password');
            }, 3000);
            return;
          }
          setInitializing(false);
          return;
        }

        // No valid reset token or email, redirect to reset password page
        setError('Invalid reset link. Please request a new password reset.');
        setInitializing(false);
        setTimeout(() => {
          navigate('/reset-password');
        }, 3000);
      } catch (err: any) {
        console.error('Error handling password reset:', err);
        setError('An error occurred. Please try again.');
        setInitializing(false);
        setTimeout(() => {
          navigate('/reset-password');
        }, 3000);
      }
    };

    handlePasswordReset();
  }, [navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password || !confirmPassword) {
      setError('Please enter both password fields');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await updatePassword(password);

      if (updateError) {
        setError(updateError.message || 'Failed to update password');
        setLoading(false);
        return;
      }

      // Store password in history
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // In production, hash the password before storing
        await supabase
          .from('password_history')
          .insert({
            user_id: user.id,
            password_hash: password, // Should be hashed in production
          });

        // Create notification
        await supabase.rpc('create_notification', {
          p_user_id: user.id,
          p_type: 'password_changed',
          p_title: 'Password Changed',
          p_message: 'Your password has been successfully changed.',
        });

        // Send password changed email notification
        if (user.email) {
          await emailService.sendPasswordChangedEmail(user.email);
        }
      }

      navigate('/success', { state: { message: 'Password Updated!' } });
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      setLoading(false);
    }
  };

  if (initializing) {
    return (
      <div className="centered-container">
        <div className="centered-content">
          <div className="centered-form">
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <p>Verifying reset link...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="centered-container">
      <div className="centered-content">
        <div className="centered-image">
          <img src={characterImage} alt="Character" />
        </div>

        <div className="centered-form">
          <form className="form-container" onSubmit={handleSubmit}>
            <h2 className="form-title">Set a New Password.</h2>
            <p className="form-subtitle">
              Create a new password to continue.
            </p>

            <div className="form-group">
              <label>Enter New Password</label>
              <div className="input-with-icon">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter Your New Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <span 
                  className="input-icon"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </span>
              </div>
            </div>

            <div className="form-group">
              <label>Confirm Password</label>
              <div className="input-with-icon">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Enter Your Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <span 
                  className="input-icon"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                </span>
              </div>
            </div>

            {error && <div className="error-message">{error}</div>}
            <button 
              type="submit"
              className="submit-button" 
              disabled={loading}
            >
              {loading ? 'Updating...' : 'Done'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SetNewPassword;
