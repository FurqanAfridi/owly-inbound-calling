import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Box,
  Typography,
} from '@mui/material';
import { Mail, Send } from '@mui/icons-material';
import { supabase } from '../lib/supabase';
import { convertToHtmlEmail, EmailDesignStyle } from '../lib/htmlEmail';

interface SendEmailDialogProps {
  open: boolean;
  onClose: () => void;
  agentId: string | null;
  recipientEmail?: string;
  recipientName?: string;
  recipientPhone?: string;
  callDate?: string;
  callTranscript?: string;
}

const SendEmailDialog: React.FC<SendEmailDialogProps> = ({
  open,
  onClose,
  agentId,
  recipientEmail = '',
  recipientName = '',
  recipientPhone = '',
  callDate = '',
  callTranscript = '',
}) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [toEmail, setToEmail] = useState(recipientEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [agentInfo, setAgentInfo] = useState<{ name: string; company_name: string | null } | null>(null);

  // Fetch agent info when dialog opens
  useEffect(() => {
    if (open && agentId) {
      fetchAgentInfo();
    }
  }, [open, agentId]);

  // Update toEmail when recipientEmail changes
  useEffect(() => {
    if (recipientEmail) {
      setToEmail(recipientEmail);
    }
  }, [recipientEmail]);

  // Auto-fill subject and body when dialog opens
  useEffect(() => {
    if (open && recipientName) {
      const defaultSubject = `Follow-up: ${recipientName}`;
      const defaultBody = `Hello ${recipientName || 'there'},

Thank you for your interest. We wanted to follow up on our recent conversation${callDate ? ` on ${new Date(callDate).toLocaleDateString()}` : ''}.

${callTranscript ? `Based on our conversation:\n\n${callTranscript.substring(0, 500)}${callTranscript.length > 500 ? '...' : ''}\n\n` : ''}Please let us know if you have any questions or would like to schedule a follow-up call.

Best regards`;
      setSubject(defaultSubject);
      setBody(defaultBody);
    }
  }, [open, recipientName, callDate, callTranscript]);

  const fetchAgentInfo = async () => {
    if (!agentId) return;
    try {
      const { data, error } = await supabase
        .from('voice_agents')
        .select('name, company_name')
        .eq('id', agentId)
        .single();

      if (error) throw error;
      setAgentInfo(data);
    } catch (err: any) {
      console.error('Error fetching agent info:', err);
    }
  };

  const handleSend = async () => {
    if (!agentId) {
      setError('Agent ID is required');
      return;
    }

    if (!toEmail.trim()) {
      setError('Recipient email is required');
      return;
    }

    if (!subject.trim()) {
      setError('Subject is required');
      return;
    }

    if (!body.trim()) {
      setError('Message body is required');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(toEmail.trim())) {
      setError('Invalid email format');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Convert body to HTML email
      const htmlBody = convertToHtmlEmail(
        subject,
        body,
        {
          previewMode: false,
          style: 'modern' as EmailDesignStyle,
          accentColor: '#00c19c',
          companyName: agentInfo?.company_name || '',
        }
      );

      // Get backend URL
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';
      const cleanBackendUrl = backendUrl.replace(/\/$/, '');
      const emailEndpoint = `${cleanBackendUrl}/api/send-agent-email`;

      const response = await fetch(emailEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agent_id: agentId,
          to_email: toEmail.trim(),
          subject: subject.trim(),
          body: body.trim(),
          html_body: htmlBody,
          design_style: 'modern',
          accent_color: '#00c19c',
          company_name: agentInfo?.company_name || '',
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to send email');
      }

      setSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to send email');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSubject('');
    setBody('');
    setToEmail(recipientEmail);
    setError(null);
    setSuccess(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontFamily: "'Manrope', sans-serif", display: 'flex', alignItems: 'center', gap: 1 }}>
        <Mail sx={{ color: '#00c19c' }} />
        Send Email
        {agentInfo && (
          <Typography variant="body2" color="text.secondary" sx={{ ml: 1, fontSize: '0.875rem' }}>
            (via {agentInfo.name})
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success">
              Email sent successfully!
            </Alert>
          )}

          <TextField
            label="To Email"
            type="email"
            value={toEmail}
            onChange={(e) => setToEmail(e.target.value)}
            fullWidth
            required
            disabled={loading}
            placeholder="recipient@example.com"
          />

          <TextField
            label="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            fullWidth
            required
            disabled={loading}
            placeholder="Email subject"
          />

          <TextField
            label="Message"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            fullWidth
            required
            multiline
            rows={10}
            disabled={loading}
            placeholder="Write your email message here..."
            sx={{ fontFamily: "'Manrope', sans-serif" }}
          />

          {recipientName && (
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "'Manrope', sans-serif" }}>
              Recipient: {recipientName} {recipientPhone && `(${recipientPhone})`}
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={loading} sx={{ fontFamily: "'Manrope', sans-serif" }}>
          Cancel
        </Button>
        <Button
          onClick={handleSend}
          variant="contained"
          disabled={loading || !toEmail.trim() || !subject.trim() || !body.trim()}
          startIcon={loading ? <CircularProgress size={20} /> : <Send />}
          sx={{
            fontFamily: "'Manrope', sans-serif",
            bgcolor: '#00c19c',
            '&:hover': { bgcolor: '#009e80' },
          }}
        >
          {loading ? 'Sending...' : 'Send Email'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SendEmailDialog;
