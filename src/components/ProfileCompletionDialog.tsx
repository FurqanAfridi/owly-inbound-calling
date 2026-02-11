import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import CountryCodeSelector from './CountryCodeSelector';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Alert, AlertDescription } from './ui/alert';
import { AlertCircle } from 'lucide-react';

interface ProfileCompletionDialogProps {
  open: boolean;
  onComplete: () => void;
}

const ProfileCompletionDialog: React.FC<ProfileCompletionDialogProps> = ({
  open,
  onComplete,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    country_code: '+1',
    company_name: '',
    bio: '',
    date_of_birth: '',
    company_address: '',
    company_website: '',
    company_registration_number: '',
    company_tax_id: '',
  });

  useEffect(() => {
    if (open && user) {
      loadExistingProfile();
    }
  }, [open, user]);

  const loadExistingProfile = async () => {
    if (!user) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error loading profile:', fetchError);
        return;
      }

      if (data) {
        setFormData({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          phone: data.phone || '',
          country_code: data.country_code || '+1',
          company_name: data.company_name || '',
          bio: data.bio || '',
          date_of_birth: data.date_of_birth || '',
          company_address: data.company_address || '',
          company_website: data.company_website || '',
          company_registration_number: data.company_registration_number || '',
          company_tax_id: data.company_tax_id || '',
        });
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const validateForm = (): boolean => {
    if (!formData.first_name.trim()) {
      setError('First name is required');
      return false;
    }
    if (!formData.last_name.trim()) {
      setError('Last name is required');
      return false;
    }
    if (!formData.phone.trim()) {
      setError('Phone number is required');
      return false;
    }
    if (!formData.company_name.trim()) {
      setError('Company name is required');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    if (!user) {
      setError('User not authenticated');
      return;
    }

    setLoading(true);

    try {
      // Check if profile exists
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      const profileData = {
        id: user.id,
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        phone: formData.phone.trim(),
        country_code: formData.country_code,
        company_name: formData.company_name.trim(),
        bio: formData.bio.trim() || null,
        date_of_birth: formData.date_of_birth || null,
        company_address: formData.company_address.trim() || null,
        company_website: formData.company_website.trim() || null,
        company_registration_number: formData.company_registration_number.trim() || null,
        company_tax_id: formData.company_tax_id.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (existingProfile) {
        // Update existing profile
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update(profileData)
          .eq('id', user.id);

        if (updateError) {
          throw updateError;
        }
      } else {
        // Create new profile
        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert({
            ...profileData,
            created_at: new Date().toISOString(),
            account_status: 'active',
            email_verified: false,
            phone_verified: false,
            kyc_status: 'pending',
            metadata: {},
          });

        if (insertError) {
          throw insertError;
        }
      }

      onComplete();
    } catch (err: any) {
      console.error('Error saving profile:', err);
      setError(err.message || 'Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Complete Your Profile</DialogTitle>
          <DialogDescription>
            Please fill in your profile details to continue. All fields marked with * are required.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Personal Information</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="first_name">
                  First Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => handleInputChange('first_name', e.target.value)}
                  placeholder="Enter your first name"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="last_name">
                  Last Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => handleInputChange('last_name', e.target.value)}
                  placeholder="Enter your last name"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="phone">
                Phone Number <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-2">
                <div className="w-[120px]">
                  <CountryCodeSelector
                    value={formData.country_code}
                    onChange={(code) => handleInputChange('country_code', code)}
                    disabled={loading}
                  />
                </div>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="Enter your phone number"
                  required
                  disabled={loading}
                  className="flex-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="date_of_birth">Date of Birth</Label>
              <Input
                id="date_of_birth"
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => handleInputChange('date_of_birth', e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                placeholder="Tell us about yourself"
                rows={3}
                disabled={loading}
              />
            </div>
          </div>

          {/* Company Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Company Information</h3>
            
            <div>
              <Label htmlFor="company_name">
                Company Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="company_name"
                value={formData.company_name}
                onChange={(e) => handleInputChange('company_name', e.target.value)}
                placeholder="Enter your company name"
                required
                disabled={loading}
              />
            </div>

            <div>
              <Label htmlFor="company_address">Company Address</Label>
              <Textarea
                id="company_address"
                value={formData.company_address}
                onChange={(e) => handleInputChange('company_address', e.target.value)}
                placeholder="Enter your company address"
                rows={2}
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="company_website">Company Website</Label>
                <Input
                  id="company_website"
                  type="url"
                  value={formData.company_website}
                  onChange={(e) => handleInputChange('company_website', e.target.value)}
                  placeholder="https://example.com"
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="company_registration_number">Registration Number</Label>
                <Input
                  id="company_registration_number"
                  value={formData.company_registration_number}
                  onChange={(e) => handleInputChange('company_registration_number', e.target.value)}
                  placeholder="Enter registration number"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="company_tax_id">Tax ID</Label>
              <Input
                id="company_tax_id"
                value={formData.company_tax_id}
                onChange={(e) => handleInputChange('company_tax_id', e.target.value)}
                placeholder="Enter tax ID"
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="submit"
              disabled={loading}
              className="min-w-[120px]"
            >
              {loading ? 'Saving...' : 'Save & Continue'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileCompletionDialog;
