import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Alert,
  CircularProgress,
  Divider,
  Stack,
  InputAdornment,
  Chip,
  Typography,
} from '@mui/material';
import {
  Phone as PhoneIcon,
  Business as ProviderIcon,
  ForwardToInbox as ForwardIcon,
  CheckCircle as StatusIcon,
  Settings as ConfigIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import CountryCodeSelector from './CountryCodeSelector';

interface InboundNumber {
  id: string;
  phone_number: string;
  country_code: string;
  phone_label: string | null;
  call_forwarding_number: string | null;
  provider: string;
  status: string;
  twilio_auth_token?: string | null;
  sms_enabled?: boolean;
  vonage_api_key?: string | null;
  vonage_api_secret?: string | null;
  callhippo_api_key?: string | null;
  callhippo_account_id?: string | null;
  provider_api_key?: string | null;
  provider_api_secret?: string | null;
  provider_webhook_url?: string | null;
}

interface AddInboundNumberProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingNumber?: InboundNumber | null;
}

const AddInboundNumber: React.FC<AddInboundNumberProps> = ({
  open,
  onClose,
  onSuccess,
  editingNumber,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookMessage, setWebhookMessage] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [error, setError] = useState<string | null>(null);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [existingRecord, setExistingRecord] = useState<InboundNumber | null>(null);
  const [pendingDbRecord, setPendingDbRecord] = useState<any>(null);
  const [pendingWebhookPayload, setPendingWebhookPayload] = useState<any>(null);
  const [provider, setProvider] = useState<'twilio' | 'vonage' | 'callhippo' | 'telnyx' | 'other'>(
    'twilio'
  );

  const [formData, setFormData] = useState({
    phoneNumber: '',
    countryCode: '+1',
    phoneLabel: '',
    callForwardingNumber: '',
    callTransferReason: '',
    status: 'active' as 'active' | 'suspended' | 'error' | 'pending' | 'inactive',
    // Twilio
    twilioAuthToken: '',
    twilioAccountSid: '',
    smsEnabled: false,
    // Vonage
    vonageApiKey: '',
    vonageApiSecret: '',
    vonageApplicationId: '',
    // CallHippo
    callhippoApiKey: '',
    callhippoAccountId: '',
    // Other/Generic
    providerApiKey: '',
    providerApiSecret: '',
    providerWebhookUrl: '',
  });

  useEffect(() => {
    if (editingNumber) {
      setProvider(editingNumber.provider as any);
      // Extract phone number without country code if it includes it
      const phoneNumberWithoutCode = editingNumber.phone_number.replace(editingNumber.country_code || '', '');
      setFormData({
        phoneNumber: phoneNumberWithoutCode,
        countryCode: editingNumber.country_code || '+1',
        phoneLabel: editingNumber.phone_label || '',
        callForwardingNumber: editingNumber.call_forwarding_number || '',
        callTransferReason: (editingNumber as any).metadata?.call_transfer_reason || '',
        status: editingNumber.status as any,
        twilioAuthToken: editingNumber.twilio_auth_token || '',
        twilioAccountSid: '',
        smsEnabled: editingNumber.sms_enabled || false,
        vonageApiKey: editingNumber.vonage_api_key || '',
        vonageApiSecret: editingNumber.vonage_api_secret || '',
        vonageApplicationId: '',
        callhippoApiKey: editingNumber.callhippo_api_key || '',
        callhippoAccountId: editingNumber.callhippo_account_id || '',
        providerApiKey: editingNumber.provider_api_key || '',
        providerApiSecret: editingNumber.provider_api_secret || '',
        providerWebhookUrl: editingNumber.provider_webhook_url || '',
      });
    } else {
      // Reset form for new number
      setProvider('twilio');
      setFormData({
        phoneNumber: '',
        countryCode: '+1',
        phoneLabel: '',
        callForwardingNumber: '',
        callTransferReason: '',
        status: 'active',
        twilioAuthToken: '',
        twilioAccountSid: '',
        smsEnabled: false,
        vonageApiKey: '',
        vonageApiSecret: '',
        vonageApplicationId: '',
        callhippoApiKey: '',
        callhippoAccountId: '',
        providerApiKey: '',
        providerApiSecret: '',
        providerWebhookUrl: '',
      });
    }
  }, [editingNumber, open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    // Restrict phone number fields to numbers only, max 10 digits
    if (name === 'phoneNumber' || name === 'callForwardingNumber') {
      // Remove all non-numeric characters
      const numericValue = value.replace(/\D/g, '');
      // Limit to 10 digits
      const limitedValue = numericValue.slice(0, 10);
      setFormData((prev) => ({
        ...prev,
        [name]: limitedValue,
      }));
      return;
    }
    
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleCountryCodeChange = (code: string) => {
    setFormData((prev) => ({ ...prev, countryCode: code }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError(null);

    // Validate required fields
    if (!formData.phoneNumber) {
      setError('Phone number is required');
      setLoading(false);
      return;
    }

    if (!formData.callForwardingNumber) {
      setError('Call forwarding number is required');
      setLoading(false);
      return;
    }

    // Validate provider-specific fields
    if (provider === 'twilio' && !formData.twilioAuthToken) {
      setError('Twilio Auth Token is required');
      setLoading(false);
      return;
    }

    if (provider === 'vonage' && (!formData.vonageApiKey || !formData.vonageApiSecret)) {
      setError('Vonage API Key and Secret are required');
      setLoading(false);
      return;
    }

    if (provider === 'callhippo' && !formData.callhippoApiKey) {
      setError('CallHippo API Key is required');
      setLoading(false);
      return;
    }

    if (provider === 'other' && (!formData.providerApiKey || !formData.providerWebhookUrl)) {
      setError('Provider API Key and Webhook URL are required for other providers');
      setLoading(false);
      return;
    }

    try {
      // Generate unique UUID for this inbound number import
      const inboundNumberId = crypto.randomUUID();

      // Combine country code with phone number
      const fullPhoneNumber = formData.countryCode + formData.phoneNumber.replace(/\D/g, '');
      const fullCallForwardingNumber = formData.countryCode + formData.callForwardingNumber.replace(/\D/g, '');

      // Prepare payload for webhook
      const webhookPayload: any = {
        id: inboundNumberId, // Unique UUID for this inbound number import
        provider,
        phone_number: fullPhoneNumber, // Phone number with country code
        country_code: formData.countryCode,
        label: formData.phoneLabel,
        call_forwarding_number: fullCallForwardingNumber, // Call forwarding number with country code
        call_transfer_reason: formData.callTransferReason, // Reason for call transfer
        user_id: user.id,
      };

      // Add provider-specific fields
      if (provider === 'twilio') {
        webhookPayload.twilio_auth_token = formData.twilioAuthToken;
        webhookPayload.twilio_account_sid = formData.twilioAccountSid;
        webhookPayload.sms_enabled = formData.smsEnabled;
      } else if (provider === 'vonage') {
        webhookPayload.vonage_api_key = formData.vonageApiKey;
        webhookPayload.vonage_api_secret = formData.vonageApiSecret;
        webhookPayload.vonage_application_id = formData.vonageApplicationId;
      } else if (provider === 'callhippo') {
        webhookPayload.callhippo_api_key = formData.callhippoApiKey;
        webhookPayload.callhippo_account_id = formData.callhippoAccountId;
      } else if (provider === 'telnyx') {
        webhookPayload.telnyx_api_key = formData.providerApiKey;
      } else if (provider === 'other') {
        webhookPayload.provider_api_key = formData.providerApiKey;
        webhookPayload.provider_api_secret = formData.providerApiSecret;
        webhookPayload.provider_webhook_url = formData.providerWebhookUrl;
      }

      // Call webhook first
      const phoneWebhookUrl = process.env.REACT_APP_PHONE_NUMBER_WEBHOOK_URL;
      if (!phoneWebhookUrl) {
        throw new Error('Phone number webhook URL is not configured');
      }

      // Show webhook loading state
      setWebhookLoading(true);
      setWebhookMessage({ type: null, message: '' });
      setError(null);

      console.log('Calling phone number webhook:', phoneWebhookUrl);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      let webhookResponse;
      let webhookResult;

      try {
        webhookResponse = await fetch(phoneWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(webhookPayload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!webhookResponse.ok) {
          const errorText = await webhookResponse.text().catch(() => 'No error details');
          const errorMessage = `Webhook failed: ${webhookResponse.status} - ${errorText}`;
          setWebhookMessage({ type: 'error', message: errorMessage });
          setWebhookLoading(false);
          throw new Error(errorMessage);
        }

        webhookResult = await webhookResponse.json().catch(() => ({}));
        
        // Show success message
        const successMessage = webhookResult.message || 'Phone number successfully added via webhook';
        setWebhookMessage({ type: 'success', message: successMessage });
        setWebhookLoading(false);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        setWebhookLoading(false);
        if (fetchError.name === 'AbortError') {
          const timeoutMessage = 'Webhook request timed out after 30 seconds';
          setWebhookMessage({ type: 'error', message: timeoutMessage });
          throw new Error(timeoutMessage);
        }
        // Error message already set above if it was a response error
        if (!webhookMessage.message) {
          setWebhookMessage({ type: 'error', message: fetchError.message || 'Failed to connect to webhook' });
        }
        throw fetchError;
      }

      // Prepare database record - use the same UUID generated for webhook
      // Update webhook_status based on webhook response
      const webhookStatus = webhookResult?.status || (webhookResponse?.ok ? 'active' : 'error');
      
      const dbRecord: any = {
        id: inboundNumberId, // Use the same UUID generated for webhook
        user_id: user.id,
        phone_number: fullPhoneNumber, // Store full number with country code
        country_code: formData.countryCode,
        phone_label: formData.phoneLabel || null,
        call_forwarding_number: fullCallForwardingNumber, // Store full call forwarding number with country code
        provider,
        status: formData.status,
        health_status: 'unknown',
        webhook_status: webhookStatus,
        last_webhook_test: new Date().toISOString(),
        webhook_test_result: webhookResult || {},
      };

      // Add provider-specific fields
      if (provider === 'twilio') {
        dbRecord.twilio_auth_token = formData.twilioAuthToken;
        dbRecord.twilio_account_sid = formData.twilioAccountSid || null;
        dbRecord.sms_enabled = formData.smsEnabled;
      } else if (provider === 'vonage') {
        dbRecord.vonage_api_key = formData.vonageApiKey;
        dbRecord.vonage_api_secret = formData.vonageApiSecret;
        dbRecord.vonage_application_id = formData.vonageApplicationId || null;
      } else if (provider === 'callhippo') {
        dbRecord.callhippo_api_key = formData.callhippoApiKey;
        dbRecord.callhippo_account_id = formData.callhippoAccountId || null;
      } else if (provider === 'telnyx') {
        dbRecord.provider_api_key = formData.providerApiKey;
      } else if (provider === 'other') {
        dbRecord.provider_api_key = formData.providerApiKey;
        dbRecord.provider_api_secret = formData.providerApiSecret || null;
        dbRecord.provider_webhook_url = formData.providerWebhookUrl;
      }

      // Store webhook result and call transfer reason in metadata
      dbRecord.metadata = {
        ...webhookResult,
        call_transfer_reason: formData.callTransferReason || null,
      };

      if (editingNumber) {
        // Update existing number
        const { error: updateError } = await supabase
          .from('inbound_numbers')
          .update({
            ...dbRecord,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingNumber.id);

        if (updateError) throw updateError;
      } else {
        // Check for duplicate phone number before inserting
        const { data: existingData, error: checkError } = await supabase
          .from('inbound_numbers')
          .select('*')
          .eq('user_id', user.id)
          .eq('phone_number', fullPhoneNumber)
          .is('deleted_at', null)
          .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') {
          // PGRST116 is "not found" which is fine, ignore other errors
          throw checkError;
        }

        if (existingData) {
          // Duplicate found - show confirmation dialog
          setExistingRecord(existingData);
          setPendingDbRecord(dbRecord);
          setPendingWebhookPayload(webhookPayload);
          setDuplicateDialogOpen(true);
          setLoading(false);
          return;
        }

        // No duplicate - proceed with insert
        const { error: insertError } = await supabase.from('inbound_numbers').insert(dbRecord);

        if (insertError) {
          // Check if it's a unique constraint violation
          if (insertError.message?.includes('inbound_numbers_user_phone_unique')) {
            // Try to fetch the existing record
            const { data: existingData2, error: fetchError } = await supabase
              .from('inbound_numbers')
              .select('*')
              .eq('user_id', user.id)
              .eq('phone_number', fullPhoneNumber)
              .is('deleted_at', null)
              .maybeSingle();

            if (!fetchError && existingData2) {
              setExistingRecord(existingData2);
              setPendingDbRecord(dbRecord);
              setPendingWebhookPayload(webhookPayload);
              setDuplicateDialogOpen(true);
              setLoading(false);
              return;
            }
          }
          throw insertError;
        }
      }

      onSuccess();
    } catch (err: any) {
      console.error('Error saving inbound number:', err);
      setError(err.message || 'Failed to save inbound number');
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicateConfirm = async () => {
    if (!user || !existingRecord || !pendingDbRecord || !pendingWebhookPayload) return;

    setLoading(true);
    setDuplicateDialogOpen(false);
    setError(null);

    try {
      // Call webhook first (same as before)
      const phoneWebhookUrl = process.env.REACT_APP_PHONE_NUMBER_WEBHOOK_URL;
      if (!phoneWebhookUrl) {
        throw new Error('Phone number webhook URL is not configured');
      }

      // Show webhook loading state
      setWebhookLoading(true);
      setWebhookMessage({ type: null, message: '' });
      setError(null);

      console.log('Calling phone number webhook for update:', phoneWebhookUrl);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      // Update webhook payload with existing record ID
      const updateWebhookPayload = {
        ...pendingWebhookPayload,
        id: existingRecord.id, // Use existing record ID
        is_update: true, // Flag to indicate this is an update
      };

      let webhookResponse;
      let webhookResult;

      try {
        webhookResponse = await fetch(phoneWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(updateWebhookPayload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!webhookResponse.ok) {
          const errorText = await webhookResponse.text().catch(() => 'No error details');
          const errorMessage = `Webhook failed: ${webhookResponse.status} - ${errorText}`;
          setWebhookMessage({ type: 'error', message: errorMessage });
          setWebhookLoading(false);
          throw new Error(errorMessage);
        }

        webhookResult = await webhookResponse.json().catch(() => ({}));
        
        // Show success message
        const successMessage = webhookResult.message || 'Phone number successfully updated via webhook';
        setWebhookMessage({ type: 'success', message: successMessage });
        setWebhookLoading(false);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        setWebhookLoading(false);
        if (fetchError.name === 'AbortError') {
          const timeoutMessage = 'Webhook request timed out after 30 seconds';
          setWebhookMessage({ type: 'error', message: timeoutMessage });
          throw new Error(timeoutMessage);
        }
        // Error message already set above if it was a response error
        if (!webhookMessage.message) {
          setWebhookMessage({ type: 'error', message: fetchError.message || 'Failed to connect to webhook' });
        }
        throw fetchError;
      }

      // Update webhook_status based on webhook response
      const webhookStatus = webhookResult?.status || (webhookResponse?.ok ? 'active' : 'error');

      // Update existing record instead of inserting
      // Remove id from pendingDbRecord to avoid overwriting the existing ID
      const { id, ...updateData } = pendingDbRecord;
      const { error: updateError } = await supabase
        .from('inbound_numbers')
        .update({
          ...updateData,
          webhook_status: webhookStatus,
          last_webhook_test: new Date().toISOString(),
          webhook_test_result: webhookResult || {},
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingRecord.id);

      if (updateError) throw updateError;

      // Clear pending data
      setExistingRecord(null);
      setPendingDbRecord(null);
      setPendingWebhookPayload(null);

      onSuccess();
    } catch (err: any) {
      console.error('Error updating duplicate inbound number:', err);
      setError(err.message || 'Failed to update inbound number');
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicateCancel = () => {
    setDuplicateDialogOpen(false);
    setExistingRecord(null);
    setPendingDbRecord(null);
    setPendingWebhookPayload(null);
  };

  return (
    <>
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle sx={{ fontSize: '1.5rem', fontWeight: 600, pb: 1 }}>
          {editingNumber ? 'Edit Inbound Number' : 'Add Inbound Number'}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Stack spacing={3.5}>
            {/* Provider Selection */}
            <TextField
              select
              label="Provider"
              name="provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value as any)}
              fullWidth
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <ProviderIcon color="action" />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiInputBase-root': {
                  fontSize: '1rem',
                },
                '& .MuiInputLabel-root': {
                  fontSize: '1rem',
                },
              }}
            >
              <MenuItem value="twilio">Twilio</MenuItem>
              <MenuItem value="vonage">Vonage</MenuItem>
              <MenuItem value="callhippo">CallHippo</MenuItem>
              <MenuItem value="telnyx">Telnyx</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </TextField>

            <Divider>
              <Chip icon={<PhoneIcon />} label="Phone Details" size="small" />
            </Divider>

            {/* Phone Number */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <CountryCodeSelector
                value={formData.countryCode}
                onChange={handleCountryCodeChange}
              />
              <TextField
                label="Phone Number"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleChange}
                fullWidth
                required
                placeholder="1234567890"
                inputProps={{
                  maxLength: 10,
                  inputMode: 'numeric',
                  pattern: '[0-9]*',
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PhoneIcon color="action" />
                    </InputAdornment>
                  ),
                }}
                helperText={`${formData.phoneNumber.length}/10 digits`}
                sx={{
                  '& .MuiInputBase-root': {
                    fontSize: '1rem',
                  },
                  '& .MuiInputLabel-root': {
                    fontSize: '1rem',
                  },
                }}
              />
            </Box>

            {/* Phone Label */}
            <TextField
              label="Label (Optional)"
              name="phoneLabel"
              value={formData.phoneLabel}
              onChange={handleChange}
              fullWidth
              placeholder="e.g., Main Business Line"
              helperText="A friendly name to identify this number"
              sx={{
                '& .MuiInputBase-root': {
                  fontSize: '1rem',
                },
                '& .MuiInputLabel-root': {
                  fontSize: '1rem',
                },
              }}
            />

            {/* Call Forwarding Number */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <CountryCodeSelector
                value={formData.countryCode}
                onChange={(code) => setFormData((prev) => ({ ...prev, countryCode: code }))}
              />
              <TextField
                label="Call Forwarding Number *"
                name="callForwardingNumber"
                value={formData.callForwardingNumber}
                onChange={handleChange}
                fullWidth
                required
                placeholder="Number to forward calls to"
                inputProps={{
                  maxLength: 10,
                  inputMode: 'numeric',
                  pattern: '[0-9]*',
                }}
                helperText={`${formData.callForwardingNumber.length}/10 digits - Incoming calls will be forwarded to this number`}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <ForwardIcon color="action" />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiInputBase-root': {
                    fontSize: '1rem',
                  },
                  '& .MuiInputLabel-root': {
                    fontSize: '1rem',
                  },
                }}
              />
            </Box>

            {/* Call Transfer Reason */}
            <TextField
              label="Call Transfer Reason"
              name="callTransferReason"
              value={formData.callTransferReason}
              onChange={handleChange}
              fullWidth
              multiline
              rows={3}
              placeholder="e.g., Transfer calls when agent is unavailable, Transfer after business hours, Transfer for technical support"
              helperText="Describe when and why calls should be transferred to the forwarding number"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <InfoIcon color="action" />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiInputBase-root': {
                  fontSize: '1rem',
                },
                '& .MuiInputLabel-root': {
                  fontSize: '1rem',
                },
              }}
            />

            {/* Status */}
            <TextField
              select
              label="Status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <StatusIcon color="action" />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiInputBase-root': {
                  fontSize: '1rem',
                },
                '& .MuiInputLabel-root': {
                  fontSize: '1rem',
                },
              }}
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="suspended">Suspended</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
              <MenuItem value="error">Error</MenuItem>
            </TextField>

            <Divider>
              <Chip icon={<ConfigIcon />} label="Provider Configuration" size="small" />
            </Divider>

            {provider === 'twilio' && (
              <>
                <TextField
                  label="Twilio Account SID"
                  name="twilioAccountSid"
                  value={formData.twilioAccountSid}
                  onChange={handleChange}
                  fullWidth
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                />
                <TextField
                  label="Twilio Auth Token"
                  name="twilioAuthToken"
                  type="password"
                  value={formData.twilioAuthToken}
                  onChange={handleChange}
                  fullWidth
                  required
                  placeholder="Your Twilio Auth Token"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      name="smsEnabled"
                      checked={formData.smsEnabled}
                      onChange={handleChange}
                    />
                  }
                  label="Enable SMS"
                />
              </>
            )}

            {provider === 'vonage' && (
              <>
                <TextField
                  label="Vonage API Key"
                  name="vonageApiKey"
                  value={formData.vonageApiKey}
                  onChange={handleChange}
                  fullWidth
                  required
                />
                <TextField
                  label="Vonage API Secret"
                  name="vonageApiSecret"
                  type="password"
                  value={formData.vonageApiSecret}
                  onChange={handleChange}
                  fullWidth
                  required
                />
                <TextField
                  label="Vonage Application ID (Optional)"
                  name="vonageApplicationId"
                  value={formData.vonageApplicationId}
                  onChange={handleChange}
                  fullWidth
                />
              </>
            )}

            {provider === 'callhippo' && (
              <>
                <TextField
                  label="CallHippo API Key"
                  name="callhippoApiKey"
                  type="password"
                  value={formData.callhippoApiKey}
                  onChange={handleChange}
                  fullWidth
                  required
                />
                <TextField
                  label="CallHippo Account ID (Optional)"
                  name="callhippoAccountId"
                  value={formData.callhippoAccountId}
                  onChange={handleChange}
                  fullWidth
                />
              </>
            )}

            {provider === 'telnyx' && (
              <TextField
                label="Telnyx API Key"
                name="providerApiKey"
                type="password"
                value={formData.providerApiKey}
                onChange={handleChange}
                fullWidth
                required
              />
            )}

            {provider === 'other' && (
              <>
                <TextField
                  label="API Key"
                  name="providerApiKey"
                  type="password"
                  value={formData.providerApiKey}
                  onChange={handleChange}
                  fullWidth
                  required
                />
                <TextField
                  label="API Secret (Optional)"
                  name="providerApiSecret"
                  type="password"
                  value={formData.providerApiSecret}
                  onChange={handleChange}
                  fullWidth
                />
                <TextField
                  label="Webhook URL"
                  name="providerWebhookUrl"
                  value={formData.providerWebhookUrl}
                  onChange={handleChange}
                  fullWidth
                  required
                  placeholder="https://example.com/webhook"
                />
              </>
            )}

            {/* Credit Usage Info */}
            <Alert severity="info" sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <InfoIcon sx={{ fontSize: 18 }} />
                <Typography variant="body2">
                  <strong>Credit Usage:</strong> Inbound calls will use{' '}
                  <strong>3 credits per minute</strong> of call duration.
                </Typography>
              </Box>
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button 
            onClick={onClose} 
            disabled={loading}
            size="large"
            sx={{ minWidth: 100, fontSize: '1rem' }}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            variant="contained" 
            disabled={loading}
            size="large"
            sx={{ minWidth: 140, fontSize: '1rem', fontWeight: 600 }}
          >
            {loading ? <CircularProgress size={24} /> : editingNumber ? 'Update' : 'Import'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>

      {/* Duplicate Confirmation Dialog */}
      <Dialog 
        open={duplicateDialogOpen} 
        onClose={handleDuplicateCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontSize: '1.5rem', fontWeight: 600, pb: 1 }}>
          Duplicate Phone Number Found
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            A phone number with the same number already exists in your account.
          </Alert>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Existing Record:
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 500, mb: 1 }}>
              {existingRecord?.phone_number} - {existingRecord?.phone_label || 'No label'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Provider: {existingRecord?.provider} | Status: {existingRecord?.status}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Would you like to update the existing record with the new information?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button 
            onClick={handleDuplicateCancel} 
            disabled={loading}
            size="large"
            sx={{ minWidth: 100, fontSize: '1rem' }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDuplicateConfirm}
            variant="contained" 
            disabled={loading}
            size="large"
            sx={{ minWidth: 140, fontSize: '1rem', fontWeight: 600 }}
          >
            {loading ? <CircularProgress size={24} /> : 'Update Existing'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AddInboundNumber;
