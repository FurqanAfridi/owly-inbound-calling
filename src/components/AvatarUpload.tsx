import React, { useState, useRef, useEffect } from 'react';
import { User, Upload, X, Camera } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';

const AvatarUpload: React.FC = () => {
  const { user } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      loadAvatar();
    }
  }, [user]);

  const loadAvatar = async () => {
    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .single();

      if (profile?.avatar_url) {
        setAvatarUrl(profile.avatar_url);
        setPreview(profile.avatar_url);
      }
    } catch (err) {
      console.error('Error loading avatar:', err);
    }
  };

  const uploadAvatar = async (file: File): Promise<string> => {
    if (!user) throw new Error('User not found');

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/avatar-${Date.now()}.${fileExt}`;
    const filePath = fileName; // Path relative to bucket root (no bucket name prefix)

    // Delete old avatar if exists
    if (avatarUrl && avatarUrl.includes('/storage/v1/object/public/avatars/')) {
      const oldPath = avatarUrl.split('/avatars/')[1];
      if (oldPath) {
        await supabase.storage
          .from('avatars')
          .remove([oldPath]); // Use the full path from bucket root
      }
    }

    // Upload new avatar
    const { data, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      // If bucket doesn't exist, provide helpful error
      if (uploadError.message.includes('Bucket not found')) {
        throw new Error('Avatar storage bucket not found. Please create an "avatars" bucket in Supabase Storage.');
      }
      throw uploadError;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      setError('Invalid file type. Please upload JPG, PNG, WebP, or GIF images.');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    setError(null);
    setSuccess(null);
    setUploading(true);

    try {
      const url = await uploadAvatar(file);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ avatar_url: url })
        .eq('id', user?.id);

      if (updateError) {
        throw updateError;
      }

      setAvatarUrl(url);
      setSuccess('Avatar updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to upload avatar');
      setPreview(avatarUrl);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = async () => {
    if (!user || !avatarUrl) return;

    if (!window.confirm('Are you sure you want to remove your avatar?')) {
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Delete from storage if it's in Supabase storage
      if (avatarUrl.includes('/storage/v1/object/public/avatars/')) {
        const pathParts = avatarUrl.split('/avatars/');
        if (pathParts[1]) {
          await supabase.storage
            .from('avatars')
            .remove([pathParts[1]]); // Use the full path from bucket root
        }
      }

      // Remove from profile
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ avatar_url: null })
        .eq('id', user.id);

      if (updateError) {
        throw updateError;
      }

      setAvatarUrl(null);
      setPreview(null);
      setSuccess('Avatar removed successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to remove avatar');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <User className="w-5 h-5" />
          Profile Picture
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Upload a profile picture to personalize your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4" onClose={() => setError(null)}>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert variant="success" className="mb-4" onClose={() => setSuccess(null)}>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            {preview ? (
              <img
                src={preview}
                alt="Avatar"
                className="w-32 h-32 rounded-full object-cover border-4 border-border"
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-muted border-4 border-border flex items-center justify-center">
                <User className="w-16 h-16 text-muted-foreground" />
              </div>
            )}
            {preview && (
              <button
                onClick={handleRemove}
                disabled={uploading}
                className="absolute -top-2 -right-2 w-8 h-8 bg-destructive text-white rounded-full flex items-center justify-center hover:bg-destructive/90 transition-colors"
                title="Remove avatar"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-col items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
                  Uploading...
                </>
              ) : preview ? (
                <>
                  <Camera className="w-4 h-4 mr-2" />
                  Change Picture
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Picture
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              JPG, PNG, WebP, or GIF. Max 5MB
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AvatarUpload;
