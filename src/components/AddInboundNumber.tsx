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
  Stack,
  Chip,
  Typography,
} from '@mui/material';
import {
  Info as InfoIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import CountryCodeSelector from './CountryCodeSelector';
import { NotificationHelpers } from '../services/notificationService';

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
  provider_api_key?: string | null;
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
  const [provider, setProvider] = useState<'twilio' | 'vonage' | 'telnyx'>(
    'twilio'
  );
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;

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
    // Telnyx
    telnyxApiKey: '',
  });

  useEffect(() => {
    setCurrentStep(1);
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
        telnyxApiKey: editingNumber.provider_api_key || '',
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
        telnyxApiKey: '',
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

  // Check if all required fields are filled for the selected provider
  const getRequiredFields = (): { label: string; filled: boolean }[] => {
    const fields: { label: string; filled: boolean }[] = [
      { label: 'Provider', filled: !!provider },
      { label: 'Phone Number', filled: formData.phoneNumber.length === 10 },
    ];

    if (provider === 'twilio') {
      fields.push({ label: 'Twilio Auth Token', filled: !!formData.twilioAuthToken.trim() });
    } else if (provider === 'vonage') {
      fields.push({ label: 'Vonage API Key', filled: !!formData.vonageApiKey.trim() });
      fields.push({ label: 'Vonage API Secret', filled: !!formData.vonageApiSecret.trim() });
    } else if (provider === 'telnyx') {
      fields.push({ label: 'Telnyx API Key', filled: !!formData.telnyxApiKey.trim() });
    }

    return fields;
  };

  const requiredFields = getRequiredFields();
  const filledCount = requiredFields.filter((f) => f.filled).length;
  const totalRequired = requiredFields.length;
  const progressPercent = totalRequired > 0 ? Math.round((filledCount / totalRequired) * 100) : 0;
  const isFormValid = filledCount === totalRequired;

  // Per-step validation
  const isStep1Valid = !!provider;
  const isStep2Valid = formData.phoneNumber.length === 10;
  const isCurrentStepValid = currentStep === 1 ? isStep1Valid : currentStep === 2 ? isStep2Valid : isFormValid;

  const stepLabels = ['Provider', 'Phone Details', 'Configuration'];

  const handleNext = () => {
    setError(null);
    if (currentStep === 1 && !isStep1Valid) {
      setError('Please select a provider');
      return;
    }
    if (currentStep === 2 && !isStep2Valid) {
      if (formData.phoneNumber.length !== 10) {
        setError('Please enter a valid 10-digit phone number');
      } else {
        setError('Please enter a valid 10-digit call forwarding number');
      }
      return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
  };

  const handleBack = () => {
    setError(null);
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent double submission
    if (loading) {
      return;
    }
    
    if (!user) return;

    setLoading(true);
    setError(null);

    // Validate required fields
    if (!formData.phoneNumber) {
      setError('Phone number is required');
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

    if (provider === 'telnyx' && !formData.telnyxApiKey) {
      setError('Telnyx API Key is required');
      setLoading(false);
      return;
    }

    try {
      // Generate unique UUID for this inbound number import
      const inboundNumberId = crypto.randomUUID();

      // Combine country code with phone number
      const fullPhoneNumber = formData.countryCode + formData.phoneNumber.replace(/\D/g, '');
      const fullCallForwardingNumber = formData.callForwardingNumber 
        ? formData.countryCode + formData.callForwardingNumber.replace(/\D/g, '') 
        : null;

      // Prepare payload for webhook
      const webhookPayload: any = {
        id: inboundNumberId, // Unique UUID for this inbound number import
        provider,
        phone_number: fullPhoneNumber, // Phone number with country code
        country_code: formData.countryCode,
        label: formData.phoneLabel,
        call_forwarding_number: fullCallForwardingNumber || null, // Call forwarding number with country code (optional)
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
      } else if (provider === 'telnyx') {
        webhookPayload.telnyx_api_key = formData.telnyxApiKey;
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
        call_forwarding_number: fullCallForwardingNumber || null, // Store full call forwarding number with country code (optional)
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
      } else if (provider === 'telnyx') {
        dbRecord.provider_api_key = formData.telnyxApiKey;
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

        // For new numbers, set status to 'activating' - backend will change to 'active' when ready
        if (!editingNumber) {
          dbRecord.status = 'activating';
        }

        // No duplicate - proceed with insert
        const { data: insertedData, error: insertError } = await supabase.from('inbound_numbers').insert(dbRecord).select().single();

        if (insertError) {
          // Check if it's a unique constraint violation for phone_number
          if (insertError.code === '23505' || insertError.message?.includes('inbound_numbers_phone_number_key') || insertError.message?.includes('duplicate key value violates unique constraint')) {
            // Try to fetch the existing record (could be from any user)
            const { data: existingData2, error: fetchError } = await supabase
              .from('inbound_numbers')
              .select('*, assigned_to_agent_id')
              .eq('phone_number', fullPhoneNumber)
              .maybeSingle();

            if (!fetchError && existingData2) {
              // Check if it's assigned to an agent
              if (existingData2.assigned_to_agent_id) {
                // Fetch the agent name
                const { data: agentData, error: agentError } = await supabase
                  .from('voice_agents')
                  .select('name')
                  .eq('id', existingData2.assigned_to_agent_id)
                  .maybeSingle();

                const agentName = agentData?.name || 'another agent';
                setError(`This phone number is already in use by "${agentName}". Please use a different number or contact support if you believe this is an error.`);
                setLoading(false);
                return;
              }

              // If it's the same user, show the duplicate dialog
              if (existingData2.user_id === user.id) {
                setExistingRecord(existingData2);
                setPendingDbRecord(dbRecord);
                setPendingWebhookPayload(webhookPayload);
                setDuplicateDialogOpen(true);
                setLoading(false);
                return;
              } else {
                // Different user owns this number
                setError('This phone number is already in use by another account. Please use a different number.');
                setLoading(false);
                return;
              }
            } else {
              // Couldn't fetch the existing record, show generic message
              setError('This phone number is already in use. Please use a different number.');
              setLoading(false);
              return;
            }
          }
          
          // Check if it's a user-specific unique constraint violation
          if (insertError.message?.includes('inbound_numbers_user_phone_unique')) {
            // Try to fetch the existing record
            const { data: existingData2, error: fetchError } = await supabase
              .from('inbound_numbers')
              .select('*')
              .eq('user_id', user.id)
              .eq('phone_number', fullPhoneNumber)
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

        // Send notification for number import
        if (!editingNumber && insertedData && user) {
          try {
            await NotificationHelpers.numberImported(
              user.id,
              insertedData.phone_number,
              insertedData.phone_label || undefined
            );
          } catch (notifError) {
            console.error('Error sending notification:', notifError);
            // Don't fail the import if notification fails
          }
        }

        // Status will be changed to 'active' by n8n backend when ready
        // No need for client-side timer
      }

      onSuccess();
    } catch (err: any) {
      console.error('Error saving inbound number:', err);
      
      // Check if it's a unique constraint violation for phone_number
      if (err.code === '23505' || err.message?.includes('inbound_numbers_phone_number_key') || err.message?.includes('duplicate key value violates unique constraint')) {
        // Try to fetch the existing record and agent info
        try {
          const { data: existingData, error: fetchError } = await supabase
            .from('inbound_numbers')
            .select('*, assigned_to_agent_id')
            .eq('phone_number', formData.countryCode + formData.phoneNumber.replace(/\D/g, ''))
            .maybeSingle();

          if (!fetchError && existingData) {
            if (existingData.assigned_to_agent_id) {
              // Fetch the agent name
              const { data: agentData } = await supabase
                .from('voice_agents')
                .select('name')
                .eq('id', existingData.assigned_to_agent_id)
                .maybeSingle();

              const agentName = agentData?.name || 'another agent';
              setError(`This phone number is already in use by "${agentName}". Please use a different number or contact support if you believe this is an error.`);
            } else {
              setError('This phone number is already in use. Please use a different number.');
            }
          } else {
            setError('This phone number is already in use. Please use a different number.');
          }
        } catch (fetchErr) {
          setError('This phone number is already in use. Please use a different number.');
        }
      } else {
        setError(err.message || 'Failed to save inbound number');
      }
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
        <DialogTitle sx={{ fontSize: '1.5rem', fontWeight: 600, pb: 0, fontFamily: "'Manrope', sans-serif" }}>
          {editingNumber ? 'Edit Inbound Number' : 'Import Inbound Number'}
        </DialogTitle>
        
        {/* Progress Bar + Step Indicator */}
        <Box sx={{ px: 3, pt: 2, pb: 1 }}>
          {/* Overall progress */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 600, color: isFormValid ? '#00c19c' : 'text.secondary', fontFamily: "'Manrope', sans-serif" }}>
              {isFormValid ? 'All fields complete — ready to import!' : `${filledCount} of ${totalRequired} required fields filled`}
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 700, color: isFormValid ? '#00c19c' : 'text.secondary', fontFamily: "'Manrope', sans-serif" }}>
              {progressPercent}%
            </Typography>
          </Box>
          <Box sx={{ width: '100%', height: 6, bgcolor: 'action.disabledBackground', borderRadius: 3, overflow: 'hidden', mb: 2 }}>
            <Box sx={{ width: `${progressPercent}%`, height: '100%', bgcolor: isFormValid ? '#00c19c' : progressPercent > 50 ? '#f59e0b' : '#ef4444', borderRadius: 3, transition: 'width 0.4s ease, background-color 0.4s ease' }} />
          </Box>

          {/* Step indicator */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
            {[1, 2, 3].map((step) => (
              <React.Fragment key={step}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: step < currentStep ? 'pointer' : 'default' }} onClick={() => { if (step < currentStep) setCurrentStep(step); }}>
                  <Box sx={{
                    width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: currentStep >= step ? '#00c19c' : 'action.disabledBackground',
                    color: currentStep >= step ? 'white' : 'text.secondary',
                    fontWeight: 700, fontSize: '0.8rem', fontFamily: "'Manrope', sans-serif",
                    transition: 'all 0.3s',
                  }}>
                    {step < currentStep ? '✓' : step}
                  </Box>
                  <Typography variant="caption" sx={{
                    fontSize: '0.75rem', fontWeight: currentStep === step ? 700 : 500,
                    color: currentStep >= step ? 'text.primary' : 'text.secondary',
                    fontFamily: "'Manrope', sans-serif",
                  }}>
                    {stepLabels[step - 1]}
                  </Typography>
                </Box>
                {step < 3 && (
                  <Box sx={{ width: 40, height: 2, bgcolor: currentStep > step ? '#00c19c' : 'action.disabledBackground', mx: 1, transition: 'background-color 0.3s' }} />
                )}
              </React.Fragment>
            ))}
          </Box>
        </Box>

        <DialogContent sx={{ pt: 2 }}>
          {webhookLoading && (
            <Alert severity="info" sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <CircularProgress size={20} />
                <Typography>Waiting for webhook response...</Typography>
              </Box>
            </Alert>
          )}

          {webhookMessage.type && !webhookLoading && (
            <Alert severity={webhookMessage.type === 'success' ? 'success' : 'error'} sx={{ mb: 3 }} onClose={() => setWebhookMessage({ type: null, message: '' })}>
              {webhookMessage.message}
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, fontFamily: "'Manrope', sans-serif", minHeight: 350 }}>

            {/* Step 1: Provider Selection */}
            {currentStep === 1 && (
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 3, bgcolor: 'background.paper' }}>
                <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600, mb: 1, fontFamily: "'Manrope', sans-serif" }}>
                  Select Provider
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem', mb: 2, fontFamily: "'Manrope', sans-serif" }}>
                  Choose your phone service provider to configure the inbound number.
                </Typography>
                <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5, bgcolor: 'action.hover', minHeight: 48, display: 'flex', alignItems: 'center' }}>
                  <TextField
                    select name="provider" value={provider}
                    onChange={(e) => setProvider(e.target.value as any)}
                    fullWidth required variant="standard"
                    InputProps={{ disableUnderline: true }}
                    sx={{ '& .MuiInputBase-root': { fontSize: '1rem', fontFamily: "'Manrope', sans-serif", fontWeight: 500 }, '& .MuiSelect-select': { py: 0 } }}
                  >
                    <MenuItem value="twilio">Twilio</MenuItem>
                    <MenuItem value="vonage">Vonage</MenuItem>
                    <MenuItem value="telnyx">Telnyx</MenuItem>
                  </TextField>
                </Box>
              </Box>
            )}

            {/* Step 2: Phone Details */}
            {currentStep === 2 && (
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 3, bgcolor: 'background.paper' }}>
                <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600, mb: 1, fontFamily: "'Manrope', sans-serif" }}>
                  Phone Details
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem', mb: 2, fontFamily: "'Manrope', sans-serif" }}>
                  Enter the phone number and call forwarding information.
                </Typography>
                <Stack spacing={3}>
                  <Box>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 500, mb: 1, color: 'text.secondary', fontFamily: "'Manrope', sans-serif" }}>
                      Phone Number: <span style={{ color: '#ef4444' }}>*</span>
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <CountryCodeSelector value={formData.countryCode} onChange={handleCountryCodeChange} />
                      <Box sx={{ flex: 1, border: '1px solid', borderColor: formData.phoneNumber.length === 10 ? '#00c19c' : 'divider', borderRadius: 1, p: 1.5, bgcolor: 'action.hover', minHeight: 48, display: 'flex', alignItems: 'center', transition: 'border-color 0.3s' }}>
                        <TextField name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} fullWidth required placeholder="1234567890" variant="standard" InputProps={{ disableUnderline: true }} inputProps={{ maxLength: 10, inputMode: 'numeric', pattern: '[0-9]*' }} sx={{ '& .MuiInputBase-root': { fontSize: '1rem', fontFamily: "'Manrope', sans-serif", fontWeight: 500 } }} />
                      </Box>
                    </Box>
                    <Typography variant="caption" sx={{ fontSize: '0.75rem', color: formData.phoneNumber.length === 10 ? '#00c19c' : 'text.secondary', mt: 0.5, fontFamily: "'Manrope', sans-serif" }}>
                      {formData.phoneNumber.length}/10 digits {formData.phoneNumber.length === 10 && '✓'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 500, mb: 1, color: 'text.secondary', fontFamily: "'Manrope', sans-serif" }}>Label (Optional):</Typography>
                    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5, bgcolor: 'action.hover', minHeight: 48, display: 'flex', alignItems: 'center' }}>
                      <TextField name="phoneLabel" value={formData.phoneLabel} onChange={handleChange} fullWidth placeholder="e.g., Main Business Line" variant="standard" InputProps={{ disableUnderline: true }} sx={{ '& .MuiInputBase-root': { fontSize: '1rem', fontFamily: "'Manrope', sans-serif", fontWeight: 500 } }} />
                    </Box>
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 500, mb: 1, color: 'text.secondary', fontFamily: "'Manrope', sans-serif" }}>
                      Call Forwarding Number (Optional):
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <CountryCodeSelector value={formData.countryCode} onChange={(code) => setFormData((prev) => ({ ...prev, countryCode: code }))} />
                      <Box sx={{ flex: 1, border: '1px solid', borderColor: formData.callForwardingNumber.length === 10 || formData.callForwardingNumber.length === 0 ? '#00c19c' : 'divider', borderRadius: 1, p: 1.5, bgcolor: 'action.hover', minHeight: 48, display: 'flex', alignItems: 'center', transition: 'border-color 0.3s' }}>
                        <TextField name="callForwardingNumber" value={formData.callForwardingNumber} onChange={handleChange} fullWidth placeholder="Number to forward calls to (optional)" variant="standard" InputProps={{ disableUnderline: true }} inputProps={{ maxLength: 10, inputMode: 'numeric', pattern: '[0-9]*' }} sx={{ '& .MuiInputBase-root': { fontSize: '1rem', fontFamily: "'Manrope', sans-serif", fontWeight: 500 } }} />
                      </Box>
                    </Box>
                    {formData.callForwardingNumber.length > 0 && (
                      <Typography variant="caption" sx={{ fontSize: '0.75rem', color: formData.callForwardingNumber.length === 10 ? '#00c19c' : 'text.secondary', mt: 0.5, fontFamily: "'Manrope', sans-serif" }}>
                        {formData.callForwardingNumber.length}/10 digits {formData.callForwardingNumber.length === 10 && '✓'}
                      </Typography>
                    )}
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 500, mb: 1, color: 'text.secondary', fontFamily: "'Manrope', sans-serif" }}>Call Transfer Reason (Optional):</Typography>
                    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5, bgcolor: 'action.hover', minHeight: 80 }}>
                      <TextField name="callTransferReason" value={formData.callTransferReason} onChange={handleChange} fullWidth multiline rows={2} placeholder="e.g., Transfer when agent is unavailable" variant="standard" InputProps={{ disableUnderline: true }} sx={{ '& .MuiInputBase-root': { fontSize: '1rem', fontFamily: "'Manrope', sans-serif" } }} />
                    </Box>
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 500, mb: 1, color: 'text.secondary', fontFamily: "'Manrope', sans-serif" }}>Status:</Typography>
                    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5, bgcolor: 'action.hover', minHeight: 48, display: 'flex', alignItems: 'center' }}>
                      <TextField select name="status" value={formData.status} onChange={handleChange} fullWidth variant="standard" InputProps={{ disableUnderline: true }} sx={{ '& .MuiInputBase-root': { fontSize: '1rem', fontFamily: "'Manrope', sans-serif", fontWeight: 500 }, '& .MuiSelect-select': { py: 0 } }}>
                        <MenuItem value="active">Active</MenuItem>
                        <MenuItem value="pending">Pending</MenuItem>
                        <MenuItem value="suspended">Suspended</MenuItem>
                        <MenuItem value="inactive">Inactive</MenuItem>
                      </TextField>
                    </Box>
                  </Box>
                </Stack>
              </Box>
            )}

            {/* Step 3: Provider Configuration */}
            {currentStep === 3 && (
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 3, bgcolor: 'background.paper' }}>
                <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600, mb: 1, fontFamily: "'Manrope', sans-serif" }}>
                  {provider.charAt(0).toUpperCase() + provider.slice(1)} Configuration
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem', mb: 2, fontFamily: "'Manrope', sans-serif" }}>
                  Enter your provider API credentials.
                </Typography>
                <Stack spacing={3}>
                  {provider === 'twilio' && (<>
                    <Box>
                      <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 500, mb: 1, color: 'text.secondary', fontFamily: "'Manrope', sans-serif" }}>Twilio Account SID (Optional):</Typography>
                      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5, bgcolor: 'action.hover', minHeight: 48, display: 'flex', alignItems: 'center' }}>
                        <TextField name="twilioAccountSid" value={formData.twilioAccountSid} onChange={handleChange} fullWidth placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" variant="standard" InputProps={{ disableUnderline: true }} sx={{ '& .MuiInputBase-root': { fontSize: '1rem', fontFamily: "'Manrope', sans-serif", fontWeight: 500 } }} />
                      </Box>
                    </Box>
                    <Box>
                      <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 500, mb: 1, color: 'text.secondary', fontFamily: "'Manrope', sans-serif" }}>Twilio Auth Token: <span style={{ color: '#ef4444' }}>*</span></Typography>
                      <Box sx={{ border: '1px solid', borderColor: formData.twilioAuthToken.trim() ? '#00c19c' : 'divider', borderRadius: 1, p: 1.5, bgcolor: 'action.hover', minHeight: 48, display: 'flex', alignItems: 'center', transition: 'border-color 0.3s' }}>
                        <TextField name="twilioAuthToken" type="password" value={formData.twilioAuthToken} onChange={handleChange} fullWidth required placeholder="Your Twilio Auth Token" variant="standard" InputProps={{ disableUnderline: true }} sx={{ '& .MuiInputBase-root': { fontSize: '1rem', fontFamily: "'Manrope', sans-serif", fontWeight: 500 } }} />
                      </Box>
                    </Box>
                    <FormControlLabel control={<Checkbox name="smsEnabled" checked={formData.smsEnabled} onChange={handleChange} />} label="Enable SMS" sx={{ fontFamily: "'Manrope', sans-serif" }} />
                  </>)}
                  {provider === 'vonage' && (<>
                    <Box>
                      <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 500, mb: 1, color: 'text.secondary', fontFamily: "'Manrope', sans-serif" }}>Vonage API Key: <span style={{ color: '#ef4444' }}>*</span></Typography>
                      <Box sx={{ border: '1px solid', borderColor: formData.vonageApiKey.trim() ? '#00c19c' : 'divider', borderRadius: 1, p: 1.5, bgcolor: 'action.hover', minHeight: 48, display: 'flex', alignItems: 'center', transition: 'border-color 0.3s' }}>
                        <TextField name="vonageApiKey" value={formData.vonageApiKey} onChange={handleChange} fullWidth required variant="standard" InputProps={{ disableUnderline: true }} sx={{ '& .MuiInputBase-root': { fontSize: '1rem', fontFamily: "'Manrope', sans-serif", fontWeight: 500 } }} />
                      </Box>
                    </Box>
                    <Box>
                      <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 500, mb: 1, color: 'text.secondary', fontFamily: "'Manrope', sans-serif" }}>Vonage API Secret: <span style={{ color: '#ef4444' }}>*</span></Typography>
                      <Box sx={{ border: '1px solid', borderColor: formData.vonageApiSecret.trim() ? '#00c19c' : 'divider', borderRadius: 1, p: 1.5, bgcolor: 'action.hover', minHeight: 48, display: 'flex', alignItems: 'center', transition: 'border-color 0.3s' }}>
                        <TextField name="vonageApiSecret" type="password" value={formData.vonageApiSecret} onChange={handleChange} fullWidth required variant="standard" InputProps={{ disableUnderline: true }} sx={{ '& .MuiInputBase-root': { fontSize: '1rem', fontFamily: "'Manrope', sans-serif", fontWeight: 500 } }} />
                      </Box>
                    </Box>
                    <Box>
                      <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 500, mb: 1, color: 'text.secondary', fontFamily: "'Manrope', sans-serif" }}>Vonage Application ID (Optional):</Typography>
                      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5, bgcolor: 'action.hover', minHeight: 48, display: 'flex', alignItems: 'center' }}>
                        <TextField name="vonageApplicationId" value={formData.vonageApplicationId} onChange={handleChange} fullWidth variant="standard" InputProps={{ disableUnderline: true }} sx={{ '& .MuiInputBase-root': { fontSize: '1rem', fontFamily: "'Manrope', sans-serif", fontWeight: 500 } }} />
                      </Box>
                    </Box>
                  </>)}
                  {provider === 'telnyx' && (
                    <Box>
                      <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 500, mb: 1, color: 'text.secondary', fontFamily: "'Manrope', sans-serif" }}>Telnyx API Key: <span style={{ color: '#ef4444' }}>*</span></Typography>
                      <Box sx={{ border: '1px solid', borderColor: formData.telnyxApiKey.trim() ? '#00c19c' : 'divider', borderRadius: 1, p: 1.5, bgcolor: 'action.hover', minHeight: 48, display: 'flex', alignItems: 'center', transition: 'border-color 0.3s' }}>
                        <TextField name="telnyxApiKey" type="password" value={formData.telnyxApiKey} onChange={handleChange} fullWidth required variant="standard" InputProps={{ disableUnderline: true }} sx={{ '& .MuiInputBase-root': { fontSize: '1rem', fontFamily: "'Manrope', sans-serif", fontWeight: 500 } }} />
                      </Box>
                    </Box>
                  )}
                </Stack>

                {/* Credit Usage Info */}
                <Alert severity="info" sx={{ mt: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <InfoIcon sx={{ fontSize: 18 }} />
                    <Typography variant="body2" sx={{ fontFamily: "'Manrope', sans-serif" }}>
                      <strong>Credit Usage:</strong> Inbound calls will use <strong>3 credits per minute</strong> of call duration.
                    </Typography>
                  </Box>
                </Alert>
              </Box>
            )}
          </Box>
        </DialogContent>

        {/* Footer: Cancel / Back / Next or Import */}
        <DialogActions sx={{ p: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider', gap: 2, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={onClose} disabled={loading} size="large" sx={{ minWidth: 90, fontSize: '0.95rem', fontFamily: "'Manrope', sans-serif", textTransform: 'none' }}>
              Cancel
            </Button>
            {currentStep > 1 && (
              <Button onClick={handleBack} disabled={loading} size="large" startIcon={<ArrowBackIcon />} sx={{ minWidth: 110, fontSize: '0.95rem', fontFamily: "'Manrope', sans-serif", textTransform: 'none' }}>
                Back
              </Button>
            )}
          </Box>
          {currentStep < totalSteps ? (
            <Button
              onClick={handleNext}
              variant="contained"
              disabled={loading || !isCurrentStepValid}
              size="large"
              endIcon={<ArrowForwardIcon />}
              sx={{
                minWidth: 120, fontSize: '0.95rem', fontWeight: 600, fontFamily: "'Manrope', sans-serif", textTransform: 'none',
                bgcolor: isCurrentStepValid ? '#00c19c' : undefined,
                '&:hover': { bgcolor: isCurrentStepValid ? '#009e80' : undefined },
                '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'text.disabled' },
              }}
            >
              Next
            </Button>
          ) : (
            <Button
              type="submit"
              variant="contained"
              disabled={loading || !isFormValid}
              size="large"
              startIcon={loading ? undefined : <UploadIcon />}
              sx={{
                minWidth: 160, fontSize: '0.95rem', fontWeight: 600, fontFamily: "'Manrope', sans-serif", textTransform: 'none',
                bgcolor: isFormValid ? '#00c19c' : undefined,
                '&:hover': { bgcolor: isFormValid ? '#009e80' : undefined },
                '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'text.disabled' },
              }}
            >
              {loading ? <CircularProgress size={24} sx={{ color: 'white' }} /> : editingNumber ? 'Update Number' : 'Import Number'}
            </Button>
          )}
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
