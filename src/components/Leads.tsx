import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  TextField,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Stack,
  Tooltip,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  PersonAdd as LeadIcon,
  Phone as PhoneIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Download as DownloadIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
  AccessTime as TimeIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import StyledCard from './ui/StyledCard';
import { useTheme } from '@mui/material';

interface LeadRecord {
  id: string;
  user_id: string;
  agent_id: string | null;
  inbound_number_id: string | null;
  caller_number: string | null;
  called_number: string | null;
  call_status: string | null;
  call_duration: number | null;
  call_start_time: string | null;
  call_end_time: string | null;
  call_answered_time: string | null;
  recording_url: string | null;
  transcript: string | null;
  call_forwarded_to: string | null;
  call_cost: number | null;
  notes: string | null;
  metadata: any;
  is_lead: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

const Leads: React.FC = () => {
  const { user } = useAuth();
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadRecord | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  
  // Filters
  const [timeFilter, setTimeFilter] = useState<'24h' | '7days' | '30days' | 'all'>('30days');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [numberFilter, setNumberFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([]);
  const [inboundNumbers, setInboundNumbers] = useState<Array<{ id: string; phone_number: string; phone_label: string | null }>>([]);

  useEffect(() => {
    if (user) {
      loadAgents();
      loadInboundNumbers();
      fetchLeads();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchLeads();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, timeFilter, agentFilter, numberFilter]);

  const getDateRange = () => {
    const now = new Date();
    const ranges = {
      '24h': new Date(now.getTime() - 24 * 60 * 60 * 1000),
      '7days': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      '30days': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      'all': new Date(0), // Beginning of time
    };
    return ranges[timeFilter];
  };

  const loadAgents = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('voice_agents')
        .select('id, name')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAgents(data || []);
    } catch (err: any) {
      console.error('Error loading agents:', err);
    }
  };

  const loadInboundNumbers = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('inbound_numbers')
        .select('id, phone_number, phone_label')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setInboundNumbers(data || []);
    } catch (err: any) {
      console.error('Error loading inbound numbers:', err);
    }
  };

  const fetchLeads = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const startDate = getDateRange().toISOString();
      
      // Query call_history table - filter for is_lead = true
      // Note: We filter in Supabase first, then also filter in JS to handle any type variations
      let query = supabase
        .from('call_history')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('call_start_time', { ascending: false });

      if (timeFilter !== 'all') {
        query = query.gte('call_start_time', startDate);
      }

      if (agentFilter !== 'all') {
        query = query.eq('agent_id', agentFilter);
      }

      if (numberFilter !== 'all') {
        const selectedNumber = inboundNumbers.find(n => n.id === numberFilter);
        if (selectedNumber) {
          query = query.eq('called_number', selectedNumber.phone_number);
        }
      }

      const { data: allData, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // Filter for leads - handle boolean, string, and number variations
      const leadsData = (allData || []).filter((call: any) => {
        const val = call.is_lead;
        return val === true || val === 'true' || val === 1 || val === 't';
      });

      setLeads(leadsData);
    } catch (err: any) {
      console.error('Error fetching leads:', err);
      setError(err.message || 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number | null): string => {
    if (!seconds || seconds === 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getStatusChip = (status: string | null) => {
    if (!status) return <Chip label="Unknown" color="default" size="small" />;
    const config: {
      [key: string]: { label: string; color: 'success' | 'error' | 'info' | 'warning' | 'default'; icon?: React.ReactElement };
    } = {
      answered: { label: 'Answered', color: 'success' as const, icon: <CheckCircleIcon /> },
      missed: { label: 'Missed', color: 'error' as const, icon: <CancelIcon /> },
      forwarded: { label: 'Forwarded', color: 'info' as const },
      busy: { label: 'Busy', color: 'warning' as const },
      failed: { label: 'Failed', color: 'error' as const },
      'no-answer': { label: 'No Answer', color: 'warning' as const },
      canceled: { label: 'Canceled', color: 'default' as const },
    };
    const statusConfig = config[status] || { label: status, color: 'default' as const, icon: undefined };
    const { label, color, icon } = statusConfig;
    return <Chip label={label} color={color} size="small" icon={icon} />;
  };

  const handlePlayRecording = (recordingUrl: string, leadId: string) => {
    if (playingAudio === leadId && audioElement) {
      audioElement.pause();
      setPlayingAudio(null);
      setAudioElement(null);
      return;
    }

    const audio = new Audio(recordingUrl);
    audio.play();
    setPlayingAudio(leadId);
    setAudioElement(audio);

    audio.onended = () => {
      setPlayingAudio(null);
      setAudioElement(null);
    };

    audio.onerror = () => {
      setError('Failed to play recording');
      setPlayingAudio(null);
      setAudioElement(null);
    };
  };

  const handleDownloadRecording = async (recordingUrl: string, leadId: string) => {
    try {
      const response = await fetch(recordingUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lead-recording-${leadId}.mp3`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError('Failed to download recording');
    }
  };

  const handleDownloadTranscript = (transcript: string, leadId: string) => {
    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lead-transcript-${leadId}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const filteredLeads = leads.filter((lead) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      lead.caller_number?.toLowerCase().includes(query) ||
      lead.called_number?.toLowerCase().includes(query) ||
      lead.transcript?.toLowerCase().includes(query) ||
      lead.notes?.toLowerCase().includes(query)
    );
  });

  const handleDownloadLeads = () => {
    if (filteredLeads.length === 0) {
      setError('No leads to download');
      return;
    }

    // Create CSV header
    const headers = [
      'Date & Time',
      'Caller Number',
      'Called Number',
      'Status',
      'Duration (seconds)',
      'Agent ID',
      'Inbound Number ID',
      'Transcript',
      'Notes',
      'Call Cost',
    ];

    // Create CSV rows
    const rows = filteredLeads.map((lead) => [
      formatDate(lead.call_start_time),
      lead.caller_number || '',
      lead.called_number || '',
      lead.call_status || '',
      lead.call_duration?.toString() || '0',
      lead.agent_id || '',
      lead.inbound_number_id || '',
      lead.transcript || '',
      lead.notes || '',
      lead.call_cost?.toString() || '',
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  if (loading && leads.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <Box>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom sx={{ fontFamily: "'Manrope', sans-serif", fontSize: '28px', fontWeight: 700, color: '#27272b' }}>
              Leads
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'Manrope', sans-serif", fontSize: '18px', color: '#737373' }}>
              View and manage your leads from call history
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={handleDownloadLeads}
            disabled={filteredLeads.length === 0}
          >
            Download Leads ({filteredLeads.length})
          </Button>
        </Box>

        {/* Filters */}
        <StyledCard sx={{ mb: 3 }}>
          <CardContent>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
              <TextField
                placeholder="Search leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
                sx={{ flexGrow: 1 }}
              />
              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>Time Period</InputLabel>
                <Select
                  value={timeFilter}
                  label="Time Period"
                  onChange={(e) => setTimeFilter(e.target.value as any)}
                >
                  <MenuItem value="24h">Last 24 Hours</MenuItem>
                  <MenuItem value="7days">Last 7 Days</MenuItem>
                  <MenuItem value="30days">Last 30 Days</MenuItem>
                  <MenuItem value="all">All Time</MenuItem>
                </Select>
              </FormControl>
              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>Agent</InputLabel>
                <Select
                  value={agentFilter}
                  label="Agent"
                  onChange={(e) => setAgentFilter(e.target.value)}
                >
                  <MenuItem value="all">All Agents</MenuItem>
                  {agents.map((agent) => (
                    <MenuItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl sx={{ minWidth: 180 }}>
                <InputLabel>Phone Number</InputLabel>
                <Select
                  value={numberFilter}
                  label="Phone Number"
                  onChange={(e) => setNumberFilter(e.target.value)}
                >
                  <MenuItem value="all">All Numbers</MenuItem>
                  {inboundNumbers.map((number) => (
                    <MenuItem key={number.id} value={number.id}>
                      {number.phone_number} {number.phone_label ? `(${number.phone_label})` : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </CardContent>
        </StyledCard>

        {/* Leads Table */}
        {filteredLeads.length === 0 ? (
          <StyledCard>
            <CardContent>
              <Box textAlign="center" py={4}>
                <LeadIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom sx={{ fontFamily: "'Manrope', sans-serif", fontSize: '18px', fontWeight: 600, color: '#27272b' }}>
                  No Leads Found
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'Manrope', sans-serif", fontSize: '16px', color: '#737373' }}>
                  No leads found for the selected filters. Leads are calls from call_history where is_lead = true.
                </Typography>
              </Box>
            </CardContent>
          </StyledCard>
        ) : (
          <StyledCard>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.100' }}>
                    <TableCell sx={{ fontWeight: 600, fontFamily: "'Manrope', sans-serif", fontSize: '16px', color: '#27272b' }}>Date & Time</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontFamily: "'Manrope', sans-serif", fontSize: '16px', color: '#27272b' }}>Caller</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontFamily: "'Manrope', sans-serif", fontSize: '16px', color: '#27272b' }}>Called</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontFamily: "'Manrope', sans-serif", fontSize: '16px', color: '#27272b' }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontFamily: "'Manrope', sans-serif", fontSize: '16px', color: '#27272b' }}>Duration</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontFamily: "'Manrope', sans-serif", fontSize: '16px', color: '#27272b' }}>Recording</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontFamily: "'Manrope', sans-serif", fontSize: '16px', color: '#27272b' }}>Transcript</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, fontFamily: "'Manrope', sans-serif", fontSize: '16px', color: '#27272b' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredLeads.map((lead) => (
                    <TableRow key={lead.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: "'Manrope', sans-serif", fontSize: '16px', color: '#27272b' }}>{formatDate(lead.call_start_time)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500} sx={{ fontFamily: "'Manrope', sans-serif", fontSize: '16px', color: '#27272b' }}>
                          {lead.caller_number || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500} sx={{ fontFamily: "'Manrope', sans-serif", fontSize: '16px', color: '#27272b' }}>
                          {lead.called_number || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>{getStatusChip(lead.call_status)}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <TimeIcon fontSize="small" color="action" />
                          {formatDuration(lead.call_duration || 0)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {lead.recording_url ? (
                          <Tooltip title={playingAudio === lead.id ? 'Pause' : 'Play Recording'}>
                            <IconButton
                              size="small"
                              onClick={() => handlePlayRecording(lead.recording_url!, lead.id)}
                            >
                              {playingAudio === lead.id ? <PauseIcon /> : <PlayIcon />}
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            No recording
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {lead.transcript ? (
                          <Tooltip title="View Transcript">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setSelectedLead(lead);
                                setShowTranscript(true);
                              }}
                            >
                              <ViewIcon />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            No transcript
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          {lead.recording_url && (
                            <Tooltip title="Download Recording">
                              <IconButton
                                size="small"
                                onClick={() => handleDownloadRecording(lead.recording_url!, lead.id)}
                              >
                                <DownloadIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                          {lead.transcript && (
                            <Tooltip title="Download Transcript">
                              <IconButton
                                size="small"
                                onClick={() => handleDownloadTranscript(lead.transcript!, lead.id)}
                              >
                                <DownloadIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </StyledCard>
        )}

        {/* Transcript Dialog */}
        <Dialog
          open={showTranscript}
          onClose={() => setShowTranscript(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            Lead Transcript
            {selectedLead && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                {formatDate(selectedLead.call_start_time)}
              </Typography>
            )}
          </DialogTitle>
          <DialogContent>
            {selectedLead?.metadata?.speaker_separated_transcript ? (
              <Box>
                <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                  Speaker-Separated Transcript
                </Typography>
                {Array.isArray(selectedLead.metadata.speaker_separated_transcript) ? (
                  selectedLead.metadata.speaker_separated_transcript.map((segment: any, index: number) => (
                    <Box key={index} sx={{ mb: 2 }}>
                      <Chip
                        label={`Speaker ${segment.speaker || 'Unknown'}`}
                        size="small"
                        sx={{ mb: 1 }}
                      />
                      <Typography variant="body2" sx={{ ml: 1 }}>
                        {segment.text}
                      </Typography>
                      {segment.timestamp && (
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                          {segment.timestamp}
                        </Typography>
                      )}
                    </Box>
                  ))
                ) : (
                  <Typography variant="body2">{JSON.stringify(selectedLead.metadata.speaker_separated_transcript, null, 2)}</Typography>
                )}
                <Box sx={{ my: 2, borderTop: 1, borderColor: 'divider' }} />
                <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                  Full Transcript
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {selectedLead.transcript || 'No transcript available'}
                </Typography>
              </Box>
            ) : (
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {selectedLead?.transcript || 'No transcript available'}
              </Typography>
            )}
          </DialogContent>
          <DialogActions>
            {selectedLead?.transcript && (
              <Button
                onClick={() => handleDownloadTranscript(selectedLead.transcript!, selectedLead.id)}
                startIcon={<DownloadIcon />}
              >
                Download
              </Button>
            )}
            <Button onClick={() => setShowTranscript(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </>
  );
};

export default Leads;
