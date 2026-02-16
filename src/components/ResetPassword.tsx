import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useThemeMode } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { emailService } from '../services/emailService';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import characterImage from '../assest/resetpassword.png';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const { resetPassword } = useAuth();
  const { setMode } = useThemeMode();

  // Force light mode on auth pages
  useEffect(() => {
    setMode('light');
  }, []);
  const [email, setEmail] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);

    try {
      // Use Supabase's resetPasswordForEmail which will send a reset link
      const { error: resetError } = await resetPassword(email);

      if (resetError) {
        setError(resetError.message || 'Failed to send password reset link. Please try again.');
        setLoading(false);
        return;
      }

      // Supabase will automatically send password reset link email
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-6xl flex items-center gap-12">
        {/* Left Side - Image */}
        <div className="hidden lg:flex lg:w-1/2 justify-center items-center">
          <img src={characterImage} alt="Character" className="max-w-md w-full h-auto" />
        </div>

        {/* Right Side - Form */}
        <div className="w-full lg:w-1/2 flex justify-center">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold text-foreground">Reset Your Password</CardTitle>
              <CardDescription className="text-muted-foreground">
                Enter your email address, and we'll send you a link to reset your password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="123@gmail.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 bg-background text-foreground border-border"
                    />
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {success && (
                  <Alert variant="success">
                    <AlertDescription>
                      Password reset link sent! Please check your email and click the link to reset your password.
                    </AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  disabled={loading}
                >
                  {loading ? 'Sending...' : 'Send reset link'}
                </Button>

                <div className="text-center text-sm text-muted-foreground">
                  Back To <Link to="/" className="text-primary hover:underline font-medium">Sign in</Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
