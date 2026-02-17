import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import CountryCodeSelector from './CountryCodeSelector';
import { validatePassword } from '../utils/passwordValidation';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useThemeMode } from '../contexts/ThemeContext';

// Import assets
import characterImage from '../assest/Gemini_Generated_Image_ppyqz2ppyqz2ppyq (1) 1.png';
import logoImage from '../assest/LOGO LIGHT MODE.png';
import logoImageDark from '../assest/LOGO DARK MODE.png';
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
  dateOfBirth: string;
  password: string;
  confirmPassword: string;
}

interface FieldErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  password?: string;
  confirmPassword?: string;
  terms?: string;
}

const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const { mode, setMode } = useThemeMode();

  // Force light mode on auth pages
  useEffect(() => {
    setMode('light');
  }, []);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [countryCode, setCountryCode] = useState<string>('+1');
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    password: '',
    confirmPassword: ''
  });
  const [agreeTerms, setAgreeTerms] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Validation helpers
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const getMinAge13Date = (): string => {
    const today = new Date();
    today.setFullYear(today.getFullYear() - 13);
    return today.toISOString().split('T')[0];
  };

  const isAtLeast13 = (dob: string): boolean => {
    if (!dob) return false;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 13;
  };

  const clearFieldError = (field: keyof FieldErrors) => {
    setFieldErrors(prev => {
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });
    setError('');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    clearFieldError(name as keyof FieldErrors);

    // Real-time validation for email
    if (name === 'email' && value.length > 0 && !emailRegex.test(value)) {
      setFieldErrors(prev => ({ ...prev, email: 'Please enter a valid email address' }));
    }
    // Real-time validation: clear confirmPassword error if they now match
    if (name === 'confirmPassword' || name === 'password') {
      if (name === 'confirmPassword' && formData.password && value && value !== formData.password) {
        setFieldErrors(prev => ({ ...prev, confirmPassword: 'Passwords do not match' }));
      } else if (name === 'confirmPassword' && value === formData.password) {
        clearFieldError('confirmPassword');
      }
      if (name === 'password' && formData.confirmPassword && formData.confirmPassword !== value) {
        setFieldErrors(prev => ({ ...prev, confirmPassword: 'Passwords do not match' }));
      } else if (name === 'password' && formData.confirmPassword === value) {
        clearFieldError('confirmPassword');
      }
    }
  };

  const handleDateOfBirthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, dateOfBirth: value }));
    clearFieldError('dateOfBirth');

    if (value && !isAtLeast13(value)) {
      setFieldErrors(prev => ({ ...prev, dateOfBirth: 'You must be at least 13 years old to sign up' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    // Field-specific validation
    const errors: FieldErrors = {};

    if (!formData.firstName.trim()) {
      errors.firstName = 'First name is required';
    }
    if (!formData.lastName.trim()) {
      errors.lastName = 'Last name is required';
    }
    if (!formData.email.trim()) {
      errors.email = 'Email address is required';
    } else if (!emailRegex.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (!formData.phone.trim()) {
      errors.phone = 'Phone number is required';
    } else if (formData.phone.length < 7) {
      errors.phone = 'Please enter a valid phone number';
    }
    if (!formData.dateOfBirth) {
      errors.dateOfBirth = 'Date of birth is required';
    } else if (!isAtLeast13(formData.dateOfBirth)) {
      errors.dateOfBirth = 'You must be at least 13 years old to sign up';
    }
    if (!formData.password) {
      errors.password = 'Password is required';
    } else {
    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.isValid) {
        errors.password = passwordValidation.errors.join('. ');
      }
    }
    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    if (!agreeTerms) {
      errors.terms = 'Please agree to the Terms & Privacy';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
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
            date_of_birth: formData.dateOfBirth,
          },
        },
      });

      if (signUpError) {
        if (signUpError.message?.includes('already registered') ||
          signUpError.message?.includes('User already registered') ||
          signUpError.message?.includes('email address is already registered')) {
          setFieldErrors({ email: 'An account with this email already exists. Please sign in instead.' });
        } else {
          setError(signUpError.message || 'Failed to create account');
        }
        setLoading(false);
        return;
      }

      // Profile creation is handled automatically by the database trigger (handle_new_user)
      // which fires on auth.users INSERT and reads user metadata (first_name, last_name, phone, country_code, date_of_birth).
      // Free package assignment happens after email verification in VerifyEmail.tsx.

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
        <img src={mode === 'dark' ? logoImageDark : logoImage} alt="DNAi - Duha Nashrah" />
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
                  <div className={`signin-input-wrapper ${fieldErrors.firstName ? 'signin-input-error' : ''}`}>
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
                  {fieldErrors.firstName && (
                    <span className="signin-field-error">{fieldErrors.firstName}</span>
                  )}
                </div>

                <div className="signin-form-field">
                  <div className="signin-label-row">
                    <Label htmlFor="lastName" className="signin-label">Last Name *</Label>
                  </div>
                  <div className={`signin-input-wrapper ${fieldErrors.lastName ? 'signin-input-error' : ''}`}>
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
                  {fieldErrors.lastName && (
                    <span className="signin-field-error">{fieldErrors.lastName}</span>
                  )}
                </div>
              </div>

              <div className="signin-form-field">
                <div className="signin-label-row">
                  <Label htmlFor="email" className="signin-label">Email Address *</Label>
                </div>
                <div className={`signin-input-wrapper ${fieldErrors.email ? 'signin-input-error' : ''}`}>
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
                {fieldErrors.email && (
                  <span className="signin-field-error">{fieldErrors.email}</span>
                )}
              </div>

              <div className="signin-form-field">
                <div className="signin-label-row">
                  <Label htmlFor="phone" className="signin-label">Phone Number *</Label>
                </div>
                <div className={`signin-phone-input-group ${fieldErrors.phone ? 'signin-phone-group-error' : ''}`}>
                  <div className="signin-country-code-wrapper">
                    <CountryCodeSelector
                      value={countryCode}
                      onChange={setCountryCode}
                    />
                  </div>
                  <div className={`signin-input-wrapper signin-phone-input ${fieldErrors.phone ? 'signin-input-error' : ''}`}>
                    <Input
                      id="phone"
                      type="tel"
                      name="phone"
                      placeholder="0123456789"
                      value={formData.phone}
                      onChange={(e) => {
                        // Only allow digits, strip everything else including country code characters
                        const numericValue = e.target.value.replace(/\D/g, '').slice(0, 15);
                        setFormData(prev => ({ ...prev, phone: numericValue }));
                        clearFieldError('phone');
                      }}
                      onKeyDown={(e) => {
                        // Block +, -, (, ), space and other non-numeric keys (allow backspace, tab, arrows etc.)
                        const allowedKeys = ['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'Delete', 'Home', 'End'];
                        if (allowedKeys.includes(e.key)) return;
                        if (e.ctrlKey || e.metaKey) return; // Allow copy/paste shortcuts
                        if (!/^\d$/.test(e.key)) {
                          e.preventDefault();
                        }
                      }}
                      maxLength={15}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="signin-input"
                    />
                  </div>
                </div>
                {fieldErrors.phone && (
                  <span className="signin-field-error">{fieldErrors.phone}</span>
                )}
              </div>

              <div className="signin-form-field">
                <div className="signin-label-row">
                  <Label htmlFor="dateOfBirth" className="signin-label">Date of Birth *</Label>
                </div>
                <div className={`signin-input-wrapper ${fieldErrors.dateOfBirth ? 'signin-input-error' : ''}`}>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleDateOfBirthChange}
                    max={getMinAge13Date()}
                    className="signin-input signin-date-input"
                  />
                </div>
                {fieldErrors.dateOfBirth && (
                  <span className="signin-field-error">{fieldErrors.dateOfBirth}</span>
                )}
              </div>

              <div className="signin-form-field">
                <div className="signin-label-row">
                  <Label htmlFor="password" className="signin-label">Password *</Label>
                </div>
                <div className={`signin-password-input ${fieldErrors.password ? 'signin-input-error' : ''}`}>
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
                {fieldErrors.password && (
                  <span className="signin-field-error">{fieldErrors.password}</span>
                )}
              </div>

              <div className="signin-form-field">
                <div className="signin-label-row">
                  <Label htmlFor="confirmPassword" className="signin-label">Confirm Password *</Label>
                </div>
                <div className={`signin-password-input ${fieldErrors.confirmPassword ? 'signin-input-error' : ''}`}>
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
                {fieldErrors.confirmPassword && (
                  <span className="signin-field-error">{fieldErrors.confirmPassword}</span>
                )}
              </div>
            </div>

            <div className="signin-checkbox-group">
              <input
                type="checkbox"
                id="terms"
                checked={agreeTerms}
                onChange={(e) => {
                  setAgreeTerms(e.target.checked);
                  if (e.target.checked) clearFieldError('terms');
                }}
                className={`signin-checkbox ${fieldErrors.terms ? 'signin-checkbox-error' : ''}`}
              />
              <Label htmlFor="terms" className="signin-checkbox-label">
                I agree to the <Link to="/terms" className="signin-terms-link">Terms & Privacy</Link>
              </Label>
            </div>
            {fieldErrors.terms && (
              <span className="signin-field-error" style={{ marginTop: '-4px' }}>{fieldErrors.terms}</span>
            )}
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
