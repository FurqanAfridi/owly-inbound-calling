import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import CountryCodeSelector from './CountryCodeSelector';
import { assignFreePackageToUser } from '../services/subscriptionService';
import { validatePassword } from '../utils/passwordValidation';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useThemeMode } from '../contexts/ThemeContext';

// Import assets
import characterImage from '../assest/Gemini_Generated_Image_ppyqz2ppyqz2ppyq (1) 1.png';
import logoImage from '../assest/DNAI-Logo 1.png';
import logoImageDark from '../assest/DNAI LOGO@2x.png';
import googleIcon from '../assest/google.svg';
import appleIcon from '../assest/Apple.svg';
import facebookIcon from '../assest/Symbol.png.png';
import viewOffIcon from '../assest/view-off.svg';
import vector10Icon from '../assest/Vector 10.svg';
import rectangle1281Image from '../assest/Rectangle 1281.png';

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const { mode } = useThemeMode();
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [countryCode, setCountryCode] = useState<string>('+1');
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [agreeTerms, setAgreeTerms] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone || !formData.password) {
      setError('Please fill in all required fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password strength
    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.isValid) {
      setError(passwordValidation.errors.join('. '));
      return;
    }

    if (!agreeTerms) {
      setError('Please agree to the Terms & Privacy');
      return;
    }

    setLoading(true);

    try {
      // Sign up with Supabase
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: null,
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            phone: `${countryCode}${formData.phone}`,
            country_code: countryCode,
          },
        },
      });

      if (signUpError) {
        if (signUpError.message?.includes('already registered') ||
          signUpError.message?.includes('User already registered') ||
          signUpError.message?.includes('email address is already registered')) {
          setError('An account with this email already exists. Please sign in instead.');
        } else {
          setError(signUpError.message || 'Failed to create account');
        }
        setLoading(false);
        return;
      }

      if (signUpData.user) {
        if (!signUpData.user.id) {
          console.error('User ID is missing from signup data');
          setError('Failed to create user account. Please try again.');
          setLoading(false);
          return;
        }

        const phoneNumber = formData.phone.startsWith(countryCode)
          ? formData.phone
          : `${countryCode}${formData.phone}`;

        const profileData = {
          id: signUpData.user.id,
          first_name: formData.firstName || null,
          last_name: formData.lastName || null,
          phone: phoneNumber || null,
          country_code: countryCode || '+1',
          email_verified: false,
          phone_verified: false,
          account_status: 'active',
          kyc_status: 'pending',
          metadata: {},
        };

        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert(profileData);

        let profileError = insertError;

        if (insertError && (insertError.code === '23505' || insertError.message?.includes('duplicate'))) {
          const { error: upsertError } = await supabase
            .from('user_profiles')
            .upsert(profileData, {
              onConflict: 'id',
            });
          profileError = upsertError;
        }

        if (profileError && profileError.code !== '23505') {
          console.error('Error creating profile:', profileError);
        }

        // Assign free package to new user
        try {
          await assignFreePackageToUser(signUpData.user.id);
        } catch (packageError) {
          console.error('Error assigning free package:', packageError);
        }
      }

      // Navigate to verify email page
      navigate('/verify-email', { state: { email: formData.email, purpose: 'email_verification' } });
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signin-container">
      {/* Left Panel - Blue Section */}
      <div className="signin-left-panel">
        <div className="signin-left-gradient"></div>
        <div
          className="signin-left-pattern"
          style={{ backgroundImage: `url(${rectangle1281Image})` }}
        ></div>
        <div className="signin-left-content">
          <h1 className="signin-hero-title">
            Build your Genie<br />
            powered social<br />
            growth engine
          </h1>
          <p className="signin-hero-description">
            Launch your personal Genie agent to handle content, insights, and<br />
            execution across platforms. Stop reacting. Start controlling your<br />
            social media with data-driven automation.
          </p>
        </div>
        <div className="signin-character-image">
          <img src={characterImage} alt="Character illustration" />
        </div>
      </div>

      {/* Right Panel - Form Section */}
      <div className="signin-logo">
        <img src={mode === 'dark' ? logoImageDark : logoImage} alt="DNAI Logo" />
      </div>

      <div className="signup-form-wrapper">
        <div className="signup-welcome">
          <h2 className="signin-welcome-title">Create your account!</h2>
          <p className="signin-welcome-subtitle">Tell us a bit about yourself to get started.</p>
        </div>

        <form onSubmit={handleSubmit} className="signin-form">
          <div className="signin-form-group">
            <div className="signin-form-fields">
              <div className="signin-form-field-row">
                <div className="signin-form-field">
                  <div className="signin-label-row">
                    <Label htmlFor="firstName" className="signin-label">First Name *</Label>
                  </div>
                  <div className="signin-input-wrapper">
                    <Input
                      id="firstName"
                      type="text"
                      name="firstName"
                      placeholder="Enter your first name"
                      value={formData.firstName}
                      onChange={handleChange}
                      className="signin-input"
                    />
                  </div>
                </div>

                <div className="signin-form-field">
                  <div className="signin-label-row">
                    <Label htmlFor="lastName" className="signin-label">Last Name *</Label>
                  </div>
                  <div className="signin-input-wrapper">
                    <Input
                      id="lastName"
                      type="text"
                      name="lastName"
                      placeholder="Enter your last name"
                      value={formData.lastName}
                      onChange={handleChange}
                      className="signin-input"
                    />
                  </div>
                </div>
              </div>

              <div className="signin-form-field">
                <div className="signin-label-row">
                  <Label htmlFor="email" className="signin-label">Email Address *</Label>
                </div>
                <div className="signin-input-wrapper">
                  <Input
                    id="email"
                    type="email"
                    name="email"
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={handleChange}
                    className="signin-input"
                  />
                </div>
              </div>

              <div className="signin-form-field">
                <div className="signin-label-row">
                  <Label htmlFor="phone" className="signin-label">Phone Number *</Label>
                </div>
                <div className="signin-phone-input-group">
                  <div className="signin-country-code-wrapper">
                    <CountryCodeSelector
                      value={countryCode}
                      onChange={setCountryCode}
                    />
                  </div>
                  <div className="signin-input-wrapper signin-phone-input">
                    <Input
                      id="phone"
                      type="tel"
                      name="phone"
                      placeholder="0123456789"
                      value={formData.phone}
                      onChange={(e) => {
                        const numericValue = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setFormData(prev => ({ ...prev, phone: numericValue }));
                      }}
                      maxLength={10}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="signin-input"
                    />
                  </div>
                </div>
              </div>

              <div className="signin-form-field">
                <div className="signin-label-row">
                  <Label htmlFor="password" className="signin-label">Password *</Label>
                </div>
                <div className="signin-password-input">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="Enter Your Password"
                    value={formData.password}
                    onChange={handleChange}
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

              <div className="signin-form-field">
                <div className="signin-label-row">
                  <Label htmlFor="confirmPassword" className="signin-label">Confirm Password *</Label>
                </div>
                <div className="signin-password-input">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    placeholder="Enter Your Confirm Password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="signin-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
            <span className="signin-submit-button-text">{loading ? 'Creating Account...' : 'Sign up'}</span>
          </Button>

          <div className="signin-form-bottom">
            <div className="signin-signup-link">
              <span className="signin-signup-text">Have an account? </span>
              <Link to="/" className="signin-signup-link-text">Sign in</Link>
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
  );
};

export default SignUp;
