import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import characterImage from '../assest/verification.png';

const VerifyEmail: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '', '', '']); // 8 digits for Supabase OTP
  const [email, setEmail] = useState<string>('');
  const [purpose, setPurpose] = useState<string>('email_verification');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (location.state) {
      setEmail(location.state.email || '');
      setPurpose(location.state.purpose || 'email_verification');
    }
  }, [location]);

  const handleChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;
    if (value.length > 1) return;
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 7) { // 8 digits (0-7)
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 8).replace(/\D/g, '');
    if (pastedData.length === 8) {
      const newOtp = pastedData.split('');
      setOtp(newOtp);
      inputRefs.current[7]?.focus();
    }
  };

  const handleVerify = async () => {
    setError('');
    const otpCode = otp.join('');

    if (otpCode.length !== 8) {
      setError('Please enter the complete 8-digit code');
      return;
    }

    setLoading(true);

    try {
      if (purpose === 'password_reset') {
        // For password reset, verify OTP using Supabase
        const { data, error: verifyError } = await (supabase.auth as any).verifyOtp({
          email: email,
          token: otpCode,
          type: 'recovery', // Password reset type
        });

        if (verifyError || !data.user) {
          setError('Invalid or expired OTP');
          setLoading(false);
          return;
        }

        navigate('/set-new-password', { state: { email } });
      } else {
        // For email verification, try both 'signup' and 'email' types
        // 'signup' is for initial signup OTP, 'email' is for resend via signInWithOtp
        let verifyError = null;
        let verifyData = null;

        // Try 'signup' type first (for initial signup)
        const signupResult = await (supabase.auth as any).verifyOtp({
          email: email,
          token: otpCode,
          type: 'signup',
        });

        if (signupResult.error) {
          // If signup type fails, try 'email' type (for resend)
          const emailResult = await (supabase.auth as any).verifyOtp({
            email: email,
            token: otpCode,
            type: 'email',
          });
          verifyError = emailResult.error;
          verifyData = emailResult.data;
        } else {
          verifyError = signupResult.error;
          verifyData = signupResult.data;
        }

        if (verifyError || !verifyData?.user) {
          setError(verifyError?.message || 'Invalid or expired OTP');
          setLoading(false);
          return;
        }

        // Update user profile to mark email as verified
        await supabase
          .from('user_profiles')
          .update({ email_verified: true })
          .eq('id', verifyData.user.id);

        // Create notification
        await supabase.rpc('create_notification', {
          p_user_id: verifyData.user.id,
          p_type: 'email_verification',
          p_title: 'Email Verified',
          p_message: 'Your email has been successfully verified.',
        });

        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setLoading(true);

    try {
      if (!email) {
        setError('Email address is required');
        setLoading(false);
        return;
      }

      if (purpose === 'password_reset') {
        // Resend password reset OTP via Supabase
        const { error: resendError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/verify-email?purpose=password_reset`,
        });

        if (resendError) {
          setError(resendError.message || 'Failed to resend OTP');
        } else {
          setError('OTP resent! Please check your email.');
        }
      } else {
        // Resend email verification OTP via Supabase by calling signInWithOtp
        const { error: resendError } = await (supabase.auth as any).signInWithOtp({
          email: email,
          options: {
            shouldCreateUser: false, // Don't create new user, just resend OTP
          },
        });

        if (resendError) {
          setError(resendError.message || 'Failed to resend OTP');
        } else {
          setError('OTP resent! Please check your email.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-6xl flex flex-col lg:flex-row items-center gap-6 lg:gap-12">
        {/* Left Side - Image */}
        <div className="hidden lg:flex lg:w-1/2 justify-center items-center">
          <img src={characterImage} alt="Character" className="max-w-md w-full h-auto" />
        </div>

        {/* Right Side - Form */}
        <div className="w-full lg:w-1/2 flex justify-center">
          <Card className="w-full max-w-md mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold text-foreground">Verify Your Email</CardTitle>
              <CardDescription className="text-muted-foreground">
                Please enter the 8-digit code we just sent to {email || 'your email'}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex justify-center gap-1 sm:gap-2 md:gap-3 flex-wrap px-2" onPaste={handlePaste}>
                  {otp.map((digit, index) => (
                    <Input
                      key={index}
                      ref={(el) => { inputRefs.current[index] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      placeholder="-"
                      className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 text-lg sm:text-xl md:text-2xl font-bold text-center bg-background text-foreground border-border flex-shrink-0"
                    />
                  ))}
                </div>

                <div className="text-center text-sm text-muted-foreground">
                  Didn't receive OTP?{' '}
                  <button
                    type="button"
                    onClick={handleResend}
                    className="text-primary hover:underline font-medium"
                  >
                    Resend Code
                  </button>
                </div>

                {error && (
                  <Alert variant={error.includes('resent') ? 'success' : 'destructive'}>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={handleVerify}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  disabled={loading}
                >
                  {loading ? 'Verifying...' : 'Done'}
                </Button>

                <div className="text-center text-sm text-muted-foreground">
                  Back To <Link to="/" className="text-primary hover:underline font-medium">Sign in</Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
