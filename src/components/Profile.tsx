import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Edit, X, Save, User, Mail, Lock, Shield, Activity, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import CountryCodeSelector from './CountryCodeSelector';
import TwoFactorAuth from './TwoFactorAuth';
import LoginActivity from './LoginActivity';
import AccountDeactivation from './AccountDeactivation';
import AvatarUpload from './AvatarUpload';
import PhoneVerification from './PhoneVerification';
import KYCVerification from './KYCVerification';
import { validatePassword } from '../utils/passwordValidation';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

interface ProfileData {
  [key: string]: any;
}

const Profile: React.FC = () => {
  const { user, updatePassword } = useAuth();
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [originalProfileData, setOriginalProfileData] = useState<ProfileData | null>(null);
  const [profileData, setProfileData] = useState<ProfileData>({});
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  
  // Phone number change verification state
  const [showPhoneVerificationDialog, setShowPhoneVerificationDialog] = useState(false);
  const [pendingPhoneNumber, setPendingPhoneNumber] = useState<string>('');
  const [pendingCountryCode, setPendingCountryCode] = useState<string>('');
  const [phoneVerificationOTP, setPhoneVerificationOTP] = useState<string>('');
  const [phoneVerificationLoading, setPhoneVerificationLoading] = useState(false);
  const [phoneVerificationError, setPhoneVerificationError] = useState<string>('');

  useEffect(() => {
    if (!user) return;
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;

    setProfileLoading(true);
    setErrorMessage(null);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error loading profile:', error);
        if (error.code === 'PGRST116') {
          setProfileData({});
          setOriginalProfileData({});
        } else {
          setErrorMessage('Failed to load profile data: ' + error.message);
        }
      } else if (data) {
        setProfileData(data);
        setOriginalProfileData(data);
      }
    } catch (err: any) {
      console.error('Error loading profile:', err);
      setErrorMessage('Failed to load profile data: ' + (err.message || 'Unknown error'));
    } finally {
      setProfileLoading(false);
    }
  };

  const handleProfileChange = (field: string, value: any) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // Restrict phone number field to numbers only, max 10 digits
    if (e.target.name === 'phone') {
      const numericValue = e.target.value.replace(/\D/g, '').slice(0, 10);
      handleProfileChange('phone', numericValue);
      return;
    }
    const { name, value } = e.target;
    handleProfileChange(name, value);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      // Check if phone number is being changed
      const originalPhone = originalProfileData?.phone || '';
      const originalCountryCode = originalProfileData?.country_code || '';
      const newPhone = profileData.phone || '';
      const newCountryCode = profileData.country_code || '';
      
      const phoneChanged = originalPhone !== newPhone || originalCountryCode !== newCountryCode;
      
      if (phoneChanged) {
        // Phone number is being changed - require email verification
        setPendingPhoneNumber(newPhone);
        setPendingCountryCode(newCountryCode);
        setShowPhoneVerificationDialog(true);
        setLoading(false);
        return;
      }

      const updateData: ProfileData = { ...profileData };
      delete updateData.id;
      delete updateData.created_at;
      updateData.updated_at = new Date().toISOString();

      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      let error;
      if (existingProfile) {
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update(updateData)
          .eq('id', user.id);
        error = updateError;
      } else {
        updateData.id = user.id;
        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert(updateData);
        error = insertError;
      }

      if (error) {
        throw error;
      }

      setSuccessMessage('Profile updated successfully!');
      setIsEditMode(false);
      await loadProfile();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setErrorMessage(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  // Send email OTP for phone number change verification
  const sendPhoneChangeVerification = async () => {
    if (!user?.email) {
      setPhoneVerificationError('User email not found');
      return;
    }

    setPhoneVerificationLoading(true);
    setPhoneVerificationError('');

    try {
      // Send OTP via Supabase email
      const { error: otpError } = await (supabase.auth as any).signInWithOtp({
        email: user.email,
        options: {
          shouldCreateUser: false,
        },
      });

      if (otpError) {
        throw otpError;
      }

      setPhoneVerificationError('');
      // OTP sent successfully - user will enter it in the dialog
    } catch (err: any) {
      console.error('Error sending verification email:', err);
      setPhoneVerificationError(err.message || 'Failed to send verification email');
    } finally {
      setPhoneVerificationLoading(false);
    }
  };

  // Verify OTP and update phone number
  const verifyPhoneChangeOTP = async () => {
    if (!user?.email || !phoneVerificationOTP) {
      setPhoneVerificationError('Please enter the verification code');
      return;
    }

    if (phoneVerificationOTP.length !== 6 && phoneVerificationOTP.length !== 8) {
      setPhoneVerificationError('Please enter a valid 6 or 8 digit code');
      return;
    }

    setPhoneVerificationLoading(true);
    setPhoneVerificationError('');

    try {
      // Verify OTP
      const { data, error: verifyError } = await (supabase.auth as any).verifyOtp({
        email: user.email,
        token: phoneVerificationOTP,
        type: 'email',
      });

      if (verifyError) {
        throw verifyError;
      }

      // OTP verified - now update the phone number
      const updateData: ProfileData = { ...profileData };
      delete updateData.id;
      delete updateData.created_at;
      updateData.updated_at = new Date().toISOString();
      updateData.phone = pendingPhoneNumber;
      updateData.country_code = pendingCountryCode;
      updateData.phone_verified = false; // Reset phone verification status

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('id', user.id);

      if (updateError) {
        throw updateError;
      }

      // Success - close dialog and refresh profile
      setShowPhoneVerificationDialog(false);
      setPhoneVerificationOTP('');
      setPendingPhoneNumber('');
      setPendingCountryCode('');
      setSuccessMessage('Phone number updated successfully! Please verify your new phone number.');
      setIsEditMode(false);
      await loadProfile();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error('Error verifying OTP:', err);
      setPhoneVerificationError(err.message || 'Invalid verification code. Please try again.');
    } finally {
      setPhoneVerificationLoading(false);
    }
  };

  // Initialize email verification when dialog opens
  useEffect(() => {
    if (showPhoneVerificationDialog && user?.email) {
      sendPhoneChangeVerification();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPhoneVerificationDialog]);

  const handleCancelEdit = () => {
    if (originalProfileData) {
      setProfileData({ ...originalProfileData });
    }
    setIsEditMode(false);
    setErrorMessage(null);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setErrorMessage('New passwords do not match');
      setLoading(false);
      return;
    }

    // Validate password strength
    const passwordValidation = validatePassword(passwordData.newPassword);
    if (!passwordValidation.isValid) {
      setErrorMessage(passwordValidation.errors.join('. '));
      setLoading(false);
      return;
    }

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email || '',
        password: passwordData.currentPassword,
      });

      if (signInError) {
        throw new Error('Current password is incorrect');
      }

      const { error: updateError } = await updatePassword(passwordData.newPassword);

      if (updateError) {
        throw updateError;
      }

      try {
        const ipResponse = await fetch('https://api.ipify.org?format=json').catch(() => null);
        const ipData = ipResponse ? await ipResponse.json() : { ip: null };
        
        await supabase.from('security_events').insert({
          user_id: user.id,
          event_type: 'password_changed',
          severity: 'medium',
          ip_address: ipData.ip,
          user_agent: navigator.userAgent,
          details: { changed_at: new Date().toISOString() },
        });
      } catch (logError) {
        console.error('Error logging security event:', logError);
      }

      setSuccessMessage('Password changed successfully!');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error('Error changing password:', err);
      setErrorMessage(err.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const formatFieldName = (fieldName: string): string => {
    const fieldLabels: { [key: string]: string } = {
      first_name: 'First Name',
      last_name: 'Last Name',
      phone: 'Phone Number',
      country_code: 'Country Code',
      avatar_url: 'Avatar URL',
      bio: 'Bio',
      date_of_birth: 'Date of Birth',
      account_status: 'Account Status',
      email_verified: 'Email Verified',
      phone_verified: 'Phone Verified',
      last_login_at: 'Last Login',
      last_active_at: 'Last Active',
      created_at: 'Created At',
      updated_at: 'Updated At',
    };
    
    return fieldLabels[fieldName] || fieldName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const shouldDisplayField = (key: string, showAll: boolean = false): boolean => {
    const hiddenFields = ['id', 'user_id', 'created_at', 'updated_at', 'deleted_at'];
    
    // Hide company and KYC fields from main profile view
    const companyFields = ['company_name', 'company_registration_number', 'company_address', 'company_website', 'company_tax_id'];
    const kycFields = ['kyc_status', 'kyc_verified_at', 'kyc_verified_by', 'kyc_rejection_reason'];
    const metadataFields = ['metadata'];
    
    if (!showAll) {
      // Hide company, KYC, and metadata fields from main view
      if (companyFields.includes(key) || kycFields.includes(key) || metadataFields.includes(key)) {
        return false;
      }
    }
    
    return !hiddenFields.includes(key);
  };

  const getFieldType = (key: string, value: any): string => {
    if (key.includes('email')) return 'email';
    if (key.includes('phone')) return 'tel';
    if (key.includes('date') || key.includes('birth')) return 'date';
    if (key.includes('url') || key.includes('avatar')) return 'url';
    if (typeof value === 'boolean') return 'checkbox';
    if (typeof value === 'number') return 'number';
    return 'text';
  };

  const renderViewField = (key: string, value: any) => {
    if (!shouldDisplayField(key)) return null;

    // Special handling for avatar
    if (key === 'avatar_url' && value) {
      return (
        <div key={key} className="mb-6">
          <Label className="text-sm font-semibold text-muted-foreground mb-3 block">
            {formatFieldName(key)}
          </Label>
          <div className="flex items-center gap-4">
            <img 
              src={value} 
              alt="Avatar" 
              className="w-20 h-20 rounded-full object-cover border-2 border-border"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <p className="text-sm text-muted-foreground break-all">{value}</p>
          </div>
        </div>
      );
    }

    let displayValue: string | React.ReactNode;
    let isEmpty = false;
    
    if (value === null || value === undefined || value === '') {
      displayValue = (
        <span className="text-muted-foreground italic">Not set</span>
      );
      isEmpty = true;
    } else if (typeof value === 'boolean') {
      displayValue = (
        <Badge variant={value ? 'default' : 'secondary'} className="w-fit">
          {value ? (
            <>
              <CheckCircle className="w-3 h-3 mr-1" />
              Yes
            </>
          ) : (
            <>
              <X className="w-3 h-3 mr-1" />
              No
            </>
          )}
        </Badge>
      );
    } else if (key.includes('_at') || key.includes('date')) {
      try {
        const date = new Date(value);
        if (key.includes('date_of_birth')) {
          displayValue = date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });
        } else {
          displayValue = date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        }
      } catch {
        displayValue = String(value);
      }
    } else if (key === 'account_status') {
      const statusColors: { [key: string]: string } = {
        active: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
        inactive: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20',
        suspended: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
        deleted: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
      };
      const status = String(value).toLowerCase();
      displayValue = (
        <Badge 
          variant="outline" 
          className={`${statusColors[status] || 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20'} capitalize`}
        >
          {String(value).charAt(0).toUpperCase() + String(value).slice(1)}
        </Badge>
      );
    } else if (key === 'phone' && value) {
      // Format phone number nicely - don't show country_code separately if it's in phone
      const phoneStr = String(value);
      const countryCode = profileData.country_code || '+1';
      // If phone already includes country code, use it as is, otherwise prepend
      displayValue = phoneStr.startsWith('+') 
        ? phoneStr 
        : `${countryCode}${phoneStr}`;
    } else if (key === 'country_code') {
      // Don't show country_code separately if phone is shown (it's already included)
      return null;
    } else {
      displayValue = String(value);
    }

    return (
      <div key={key} className="mb-5 pb-5 border-b border-border last:border-0 last:pb-0 last:mb-0">
        <Label className="text-xs font-medium text-muted-foreground mb-2 block uppercase tracking-wide">
          {formatFieldName(key)}
        </Label>
        <div className={`text-base ${isEmpty ? '' : 'text-foreground font-medium'}`}>
          {displayValue}
        </div>
      </div>
    );
  };

  const renderEditField = (key: string, value: any) => {
    if (!shouldDisplayField(key)) return null;

    const fieldType = getFieldType(key, value);
    const isMultiline = key.includes('bio') || key.includes('description') || key.includes('note');

    if (key === 'country_code') {
      return (
        <div key={key} className="mb-4">
          <Label className="text-sm font-medium mb-2 block text-foreground">
            {formatFieldName(key)}
          </Label>
          <CountryCodeSelector
            value={value || '+1'}
            onChange={(code) => handleProfileChange(key, code)}
          />
        </div>
      );
    }

    if (key === 'account_status' || key === 'email_verified' || key === 'phone_verified' || 
        key === 'last_login_at' || key === 'last_active_at' || key === 'created_at' || 
        key === 'updated_at' || key === 'deleted_at') {
      return null;
    }

    if (fieldType === 'checkbox') {
      return (
        <div key={key} className="mb-4 flex items-center gap-2">
          <input
            type="checkbox"
            checked={value || false}
            onChange={(e) => handleProfileChange(key, e.target.checked)}
            className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
          />
          <Label className="text-foreground">{formatFieldName(key)}</Label>
        </div>
      );
    }

    return (
      <div key={key} className="mb-4">
        <Label htmlFor={key} className="text-sm font-medium mb-2 block text-foreground">
          {formatFieldName(key)}
        </Label>
        {isMultiline ? (
          <textarea
            id={key}
            name={key}
            value={value || ''}
            onChange={handleInputChange}
            rows={4}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
          />
        ) : (
          <Input
            id={key}
            name={key}
            type={fieldType}
            value={value || ''}
            onChange={handleInputChange}
            className="bg-background text-foreground border-border"
          />
        )}
      </div>
    );
  };

  if (profileLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="max-w-[1200px] mx-auto px-6" style={{ fontFamily: "'Manrope', sans-serif" }}>
        <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="profile">
            <User className="w-4 h-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="w-4 h-4 mr-2" />
            Security
          </TabsTrigger>
          <TabsTrigger value="verification">
            <CheckCircle className="w-4 h-4 mr-2" />
            Verification
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Activity className="w-4 h-4 mr-2" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="account">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Account
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <AvatarUpload />
          
          {!isEditMode && (
            <div className="flex justify-end">
              <Button
                onClick={() => setIsEditMode(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Profile
              </Button>
            </div>
          )}

          {successMessage && (
            <Alert variant="success" onClose={() => setSuccessMessage(null)}>
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          )}

          {errorMessage && (
            <Alert variant="destructive" onClose={() => setErrorMessage(null)}>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {/* Profile Information Card */}
        <Card className="rounded-[14px] border border-[#e5e5e5]">
          <CardHeader className="px-5 pt-5 pb-0">
            <div className="flex justify-between items-center">
              <CardTitle className="text-[18px] font-semibold text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>Profile Information</CardTitle>
              {isEditMode && (
                <Badge variant="default">Edit Mode</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-5 py-5">

            {isEditMode ? (
              <form onSubmit={handleProfileSubmit}>
                {/* Email Address - Read Only */}
                <div className="mb-6 pb-6 border-b border-border">
                  <Label className="text-sm font-medium mb-2 block text-foreground">
                    Email Address
                  </Label>
                  <Input
                    value={user?.email || ''}
                    disabled
                    className="bg-muted text-muted-foreground border-border"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
                </div>

                <div className="space-y-4">
                  {/* Always show these fields in edit mode */}
                  <div className="mb-4">
                    <Label htmlFor="first_name" className="text-sm font-medium mb-2 block text-foreground">
                      First Name
                    </Label>
                    <Input
                      id="first_name"
                      name="first_name"
                      value={profileData.first_name || ''}
                      onChange={handleInputChange}
                      placeholder="Enter your first name"
                      className="bg-background text-foreground border-border"
                    />
                  </div>
                  <div className="mb-4">
                    <Label htmlFor="last_name" className="text-sm font-medium mb-2 block text-foreground">
                      Last Name
                    </Label>
                    <Input
                      id="last_name"
                      name="last_name"
                      value={profileData.last_name || ''}
                      onChange={handleInputChange}
                      placeholder="Enter your last name"
                      className="bg-background text-foreground border-border"
                    />
                  </div>
                  <div className="mb-4">
                    <Label className="text-sm font-medium mb-2 block text-foreground">
                      Phone Number
                    </Label>
                    <div className="flex gap-2">
                      <CountryCodeSelector
                        value={profileData.country_code || '+1'}
                        onChange={(code) => handleProfileChange('country_code', code)}
                      />
                      <Input
                        name="phone"
                        value={profileData.phone || ''}
                        onChange={handleInputChange}
                        placeholder="Enter your phone number"
                        type="tel"
                        maxLength={10}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        className="flex-1 bg-background text-foreground border-border"
                      />
                    </div>
                  </div>
                  <div className="mb-4">
                    <Label htmlFor="date_of_birth" className="text-sm font-medium mb-2 block text-foreground">
                      Date of Birth
                    </Label>
                    <Input
                      id="date_of_birth"
                      name="date_of_birth"
                      type="date"
                      value={profileData.date_of_birth || ''}
                      onChange={handleInputChange}
                      className="bg-background text-foreground border-border"
                    />
                  </div>
                  <div className="mb-4">
                    <Label htmlFor="bio" className="text-sm font-medium mb-2 block text-foreground">
                      Bio
                    </Label>
                    <textarea
                      id="bio"
                      name="bio"
                      value={profileData.bio || ''}
                      onChange={handleInputChange}
                      placeholder="Tell us about yourself"
                      rows={4}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
                    />
                  </div>
                  <div className="mb-4">
                    <Label htmlFor="avatar_url" className="text-sm font-medium mb-2 block text-foreground">
                      Avatar URL
                    </Label>
                    <Input
                      id="avatar_url"
                      name="avatar_url"
                      value={profileData.avatar_url || ''}
                      onChange={handleInputChange}
                      placeholder="https://example.com/avatar.jpg"
                      type="url"
                      className="bg-background text-foreground border-border"
                    />
                  </div>
                  
                  {/* Render other user fields that might exist */}
                  {Object.keys(profileData)
                    .filter(key => shouldDisplayField(key) && 
                      !['first_name', 'last_name', 'phone', 'country_code', 'date_of_birth', 'bio', 'avatar_url'].includes(key))
                    .sort((a, b) => {
                      const order: { [key: string]: number } = {};
                      return (order[a] || 99) - (order[b] || 99);
                    })
                    .map(key => renderEditField(key, profileData[key]))}
                  

                  <div className="flex justify-end gap-3 mt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancelEdit}
                      disabled={loading}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={loading}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {loading ? 'Saving...' : 'Save Profile'}
                    </Button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                {/* Email Address - Always shown */}
                <div className="pb-5 border-b border-border">
                  <Label className="text-xs font-medium text-muted-foreground mb-2 block uppercase tracking-wide">
                    Email Address
                  </Label>
                  <div className="text-base text-foreground font-medium flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    {user?.email || 'Not set'}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
                </div>

                {/* User Profile Fields */}
                {Object.keys(profileData).length > 0 ? (
                  <div>
                    {Object.keys(profileData)
                      .filter(key => shouldDisplayField(key))
                      .sort((a, b) => {
                        const order: { [key: string]: number } = {
                          first_name: 1,
                          last_name: 2,
                          phone: 3,
                          country_code: 4,
                          date_of_birth: 5,
                          bio: 6,
                          avatar_url: 7,
                          account_status: 8,
                          email_verified: 9,
                          phone_verified: 10,
                          last_login_at: 11,
                          last_active_at: 12,
                        };
                        return (order[a] || 99) - (order[b] || 99);
                      })
                      .map(key => renderViewField(key, profileData[key]))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <User className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-foreground font-medium mb-2">No profile information available</p>
                    <p className="text-sm text-muted-foreground mb-6">
                      Click "Edit Profile" to add your information
                    </p>
                    <Button
                      onClick={() => setIsEditMode(true)}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Add Profile Information
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Change Password Card */}
        <Card className="rounded-[14px] border border-[#e5e5e5]">
          <CardHeader className="px-5 pt-5 pb-0">
            <CardTitle className="text-[18px] font-semibold text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>Change Password</CardTitle>
            <CardDescription className="text-[16px] text-[#737373]" style={{ fontFamily: "'Manrope', sans-serif" }}>
              Update your password to keep your account secure
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5 py-5">
            <form onSubmit={handlePasswordSubmit}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword" className="text-foreground">Current Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="currentPassword"
                      name="currentPassword"
                      type={showPasswords.current ? 'text' : 'password'}
                      value={passwordData.currentPassword}
                      onChange={handlePasswordChange}
                      required
                      className="pl-10 pr-10 bg-background text-foreground border-border"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPasswords.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-foreground">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="newPassword"
                      name="newPassword"
                      type={showPasswords.new ? 'text' : 'password'}
                      value={passwordData.newPassword}
                      onChange={handlePasswordChange}
                      required
                      className="pl-10 pr-10 bg-background text-foreground border-border"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Password must be at least 8 characters and include at least one capital letter
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-foreground">Confirm New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showPasswords.confirm ? 'text' : 'password'}
                      value={passwordData.confirmPassword}
                      onChange={handlePasswordChange}
                      required
                      className="pl-10 pr-10 bg-background text-foreground border-border"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={loading}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {loading ? 'Changing...' : 'Change Password'}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <TwoFactorAuth />
        </TabsContent>

        <TabsContent value="verification" className="space-y-6">
          <PhoneVerification />
          <KYCVerification />
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <LoginActivity />
        </TabsContent>

        <TabsContent value="account" className="space-y-6">
          <AccountDeactivation />
        </TabsContent>
      </Tabs>
      </div>

      {/* Phone Number Change Verification Dialog */}
      <Dialog open={showPhoneVerificationDialog} onOpenChange={setShowPhoneVerificationDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Verify Email to Change Phone Number</DialogTitle>
            <DialogDescription>
              For security reasons, please verify your email address before changing your phone number.
              We've sent a verification code to {user?.email}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            {phoneVerificationError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{phoneVerificationError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="phoneVerificationOTP" className="text-foreground">
                Verification Code
              </Label>
              <Input
                id="phoneVerificationOTP"
                type="text"
                placeholder="Enter 6 or 8 digit code"
                value={phoneVerificationOTP}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 8);
                  setPhoneVerificationOTP(value);
                  setPhoneVerificationError('');
                }}
                maxLength={8}
                className="bg-background text-foreground border-border text-center text-lg tracking-widest"
              />
              <p className="text-xs text-muted-foreground">
                Enter the verification code sent to your email
              </p>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPhoneVerificationDialog(false);
                  setPhoneVerificationOTP('');
                  setPhoneVerificationError('');
                  setPendingPhoneNumber('');
                  setPendingCountryCode('');
                  // Revert phone number changes
                  if (originalProfileData) {
                    setProfileData({ ...originalProfileData });
                  }
                }}
                disabled={phoneVerificationLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={sendPhoneChangeVerification}
                variant="outline"
                disabled={phoneVerificationLoading}
              >
                Resend Code
              </Button>
              <Button
                onClick={verifyPhoneChangeOTP}
                disabled={phoneVerificationLoading || !phoneVerificationOTP}
              >
                {phoneVerificationLoading ? 'Verifying...' : 'Verify & Update'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Profile;
