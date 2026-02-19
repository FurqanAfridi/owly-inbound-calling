import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useParams, useLocation } from 'react-router-dom';
import { User, Building2, Globe, Mic, FileText, Phone, Settings, Plus, Sparkles, X, Play, Volume2, Coins, ArrowLeft, ListCollapse, AudioLines, Settings2, ChevronRight, Search, ChevronLeft, ArrowUpDown, MoreVertical, Calendar, ChevronLeft as ChevronLeftIcon, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { hasEnoughCredits, deductAgentCreationCredits, CREDIT_RATES } from '../services/creditService';
import { NotificationHelpers } from '../services/notificationService';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from './ui/select';
import { Separator } from './ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Slider } from './ui/slider';
import { allVoices, vapiVoices, deepgramVoices, VoiceConfig } from '../data/voices';
import { timezones, getTimezonesByGroup } from '../data/timezones';
import { generatePromptFromProfile } from '../services/aiPromptService';
import { useAIPrompts } from '../hooks/useAIPrompts';
import type { AgentPromptProfile } from '../types/aiPrompt';
import { toast } from '@/hooks/use-toast';

interface InboundNumber {
  id: string;
  phone_number: string;
  country_code: string;
  phone_label: string | null;
  provider: string;
  status: string;
  assigned_to_agent_id?: string | null;
  twilio_sid?: string | null;
  twilio_auth_token?: string | null;
  sms_enabled?: boolean;
  vonage_api_key?: string | null;
  vonage_api_secret?: string | null;
  telnyx_api_key?: string | null;
}

interface AgentConfig {
  agentName?: string;
  companyName?: string;
  websiteUrl?: string;
  goal?: string;
  backgroundContext?: string;
  welcomeMessage?: string;
  welcomeMessages?: string[];
  instructionVoice?: string;
  script?: string;
  language?: string;
  timezone?: string;
  agentType?: string;
  tool?: string;
  voice?: string;
  temperature?: number;
  confidence?: number;
  verbosity?: number;
  callAvailabilityStart?: string;
  callAvailabilityEnd?: string;
  callAvailabilityDays?: string[];
}

const CreateVoiceAgent: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { promptId?: string } };
  const { id: agentId } = useParams<{ id?: string }>();
  const { user } = useAuth();
  const isEditMode = !!agentId;
  const [loading, setLoading] = useState(false);
  const isSubmittingRef = useRef(false); // Ref to track submission state (synchronous)
  const [loadingAgent, setLoadingAgent] = useState(isEditMode);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [inboundNumbers, setInboundNumbers] = useState<InboundNumber[]>([]);
  const [selectedNumberId, setSelectedNumberId] = useState<string>('');
  const [loadingNumbers, setLoadingNumbers] = useState(true);
  const [editingAgent, setEditingAgent] = useState<any>(null);
  const isDraft = isEditMode && editingAgent?.status === 'draft';
  const [showNumberWarning, setShowNumberWarning] = useState(false);
  const [pendingNumberId, setPendingNumberId] = useState<string>('');
  const [previousAgent, setPreviousAgent] = useState<{ id: string; name: string } | null>(null);
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<Array<{ id: string; name: string }>>([]);
  const [showAutofillDialog, setShowAutofillDialog] = useState(false);
  const [autofillPrompt, setAutofillPrompt] = useState('');
  const [autofillLoading, setAutofillLoading] = useState(false);
  const [autofillError, setAutofillError] = useState<string | null>(null);

  // New state for tabbed interface and sidebar navigation
  const [activeTab, setActiveTab] = useState<'overview' | 'edit' | 'logs'>('edit');
  const [activeSection, setActiveSection] = useState<'details' | 'voice' | 'settings' | 'schedules'>('details');
  const [welcomeMessages, setWelcomeMessages] = useState<string[]>([]);
  const [newWelcomeMessage, setNewWelcomeMessage] = useState('');
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [voiceTab, setVoiceTab] = useState<'deepgram' | 'vapi'>('deepgram');

  // Overview stats state
  const [overviewStats, setOverviewStats] = useState({
    totalCalls: 0,
    answered: 0,
    avgDuration: { minutes: 0, seconds: 0 },
    answerRate: 0,
  });

  const [callStatusSummary, setCallStatusSummary] = useState({
    totalCost: 0,
    forwarded: 0,
    lead: 0,
    missed: 0,
  });

  const [agentSchedule, setAgentSchedule] = useState<any[]>([]);
  const [loadingOverview, setLoadingOverview] = useState(false);

  // Schedule selection state
  const [availableSchedules, setAvailableSchedules] = useState<Array<{ id: string; schedule_name: string; timezone: string; is_active: boolean }>>([]);
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<string[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);

  // Logs state
  const [callLogs, setCallLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logsSearch, setLogsSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [showLogDetail, setShowLogDetail] = useState(false);
  const [logsPage, setLogsPage] = useState(1);
  const [logsPerPage] = useState(10);
  const [logsStatusFilter, setLogsStatusFilter] = useState<string>('all');
  const [logsDateFilter, setLogsDateFilter] = useState<string>('all');

  // Saved Prompts State
  const [savedPrompts, setSavedPrompts] = useState<any[]>([]);
  const [showPromptDialog, setShowPromptDialog] = useState(false);
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const [selectedPromptId, setSelectedPromptId] = useState<string>('');
  const [highlightEmptyFields, setHighlightEmptyFields] = useState(false);

  // Generate Prompt Dialog State
  const [showGeneratePromptDialog, setShowGeneratePromptDialog] = useState(false);
  const [promptGenFormData, setPromptGenFormData] = useState<Partial<AgentPromptProfile>>({
    companyName: '',
    businessIndustry: '',
    agentPurpose: '',
    callType: 'Sales',
    targetAudience: '',
    callGoal: 'Book Appointment',
    services: [],
    tone: 'Friendly',
    languages: ['en-US'],
  });
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [generatedPromptData, setGeneratedPromptData] = useState<{
    finalPrompt: string;
    welcomeMessages: string[];
    formData: any;
    agentProfile: any;
  } | null>(null);
  const [promptSaveName, setPromptSaveName] = useState('');
  const [promptSaveCategory, setPromptSaveCategory] = useState('general');
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  
  const { createPrompt, refetch: refetchPrompts } = useAIPrompts();

  const [formData, setFormData] = useState({
    agentName: '',
    companyName: 'DNAI', // Default company name
    websiteUrl: 'https://duhanashrah.ai', // Default website URL
    goal: '',
    backgroundContext: '',
    welcomeMessage: '',
    instructionVoice: '',
    script: '',
    language: 'en-US',
    timezone: '',
    agentType: '',
    tool: '',
    voice: 'helena', // Default to helena (Deepgram)
    temperature: 0.7, // Default temperature between 0 and 1
    confidence: 0.8, // Default confidence between 0 and 1
    verbosity: 0.7, // Default verbosity between 0 and 1
    fallbackEnabled: false,
    fallbackNumber: '',
    knowledgeBaseId: '', // Selected knowledge base ID
    callAvailabilityStart: '09:00',
    callAvailabilityEnd: '17:00',
    callAvailabilityDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  });
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);

  // Validation function to check if compulsory details are filled
  const isFormValid = () => {
    const requiredFields = [
      formData.agentName,
      formData.companyName,
      formData.websiteUrl,
      formData.goal,
      formData.backgroundContext,
      formData.instructionVoice,
      formData.voice,
      formData.language,
      formData.agentType,
      formData.timezone,
      selectedNumberId
    ];

    // Check basic string fields
    const basicFieldsValid = requiredFields.every(field => field && field.trim() !== '');

    // Check welcome messages count (min 1, max 5)
    const welcomeMessagesValid = welcomeMessages.length >= 1 && welcomeMessages.length <= 5;

    return basicFieldsValid && welcomeMessagesValid;
  };

  // Progress calculation
  const getProgress = () => {
    const detailsFields = [formData.agentName, formData.companyName, formData.websiteUrl, formData.goal, formData.backgroundContext];
    const voiceFields = [welcomeMessages.length >= 1 && welcomeMessages.length <= 5, formData.instructionVoice];
    const settingsFields = [formData.voice, formData.language, formData.agentType, formData.timezone, selectedNumberId];

    const allRequired = [...detailsFields, ...voiceFields, ...settingsFields];
    const filledCount = allRequired.filter(field => {
      if (typeof field === 'boolean') return field;
      return field && field.trim() !== '';
    }).length;

    return Math.round((filledCount / allRequired.length) * 100);
  };

  const getSectionStatus = (section: 'details' | 'voice' | 'settings' | 'schedules') => {
    switch (section) {
      case 'details':
        return [formData.agentName, formData.companyName, formData.websiteUrl, formData.goal, formData.backgroundContext]
          .every(f => f && f.trim() !== '');
      case 'voice':
        return welcomeMessages.length >= 1 && welcomeMessages.length <= 5 && formData.instructionVoice.trim() !== '';
      case 'settings':
        return [formData.voice, formData.language, formData.agentType, formData.timezone, selectedNumberId]
          .every(f => f && f.trim() !== '');
      case 'schedules':
        return true;
      default:
        return false;
    }
  };

  // Function to load overview stats
  const loadOverviewStats = async () => {
    if (!isEditMode || !editingAgent || !user) return;

    setLoadingOverview(true);
    try {
      // Fetch call statistics for this agent
      const { data: statsData, error: statsError } = await supabase.rpc('get_call_statistics', {
        p_user_id: user.id,
        p_start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Last 30 days
        p_end_date: new Date().toISOString().split('T')[0],
        p_agent_id: editingAgent.id,
      });

      if (statsError) {
        console.error('Error fetching overview stats:', statsError);
        // Set defaults on error
        setOverviewStats({
          totalCalls: 0,
          answered: 0,
          avgDuration: { minutes: 0, seconds: 0 },
          answerRate: 0,
        });
        setCallStatusSummary({
          totalCost: 0,
          forwarded: 0,
          lead: 0,
          missed: 0,
        });
        return;
      }

      if (statsData && statsData.length > 0) {
        const stats = statsData[0];
        const totalCalls = Number(stats.total_calls) || 0;
        const answered = Number(stats.answered_calls) || 0;
        const avgDurationSeconds = Number(stats.average_duration_seconds) || 0;
        const answerRate = totalCalls > 0 ? Math.round((answered / totalCalls) * 100) : 0;

        setOverviewStats({
          totalCalls,
          answered,
          avgDuration: {
            minutes: Math.floor(avgDurationSeconds / 60),
            seconds: Math.floor(avgDurationSeconds % 60),
          },
          answerRate,
        });

        // Calculate call status summary
        const forwarded = Number(stats.forwarded_calls) || 0;
        const missed = Number(stats.missed_calls) || 0;

        // Fetch leads count
        const { data: leadsData } = await supabase
          .from('call_history')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id)
          .eq('agent_id', editingAgent.id)
          .eq('is_lead', true)
          .is('deleted_at', null);

        const lead = leadsData?.length || 0;
        const totalCost = Number(stats.total_cost) || 0;

        setCallStatusSummary({
          totalCost,
          forwarded,
          lead,
          missed,
        });
      } else {
        // Set defaults if no data
        setOverviewStats({
          totalCalls: 0,
          answered: 0,
          avgDuration: { minutes: 0, seconds: 0 },
          answerRate: 0,
        });
        setCallStatusSummary({
          totalCost: 0,
          forwarded: 0,
          lead: 0,
          missed: 0,
        });
      }

      // Fetch agent schedule (call history for this agent)
      const { data: scheduleData } = await supabase
        .from('call_history')
        .select('id, call_start_time, caller_number, called_number, call_status, call_duration, is_lead, metadata')
        .eq('user_id', user.id)
        .eq('agent_id', editingAgent.id)
        .is('deleted_at', null)
        .order('call_start_time', { ascending: false })
        .limit(10);

      if (scheduleData) {
        setAgentSchedule(scheduleData);
      } else {
        setAgentSchedule([]);
      }
    } catch (err: any) {
      console.error('Error loading overview stats:', err);
      // Set defaults on error
      setOverviewStats({
        totalCalls: 0,
        answered: 0,
        avgDuration: { minutes: 0, seconds: 0 },
        answerRate: 0,
      });
      setCallStatusSummary({
        totalCost: 0,
        forwarded: 0,
        lead: 0,
        missed: 0,
      });
      setAgentSchedule([]);
    } finally {
      setLoadingOverview(false);
    }
  };

  // Function to load call logs
  const loadCallLogs = async () => {
    if (!isEditMode || !editingAgent || !user) return;

    setLoadingLogs(true);
    try {
      let query = supabase
        .from('call_history')
        .select('id, call_start_time, call_end_time, caller_number, called_number, call_status, call_duration, call_cost, recording_url, transcript, notes, is_lead, metadata')
        .eq('user_id', user.id)
        .eq('agent_id', editingAgent.id)
        .is('deleted_at', null)
        .order('call_start_time', { ascending: false });

      // Apply search filter
      if (logsSearch) {
        query = query.or(`caller_number.ilike.%${logsSearch}%,called_number.ilike.%${logsSearch}%,transcript.ilike.%${logsSearch}%`);
      }

      // Apply status filter
      if (logsStatusFilter !== 'all') {
        if (logsStatusFilter === 'completed') {
          query = query.in('call_status', ['answered', 'completed']);
        } else if (logsStatusFilter === 'failed') {
          query = query.in('call_status', ['failed', 'missed']);
        } else {
          query = query.eq('call_status', logsStatusFilter);
        }
      }

      // Apply date filter
      if (logsDateFilter !== 'all') {
        const now = new Date();
        let startDate: Date;
        if (logsDateFilter === 'today') {
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (logsDateFilter === 'week') {
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else if (logsDateFilter === 'month') {
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        } else {
          startDate = new Date(0);
        }
        query = query.gte('call_start_time', startDate.toISOString());
      }

      const { data: logsData, error: logsError } = await query
        .range((logsPage - 1) * logsPerPage, logsPage * logsPerPage - 1);

      if (logsError) {
        console.error('Error fetching call logs:', logsError);
        setCallLogs([]);
        return;
      }

      setCallLogs(logsData || []);
    } catch (err: any) {
      console.error('Error loading call logs:', err);
      setCallLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Load overview stats when overview tab is active
  useEffect(() => {
    if (isEditMode && editingAgent && activeTab === 'overview') {
      loadOverviewStats();
    }
  }, [isEditMode, editingAgent, activeTab]);

  // Load logs when logs tab is active or search/page/filters change
  useEffect(() => {
    if (isEditMode && editingAgent && activeTab === 'logs') {
      loadCallLogs();
    }
  }, [isEditMode, editingAgent, activeTab, logsPage, logsSearch, logsStatusFilter, logsDateFilter]);

  // Helper function to format phone number display (avoid duplicate country code)
  // phone_number in database already includes country_code, so we just display phone_number
  const formatPhoneDisplay = (phoneNumber: string, countryCode: string): string => {
    if (!phoneNumber) return '';

    // phone_number is stored with country_code already included (from AddInboundNumber)
    // So we just return phone_number as-is
    // But if for some reason it doesn't start with +, we add the country_code
    if (phoneNumber.startsWith('+')) {
      return phoneNumber;
    }

    // Fallback: if phone_number doesn't start with +, combine with country_code
    return `${countryCode}${phoneNumber}`;
  };

  useEffect(() => {
    const initialize = async () => {
      await fetchInboundNumbers();
      await fetchAgents();
      await fetchKnowledgeBases();
      await fetchSchedules();
      await fetchSavedPrompts();
      if (isEditMode && agentId && user) {
        // Wait a bit for inbound numbers to be loaded
        setTimeout(() => {
          loadAgentForEdit(agentId);
        }, 100);
      } else if (!isEditMode && user) {
        // Check if prompt ID is in location state (from AI Prompts page)
        const promptId = location.state?.promptId;
        if (promptId) {
          // Wait for saved prompts to load, then load the prompt
          setTimeout(async () => {
            try {
              const { data, error } = await supabase
                .from('ai_prompts')
                .select('*')
                .eq('id', promptId)
                .eq('user_id', user.id)
                .single();
              
              if (!error && data) {
                // Use the same logic as handleSelectPrompt
                await handleSelectPrompt(promptId);
                // Clear the state to prevent reloading on re-render
                window.history.replaceState({}, document.title);
              }
            } catch (err) {
              console.error('Error loading prompt:', err);
            }
          }, 200);
        }
      }
    };
    initialize();

    // Cleanup: stop any playing audio when component unmounts
    return () => {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio.onended = null;
        currentAudio.onerror = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, agentId, isEditMode]);

  const fetchAgents = async () => {
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
      console.error('Error fetching agents:', err);
    }
  };

  const fetchKnowledgeBases = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('knowledge_bases')
        .select('id, name')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setKnowledgeBases(data || []);
    } catch (err: any) {
      console.error('Error fetching knowledge bases:', err);
    }
  };

  const fetchSchedules = async () => {
    if (!user) return;
    setLoadingSchedules(true);
    try {
      const { data, error } = await supabase
        .from('call_schedules')
        .select('id, schedule_name, timezone, is_active')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAvailableSchedules(data || []);
    } catch (err: any) {
      console.error('Error fetching schedules:', err);
    } finally {
      setLoadingSchedules(false);
    }
  };

  const fetchSavedPrompts = async () => {
    if (!user) return;
    setLoadingPrompts(true);
    try {
      const { data, error } = await supabase
        .from('ai_prompts')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'ready')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSavedPrompts(data || []);
    } catch (err: any) {
      console.error('Error fetching saved prompts:', err);
    } finally {
      setLoadingPrompts(false);
    }
  };

  // Initialize prompt generation form with current agent form data
  const openGeneratePromptDialog = () => {
    setPromptGenFormData({
      companyName: formData.companyName || '',
      businessIndustry: '',
      agentPurpose: formData.goal || '',
      callType: formData.agentType ? (formData.agentType.charAt(0).toUpperCase() + formData.agentType.slice(1)) as AgentPromptProfile['callType'] : 'Sales',
      targetAudience: '',
      callGoal: 'Book Appointment',
      services: [],
      tone: 'Friendly',
      languages: [formData.language || 'en-US'],
    });
    setPromptSaveName(formData.companyName ? `${formData.companyName} - Prompt` : 'New Prompt');
    setGeneratedPromptData(null);
    setShowGeneratePromptDialog(true);
  };

  // Generate prompt from form data
  const handleGeneratePromptInDialog = async () => {
    if (!promptGenFormData.companyName || !promptGenFormData.agentPurpose || !promptGenFormData.callType) {
      toast({
        title: 'Missing Required Fields',
        description: 'Please fill in Company Name, Agent Purpose, and Call Type',
        variant: 'destructive',
      });
      return;
    }

    setIsGeneratingPrompt(true);
    try {
      const result = await generatePromptFromProfile(promptGenFormData);
      setGeneratedPromptData({
        finalPrompt: result.finalPrompt || '',
        welcomeMessages: result.welcomeMessages || [],
        formData: result.formData || null,
        agentProfile: result.agentProfile || null,
      });
      toast({
        title: 'Success',
        description: 'Prompt generated successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate prompt',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  // Save generated prompt and auto-fill form
  const handleSaveAndUsePrompt = async () => {
    if (!user || !generatedPromptData || !promptSaveName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a prompt name',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingPrompt(true);
    try {
      const savedPrompt = await createPrompt({
        name: promptSaveName.trim(),
        category: promptSaveCategory,
        system_prompt: generatedPromptData.finalPrompt,
        begin_message: null,
        agent_profile: generatedPromptData.agentProfile || promptGenFormData,
        welcome_messages: generatedPromptData.welcomeMessages || [],
        call_type: promptGenFormData.callType,
        call_goal: promptGenFormData.callGoal,
        tone: promptGenFormData.tone,
        status: 'ready',
        state_prompts: {} as any,
        tools_config: {} as any,
        is_active: true,
        is_template: false,
        form_data: generatedPromptData.formData || null,
      });

      if (savedPrompt) {
        // Refresh prompts list
        await refetchPrompts();
        await fetchSavedPrompts();

        // Auto-fill the agent creation form with the generated prompt
        if (savedPrompt.form_data && Object.keys(savedPrompt.form_data).length > 0) {
          const formDataFromPrompt = savedPrompt.form_data;
          setFormData(prev => {
            const newFormData: any = { ...prev };
            if ('agentName' in formDataFromPrompt) newFormData.agentName = formDataFromPrompt.agentName || savedPrompt.name || '';
            if ('companyName' in formDataFromPrompt) newFormData.companyName = formDataFromPrompt.companyName || '';
            if ('websiteUrl' in formDataFromPrompt) newFormData.websiteUrl = formDataFromPrompt.websiteUrl || '';
            if ('goal' in formDataFromPrompt) newFormData.goal = formDataFromPrompt.goal || '';
            if ('backgroundContext' in formDataFromPrompt) newFormData.backgroundContext = savedPrompt.system_prompt || formDataFromPrompt.backgroundContext || '';
            if ('instructionVoice' in formDataFromPrompt) newFormData.instructionVoice = formDataFromPrompt.instructionVoice || '';
            if ('script' in formDataFromPrompt) newFormData.script = formDataFromPrompt.script || savedPrompt.system_prompt || '';
            if ('language' in formDataFromPrompt) newFormData.language = formDataFromPrompt.language || 'en-US';
            if ('timezone' in formDataFromPrompt) newFormData.timezone = formDataFromPrompt.timezone || '';
            if ('agentType' in formDataFromPrompt) newFormData.agentType = formDataFromPrompt.agentType || '';
            if ('tool' in formDataFromPrompt) newFormData.tool = formDataFromPrompt.tool || '';
            if ('voice' in formDataFromPrompt) newFormData.voice = formDataFromPrompt.voice || 'helena';
            if ('temperature' in formDataFromPrompt) newFormData.temperature = formDataFromPrompt.temperature !== undefined ? formDataFromPrompt.temperature : 0.7;
            if ('confidence' in formDataFromPrompt) newFormData.confidence = formDataFromPrompt.confidence !== undefined ? formDataFromPrompt.confidence : 0.8;
            if ('verbosity' in formDataFromPrompt) newFormData.verbosity = formDataFromPrompt.verbosity !== undefined ? formDataFromPrompt.verbosity : 0.7;
            if (!newFormData.script && savedPrompt.system_prompt) newFormData.script = savedPrompt.system_prompt;
            if (!newFormData.agentName && savedPrompt.name) newFormData.agentName = savedPrompt.name;
            return newFormData;
          });

          if (savedPrompt.welcome_messages && savedPrompt.welcome_messages.length > 0) {
            setWelcomeMessages(savedPrompt.welcome_messages);
          }
        } else {
          // Fallback to agent_profile mapping
          const profile = savedPrompt.agent_profile || {};
          setFormData(prev => ({
            ...prev,
            agentName: savedPrompt.name || prev.agentName,
            companyName: profile.companyName || prev.companyName,
            websiteUrl: profile.companyWebsite || prev.websiteUrl,
            goal: profile.callGoal || prev.goal,
            backgroundContext: savedPrompt.system_prompt || prev.backgroundContext,
            script: savedPrompt.system_prompt || prev.script,
            instructionVoice: profile.tone ? `Use a ${profile.tone} tone.` : prev.instructionVoice,
            agentType: profile.callType ? profile.callType.toLowerCase() : prev.agentType,
            language: (profile.languages && profile.languages.length > 0) ? profile.languages[0] : prev.language,
          }));
          if (savedPrompt.welcome_messages && savedPrompt.welcome_messages.length > 0) {
            setWelcomeMessages(savedPrompt.welcome_messages);
          }
        }

        toast({
          title: 'Success',
          description: 'Prompt saved and form autofilled!',
        });

        // Close both dialogs
        setShowGeneratePromptDialog(false);
        setShowPromptDialog(false);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to save prompt',
        variant: 'destructive',
      });
    } finally {
      setIsSavingPrompt(false);
    }
  };

  const handleSelectPrompt = async (promptId: string) => {
    // If prompt is not in savedPrompts, fetch it
    let prompt = savedPrompts.find(p => p.id === promptId);
    if (!prompt && user) {
      try {
        const { data, error } = await supabase
          .from('ai_prompts')
          .select('*')
          .eq('id', promptId)
          .eq('user_id', user.id)
          .single();
        
        if (error || !data) {
          setStatusMessage({ type: 'error', text: 'Prompt not found' });
          return;
        }
        prompt = data;
      } catch (err) {
        console.error('Error fetching prompt:', err);
        setStatusMessage({ type: 'error', text: 'Failed to load prompt' });
        return;
      }
    }
    
    if (!prompt) return;

    const profile = prompt.agent_profile || {};
    const formDataFromPrompt = prompt.form_data || {};

    // If form_data exists, use it directly (new structured format)
    // Otherwise, fall back to mapping from agent_profile (backward compatibility)
    if (formDataFromPrompt && Object.keys(formDataFromPrompt).length > 0) {
      // Use structured form_data for complete auto-fill
      // Use ALL fields from formDataFromPrompt - prioritize formData values, fallback to prompt/system_prompt
      setFormData(prev => {
        const newFormData: any = { ...prev };
        
        // Fill all fields that exist in formDataFromPrompt
        // Use the value from formData if it exists (even if empty string), otherwise use fallback
        if ('agentName' in formDataFromPrompt) {
          newFormData.agentName = formDataFromPrompt.agentName !== undefined && formDataFromPrompt.agentName !== null 
            ? formDataFromPrompt.agentName 
            : (prompt.name || prev.agentName);
        }
        if ('companyName' in formDataFromPrompt) {
          newFormData.companyName = formDataFromPrompt.companyName !== undefined && formDataFromPrompt.companyName !== null 
            ? formDataFromPrompt.companyName 
            : prev.companyName;
        }
        if ('websiteUrl' in formDataFromPrompt) {
          newFormData.websiteUrl = formDataFromPrompt.websiteUrl !== undefined && formDataFromPrompt.websiteUrl !== null 
            ? formDataFromPrompt.websiteUrl 
            : prev.websiteUrl;
        }
        if ('goal' in formDataFromPrompt) {
          newFormData.goal = formDataFromPrompt.goal !== undefined && formDataFromPrompt.goal !== null 
            ? formDataFromPrompt.goal 
            : prev.goal;
        }
        // Always load the full system prompt into backgroundContext
        if (prompt.system_prompt) {
          newFormData.backgroundContext = prompt.system_prompt;
        } else if ('backgroundContext' in formDataFromPrompt) {
          newFormData.backgroundContext = formDataFromPrompt.backgroundContext !== undefined && formDataFromPrompt.backgroundContext !== null 
            ? formDataFromPrompt.backgroundContext 
            : prev.backgroundContext;
        }
        if ('instructionVoice' in formDataFromPrompt) {
          newFormData.instructionVoice = formDataFromPrompt.instructionVoice !== undefined && formDataFromPrompt.instructionVoice !== null 
            ? formDataFromPrompt.instructionVoice 
            : prev.instructionVoice;
        }
        if ('script' in formDataFromPrompt) {
          newFormData.script = formDataFromPrompt.script !== undefined && formDataFromPrompt.script !== null 
            ? formDataFromPrompt.script 
            : (prompt.system_prompt || prev.script);
        }
        if ('language' in formDataFromPrompt) {
          newFormData.language = formDataFromPrompt.language !== undefined && formDataFromPrompt.language !== null 
            ? formDataFromPrompt.language 
            : prev.language;
        }
        if ('timezone' in formDataFromPrompt) {
          newFormData.timezone = formDataFromPrompt.timezone !== undefined && formDataFromPrompt.timezone !== null 
            ? formDataFromPrompt.timezone 
            : prev.timezone;
        }
        if ('agentType' in formDataFromPrompt) {
          newFormData.agentType = formDataFromPrompt.agentType !== undefined && formDataFromPrompt.agentType !== null 
            ? formDataFromPrompt.agentType 
            : prev.agentType;
        }
        if ('tool' in formDataFromPrompt) {
          newFormData.tool = formDataFromPrompt.tool !== undefined && formDataFromPrompt.tool !== null 
            ? formDataFromPrompt.tool 
            : prev.tool;
        }
        if ('voice' in formDataFromPrompt) {
          newFormData.voice = formDataFromPrompt.voice !== undefined && formDataFromPrompt.voice !== null 
            ? formDataFromPrompt.voice 
            : prev.voice;
        }
        if ('temperature' in formDataFromPrompt) {
          newFormData.temperature = formDataFromPrompt.temperature !== undefined && formDataFromPrompt.temperature !== null 
            ? formDataFromPrompt.temperature 
            : prev.temperature;
        }
        if ('confidence' in formDataFromPrompt) {
          newFormData.confidence = formDataFromPrompt.confidence !== undefined && formDataFromPrompt.confidence !== null 
            ? formDataFromPrompt.confidence 
            : prev.confidence;
        }
        if ('verbosity' in formDataFromPrompt) {
          newFormData.verbosity = formDataFromPrompt.verbosity !== undefined && formDataFromPrompt.verbosity !== null 
            ? formDataFromPrompt.verbosity 
            : prev.verbosity;
        }
        
        // Ensure script is always set from system_prompt if not in formData or is empty
        if (!newFormData.script && prompt.system_prompt) {
          newFormData.script = prompt.system_prompt;
        }
        
        // Ensure agentName is set from prompt name if not in formData or is empty
        if (!newFormData.agentName && prompt.name) {
          newFormData.agentName = prompt.name;
        }
        
        return newFormData;
      });
    } else {
      // Fallback: Map agent_profile to formData (backward compatibility)
      // Always load the full system prompt into backgroundContext
      setFormData(prev => ({
        ...prev,
        // Core Identity
        agentName: prompt.name || prev.agentName,
        companyName: profile.companyName || prev.companyName,
        websiteUrl: profile.companyWebsite || prev.websiteUrl,

        // Goals & Context - load full system prompt into backgroundContext
        goal: profile.callGoal || prev.goal,
        backgroundContext: prompt.system_prompt || prev.backgroundContext,

        // Script
        script: prompt.system_prompt || prev.script,

        // Voice & Tone - more detailed
        instructionVoice: profile.tone 
          ? `Use a ${profile.tone} tone. ${profile.agentPurpose ? `Purpose: ${profile.agentPurpose}. ` : ''}${prompt.system_prompt ? 'Follow the system prompt instructions carefully.' : ''}` 
          : prev.instructionVoice,

        // Configuration
        agentType: profile.callType ? profile.callType.toLowerCase() : prev.agentType,
        language: (profile.languages && profile.languages.length > 0) ? profile.languages[0] : prev.language,
        timezone: profile.companyAddress ? prev.timezone : prev.timezone, // Keep existing or infer from address if possible

        // Reset number selection to force user to choose valid number
      }));
    }

    // Update welcome messages list - prioritize welcome_messages array
    if (prompt.welcome_messages && prompt.welcome_messages.length > 0) {
      setWelcomeMessages(prompt.welcome_messages);
    } else if (prompt.begin_message) {
      setWelcomeMessages([prompt.begin_message]);
    } else {
      setWelcomeMessages([]);
    }

    setHighlightEmptyFields(true);
    setShowPromptDialog(false);
    setStatusMessage({ type: 'success', text: 'Form autofilled from saved prompt! All available details have been filled.' });
    setSelectedPromptId('');
  };

  const fetchInboundNumbers = async () => {
    if (!user) return;

    setLoadingNumbers(true);
    try {
      const { data, error } = await supabase
        .from('inbound_numbers')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInboundNumbers(data || []);
    } catch (err: any) {
      console.error('Error fetching inbound numbers:', err);
      setStatusMessage({ type: 'error', text: 'Failed to load inbound numbers' });
    } finally {
      setLoadingNumbers(false);
    }
  };

  const handleNumberSelection = async (numberId: string) => {
    // If editing and the number is already assigned to this agent, allow it
    if (isEditMode && editingAgent) {
      const selectedNumber = inboundNumbers.find(n => n.id === numberId);
      if (selectedNumber?.assigned_to_agent_id === editingAgent.id) {
        setSelectedNumberId(numberId);
        return;
      }
    }

    // Check if the number is assigned to another agent
    const selectedNumber = inboundNumbers.find(n => n.id === numberId);
    if (selectedNumber?.assigned_to_agent_id) {
      // Fetch the previous agent details
      const { data: agentData, error } = await supabase
        .from('voice_agents')
        .select('id, name')
        .eq('id', selectedNumber.assigned_to_agent_id)
        .eq('user_id', user?.id)
        .is('deleted_at', null)
        .single();

      if (!error && agentData) {
        // Show warning dialog
        setPreviousAgent({ id: agentData.id, name: agentData.name });
        setPendingNumberId(numberId);
        setShowNumberWarning(true);
        return;
      }
    }

    // Number is not assigned or error fetching agent, proceed normally
    setSelectedNumberId(numberId);
  };

  const handleConfirmNumberReassignment = () => {
    setSelectedNumberId(pendingNumberId);
    setShowNumberWarning(false);
    setPendingNumberId('');
  };

  const handleCancelNumberReassignment = () => {
    setShowNumberWarning(false);
    setPendingNumberId('');
    setPreviousAgent(null);
  };

  const loadAgentForEdit = async (id: string) => {
    if (!user) return;

    setLoadingAgent(true);
    try {
      const { data, error } = await supabase
        .from('voice_agents')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .single();

      if (error) throw error;

      if (data) {
        setEditingAgent(data);
        // Populate form with agent data - use actual data, no defaults
        setFormData({
          agentName: data.name || '',
          companyName: data.company_name ?? '',
          websiteUrl: data.website_url ?? '',
          goal: data.goal || '',
          backgroundContext: data.background || '',
          welcomeMessage: data.welcome_message || '',
          instructionVoice: data.instruction_voice || '',
          script: data.script || '',
          language: data.language || '',
          timezone: data.timezone || '',
          agentType: data.agent_type || '',
          tool: data.tool || '',
          voice: data.voice || '',
          temperature: data.temperature ?? 0.7, // Use nullish coalescing to allow 0
          confidence: data.confidence ?? 0.8, // Use nullish coalescing to allow 0
          verbosity: data.verbosity ?? 0.7, // Use nullish coalescing to allow 0
          fallbackEnabled: data.fallback_enabled ?? false,
          fallbackNumber: data.fallback_number || '',
          knowledgeBaseId: data.knowledge_base_id || '',
          callAvailabilityStart: data.metadata?.call_availability_start || '',
          callAvailabilityEnd: data.metadata?.call_availability_end || '',
          callAvailabilityDays: data.metadata?.call_availability_days || [],
        });

        // Set the voice tab based on the selected voice's provider
        if (data.voice) {
          const selectedVoice = allVoices.find(v => v.value === data.voice);
          if (selectedVoice) {
            setVoiceTab(selectedVoice.provider === 'vapi' ? 'vapi' : 'deepgram');
          }
        }

        // Handle welcome messages - could be string or array
        // If it's a string, convert to array; if array, use it; if empty, use empty array
        if (data.welcome_message) {
          try {
            // Try to parse as JSON array first
            const parsed = JSON.parse(data.welcome_message);
            if (Array.isArray(parsed)) {
              setWelcomeMessages(parsed);
            } else {
              // If it's a string, convert to array
              setWelcomeMessages([data.welcome_message]);
            }
          } catch {
            // If parsing fails, treat as string and convert to array
            setWelcomeMessages([data.welcome_message]);
          }
        } else {
          setWelcomeMessages([]);
        }

        // Find and set the selected inbound number
        // Re-fetch inbound numbers to ensure we have the latest data
        const { data: numbersData } = await supabase
          .from('inbound_numbers')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active');

        if (numbersData && data.phone_number) {
          const matchingNumber = numbersData.find(
            (n: InboundNumber) => n.phone_number === data.phone_number
          );
          if (matchingNumber) {
            setSelectedNumberId(matchingNumber.id);
          }
        }

        // Load schedules assigned to this agent using junction table
        const { data: agentScheduleLinks } = await supabase
          .from('agent_schedules')
          .select('schedule_id')
          .eq('agent_id', id);

        if (agentScheduleLinks && agentScheduleLinks.length > 0) {
          setSelectedScheduleIds(agentScheduleLinks.map((link: { schedule_id: string }) => link.schedule_id));
        } else {
          setSelectedScheduleIds([]);
        }
      }
    } catch (err: any) {
      console.error('Error loading agent:', err);
      setStatusMessage({ type: 'error', text: 'Failed to load agent data' });
      navigate('/agents');
    } finally {
      setLoadingAgent(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));

    // If voice is changed, update the voice tab to show the correct provider
    if (name === 'voice') {
      const selectedVoice = allVoices.find(v => v.value === value);
      if (selectedVoice) {
        setVoiceTab(selectedVoice.provider === 'vapi' ? 'vapi' : 'deepgram');
      }
    }
  };


  const getSelectedNumber = (): InboundNumber | null => {
    return inboundNumbers.find(n => n.id === selectedNumberId) || null;
  };

  const handleOpenAutofillDialog = () => {
    setShowAutofillDialog(true);
    setAutofillPrompt('');
    setAutofillError(null);
  };

  const handleCloseAutofillDialog = () => {
    setShowAutofillDialog(false);
    setAutofillPrompt('');
    setAutofillError(null);
  };

  const generateAgentDetails = async (prompt: string) => {
    // Support both REACT_APP_OPENAI_API and REACT_APP_OPENAI_API_KEY for flexibility
    const apiKey = process.env.REACT_APP_OPENAI_API || process.env.REACT_APP_OPENAI_API_KEY;

    console.log('Checking for API key...');
    console.log('REACT_APP_OPENAI_API:', process.env.REACT_APP_OPENAI_API ? 'Present' : 'Missing');
    console.log('REACT_APP_OPENAI_API_KEY:', process.env.REACT_APP_OPENAI_API_KEY ? 'Present' : 'Missing');

    if (!apiKey) {
      const errorMsg = 'OpenAI API key is not configured. Please set REACT_APP_OPENAI_API or REACT_APP_OPENAI_API_KEY in your .env.local file and restart the development server.';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    const systemPrompt = `You are an AI assistant that helps create voice agent configurations. Based on the user's description, generate a complete voice agent configuration in JSON format.

Return ONLY a valid JSON object with the following structure:
{
  "agentName": "string (short, descriptive name)",
  "companyName": "string",
  "websiteUrl": "string (valid URL)",
  "goal": "string (primary business objectives, can be multi-line)",
  "backgroundContext": "string (company history, mission, product description, can be multi-line)",
  "welcomeMessage": "string (ONE friendly greeting message - this will be used as the first welcome message)",
  "welcomeMessages": ["array of 1-5 different greeting messages", "each should be unique and natural", "use {name} placeholder for personalization"],
  "instructionVoice": "string (tone and style instructions for the agent, 2-3 sentences)",
  "script": "string (comprehensive agent's role and behavior description, include identity, mission, opening script, and conversation guidelines)",
  "language": "string (ISO language code like en-US, es-ES, fr-FR, de-DE, zh-CN)",
  "timezone": "string (IANA timezone like America/New_York, America/Los_Angeles, UTC)",
  "agentType": "string (one of: sales, support, booking, general)",
  "tool": "string (one of: schedule, crm, email, sms)",
  "voice": "string (voice name, default to helena)",
  "temperature": number (0.0 to 1.0, default 0.7),
  "confidence": number (0.0 to 1.0, default 0.8),
  "verbosity": number (0.0 to 1.0, default 0.7),
  "callAvailabilityStart": "string (time in HH:MM format, default 09:00)",
  "callAvailabilityEnd": "string (time in HH:MM format, default 17:00)",
  "callAvailabilityDays": ["array of strings", "monday", "tuesday", "wednesday", "thursday", "friday"]
}

IMPORTANT:
- Generate 1-5 unique welcome messages in the "welcomeMessages" array
- Each welcome message should be different, natural, and use {name} for personalization
- Make the script comprehensive and detailed, including full opening script
- Make the content professional, realistic, and tailored to the user's business description
- Be creative but professional with the welcome messages`;

    try {
      console.log('Sending request to OpenAI API...');
      const requestBody = {
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      };

      console.log('Request body:', { ...requestBody, messages: requestBody.messages.map(m => ({ ...m, content: m.content.substring(0, 100) + '...' })) });

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      console.log('Response status:', response.status, response.statusText);

      if (!response.ok) {
        let errorMessage = `OpenAI API error: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error?.message || errorMessage;
          console.error('OpenAI API error details:', errorData);
        } catch (parseError) {
          const errorText = await response.text().catch(() => 'No error details');
          console.error('OpenAI API error response:', errorText);
          errorMessage = `OpenAI API error (${response.status}): ${errorText.substring(0, 200)}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('OpenAI API response received');

      const content = data.choices[0]?.message?.content;

      if (!content) {
        console.error('No content in OpenAI response:', data);
        throw new Error('No response content from OpenAI. Please try again.');
      }

      console.log('Parsing OpenAI response content...');

      // Parse JSON response
      let agentConfig: AgentConfig;
      try {
        agentConfig = JSON.parse(content) as AgentConfig;
        console.log('Successfully parsed agent configuration');
      } catch (parseError: any) {
        console.error('Failed to parse JSON response:', parseError);
        console.error('Response content:', content);
        throw new Error('Failed to parse AI response. The response may not be in valid JSON format. Please try again.');
      }

      // Validate and set form data
      setFormData(prev => ({
        ...prev,
        agentName: agentConfig.agentName || prev.agentName,
        companyName: agentConfig.companyName || prev.companyName,
        websiteUrl: agentConfig.websiteUrl || prev.websiteUrl,
        goal: agentConfig.goal || prev.goal,
        backgroundContext: agentConfig.backgroundContext || prev.backgroundContext,
        welcomeMessage: agentConfig.welcomeMessage || prev.welcomeMessage,
        instructionVoice: agentConfig.instructionVoice || prev.instructionVoice,
        script: agentConfig.script || prev.script,
        language: agentConfig.language || prev.language,
        timezone: agentConfig.timezone || prev.timezone,
        agentType: agentConfig.agentType || prev.agentType,
        tool: agentConfig.tool || prev.tool,
        voice: agentConfig.voice || prev.voice,
        temperature: typeof agentConfig.temperature === 'number' ? agentConfig.temperature : prev.temperature,
        confidence: typeof agentConfig.confidence === 'number' ? agentConfig.confidence : prev.confidence,
        verbosity: typeof agentConfig.verbosity === 'number' ? agentConfig.verbosity : prev.verbosity,
        callAvailabilityStart: agentConfig.callAvailabilityStart || prev.callAvailabilityStart,
        callAvailabilityEnd: agentConfig.callAvailabilityEnd || prev.callAvailabilityEnd,
        callAvailabilityDays: Array.isArray(agentConfig.callAvailabilityDays)
          ? agentConfig.callAvailabilityDays
          : prev.callAvailabilityDays,
      }));

      // Handle welcome messages - prioritize welcomeMessages array, fallback to welcomeMessage
      if (agentConfig.welcomeMessages && Array.isArray(agentConfig.welcomeMessages) && agentConfig.welcomeMessages.length > 0) {
        setWelcomeMessages(agentConfig.welcomeMessages);
      } else if (agentConfig.welcomeMessage) {
        setWelcomeMessages([agentConfig.welcomeMessage]);
      } else {
        setWelcomeMessages([]);
      }

      // Auto-select first available number if none selected
      if (!selectedNumberId && inboundNumbers.length > 0) {
        setSelectedNumberId(inboundNumbers[0].id);
      }

      setShowAutofillDialog(false);
      setAutofillPrompt('');
      setHighlightEmptyFields(true);
      setStatusMessage({ type: 'success', text: 'Agent details generated and filled successfully! Empty fields are highlighted.' });
    } catch (error: any) {
      console.error('Error generating agent details:', error);
      setAutofillError(error.message || 'Failed to generate agent details. Please try again.');
      throw error;
    }
  };

  // Welcome messages handlers
  const handleAddWelcomeMessage = () => {
    if (newWelcomeMessage.trim() && welcomeMessages.length < 5) {
      setWelcomeMessages([...welcomeMessages, newWelcomeMessage.trim()]);
      setNewWelcomeMessage('');
    } else if (welcomeMessages.length >= 5) {
      toast({
        title: 'Maximum Reached',
        description: 'You can only add up to 5 welcome messages.',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveWelcomeMessage = (index: number) => {
    setWelcomeMessages(welcomeMessages.filter((_, i) => i !== index));
  };

  const handleWelcomeMessageKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && welcomeMessages.length < 5) {
      e.preventDefault();
      handleAddWelcomeMessage();
    } else if (welcomeMessages.length >= 5 && (e.key === 'Enter' || e.key === ',')) {
      e.preventDefault();
      toast({
        title: 'Maximum Reached',
        description: 'You can only add up to 5 welcome messages.',
        variant: 'destructive',
      });
    }
  };

  const handleGenerateAutofill = async (e?: React.MouseEvent) => {
    // Prevent form submission if button is inside a form
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!autofillPrompt.trim()) {
      setAutofillError('Please enter a description of your agent or business');
      return;
    }

    // Check for API key before starting
    const apiKey = process.env.REACT_APP_OPENAI_API || process.env.REACT_APP_OPENAI_API_KEY;
    if (!apiKey) {
      setAutofillError(
        'OpenAI API key is not configured. Please add REACT_APP_OPENAI_API to your .env.local file and restart the development server.'
      );
      return;
    }

    setAutofillLoading(true);
    setAutofillError(null);

    console.log('Starting AI autofill generation...');
    console.log('API Key present:', !!apiKey);
    console.log('Prompt length:', autofillPrompt.trim().length);

    try {
      await generateAgentDetails(autofillPrompt.trim());
      console.log('AI autofill completed successfully');
    } catch (error: any) {
      console.error('AI autofill error:', error);
      // Ensure error is displayed
      setAutofillError(error.message || 'Failed to generate agent details. Please check the console for details and try again.');
    } finally {
      setAutofillLoading(false);
    }
  };

  const handlePlayAudio = (audioUrl: string, voiceValue: string) => {
    // If the same voice is playing, stop it
    if (playingAudio === voiceValue && currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setPlayingAudio(null);
      setCurrentAudio(null);
      return;
    }

    // Stop any currently playing audio before starting a new one
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio.onended = null;
      currentAudio.onerror = null;
    }

    // Create and play new audio
    const audio = new Audio(audioUrl);
    setCurrentAudio(audio);
    setPlayingAudio(voiceValue);

    audio.play().catch((error) => {
      console.error('Error playing audio:', error);
      setPlayingAudio(null);
      setCurrentAudio(null);
    });

    audio.onended = () => {
      setPlayingAudio(null);
      setCurrentAudio(null);
    };

    audio.onerror = () => {
      console.error('Audio playback error');
      setPlayingAudio(null);
      setCurrentAudio(null);
    };
  };

  const getSelectedVoice = (): VoiceConfig | undefined => {
    return allVoices.find(v => v.value === formData.voice);
  };

  // Separate update handlers for each section
  const handleUpdateDetails = async () => {
    if (!isEditMode || !editingAgent || !user) return;

    setLoading(true);
    setStatusMessage(null);

    try {
      const updateData: any = {
        name: formData.agentName,
        company_name: formData.companyName,
        website_url: formData.websiteUrl,
        goal: formData.goal,
        background: formData.backgroundContext,
        updated_at: new Date().toISOString(),
      };

      // Update metadata for call availability
      const existingMetadata = editingAgent?.metadata || {};
      const updatedMetadata = {
        ...existingMetadata,
        call_availability_start: formData.callAvailabilityStart,
        call_availability_end: formData.callAvailabilityEnd,
        call_availability_days: formData.callAvailabilityDays,
      };

      updateData.metadata = updatedMetadata;

      // Handle number assignment if changed
      if (selectedNumberId) {
        const selectedNumber = getSelectedNumber();
        if (selectedNumber) {
          // Check if number is assigned to another agent
          if (selectedNumber.assigned_to_agent_id && selectedNumber.assigned_to_agent_id !== editingAgent.id) {
            const unBindWebhookUrl = process.env.REACT_APP_UN_BIND_WEBHOOK_URL;
            if (unBindWebhookUrl) {
              // Get the agent that currently has this number
              const { data: currentAgent, error: agentError } = await supabase
                .from('voice_agents')
                .select('*')
                .eq('id', selectedNumber.assigned_to_agent_id)
                .eq('user_id', user.id)
                .single();

              if (!agentError && currentAgent) {
                // Call unbind webhook
                try {
                  const unbindPayload = {
                    agent_id: currentAgent.id,
                    owner_user_id: user.id,
                    ...currentAgent,
                  };

                  const controller = new AbortController();
                  const timeoutId = setTimeout(() => controller.abort(), 30000);

                  const unbindResponse = await fetch(unBindWebhookUrl, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Accept': 'application/json',
                    },
                    body: JSON.stringify(unbindPayload),
                    signal: controller.signal,
                  });

                  clearTimeout(timeoutId);

                  if (!unbindResponse.ok) {
                    const errorText = await unbindResponse.text().catch(() => 'No error details available');
                    console.error(`Unbind webhook failed: ${errorText}`);
                  }
                } catch (unbindError: any) {
                  console.error('Error calling unbind webhook:', unbindError);
                }
              }

              // Remove assignment from inbound_numbers
              await supabase
                .from('inbound_numbers')
                .update({ assigned_to_agent_id: null, updated_at: new Date().toISOString() })
                .eq('id', selectedNumber.id);
            }
          }

          // Update agent's phone number fields
          updateData.phone_provider = selectedNumber.provider;
          updateData.phone_number = selectedNumber.phone_number;
          updateData.phone_label = selectedNumber.phone_label || '';

          // Add provider-specific fields
          if (selectedNumber.provider === 'twilio') {
            updateData.twilio_sid = selectedNumber.twilio_sid;
            updateData.twilio_auth_token = selectedNumber.twilio_auth_token;
            updateData.sms_enabled = selectedNumber.sms_enabled || false;
          } else if (selectedNumber.provider === 'vonage') {
            updateData.vonage_api_key = selectedNumber.vonage_api_key;
            updateData.vonage_api_secret = selectedNumber.vonage_api_secret;
          } else if (selectedNumber.provider === 'telnyx') {
            updateData.telnyx_api_key = selectedNumber.telnyx_api_key;
          }
        }
      }

      const { error: updateError } = await supabase
        .from('voice_agents')
        .update(updateData)
        .eq('id', editingAgent.id)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      // Update inbound number assignment if changed
      if (selectedNumberId) {
        const selectedNumber = getSelectedNumber();
        if (selectedNumber) {
          await supabase
            .from('inbound_numbers')
            .update({
              assigned_to_agent_id: editingAgent.id,
              is_in_use: true,
              updated_at: new Date().toISOString()
            })
            .eq('id', selectedNumberId);

          // Call bind webhook after successful assignment
          const bindWebhookUrl = process.env.REACT_APP_BIND_WEBHOOK_URL;
          if (bindWebhookUrl) {
            try {
              const { data: completeAgent } = await supabase
                .from('voice_agents')
                .select('*')
                .eq('id', editingAgent.id)
                .eq('user_id', user.id)
                .single();

              if (completeAgent) {
                // Fetch schedules for this agent
                const agentSchedules = await fetchAgentSchedules(completeAgent.id);

                const bindPayload = {
                  agent_id: completeAgent.id,
                  owner_user_id: user.id,
                  ...completeAgent,
                  schedules: agentSchedules,
                };

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000);

                const bindResponse = await fetch(bindWebhookUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                  },
                  body: JSON.stringify(bindPayload),
                  signal: controller.signal,
                });

                clearTimeout(timeoutId);

                if (!bindResponse.ok) {
                  const errorText = await bindResponse.text().catch(() => 'No error details available');
                  console.error(`Bind webhook failed: ${errorText}`);
                }
              }
            } catch (bindError: any) {
              console.error('Error calling bind webhook:', bindError);
            }
          }
        }
      }

      // Get complete updated agent data for webhook
      const { data: updatedAgent } = await supabase
        .from('voice_agents')
        .select('*')
        .eq('id', editingAgent.id)
        .eq('user_id', user.id)
        .single();

      // Call webhook with complete data
      if (updatedAgent) {
        await callEditWebhook(editingAgent.id, {
          ...updatedAgent,
          ...updateData,
        });
      }

      setStatusMessage({ type: 'success', text: 'Details updated successfully!' });
      loadAgentForEdit(editingAgent.id);
    } catch (error: any) {
      setStatusMessage({ type: 'error', text: error.message || 'Failed to update details' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateVoice = async () => {
    if (!isEditMode || !editingAgent || !user) return;

    setLoading(true);
    setStatusMessage(null);

    try {
      // Combine welcome messages - if multiple, store as JSON array; if single, store as string
      const welcomeMessageValue = welcomeMessages.length > 0
        ? (welcomeMessages.length === 1 ? welcomeMessages[0] : JSON.stringify(welcomeMessages))
        : formData.welcomeMessage || '';

      const updateData: any = {
        welcome_message: welcomeMessageValue,
        instruction_voice: formData.instructionVoice,
        script: formData.script,
        updated_at: new Date().toISOString(),
      };

      // Update metadata for call availability if needed
      const existingMetadata = editingAgent?.metadata || {};
      const updatedMetadata = {
        ...existingMetadata,
        call_availability_start: formData.callAvailabilityStart,
        call_availability_end: formData.callAvailabilityEnd,
        call_availability_days: formData.callAvailabilityDays,
      };

      updateData.metadata = updatedMetadata;

      const { error: updateError } = await supabase
        .from('voice_agents')
        .update(updateData)
        .eq('id', editingAgent.id)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      // Get complete updated agent data for webhook
      const { data: updatedAgent } = await supabase
        .from('voice_agents')
        .select('*')
        .eq('id', editingAgent.id)
        .eq('user_id', user.id)
        .single();

      // Call webhook with complete data
      if (updatedAgent) {
        await callEditWebhook(editingAgent.id, {
          ...updatedAgent,
          ...updateData,
        });
      }

      setStatusMessage({ type: 'success', text: 'Voice configuration updated successfully!' });
      loadAgentForEdit(editingAgent.id);
    } catch (error: any) {
      setStatusMessage({ type: 'error', text: error.message || 'Failed to update voice configuration' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSettings = async () => {
    if (!isEditMode || !editingAgent || !user) return;

    setLoading(true);
    setStatusMessage(null);

    try {
      // Get existing metadata and merge with updates
      const existingMetadata = editingAgent?.metadata || {};
      const updateData: any = {
        voice: formData.voice,
        language: formData.language,
        agent_type: formData.agentType,
        tool: formData.tool,
        timezone: formData.timezone,
        tone: 'professional', // Default tone
        temperature: formData.temperature,
        confidence: formData.confidence,
        verbosity: formData.verbosity,
        fallback_enabled: formData.fallbackEnabled,
        fallback_number: formData.fallbackEnabled ? formData.fallbackNumber : null,
        knowledge_base_id: formData.knowledgeBaseId || null,
        metadata: {
          ...existingMetadata,
          call_availability_start: formData.callAvailabilityStart,
          call_availability_end: formData.callAvailabilityEnd,
          call_availability_days: formData.callAvailabilityDays,
          fallback_config: {
            enabled: formData.fallbackEnabled,
            number: formData.fallbackNumber,
          },
        },
        updated_at: new Date().toISOString(),
      };

      // Update inbound number assignment if changed
      if (selectedNumberId && selectedNumberId !== editingAgent.phone_number) {
        const selectedNumber = getSelectedNumber();
        if (selectedNumber) {
          updateData.phone_provider = selectedNumber.provider;
          updateData.phone_number = selectedNumber.phone_number;
          updateData.phone_label = selectedNumber.phone_label || '';

          // Add provider-specific fields
          if (selectedNumber.provider === 'twilio') {
            updateData.twilio_sid = selectedNumber.twilio_sid;
            updateData.twilio_auth_token = selectedNumber.twilio_auth_token;
            updateData.sms_enabled = selectedNumber.sms_enabled || false;
          } else if (selectedNumber.provider === 'vonage') {
            updateData.vonage_api_key = selectedNumber.vonage_api_key;
            updateData.vonage_api_secret = selectedNumber.vonage_api_secret;
          } else if (selectedNumber.provider === 'telnyx') {
            updateData.telnyx_api_key = selectedNumber.telnyx_api_key;
          }
        }
      }

      const { error: updateError } = await supabase
        .from('voice_agents')
        .update(updateData)
        .eq('id', editingAgent.id)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      // Update inbound number assignment if changed
      if (selectedNumberId) {
        const selectedNumber = getSelectedNumber();
        if (selectedNumber) {
          // Check if number is assigned to another agent
          if (selectedNumber.assigned_to_agent_id && selectedNumber.assigned_to_agent_id !== editingAgent.id) {
            const unBindWebhookUrl = process.env.REACT_APP_UN_BIND_WEBHOOK_URL;
            if (unBindWebhookUrl) {
              // Get the agent that currently has this number
              const { data: currentAgent, error: agentError } = await supabase
                .from('voice_agents')
                .select('*')
                .eq('id', selectedNumber.assigned_to_agent_id)
                .eq('user_id', user.id)
                .single();

              if (!agentError && currentAgent) {
                // Call unbind webhook
                try {
                  const unbindPayload = {
                    agent_id: currentAgent.id,
                    owner_user_id: user.id,
                    ...currentAgent,
                  };

                  const controller = new AbortController();
                  const timeoutId = setTimeout(() => controller.abort(), 30000);

                  const unbindResponse = await fetch(unBindWebhookUrl, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Accept': 'application/json',
                    },
                    body: JSON.stringify(unbindPayload),
                    signal: controller.signal,
                  });

                  clearTimeout(timeoutId);

                  if (!unbindResponse.ok) {
                    const errorText = await unbindResponse.text().catch(() => 'No error details available');
                    console.error(`Unbind webhook failed: ${errorText}`);
                  }
                } catch (unbindError: any) {
                  console.error('Error calling unbind webhook:', unbindError);
                }
              }

              // Remove assignment from inbound_numbers
              await supabase
                .from('inbound_numbers')
                .update({ assigned_to_agent_id: null, updated_at: new Date().toISOString() })
                .eq('id', selectedNumber.id);
            }
          }

          // Assign number to this agent
          await supabase
            .from('inbound_numbers')
            .update({
              assigned_to_agent_id: editingAgent.id,
              is_in_use: true,
              updated_at: new Date().toISOString()
            })
            .eq('id', selectedNumberId);

          // Call bind webhook after successful assignment
          const bindWebhookUrl = process.env.REACT_APP_BIND_WEBHOOK_URL;
          if (bindWebhookUrl) {
            try {
              const { data: completeAgent } = await supabase
                .from('voice_agents')
                .select('*')
                .eq('id', editingAgent.id)
                .eq('user_id', user.id)
                .single();

              if (completeAgent) {
                // Fetch schedules for this agent
                const agentSchedules = await fetchAgentSchedules(completeAgent.id);

                const bindPayload = {
                  agent_id: completeAgent.id,
                  owner_user_id: user.id,
                  ...completeAgent,
                  schedules: agentSchedules,
                };

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000);

                const bindResponse = await fetch(bindWebhookUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                  },
                  body: JSON.stringify(bindPayload),
                  signal: controller.signal,
                });

                clearTimeout(timeoutId);

                if (!bindResponse.ok) {
                  const errorText = await bindResponse.text().catch(() => 'No error details available');
                  console.error(`Bind webhook failed: ${errorText}`);
                }
              }
            } catch (bindError: any) {
              console.error('Error calling bind webhook:', bindError);
            }
          }
        }
      }

      // Get complete updated agent data for webhook
      const { data: updatedAgent } = await supabase
        .from('voice_agents')
        .select('*')
        .eq('id', editingAgent.id)
        .eq('user_id', user.id)
        .single();

      // Call webhook with complete data
      if (updatedAgent) {
        await callEditWebhook(editingAgent.id, {
          ...updatedAgent,
          ...updateData,
        });
      }

      setStatusMessage({ type: 'success', text: 'Agent settings updated successfully!' });
      loadAgentForEdit(editingAgent.id);
    } catch (error: any) {
      setStatusMessage({ type: 'error', text: error.message || 'Failed to update settings' });
    } finally {
      setLoading(false);
    }
  };

  // Helper function to fetch schedules for an agent
  const fetchAgentSchedules = async (agentId: string): Promise<any[]> => {
    try {
      const { data: agentScheduleLinks } = await supabase
        .from('agent_schedules')
        .select('schedule_id')
        .eq('agent_id', agentId);

      if (agentScheduleLinks && agentScheduleLinks.length > 0) {
        const scheduleIds = agentScheduleLinks.map((link: { schedule_id: string }) => link.schedule_id);
        const { data: schedules } = await supabase
          .from('call_schedules')
          .select('*')
          .in('id', scheduleIds)
          .is('deleted_at', null);

        // Fetch complete schedule data including related tables
        const schedulesWithDetails = await Promise.all(
          (schedules || []).map(async (schedule: any) => {
            // Fetch weekly availability
            const { data: weeklyAvailability } = await supabase
              .from('weekly_availability')
              .select('*')
              .eq('schedule_id', schedule.id);

            // Fetch holidays
            const { data: holidays } = await supabase
              .from('holidays')
              .select('*')
              .eq('schedule_id', schedule.id)
              .is('deleted_at', null)
              .eq('is_active', true);

            // Fetch schedule overrides
            const { data: scheduleOverrides } = await supabase
              .from('schedule_overrides')
              .select('*')
              .eq('schedule_id', schedule.id)
              .is('deleted_at', null);

            // Fetch after hours messages
            const { data: afterHoursMessages } = await supabase
              .from('after_hours_messages')
              .select('*')
              .eq('schedule_id', schedule.id)
              .is('deleted_at', null);

            return {
              ...schedule,
              weekly_availability: weeklyAvailability || [],
              holidays: holidays || [],
              schedule_overrides: scheduleOverrides || [],
              after_hours_messages: afterHoursMessages || [],
            };
          })
        );

        return schedulesWithDetails;
      }
      return [];
    } catch (error) {
      console.error('Error fetching agent schedules:', error);
      return [];
    }
  };

  // Helper function to call edit webhook
  const callEditWebhook = async (agentId: string, updateData: any) => {
    if (!user) return;

    const editWebhookUrl = process.env.REACT_APP_EDIT_AGENT_WEBHOOK_URL;
    if (!editWebhookUrl) {
      console.warn('Edit agent webhook URL is not configured');
      return;
    }

    try {
      const cleanWebhookUrl = (() => {
        try {
          const url = new URL(editWebhookUrl);
          url.port = '';
          return url.toString();
        } catch {
          return editWebhookUrl;
        }
      })();

      // Get full agent data for webhook to ensure we send complete data
      const { data: currentAgent } = await supabase
        .from('voice_agents')
        .select('*')
        .eq('id', agentId)
        .eq('user_id', user.id)
        .single();

      if (!currentAgent) {
        throw new Error('Agent not found');
      }

      // Fetch schedules assigned to this agent using junction table
      const agentSchedules = await fetchAgentSchedules(agentId);

      // Merge current agent data with updates for complete webhook payload
      const webhookPayload = {
        agent_id: agentId,
        owner_user_id: user.id,
        ...currentAgent,
        ...updateData,
        voice_provider: getSelectedVoice()?.provider || currentAgent.voice_provider || 'deepgram',
        executionMode: 'production',
        schedules: agentSchedules,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const webhookResponse = await fetch(cleanWebhookUrl, {
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
        const errorText = await webhookResponse.text().catch(() => 'No error details available');
        throw new Error(`Edit webhook failed: ${webhookResponse.status} ${webhookResponse.statusText} - ${errorText}`);
      }
    } catch (webhookError: any) {
      if (webhookError.name === 'AbortError' || webhookError.message.includes('timeout')) {
        throw new Error('Webhook request timed out. Please try again.');
      }
      throw webhookError;
    }
  };

  const saveDraft = async (nextSection?: 'details' | 'voice' | 'settings' | 'schedules') => {
    // Prevent double submission - check both ref and state
    if (isSubmittingRef.current || loading) {
      return;
    }

    if (!user) {
      setStatusMessage({ type: 'error', text: 'You must be logged in to save a draft' });
      return;
    }

    // Set submission flag immediately
    isSubmittingRef.current = true;
    setLoading(true);
    setStatusMessage(null);

    try {
      const currentTime = new Date().toISOString();
      const selectedNumber = getSelectedNumber();

      const draftData: any = {
        user_id: user.id,
        name: formData.agentName || 'Untitled Draft',
        company_name: formData.companyName || null,
        website_url: formData.websiteUrl || null,
        goal: formData.goal || null,
        background: formData.backgroundContext || null,
        welcome_message: welcomeMessages.length > 0
          ? (welcomeMessages.length === 1 ? welcomeMessages[0] : JSON.stringify(welcomeMessages))
          : formData.welcomeMessage || null,
        instruction_voice: formData.instructionVoice || null,
        script: formData.script || null,
        language: formData.language || null,
        timezone: formData.timezone || null,
        agent_type: formData.agentType || null,
        tool: formData.tool || null,
        voice: formData.voice || null,
        voice_provider: getSelectedVoice()?.provider || 'deepgram',
        temperature: formData.temperature,
        confidence: formData.confidence,
        verbosity: formData.verbosity,
        fallback_enabled: formData.fallbackEnabled ?? false,
        fallback_number: formData.fallbackEnabled ? formData.fallbackNumber : null,
        tone: 'professional',
        model: 'gpt-4o',
        background_noise: 'office',
        phone_provider: selectedNumber?.provider || null,
        phone_number: selectedNumber?.phone_number || null,
        phone_label: selectedNumber?.phone_label || null,
        status: 'draft',
        updated_at: currentTime,
        knowledge_base_id: formData.knowledgeBaseId || null,
        metadata: {
          call_availability_start: formData.callAvailabilityStart,
          call_availability_end: formData.callAvailabilityEnd,
          call_availability_days: formData.callAvailabilityDays,
          draft_section: nextSection || activeSection,
          fallback_config: {
            enabled: formData.fallbackEnabled,
            number: formData.fallbackNumber,
          },
        },
      };

      if (isEditMode && editingAgent) {
        // Update existing agent as draft
        const { error: updateError } = await supabase
          .from('voice_agents')
          .update(draftData)
          .eq('id', editingAgent.id)
          .eq('user_id', user.id);

        if (updateError) throw updateError;
        setStatusMessage({ type: 'success', text: 'Draft saved successfully!' });
      } else {
        // Check if there's already a draft with no id set
        const draftId = editingAgent?.id || crypto.randomUUID();
        draftData.id = draftId;
        draftData.created_at = currentTime;

        const { error: insertError } = await supabase
          .from('voice_agents')
          .upsert(draftData, { onConflict: 'id' });

        if (insertError) throw insertError;

        // Set the editing agent so future saves update instead of creating new
        setEditingAgent({ ...draftData, id: draftId } as any);
        setStatusMessage({ type: 'success', text: 'Draft saved successfully!' });
      }

      // Move to next section if specified
      if (nextSection) {
        setActiveSection(nextSection);
      }

      // Clear status after 3 seconds
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      console.error('Error saving draft:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to save draft' });
    } finally {
      setLoading(false);
      isSubmittingRef.current = false; // Reset submission flag
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent double submission - check both ref (synchronous) and state
    if (isSubmittingRef.current || loading) {
      return;
    }
    
    // Set submission flag immediately (synchronous)
    isSubmittingRef.current = true;
    setLoading(true);
    setStatusMessage(null);

    if (!selectedNumberId) {
      setStatusMessage({ type: 'error', text: 'Please select an inbound number before creating the agent' });
      setLoading(false);
      isSubmittingRef.current = false;
      return;
    }

    const selectedNumber = getSelectedNumber();
    if (!selectedNumber) {
      setStatusMessage({ type: 'error', text: 'Selected number not found. Please refresh and try again.' });
      setLoading(false);
      isSubmittingRef.current = false;
      return;
    }

    if (!user) {
      setStatusMessage({ type: 'error', text: 'You must be logged in to create an agent' });
      setLoading(false);
      isSubmittingRef.current = false;
      return;
    }

    // Check credits for new agents and drafts being created (not active/inactive edits)
    if (!isEditMode || isDraft) {
      const creditCheck = await hasEnoughCredits(user.id, CREDIT_RATES.AGENT_CREATION);

      if (!creditCheck.hasEnough) {
        setStatusMessage({
          type: 'error',
          text: creditCheck.message || 'Insufficient credits. Creating an agent requires 5 credits.'
        });
        setLoading(false);
        isSubmittingRef.current = false;
        return;
      }
    }

    try {
      // Check if selected number is already assigned to another agent
      const selectedNumber = getSelectedNumber();
      if (!selectedNumber) {
        setStatusMessage({ type: 'error', text: 'Selected number not found. Please refresh and try again.' });
        setLoading(false);
        isSubmittingRef.current = false;
        return;
      }

      if (selectedNumber.assigned_to_agent_id) {
        // If creating new agent or editing different agent, need to unbind first
        if (!isEditMode || (editingAgent && selectedNumber.assigned_to_agent_id !== editingAgent.id)) {
          const unBindWebhookUrl = process.env.REACT_APP_UN_BIND_WEBHOOK_URL;
          if (!unBindWebhookUrl) {
            throw new Error('Unbind webhook URL is not configured');
          }

          // Get the agent that currently has this number
          const { data: currentAgent, error: agentError } = await supabase
            .from('voice_agents')
            .select('*')
            .eq('id', selectedNumber.assigned_to_agent_id)
            .eq('user_id', user.id)
            .single();

          if (agentError && agentError.code !== 'PGRST116') {
            console.error('Error fetching current agent:', agentError);
          }

          if (currentAgent) {
            // For new agent creation, set previous agent status to inactive first
            await supabase
              .from('voice_agents')
              .update({
                status: 'inactive',
                updated_at: new Date().toISOString(),
              })
              .eq('id', currentAgent.id)
              .eq('user_id', user.id);

            // For new agent creation, always call unbind webhook first
            // Prepare unbind webhook payload
            const unbindPayload = {
              agent_id: currentAgent.id,
              owner_user_id: user.id,
              ...currentAgent,
            };

            // Call unbind webhook BEFORE creating new agent
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            const unbindResponse = await fetch(unBindWebhookUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
              },
              body: JSON.stringify(unbindPayload),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!unbindResponse.ok) {
              const errorText = await unbindResponse.text().catch(() => 'No error details available');
              throw new Error(`Failed to unbind number from existing agent: ${unbindResponse.status} ${unbindResponse.statusText} - ${errorText}`);
            }

            // Remove assignment from inbound_numbers
            await supabase
              .from('inbound_numbers')
              .update({
                assigned_to_agent_id: null,
                is_in_use: false,
                updated_at: new Date().toISOString()
              })
              .eq('id', selectedNumber.id);
          }
        }
      }

      const currentAgentId = isEditMode && editingAgent ? editingAgent.id : crypto.randomUUID();
      const currentTime = new Date().toISOString();

      const agentData: any = {
        id: currentAgentId,
        user_id: user.id,
        name: formData.agentName,
        company_name: formData.companyName,
        website_url: formData.websiteUrl,
        goal: formData.goal,
        background: formData.backgroundContext,
        welcome_message: welcomeMessages.length > 0
          ? (welcomeMessages.length === 1 ? welcomeMessages[0] : JSON.stringify(welcomeMessages))
          : formData.welcomeMessage || '',
        instruction_voice: formData.instructionVoice,
        script: formData.script,
        language: formData.language,
        timezone: formData.timezone,
        agent_type: formData.agentType,
        tool: formData.tool,
        voice: formData.voice,
        voice_provider: getSelectedVoice()?.provider || 'deepgram',
        temperature: formData.temperature,
        confidence: formData.confidence,
        verbosity: formData.verbosity,
        fallback_enabled: formData.fallbackEnabled,
        fallback_number: formData.fallbackEnabled ? formData.fallbackNumber : null,
        tone: 'professional',
        model: 'gpt-4o',
        background_noise: 'office',
        phone_provider: selectedNumber!.provider,
        phone_number: selectedNumber!.phone_number,
        phone_label: selectedNumber!.phone_label || '',
        status: (isEditMode && !isDraft) ? 'active' : 'activating',
        created_at: currentTime,
        updated_at: currentTime,
        knowledge_base_id: formData.knowledgeBaseId || null,
        metadata: {
          call_availability_start: formData.callAvailabilityStart,
          call_availability_end: formData.callAvailabilityEnd,
          call_availability_days: formData.callAvailabilityDays,
          fallback_config: {
            enabled: formData.fallbackEnabled,
            number: formData.fallbackNumber,
          },
        },
      };

      if (selectedNumber!.provider === 'twilio') {
        agentData.twilio_sid = selectedNumber!.twilio_sid;
        agentData.twilio_auth_token = selectedNumber!.twilio_auth_token;
        agentData.sms_enabled = selectedNumber!.sms_enabled || false;
      } else if (selectedNumber!.provider === 'vonage') {
        agentData.vonage_api_key = selectedNumber!.vonage_api_key;
        agentData.vonage_api_secret = selectedNumber!.vonage_api_secret;
      } else if (selectedNumber!.provider === 'telnyx') {
        agentData.telnyx_api_key = selectedNumber!.telnyx_api_key;
      }

      // Fetch knowledge base FAQs and documents if a knowledge base is selected
      let knowledgeBaseData = null;
      if (formData.knowledgeBaseId) {
        try {
          // Fetch FAQs
          const { data: faqsData, error: faqsError } = await supabase
            .from('knowledge_base_faqs')
            .select('id, question, answer, category, priority, display_order')
            .eq('knowledge_base_id', formData.knowledgeBaseId)
            .is('deleted_at', null)
            .order('priority', { ascending: false })
            .order('display_order', { ascending: true });

          if (faqsError) {
            console.error('Error fetching FAQs:', faqsError);
          }

          // Fetch Documents
          const { data: docsData, error: docsError } = await supabase
            .from('knowledge_base_documents')
            .select('id, name, file_type, file_url, file_size, description, storage_path')
            .eq('knowledge_base_id', formData.knowledgeBaseId)
            .is('deleted_at', null)
            .order('uploaded_at', { ascending: false });

          if (docsError) {
            console.error('Error fetching documents:', docsError);
          }

          knowledgeBaseData = {
            id: formData.knowledgeBaseId,
            faqs: faqsData || [],
            documents: docsData || [],
          };
        } catch (err: any) {
          console.error('Error fetching knowledge base data:', err);
          // Continue without knowledge base data if fetch fails
        }
      }

      // Call appropriate webhook based on mode
      // Draft agents use creation webhook; only active/inactive agents use edit webhook
      if (isEditMode && !isDraft) {
        const editWebhookUrl = process.env.REACT_APP_EDIT_AGENT_WEBHOOK_URL;
        if (!editWebhookUrl) {
          throw new Error('Edit agent webhook URL is not configured');
        }

        // Remove port number from URL if present
        // Handles cases like: https://example.com:8080/path -> https://example.com/path
        // or https://example.com:8080 -> https://example.com
        const cleanWebhookUrl = (() => {
          try {
            const url = new URL(editWebhookUrl);
            // Remove port completely (browser will use default port for http/https)
            url.port = '';
            return url.toString();
          } catch {
            // If URL parsing fails, use regex fallback to remove port pattern
            return editWebhookUrl.replace(/:\d+(\/|$)/, '$1');
          }
        })();

        try {
          // Fetch schedules assigned to this agent using junction table
          const agentSchedules = await fetchAgentSchedules(currentAgentId);

          const webhookPayload = {
            agent_id: currentAgentId,
            owner_user_id: user.id,
            ...agentData,
            voice_provider: getSelectedVoice()?.provider || 'deepgram',
            executionMode: 'production',
            confidence: formData.confidence,
            verbosity: formData.verbosity,
            fallback_enabled: formData.fallbackEnabled,
            fallback_number: formData.fallbackEnabled ? formData.fallbackNumber : null,
            knowledge_base_id: formData.knowledgeBaseId || null,
            knowledge_base: knowledgeBaseData,
            call_availability: {
              start_time: formData.callAvailabilityStart,
              end_time: formData.callAvailabilityEnd,
              days: formData.callAvailabilityDays,
            },
            fallback_config: {
              enabled: formData.fallbackEnabled,
              number: formData.fallbackNumber,
            },
            schedules: agentSchedules,
          };

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);

          const webhookResponse = await fetch(cleanWebhookUrl, {
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
            const errorText = await webhookResponse.text().catch(() => 'No error details available');
            throw new Error(`Edit webhook failed: ${webhookResponse.status} ${webhookResponse.statusText} - ${errorText}`);
          }

          try {
            const responseData = await webhookResponse.json();
            console.log('Edit webhook success response:', responseData);
          } catch (parseError) {
            const textResponse = await webhookResponse.text();
            console.log('Edit webhook success response (text):', textResponse);
          }
        } catch (webhookError: any) {
          if (webhookError.message.includes('Failed to fetch') || webhookError.name === 'TypeError') {
            throw new Error(
              'Edit webhook call failed due to CORS or network error. ' +
              'The webhook server needs to allow requests from this origin. ' +
              'Please contact your administrator or use a backend proxy endpoint.'
            );
          }

          if (webhookError.name === 'AbortError' || webhookError.message.includes('timeout')) {
            throw new Error('Edit webhook request timed out. Please try again.');
          }

          throw new Error(`Failed to update agent via webhook: ${webhookError.message || 'Unknown error'}`);
        }
      } else {
        const botWebhookUrl = process.env.REACT_APP_BOT_CREATION_WEBHOOK_URL;
        if (!botWebhookUrl) {
          throw new Error('Bot creation webhook URL is not configured');
        }

        try {
          // Fetch schedules assigned to this agent using junction table
          const agentSchedules = await fetchAgentSchedules(currentAgentId);

          const webhookPayload = {
            agent_id: currentAgentId,
            owner_user_id: user.id,
            ...agentData,
            vapi_id: null,
            vapi_account_assigned: 2,
            account_in_use: false,
            voice_provider: getSelectedVoice()?.provider || 'deepgram',
            executionMode: 'production',
            confidence: formData.confidence,
            verbosity: formData.verbosity,
            fallback_enabled: formData.fallbackEnabled,
            fallback_number: formData.fallbackEnabled ? formData.fallbackNumber : null,
            knowledge_base_id: formData.knowledgeBaseId || null,
            knowledge_base: knowledgeBaseData,
            call_availability: {
              start_time: formData.callAvailabilityStart,
              end_time: formData.callAvailabilityEnd,
              days: formData.callAvailabilityDays,
            },
            fallback_config: {
              enabled: formData.fallbackEnabled,
              number: formData.fallbackNumber,
            },
            schedules: agentSchedules,
          };

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);

          const webhookResponse = await fetch(botWebhookUrl, {
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
            const errorText = await webhookResponse.text().catch(() => 'No error details available');
            throw new Error(`Webhook failed: ${webhookResponse.status} ${webhookResponse.statusText} - ${errorText}`);
          }

          try {
            const responseData = await webhookResponse.json();
            console.log('Webhook success response:', responseData);
          } catch (parseError) {
            const textResponse = await webhookResponse.text();
            console.log('Webhook success response (text):', textResponse);
          }
        } catch (webhookError: any) {
          if (webhookError.message.includes('Failed to fetch') || webhookError.name === 'TypeError') {
            throw new Error(
              'Webhook call failed due to CORS or network error. ' +
              'The webhook server needs to allow requests from this origin. ' +
              'Please contact your administrator or use a backend proxy endpoint.'
            );
          }

          if (webhookError.name === 'AbortError' || webhookError.message.includes('timeout')) {
            throw new Error('Webhook request timed out. Please try again.');
          }

          throw new Error(`Failed to create agent via webhook: ${webhookError.message || 'Unknown error'}`);
        }
      }

      let data: any;
      if (isEditMode && !isDraft) {
        // Update existing active/inactive agent - preserve existing metadata and merge with new call availability
        const existingMetadata = editingAgent?.metadata || {};
        const updatedMetadata = {
          ...existingMetadata,
          call_availability_start: formData.callAvailabilityStart,
          call_availability_end: formData.callAvailabilityEnd,
          call_availability_days: formData.callAvailabilityDays,
          fallback_config: {
            enabled: formData.fallbackEnabled,
            number: formData.fallbackNumber,
          },
        };

        const { data: updateData, error: updateError } = await supabase
          .from('voice_agents')
          .update({
            ...agentData,
            confidence: formData.confidence,
            verbosity: formData.verbosity,
            fallback_enabled: formData.fallbackEnabled,
            fallback_number: formData.fallbackEnabled ? formData.fallbackNumber : null,
            metadata: updatedMetadata,
            updated_at: currentTime,
          })
          .eq('id', currentAgentId)
          .eq('user_id', user.id)
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }
        data = updateData;

        // Update schedule assignments for edited agent using junction table
        // First, remove all existing schedule assignments for this agent
        await supabase
          .from('agent_schedules')
          .delete()
          .eq('agent_id', currentAgentId);

        // Then, assign selected schedules to this agent
        if (selectedScheduleIds.length > 0) {
          const scheduleLinks = selectedScheduleIds.map(scheduleId => ({
            agent_id: currentAgentId,
            schedule_id: scheduleId,
          }));
          await supabase
            .from('agent_schedules')
            .insert(scheduleLinks);
        }
      } else if (isDraft) {
        // Draft agent being created — update existing draft row with full agent data
        const { data: updateData, error: updateError } = await supabase
          .from('voice_agents')
          .update({
            ...agentData,
            confidence: formData.confidence,
            verbosity: formData.verbosity,
            fallback_enabled: formData.fallbackEnabled,
            fallback_number: formData.fallbackEnabled ? formData.fallbackNumber : null,
            metadata: {
              call_availability_start: formData.callAvailabilityStart,
              call_availability_end: formData.callAvailabilityEnd,
              call_availability_days: formData.callAvailabilityDays,
              fallback_config: {
                enabled: formData.fallbackEnabled,
                number: formData.fallbackNumber,
              },
            },
            updated_at: currentTime,
          })
          .eq('id', currentAgentId)
          .eq('user_id', user.id)
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }
        data = updateData;

        // Update schedule assignments
        await supabase
          .from('agent_schedules')
          .delete()
          .eq('agent_id', currentAgentId);

        if (selectedScheduleIds.length > 0) {
          const scheduleLinks = selectedScheduleIds.map(scheduleId => ({
            agent_id: currentAgentId,
            schedule_id: scheduleId,
          }));
          await supabase
            .from('agent_schedules')
            .insert(scheduleLinks);
        }

        // Deduct credits for draft → created (same as new agent)
        const creditDeduction = await deductAgentCreationCredits(
          user.id,
          data.id,
          formData.agentName
        );

        if (!creditDeduction.success) {
          // Revert to draft status if credit deduction fails
          await supabase
            .from('voice_agents')
            .update({ status: 'draft', updated_at: new Date().toISOString() })
            .eq('id', data.id);

          await supabase
            .from('inbound_numbers')
            .update({
              is_in_use: false,
              assigned_to_agent_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', selectedNumberId);

          throw new Error(creditDeduction.error || 'Failed to deduct credits. Agent creation cancelled.');
        }

        // Send notification for agent creation and credit deduction
        if (creditDeduction.success && user) {
          try {
            await NotificationHelpers.agentCreated(
              user.id,
              formData.agentName,
              data.id,
              creditDeduction.creditsDeducted || CREDIT_RATES.AGENT_CREATION
            );
          } catch (notifError) {
            console.error('Error sending notification:', notifError);
            // Don't fail the creation if notification fails
          }
        }
      } else {
        // Check for duplicate agent (same name and phone number) created recently
        const { data: existingAgent, error: checkError } = await supabase
          .from('voice_agents')
          .select('id, name, phone_number, created_at')
          .eq('user_id', user.id)
          .eq('name', formData.agentName)
          .eq('phone_number', selectedNumber!.phone_number)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // If duplicate found and created within last 5 seconds, prevent creation
        if (existingAgent && !checkError) {
          const createdTime = new Date(existingAgent.created_at).getTime();
          const now = Date.now();
          const timeDiff = (now - createdTime) / 1000; // seconds

          if (timeDiff < 5) {
            // Duplicate detected - likely from double-click
            setLoading(false);
            isSubmittingRef.current = false;
            setStatusMessage({
              type: 'error',
              text: 'Agent creation already in progress. Please wait a moment and refresh the page.'
            });
            return;
          }
        }

        // Insert brand new agent
        const { data: insertData, error: insertError } = await supabase
          .from('voice_agents')
          .insert(agentData)
          .select()
          .single();

        if (insertError) {
          // Check if it's a duplicate key error
          if (insertError.code === '23505' || insertError.message?.includes('duplicate key')) {
            setLoading(false);
            isSubmittingRef.current = false;
            setStatusMessage({
              type: 'error',
              text: 'An agent with this configuration already exists. Please refresh the page.'
            });
            return;
          }
          throw insertError;
        }
        data = insertData;

        // Assign selected schedules to new agent using junction table
        if (selectedScheduleIds.length > 0) {
          const scheduleLinks = selectedScheduleIds.map(scheduleId => ({
            agent_id: data.id,
            schedule_id: scheduleId,
          }));
          await supabase
            .from('agent_schedules')
            .insert(scheduleLinks);
        }

        // Deduct credits only for new agents
        const creditDeduction = await deductAgentCreationCredits(
          user.id,
          data.id,
          formData.agentName
        );

        if (!creditDeduction.success) {
          await supabase
            .from('voice_agents')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', data.id);

          await supabase
            .from('inbound_numbers')
            .update({
              is_in_use: false,
              assigned_to_agent_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', selectedNumberId);

          throw new Error(creditDeduction.error || 'Failed to deduct credits. Agent creation cancelled.');
        }

        // Send notification for agent creation and credit deduction
        if (creditDeduction.success && user) {
          try {
            await NotificationHelpers.agentCreated(
              user.id,
              formData.agentName,
              data.id,
              creditDeduction.creditsDeducted || CREDIT_RATES.AGENT_CREATION
            );
          } catch (notifError) {
            console.error('Error sending notification:', notifError);
            // Don't fail the creation if notification fails
          }
        }
      }

      // Check if number was previously assigned to another agent and handle it
      // Re-fetch to get latest assignment status (in case it changed)
      const { data: currentNumberData } = await supabase
        .from('inbound_numbers')
        .select('assigned_to_agent_id')
        .eq('id', selectedNumberId)
        .single();

      const previousAgentId = currentNumberData?.assigned_to_agent_id;

      // Only process if number was assigned to a different agent (not the current one being edited)
      if (previousAgentId && previousAgentId !== data.id) {
        // Get the previous agent's full data for unbind webhook
        const { data: previousAgent, error: prevAgentError } = await supabase
          .from('voice_agents')
          .select('*')
          .eq('id', previousAgentId)
          .eq('user_id', user.id)
          .single();

        if (prevAgentError && prevAgentError.code !== 'PGRST116') {
          console.error('Error fetching previous agent:', prevAgentError);
        }

        // Call unbind webhook if previous agent exists
        if (previousAgent) {
          const unBindWebhookUrl = process.env.REACT_APP_UN_BIND_WEBHOOK_URL;
          if (unBindWebhookUrl) {
            try {
              const unbindPayload = {
                agent_id: previousAgent.id,
                owner_user_id: user.id,
                ...previousAgent,
              };

              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 30000);

              const unbindResponse = await fetch(unBindWebhookUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                },
                body: JSON.stringify(unbindPayload),
                signal: controller.signal,
              });

              clearTimeout(timeoutId);

              if (!unbindResponse.ok) {
                const errorText = await unbindResponse.text().catch(() => 'No error details available');
                console.error(`Unbind webhook failed for agent ${previousAgent.id}: ${errorText}`);
                // Continue with assignment even if unbind fails, but log the error
              }
            } catch (unbindError: any) {
              console.error('Error calling unbind webhook:', unbindError);
              // Continue with assignment even if unbind fails
            }
          }
        }

        // Disable the previous agent
        await supabase
          .from('voice_agents')
          .update({
            status: 'inactive',
            updated_at: new Date().toISOString(),
          })
          .eq('id', previousAgentId)
          .eq('user_id', user.id);

        // Remove number assignment from previous agent (clear any other numbers assigned to that agent)
        await supabase
          .from('inbound_numbers')
          .update({
            is_in_use: false,
            assigned_to_agent_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq('assigned_to_agent_id', previousAgentId)
          .neq('id', selectedNumberId);
      }

      // Update inbound number assignment to new agent
      await supabase
        .from('inbound_numbers')
        .update({
          is_in_use: true,
          assigned_to_agent_id: data.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedNumberId);

      // Note: Bind webhook is NOT called here during agent creation
      // Bind webhook should only be called when agent status is changed to 'active' (enabled)
      // This is handled in VoiceAgents.tsx when toggling agent status

      if (isEditMode && !isDraft) {
        setStatusMessage({
          type: 'success',
          text: 'Agent updated successfully!'
        });
      } else {
        setStatusMessage({
          type: 'success',
          text: 'Agent created successfully! 5 credits deducted. Your agent is being activated and will be ready shortly.'
        });

        // Status will be changed to 'active' by n8n backend when ready
        // No need for client-side timer
      }

      setTimeout(() => {
        navigate('/agents');
      }, 2000);
    } catch (error: any) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} agent:`, error);
      setStatusMessage({ type: 'error', text: error.message || `Failed to ${isEditMode ? 'update' : 'create'} agent. Please try again.` });
    } finally {
      setLoading(false);
      isSubmittingRef.current = false; // Reset submission flag
    }
  };

  const resetForm = () => {
    // Stop any currently playing audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio.onended = null;
      currentAudio.onerror = null;
      setCurrentAudio(null);
    }

    setFormData({
      agentName: '',
      companyName: 'DNAI', // Default company name
      websiteUrl: 'https://duhanashrah.ai', // Default website URL
      goal: '',
      backgroundContext: '',
      welcomeMessage: '',
      instructionVoice: '',
      script: '',
      language: 'en-US',
      timezone: '',
      agentType: '',
      tool: '',
      voice: 'helena',
      temperature: 0.7,
      confidence: 0.8,
      verbosity: 0.7,
      fallbackEnabled: false,
      fallbackNumber: '',
      knowledgeBaseId: '',
      callAvailabilityStart: '09:00',
      callAvailabilityEnd: '17:00',
      callAvailabilityDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    });
    setSelectedNumberId('');
    setStatusMessage(null);
    setPlayingAudio(null);
  };

  // Use step-by-step form for both creation and editing
  return (
    <div className="space-y-[25px]" style={{ fontFamily: "'Manrope', sans-serif" }}>
      {/* Header Section */}
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-[4px]">
          <h1 className="text-[24px] font-bold dark:text-[#f9fafb] text-[#27272b] leading-[32px] tracking-[-0.6px]" style={{ fontFamily: "'Manrope', sans-serif" }}>
            {isEditMode ? (formData.agentName || editingAgent?.name || 'Agent') : 'Create New Agent'}
          </h1>
          <p className="text-[16px] font-normal text-[#00c19c] leading-[24px]" style={{ fontFamily: "'Manrope', sans-serif" }}>
            {formData.companyName || editingAgent?.company_name || ''}
          </p>
        </div>
        <div className="flex gap-[12px] items-center justify-end">
          <Button
            variant="outline"
            onClick={handleOpenAutofillDialog}
            className="h-[36px] px-4 rounded-[8px]"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            AI Autofill
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowPromptDialog(true)}
            className="h-[36px] px-4 rounded-[8px]"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            <FileText className="w-4 h-4 mr-2" />
            Load Saved Prompt
          </Button>
          <Button
            onClick={() => navigate('/agents')}
            className="bg-[#00c19c] hover:bg-[#00c19c]/90 text-white h-[36px] px-4 rounded-[8px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </Button>
        </div>
      </div>

      {/* Tabs - Only show in edit mode */}
      {isEditMode && (
        <div className="dark:bg-[#2f3541] bg-[#f4f4f6] flex gap-[16px] items-center px-4 py-1 rounded-[8px]">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-2 py-1 rounded-[6px] text-[14px] ${activeTab === 'overview'
              ? 'dark:bg-[#1d212b] dark:text-[#f9fafb] bg-white shadow-[0px_0px_5px_0px_rgba(0,0,0,0.2)] font-semibold text-[#27272b]'
              : 'dark:text-[#818898] font-normal text-[#737373]'
              }`}
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('edit')}
            className={`px-2 py-1 rounded-[6px] text-[14px] ${activeTab === 'edit'
              ? 'dark:bg-[#1d212b] dark:text-[#f9fafb] bg-white shadow-[0px_0px_5px_0px_rgba(0,0,0,0.2)] font-semibold text-[#27272b]'
              : 'dark:text-[#818898] font-normal text-[#737373]'
              }`}
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            Edit
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-2 py-1 rounded-[6px] text-[14px] ${activeTab === 'logs'
              ? 'dark:bg-[#1d212b] dark:text-[#f9fafb] bg-white shadow-[0px_0px_5px_0px_rgba(0,0,0,0.2)] font-semibold text-[#27272b]'
              : 'dark:text-[#818898] font-normal text-[#737373]'
              }`}
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            Logs
          </button>
        </div>
      )}

      {statusMessage && (
        <Alert variant={statusMessage.type === 'success' ? 'success' : 'destructive'}>
          <AlertDescription>{statusMessage.text}</AlertDescription>
        </Alert>
      )}

      {(activeTab === 'edit' || !isEditMode) && (
        <div className="flex flex-col gap-6">
          {/* Progress Bar Container */}
          <div className="dark:bg-[#1d212b] dark:border-[#2f3541] bg-white border border-[#e4e4e8] rounded-[12px] p-6 mb-2">
            <div className="flex items-center justify-between mb-4">
              <div className="flex flex-col gap-1">
                <h3 className="text-[16px] font-bold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  Agent Creation Progress
                </h3>
                <p className="text-[14px] dark:text-[#818898] text-[#737373]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  Complete all required fields to create your agent
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[18px] font-bold text-[#00c19c]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  {getProgress()}%
                </span>
                <span className="text-[14px] dark:text-[#818898] text-[#737373]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  Completed
                </span>
              </div>
            </div>

            {/* The actual progress bar */}
            <div className="w-full h-[8px] bg-[#f4f4f6] dark:bg-[#2f3541] rounded-full overflow-hidden mb-6">
              <div
                className="h-full bg-gradient-to-r from-[#00c19c] to-[#00c19c] transition-all duration-500 ease-in-out"
                style={{ width: `${getProgress()}%` }}
              />
            </div>

            {/* Section Indicators */}
            <div className="flex items-center justify-between gap-4">
              {[
                { id: 'details', label: 'Details', icon: ListCollapse },
                { id: 'voice', label: 'Voice', icon: AudioLines },
                { id: 'settings', label: 'Settings', icon: Settings2 },
                { id: 'schedules', label: 'Schedules', icon: Calendar },
              ].map((section, index) => {
                const isComplete = getSectionStatus(section.id as any);
                const isActive = activeSection === section.id;
                const Icon = section.icon;

                return (
                  <div key={section.id} className="flex-1 flex flex-col gap-2 items-center">
                    <div className="flex items-center gap-2 w-full">
                      <div className={`shrink-0 size-8 rounded-full flex items-center justify-center border-2 transition-all ${isComplete
                        ? 'border-[#00c19c] bg-[#00c19c] text-white'
                        : isActive
                          ? 'border-[#00c19c] text-[#00c19c] dark:bg-[#1d212b] bg-white'
                          : 'border-[#e4e4e8] dark:border-[#2f3541] text-[#737373] dark:text-[#818898] dark:bg-[#1d212b] bg-white'
                        }`}>
                        {isComplete ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <span className="text-[14px] font-bold">{index + 1}</span>
                        )}
                      </div>
                      <div className="flex-1 flex flex-col items-start overflow-hidden">
                        <span className={`text-[13px] font-semibold whitespace-nowrap ${isActive ? 'text-[#00c19c]' : isComplete ? 'dark:text-[#f9fafb] text-[#27272b]' : 'dark:text-[#818898] text-[#737373]'
                          }`}>
                          {section.label}
                        </span>
                        <span className="text-[11px] dark:text-[#818898] text-[#737373] whitespace-nowrap">
                          {isComplete ? 'Completed' : isActive ? 'In Progress' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-5 items-start">
            {/* Sidebar Navigation */}
            <div className="dark:bg-[#1d212b] dark:border-[#2f3541] bg-white border border-[#e4e4e8] rounded-[12px] p-[9px] w-[256px] flex flex-col gap-[6px]">
              <button
                onClick={() => setActiveSection('details')}
                className={`h-[36px] rounded-[6px] flex items-center gap-2 px-3 ${activeSection === 'details'
                  ? 'dark:bg-[rgba(0,193,156,0.15)] dark:text-[#f9fafb] bg-[rgba(0,193,156,0.1)] font-semibold text-[#27272b]'
                  : 'dark:text-[#f9fafb] dark:hover:bg-[#2f3541] font-medium dark:text-[#f9fafb] text-[#27272b] hover:bg-gray-50'
                  }`}
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                <ListCollapse className="w-4 h-4" />
                <span className="text-[14px]">Details</span>
              </button>
              <button
                onClick={() => setActiveSection('voice')}
                className={`h-[36px] rounded-[6px] flex items-center gap-2 px-3 ${activeSection === 'voice'
                  ? 'dark:bg-[rgba(0,193,156,0.15)] dark:text-[#f9fafb] bg-[rgba(0,193,156,0.1)] font-semibold text-[#27272b]'
                  : 'dark:text-[#f9fafb] dark:hover:bg-[#2f3541] font-medium dark:text-[#f9fafb] text-[#27272b] hover:bg-gray-50'
                  }`}
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                <AudioLines className="w-4 h-4" />
                <span className="text-[14px]">Voice Configuration</span>
              </button>
              <button
                onClick={() => setActiveSection('settings')}
                className={`h-[36px] rounded-[6px] flex items-center gap-2 px-3 ${activeSection === 'settings'
                  ? 'dark:bg-[rgba(0,193,156,0.15)] dark:text-[#f9fafb] bg-[rgba(0,193,156,0.1)] font-semibold text-[#27272b]'
                  : 'dark:text-[#f9fafb] dark:hover:bg-[#2f3541] font-medium dark:text-[#f9fafb] text-[#27272b] hover:bg-gray-50'
                  }`}
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                <Settings2 className="w-4 h-4" />
                <span className="text-[14px]">Agent Settings</span>
              </button>
              <button
                onClick={() => setActiveSection('schedules')}
                className={`h-[36px] rounded-[6px] flex items-center gap-2 px-3 ${activeSection === 'schedules'
                  ? 'dark:bg-[rgba(0,193,156,0.15)] dark:text-[#f9fafb] bg-[rgba(0,193,156,0.1)] font-semibold text-[#27272b]'
                  : 'dark:text-[#f9fafb] dark:hover:bg-[#2f3541] font-medium dark:text-[#f9fafb] text-[#27272b] hover:bg-gray-50'
                  }`}
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                <Calendar className="w-4 h-4" />
                <span className="text-[14px]">Schedule Selection</span>
              </button>
            </div>

            {/* Main Content Area */}
            <div className="dark:bg-[#1d212b] dark:border-[#2f3541] bg-white border border-[#e4e4e8] rounded-[12px] px-6 py-6 flex-1">
              {loadingAgent ? (
                <div className="flex justify-center items-center min-h-[60vh]">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  {/* Details Section */}
                  {activeSection === 'details' && (
                    <div className="flex flex-col gap-[30px]">
                      <div className="flex flex-col gap-[23px]">
                        <h2 className="text-[14px] font-bold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                          Details
                        </h2>

                        <div className="flex flex-col gap-2">
                          <Label htmlFor="agentName" className="text-[14px] font-medium dark:text-[#f9fafb] text-[#27272b]">
                            Agent Name*:
                          </Label>
                          <Input
                            id="agentName"
                            name="agentName"
                            value={formData.agentName}
                            onChange={handleInputChange}
                            className={`border rounded-[6px] px-3 py-2 dark:bg-[#1d212b] dark:border-[#2f3541] ${highlightEmptyFields && !formData.agentName ? "border-red-500 ring-1 ring-red-500" : "border-[#00c19c]"}`}
                            style={{ fontFamily: "'Manrope', sans-serif" }}
                          />
                        </div>

                        <Separator />

                        <h3 className="text-[14px] font-bold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                          Company Information
                        </h3>

                        <div className="flex flex-col gap-2">
                          <Label htmlFor="companyName" className="text-[14px] font-medium dark:text-[#f9fafb] text-[#27272b]">
                            Company Name*:
                          </Label>
                          <Input
                            id="companyName"
                            name="companyName"
                            value={formData.companyName}
                            onChange={handleInputChange}
                            className={`border rounded-[6px] px-3 py-2 dark:bg-[#1d212b] dark:border-[#2f3541] ${highlightEmptyFields && !formData.companyName ? "border-red-500 ring-1 ring-red-500" : "border-[#d4d4da]"}`}
                            style={{ fontFamily: "'Manrope', sans-serif" }}
                          />
                        </div>

                        <div className="flex flex-col gap-2">
                          <Label htmlFor="websiteUrl" className="text-[14px] font-medium dark:text-[#f9fafb] text-[#27272b]">
                            Website URL*:
                          </Label>
                          <Input
                            id="websiteUrl"
                            name="websiteUrl"
                            value={formData.websiteUrl}
                            onChange={handleInputChange}
                            className={`border rounded-[6px] px-3 py-2 ${highlightEmptyFields && !formData.websiteUrl ? "border-red-500 ring-1 ring-red-500" : "border-[#d4d4da]"}`}
                            style={{ fontFamily: "'Manrope', sans-serif" }}
                          />
                        </div>

                        <Separator />

                        <h3 className="text-[14px] font-bold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                          Goals & Context
                        </h3>

                        <div className="flex flex-col gap-2">
                          <Label htmlFor="goal" className="text-[14px] font-medium dark:text-[#f9fafb] text-[#27272b]">
                            Goal*:
                          </Label>
                          <Textarea
                            id="goal"
                            name="goal"
                            value={formData.goal}
                            onChange={handleInputChange}
                            className={`border rounded-[6px] px-3 py-2 min-h-[80px] dark:bg-[#1d212b] dark:border-[#2f3541] ${highlightEmptyFields && !formData.goal ? "border-red-500 ring-1 ring-red-500" : "border-[#d4d4da]"}`}
                            style={{ fontFamily: "'Manrope', sans-serif" }}
                          />
                        </div>

                        <div className="flex flex-col gap-2">
                          <Label htmlFor="backgroundContext" className="text-[14px] font-medium dark:text-[#f9fafb] text-[#27272b]">
                            Background / Context*:
                          </Label>
                          <Textarea
                            id="backgroundContext"
                            name="backgroundContext"
                            value={formData.backgroundContext}
                            onChange={handleInputChange}
                            className={`border rounded-[6px] px-3 py-2 min-h-[120px] ${highlightEmptyFields && !formData.backgroundContext ? "border-red-500 ring-1 ring-red-500" : "border-[#d4d4da]"}`}
                            style={{ fontFamily: "'Manrope', sans-serif" }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <Button
                          onClick={() => saveDraft()}
                          variant="outline"
                          disabled={loading}
                          className="px-4 py-2 rounded-[6px] border-[#00c19c] text-[#00c19c] hover:bg-[#00c19c]/10"
                          style={{ fontFamily: "'Manrope', sans-serif" }}
                        >
                          {loading ? 'Saving...' : 'Save as Draft'}
                        </Button>
                        <Button
                          onClick={() => saveDraft('voice')}
                          disabled={loading}
                          className="bg-[#00c19c] hover:bg-[#00c19c]/90 text-white px-4 py-2 rounded-[6px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]"
                          style={{ fontFamily: "'Manrope', sans-serif" }}
                        >
                          {loading ? 'Saving...' : 'Save & Continue'}
                          {!loading && <ChevronRight className="w-4 h-4 ml-2" />}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Voice Configuration Section */}
                  {activeSection === 'voice' && (
                    <div className="flex flex-col gap-[30px]">
                      <div className="flex flex-col gap-[23px]">
                        <h2 className="text-[14px] font-bold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                          Voice Configuration
                        </h2>

                        <div className="flex flex-col gap-2">
                          <Label className="text-[14px] font-medium dark:text-[#f9fafb] text-[#27272b]">
                            Welcome Messages *: <span className="dark:text-[#818898] text-[#737373] font-normal">(1-5 messages required)</span>
                          </Label>
                          <div className={`border rounded-[6px] p-2 min-h-[100px] flex flex-wrap gap-2 dark:bg-[#1d212b] dark:border-[#2f3541] ${highlightEmptyFields && (welcomeMessages.length < 1 || welcomeMessages.length > 5) ? "border-red-500 ring-1 ring-red-500" : "border-[#00c19c]"}`}>
                            {welcomeMessages.map((msg, index) => (
                              <div
                                key={index}
                                className="border border-[#00c19c] rounded-[9px] px-2.5 py-1.5 flex items-center gap-2.5 dark:bg-[#1d212b] bg-white"
                              >
                                <span className="text-[14px] text-[#00c19c]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                  {msg}
                                </span>
                                <button
                                  onClick={() => handleRemoveWelcomeMessage(index)}
                                  className="text-[#00c19c] hover:text-[#00c19c]/70"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2 items-center">
                            <Input
                              value={newWelcomeMessage}
                              onChange={(e) => setNewWelcomeMessage(e.target.value)}
                              onKeyDown={handleWelcomeMessageKeyDown}
                              placeholder="Type message and press Enter or comma"
                              className="flex-1 border border-[#00c19c] dark:bg-[#1d212b] dark:border-[#2f3541] rounded-[6px] px-3 py-2"
                              style={{ fontFamily: "'Manrope', sans-serif" }}
                            />
                            <Button
                              type="button"
                              onClick={handleAddWelcomeMessage}
                              disabled={!newWelcomeMessage.trim() || welcomeMessages.length >= 5}
                              className="bg-[#00c19c] hover:bg-[#00c19c]/90 text-white px-2.5 py-1.5 rounded-[9px] text-[14px] font-semibold h-auto disabled:opacity-50 disabled:cursor-not-allowed"
                              style={{ fontFamily: "'Manrope', sans-serif" }}
                            >
                              + Add Welcome Message {welcomeMessages.length >= 5 && '(Max 5)'}
                            </Button>
                          </div>
                          <p className="text-[12px] dark:text-[#818898] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                            Press Enter or comma to add each message. {welcomeMessages.length > 0 && `(${welcomeMessages.length}/5)`}
                          </p>
                        </div>

                        <div className="flex flex-col gap-2">
                          <Label htmlFor="instructionVoice" className="text-[14px] font-medium dark:text-[#f9fafb] text-[#27272b]">
                            Instruction Voice*:
                          </Label>
                          <Textarea
                            id="instructionVoice"
                            name="instructionVoice"
                            value={formData.instructionVoice}
                            onChange={handleInputChange}
                              className={`border rounded-[6px] px-3 py-2 min-h-[120px] dark:bg-[#1d212b] dark:border-[#2f3541] ${highlightEmptyFields && !formData.instructionVoice ? "border-red-500 ring-1 ring-red-500" : "border-[#d4d4da]"}`}
                            style={{ fontFamily: "'Manrope', sans-serif" }}
                          />
                        </div>

                      </div>

                      <div className="flex items-center justify-between">
                        <Button
                          onClick={() => setActiveSection('details')}
                          variant="outline"
                          className="px-4 py-2 rounded-[6px]"
                          style={{ fontFamily: "'Manrope', sans-serif" }}
                        >
                          <ChevronLeftIcon className="w-4 h-4 mr-2" />
                          Previous
                        </Button>
                        <div className="flex items-center gap-3">
                          <Button
                            onClick={() => saveDraft()}
                            variant="outline"
                            disabled={loading}
                            className="px-4 py-2 rounded-[6px] border-[#00c19c] text-[#00c19c] hover:bg-[#00c19c]/10"
                            style={{ fontFamily: "'Manrope', sans-serif" }}
                          >
                            {loading ? 'Saving...' : 'Save as Draft'}
                          </Button>
                          <Button
                            onClick={() => saveDraft('settings')}
                            disabled={loading}
                            className="bg-[#00c19c] hover:bg-[#00c19c]/90 text-white px-4 py-2 rounded-[6px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]"
                            style={{ fontFamily: "'Manrope', sans-serif" }}
                          >
                            {loading ? 'Saving...' : 'Save & Continue'}
                            {!loading && <ChevronRight className="w-4 h-4 ml-2" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Agent Settings Section */}
                  {activeSection === 'settings' && (
                    <div className="flex flex-col gap-[30px]">
                      <div className="flex flex-col gap-[23px]">
                        <h2 className="text-[14px] font-bold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                          Agent Settings
                        </h2>

                        <div className="flex flex-col gap-2">
                          <Label htmlFor="voice" className="text-[14px] font-medium dark:text-[#f9fafb] text-[#27272b]">
                            Voice*:
                          </Label>
                          <Tabs
                            value={voiceTab}
                            onValueChange={(value) => setVoiceTab(value as 'deepgram' | 'vapi')}
                            className="w-full"
                          >
                            <TabsList className="grid w-full grid-cols-2 dark:bg-[#2f3541] bg-[#f4f4f6]">
                              <TabsTrigger value="deepgram" className="dark:text-[#f9fafb] text-[#27272b] dark:data-[state=active]:bg-[#1d212b] data-[state=active]:bg-white">
                                Premium Voices
                              </TabsTrigger>
                              <TabsTrigger value="vapi" className="dark:text-[#f9fafb] text-[#27272b] dark:data-[state=active]:bg-[#1d212b] data-[state=active]:bg-white">
                                Classic Voices
                              </TabsTrigger>
                            </TabsList>
                            <TabsContent value="deepgram" className="mt-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto p-2">
                                {deepgramVoices.map((voice) => (
                                  <button
                                    key={voice.value}
                                    type="button"
                                    onClick={() => handleSelectChange('voice', voice.value)}
                                    className={`p-3 rounded-[6px] border-2 transition-all text-left ${formData.voice === voice.value
                                      ? 'border-[#00c19c] dark:bg-[rgba(0,193,156,0.15)] bg-[rgba(0,193,156,0.1)]'
                                      : 'border-[#d4d4da] dark:border-[#2f3541] dark:bg-[#1d212b] bg-white hover:border-[#00c19c]/50'
                                      }`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          <p className="font-semibold text-[14px] dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                            {voice.label}
                                          </p>
                                          <Badge variant="outline" className="text-[12px]">
                                            {voice.gender === 'masculine' ? 'Male' : 'Female'}
                                          </Badge>
                                        </div>
                                        {voice.description && (
                                          <p className="text-[12px] dark:text-[#818898] text-[#737373] mb-1" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                            {voice.description}
                                          </p>
                                        )}
                                        {voice.useCase && (
                                          <p className="text-[12px] dark:text-[#818898] text-[#737373] italic" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                            Use: {voice.useCase}
                                          </p>
                                        )}
                                      </div>
                                      {voice.audioUrl && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handlePlayAudio(voice.audioUrl!, voice.value);
                                          }}
                                          className="p-1.5 rounded-full bg-[rgba(0,193,156,0.2)] hover:bg-[rgba(0,193,156,0.3)] transition-colors"
                                        >
                                          {playingAudio === voice.value ? (
                                            <Volume2 className="w-4 h-4 text-[#00c19c]" />
                                          ) : (
                                            <Play className="w-4 h-4 text-[#00c19c]" />
                                          )}
                                        </button>
                                      )}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </TabsContent>
                            <TabsContent value="vapi" className="mt-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto p-2">
                                {vapiVoices.map((voice) => (
                                  <button
                                    key={voice.value}
                                    type="button"
                                    onClick={() => handleSelectChange('voice', voice.value)}
                                    className={`p-3 rounded-[6px] border-2 transition-all text-left ${formData.voice === voice.value
                                      ? 'border-[#00c19c] dark:bg-[rgba(0,193,156,0.15)] bg-[rgba(0,193,156,0.1)]'
                                      : 'border-[#d4d4da] dark:border-[#2f3541] dark:bg-[#1d212b] bg-white hover:border-[#00c19c]/50'
                                      }`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <p className="font-semibold text-[14px] dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                            {voice.label}
                                          </p>
                                          <Badge variant="outline" className="text-[12px]">
                                            {voice.gender === 'masculine' ? 'Male' : 'Female'}
                                          </Badge>
                                        </div>
                                      </div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </TabsContent>
                          </Tabs>
                        </div>

                        <div className="flex flex-col gap-2">
                          <Label htmlFor="language" className="text-[14px] font-medium dark:text-[#f9fafb] text-[#27272b]">
                            Language*:
                          </Label>
                          <Select value={formData.language} onValueChange={(value) => handleSelectChange('language', value)}>
                            <SelectTrigger className="border dark:border-[#2f3541] border-[#d4d4da] dark:bg-[#1d212b] rounded-[6px] px-3 py-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="en-US">English</SelectItem>
                              <SelectItem value="es-ES">Spanish</SelectItem>
                              <SelectItem value="fr-FR">French</SelectItem>
                              <SelectItem value="de-DE">German</SelectItem>
                              <SelectItem value="zh-CN">Chinese</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex flex-col gap-2">
                          <Label htmlFor="agentType" className="text-[14px] font-medium dark:text-[#f9fafb] text-[#27272b]">
                            Agent Type*:
                          </Label>
                          <Select value={formData.agentType} onValueChange={(value) => handleSelectChange('agentType', value)}>
                            <SelectTrigger className="border dark:border-[#2f3541] border-[#d4d4da] dark:bg-[#1d212b] rounded-[6px] px-3 py-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sales">Sales</SelectItem>
                              <SelectItem value="support">Support</SelectItem>
                              <SelectItem value="booking">Booking</SelectItem>
                              <SelectItem value="general">General</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex flex-col gap-2">
                          <Label htmlFor="timezone" className="text-[14px] font-medium dark:text-[#f9fafb] text-[#27272b]">
                            Timezone*:
                          </Label>
                          <Select value={formData.timezone} onValueChange={(value) => handleSelectChange('timezone', value)}>
                            <SelectTrigger className="border dark:border-[#2f3541] border-[#d4d4da] dark:bg-[#1d212b] rounded-[6px] px-3 py-2">
                              <SelectValue placeholder="Select timezone" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              <SelectGroup>
                                <SelectLabel>UTC</SelectLabel>
                                {getTimezonesByGroup().UTC.map(tz => (
                                  <SelectItem key={tz.value} value={tz.value}>
                                    {tz.label}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                              {Object.entries(getTimezonesByGroup())
                                .filter(([group]) => group !== 'UTC')
                                .map(([group, tzs], index) => (
                                  <React.Fragment key={group}>
                                    {index > 0 && <SelectSeparator />}
                                    <SelectGroup>
                                      <SelectLabel>{group}</SelectLabel>
                                      {tzs.map(tz => (
                                        <SelectItem key={tz.value} value={tz.value}>
                                          {tz.label}
                                        </SelectItem>
                                      ))}
                                    </SelectGroup>
                                  </React.Fragment>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>


                        <Separator />

                        <h3 className="text-[14px] font-bold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                          Fallback Configuration
                        </h3>

                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="fallbackEnabled"
                            checked={formData.fallbackEnabled}
                            onChange={(e) => setFormData(prev => ({ ...prev, fallbackEnabled: e.target.checked }))}
                            className="rounded"
                          />
                          <Label htmlFor="fallbackEnabled" className="text-[14px] font-medium dark:text-[#f9fafb] text-[#27272b]">
                            Enable Fallback Number
                          </Label>
                        </div>

                        {formData.fallbackEnabled && (
                          <div className="flex flex-col gap-2">
                            <Label htmlFor="fallbackNumber" className="text-[14px] font-medium dark:text-[#f9fafb] text-[#27272b]">
                              Fallback Phone Number:
                            </Label>
                            <Input
                              id="fallbackNumber"
                              name="fallbackNumber"
                              value={formData.fallbackNumber}
                              onChange={handleInputChange}
                              placeholder="+1234567890"
                              className="border dark:border-[#2f3541] border-[#d4d4da] dark:bg-[#1d212b] rounded-[6px] px-3 py-2"
                              style={{ fontFamily: "'Manrope', sans-serif" }}
                            />
                            <p className="text-[12px] dark:text-[#818898] text-[#737373]">
                              Number to call if the agent fails or after retries are exhausted
                            </p>
                          </div>
                        )}

                        <Separator />

                        <h3 className="text-[14px] font-bold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                          Knowledge Base
                        </h3>

                        <div className="flex flex-col gap-2">
                          <Label htmlFor="knowledgeBase" className="text-[14px] font-medium dark:text-[#f9fafb] text-[#27272b]">
                            Assign Knowledge Base (Optional):
                          </Label>
                          <Select
                            value={formData.knowledgeBaseId || 'none'}
                            onValueChange={(value) => handleSelectChange('knowledgeBaseId', value === 'none' ? '' : value)}
                          >
                            <SelectTrigger className="border dark:border-[#2f3541] border-[#d4d4da] dark:bg-[#1d212b] rounded-[6px] px-3 py-2">
                              <SelectValue placeholder="Select a knowledge base" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {knowledgeBases.map((kb) => (
                                <SelectItem key={kb.id} value={kb.id}>
                                  {kb.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-[12px] dark:text-[#818898] text-[#737373]">
                            Select a knowledge base to provide FAQs and documents to this agent
                          </p>
                        </div>

                        <Separator />

                        <h3 className="text-[14px] font-bold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                          Phone Number
                        </h3>

                        {loadingNumbers ? (
                          <p className="text-[14px] dark:text-[#818898] text-[#737373]">Loading inbound numbers...</p>
                        ) : inboundNumbers.length === 0 ? (
                          <div className="flex flex-col gap-2">
                            <Alert variant="default">
                              <AlertDescription>No inbound numbers available. Please import a number first.</AlertDescription>
                            </Alert>
                            <Button
                              type="button"
                              onClick={() => navigate('/inbound-numbers')}
                              variant="outline"
                              className="w-fit"
                            >
                              Go to Inbound Numbers
                            </Button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <Label htmlFor="phoneNumber" className="text-[14px] font-medium dark:text-[#f9fafb] text-[#27272b]">
                              Select Inbound Number*:
                            </Label>
                            <Select value={selectedNumberId} onValueChange={handleNumberSelection}>
                              <SelectTrigger className="border dark:border-[#2f3541] border-[#d4d4da] dark:bg-[#1d212b] rounded-[6px] px-3 py-2">
                                <SelectValue placeholder="Select a phone number" />
                              </SelectTrigger>
                              <SelectContent>
                                {inboundNumbers.map((number) => {
                                  const assignedAgent = number.assigned_to_agent_id
                                    ? agents.find(a => a.id === number.assigned_to_agent_id)
                                    : null;
                                  const isAssignedToCurrentAgent = isEditMode && editingAgent && number.assigned_to_agent_id === editingAgent.id;

                                  return (
                                    <SelectItem key={number.id} value={number.id}>
                                      <div className="flex items-center justify-between w-full">
                                        <span>
                                          {formatPhoneDisplay(number.phone_number, number.country_code)}
                                          {number.phone_label && ` - ${number.phone_label}`}
                                        </span>
                                        {assignedAgent && !isAssignedToCurrentAgent && (
                                          <Badge variant="outline" className="ml-2 text-xs">
                                            Assigned to {assignedAgent.name}
                                          </Badge>
                                        )}
                                        {isAssignedToCurrentAgent && (
                                          <Badge variant="default" className="ml-2 text-xs">
                                            Current
                                          </Badge>
                                        )}
                                      </div>
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                            {selectedNumberId && (() => {
                              const selected = getSelectedNumber();
                              if (!selected) return null;
                              return (
                                <div className="p-3 rounded-[6px] dark:bg-[#2f3541] bg-[#f4f4f6] dark:border-[#2f3541] border border-[#e4e4e8] space-y-2">
                                  <div className="flex gap-2">
                                    <Badge variant="default">{selected.provider}</Badge>
                                    {selected.provider === 'twilio' && selected.sms_enabled && (
                                      <Badge variant="outline">SMS Enabled</Badge>
                                    )}
                                  </div>
                                  <p className="text-[14px] dark:text-[#f9fafb] text-[#27272b]">
                                    <strong>Number:</strong> {formatPhoneDisplay(selected.phone_number, selected.country_code)}
                                  </p>
                                  {selected.phone_label && (
                                    <p className="text-[14px] dark:text-[#818898] text-[#737373]">
                                      <strong>Label:</strong> {selected.phone_label}
                                    </p>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <Button
                          onClick={() => setActiveSection('voice')}
                          variant="outline"
                          className="px-4 py-2 rounded-[6px]"
                          style={{ fontFamily: "'Manrope', sans-serif" }}
                        >
                          <ChevronLeftIcon className="w-4 h-4 mr-2" />
                          Previous
                        </Button>
                        <div className="flex items-center gap-3">
                          <Button
                            onClick={() => saveDraft()}
                            variant="outline"
                            disabled={loading}
                            className="px-4 py-2 rounded-[6px] border-[#00c19c] text-[#00c19c] hover:bg-[#00c19c]/10"
                            style={{ fontFamily: "'Manrope', sans-serif" }}
                          >
                            {loading ? 'Saving...' : 'Save as Draft'}
                          </Button>
                          <Button
                            onClick={() => saveDraft('schedules')}
                            disabled={loading}
                            className="bg-[#00c19c] hover:bg-[#00c19c]/90 text-white px-4 py-2 rounded-[6px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]"
                            style={{ fontFamily: "'Manrope', sans-serif" }}
                          >
                            {loading ? 'Saving...' : 'Save & Continue'}
                            {!loading && <ChevronRight className="w-4 h-4 ml-2" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Schedule Selection Section */}
                  {activeSection === 'schedules' && (
                    <div className="flex flex-col gap-[30px]">
                      <div className="flex flex-col gap-[23px]">
                        <h2 className="text-[14px] font-bold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                          Schedule Selection
                        </h2>
                        <p className="text-[14px] dark:text-[#818898] text-[#737373]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                          Select one or more schedules to assign to this agent. All schedule data will be included in the webhook payload.
                        </p>

                        <div className="flex flex-col gap-2">
                          <Label htmlFor="schedules" className="text-[14px] font-medium dark:text-[#f9fafb] text-[#27272b]">
                            Available Schedules:
                          </Label>
                          <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto dark:bg-[#1d212b] dark:border-[#2f3541] border border-[#d4d4da] rounded-[6px] p-4">
                            {loadingSchedules ? (
                              <div className="flex items-center justify-center py-8">
                                <div className="w-6 h-6 border-2 border-[#00c19c] border-t-transparent rounded-full animate-spin" />
                                <p className="text-[14px] dark:text-[#818898] text-[#8c8c8c] ml-3">Loading schedules...</p>
                              </div>
                            ) : availableSchedules.length === 0 ? (
                              <div className="flex flex-col items-center justify-center py-8 gap-3">
                                <Calendar className="w-12 h-12 dark:text-[#818898] text-[#8c8c8c]" />
                                <p className="text-[14px] dark:text-[#818898] text-[#8c8c8c] text-center">
                                  No schedules available. Create schedules in the Schedules page.
                                </p>
                                <Button
                                  type="button"
                                  onClick={() => navigate('/call-schedules')}
                                  variant="outline"
                                  className="mt-2"
                                >
                                  Go to Schedules
                                </Button>
                              </div>
                            ) : (
                              availableSchedules.map((schedule) => (
                                <div
                                  key={schedule.id}
                                  className={`flex items-center gap-3 p-3 rounded-[6px] border-2 transition-all ${selectedScheduleIds.includes(schedule.id)
                                    ? 'border-[#00c19c] dark:bg-[rgba(0,193,156,0.15)] bg-[rgba(0,193,156,0.05)]'
                                    : 'border-[#e4e4e8] dark:border-[#2f3541] dark:bg-[#1d212b] bg-white hover:border-[#d4d4da]'
                                    }`}
                                >
                                  <input
                                    type="checkbox"
                                    id={`schedule-${schedule.id}`}
                                    checked={selectedScheduleIds.includes(schedule.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedScheduleIds([...selectedScheduleIds, schedule.id]);
                                      } else {
                                        setSelectedScheduleIds(selectedScheduleIds.filter(id => id !== schedule.id));
                                      }
                                    }}
                                    className="w-5 h-5 rounded dark:border-[#2f3541] border-[#d4d4da] cursor-pointer"
                                  />
                                  <div className="flex-1">
                                    <label
                                      htmlFor={`schedule-${schedule.id}`}
                                      className="text-[14px] font-medium dark:text-[#f9fafb] text-[#27272b] cursor-pointer flex items-center gap-2"
                                    >
                                      {schedule.schedule_name}
                                      {schedule.is_active ? (
                                        <Badge variant="default" className="text-xs">Active</Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-xs">Inactive</Badge>
                                      )}
                                    </label>
                                    <p className="text-[12px] dark:text-[#818898] text-[#737373] mt-1">
                                      Timezone: {schedule.timezone}
                                    </p>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                          {selectedScheduleIds.length > 0 && (
                            <div className="mt-2 p-3 dark:bg-[#2f3541] bg-[#f4f4f6] rounded-[6px] dark:border-[#2f3541] border border-[#e4e4e8]">
                              <p className="text-[12px] font-medium dark:text-[#f9fafb] text-[#27272b] mb-2">
                                Selected Schedules ({selectedScheduleIds.length}):
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {selectedScheduleIds.map((scheduleId) => {
                                  const schedule = availableSchedules.find(s => s.id === scheduleId);
                                  return schedule ? (
                                    <Badge key={scheduleId} variant="default" className="text-xs">
                                      {schedule.schedule_name}
                                    </Badge>
                                  ) : null;
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <Button
                          onClick={() => setActiveSection('settings')}
                          variant="outline"
                          className="px-4 py-2 rounded-[6px]"
                          style={{ fontFamily: "'Manrope', sans-serif" }}
                        >
                          <ChevronLeftIcon className="w-4 h-4 mr-2" />
                          Previous
                        </Button>
                        <div className="flex items-center gap-3">
                          <Button
                            onClick={() => saveDraft()}
                            variant="outline"
                            disabled={loading}
                            className="px-4 py-2 rounded-[6px] border-[#00c19c] text-[#00c19c] hover:bg-[#00c19c]/10"
                            style={{ fontFamily: "'Manrope', sans-serif" }}
                          >
                            {loading ? 'Saving...' : 'Save as Draft'}
                          </Button>
                          <Button
                            type="button"
                            onClick={handleSubmit}
                            disabled={isSubmittingRef.current || loading || (!isEditMode && !isFormValid())}
                            className={`px-6 py-2 rounded-[6px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] transition-all ${!isEditMode && !isFormValid() || isSubmittingRef.current || loading
                              ? 'bg-[#e4e4e8] text-[#737373] cursor-not-allowed border-0'
                              : 'bg-[#00c19c] hover:bg-[#00c19c]/90 text-white'
                              }`}
                            style={{ fontFamily: "'Manrope', sans-serif" }}
                          >
                            {loading || isSubmittingRef.current ? ((isEditMode && !isDraft) ? 'Updating...' : 'Creating...') : ((isEditMode && !isDraft) ? 'Update Agent' : 'Create Agent')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'overview' && (
        <div className="space-y-[25px]">
          {/* Stats Cards */}
          <div className="flex gap-[25px] items-center">
            {/* Total Call */}
            <div className="bg-[#f8f8f8] border border-[#f0f0f0] flex-1 flex flex-col gap-[6px] items-start overflow-hidden p-4 relative rounded-[24px]">
              <div className="flex gap-[6px] items-center p-1">
                <User className="w-4 h-4 text-[#141414]" />
                <p className="text-[14px] font-normal text-[#141414]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  Total Call
                </p>
              </div>
              <div className="flex items-center p-1">
                <p className="text-[32px] font-normal text-[#141414] leading-[1.2]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  {loadingOverview ? '...' : overviewStats.totalCalls}
                </p>
              </div>
              {/* Mini bar chart */}
              <div className="absolute bottom-0 flex items-end right-[-0.38px]">
                {[26, 37, 66, 54, 43, 26].map((height, i) => (
                  <div
                    key={i}
                    className={`h-[${height}px] rounded-tl-full rounded-tr-full w-4 ${i === 2 ? 'bg-gradient-to-b from-[rgba(0,193,156,0.5)] to-[rgba(0,193,156,0.05)]' : 'bg-gradient-to-b from-white/20 to-transparent'
                      }`}
                    style={{ height: `${height}px` }}
                  />
                ))}
              </div>
            </div>

            {/* Answered */}
            <div className="bg-[#f8f8f8] border border-[#f0f0f0] flex-1 flex flex-col gap-[6px] items-start overflow-hidden p-4 relative rounded-[24px]">
              <div className="flex gap-[6px] items-center p-1">
                <Phone className="w-4 h-4 text-[#141414]" />
                <p className="text-[14px] font-normal text-[#141414]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  Answered
                </p>
              </div>
              <div className="flex items-center p-1">
                <p className="text-[32px] font-normal text-[#141414] leading-[1.2]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  {loadingOverview ? '...' : overviewStats.answered}
                </p>
              </div>
              {/* Mini bar chart */}
              <div className="absolute bottom-0 flex items-end right-[-0.38px]">
                {[26, 37, 66, 54, 43, 26].map((height, i) => (
                  <div
                    key={i}
                    className={`h-[${height}px] rounded-tl-full rounded-tr-full w-4 ${i === 2 ? 'bg-gradient-to-b from-[rgba(0,193,156,0.5)] to-[rgba(0,193,156,0.05)]' : 'bg-gradient-to-b from-white/20 to-transparent'
                      }`}
                    style={{ height: `${height}px` }}
                  />
                ))}
              </div>
            </div>

            {/* Avg Duration */}
            <div className="bg-[#f8f8f8] border border-[#f0f0f0] flex-1 flex flex-col gap-[6px] items-start overflow-hidden p-4 relative rounded-[24px]">
              <div className="flex gap-[6px] items-center p-1">
                <Settings className="w-4 h-4 text-[#141414]" />
                <p className="text-[14px] font-normal text-[#141414]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  Avg Duration
                </p>
              </div>
              <div className="flex items-center p-1">
                <p className="text-[32px] font-normal text-[#141414] leading-[1.2]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  {loadingOverview ? '...' : (
                    <>
                      <span>{overviewStats.avgDuration.minutes}</span>
                      <span className="text-[14px]"> min </span>
                      <span>{overviewStats.avgDuration.seconds}</span>
                      <span className="text-[14px]"> sec</span>
                    </>
                  )}
                </p>
              </div>
              {/* Mini bar chart */}
              <div className="absolute bottom-0 flex items-end right-[-0.38px]">
                {[26, 37, 66, 54, 43, 26].map((height, i) => (
                  <div
                    key={i}
                    className={`h-[${height}px] rounded-tl-full rounded-tr-full w-4 ${i === 2 ? 'bg-gradient-to-b from-[rgba(0,193,156,0.5)] to-[rgba(0,193,156,0.05)]' : 'bg-gradient-to-b from-white/20 to-transparent'
                      }`}
                    style={{ height: `${height}px` }}
                  />
                ))}
              </div>
            </div>

            {/* Answer Rate */}
            <div className="bg-[#f8f8f8] border border-[#f0f0f0] flex-1 flex flex-col gap-[6px] items-start overflow-hidden p-4 relative rounded-[24px]">
              <div className="flex gap-[6px] items-center p-1">
                <Settings className="w-4 h-4 text-[#141414]" />
                <p className="text-[14px] font-normal text-[#141414]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  Answer Rate
                </p>
              </div>
              <div className="flex items-center p-1">
                <p className="text-[32px] font-normal text-[#141414] leading-[1.2]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  {loadingOverview ? '...' : `${overviewStats.answerRate}%`}
                </p>
              </div>
              {/* Mini bar chart */}
              <div className="absolute bottom-0 flex items-end right-[-0.38px]">
                {[26, 37, 66, 54, 43, 26].map((height, i) => (
                  <div
                    key={i}
                    className={`h-[${height}px] rounded-tl-full rounded-tr-full w-4 ${i === 2 ? 'bg-gradient-to-b from-[rgba(0,193,156,0.5)] to-[rgba(0,193,156,0.05)]' : 'bg-gradient-to-b from-white/20 to-transparent'
                      }`}
                    style={{ height: `${height}px` }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Call Status Summary and Agent Schedule */}
          <div className="flex gap-[25px] items-start">
            {/* Call Status Summary */}
            <div className="bg-[#f8f8f8] border border-[#f0f0f0] flex-1 flex flex-col gap-[10px] items-center justify-center min-w-[487px] overflow-hidden px-5 py-4 rounded-[14px]">
              <div className="flex gap-[6px] items-center">
                <Settings className="w-4 h-4 text-[#141414]" />
                <p className="text-[14px] font-medium text-[#141414]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  Call Status Summary
                </p>
              </div>
              <div className="flex flex-col gap-[40px] items-center justify-center w-full">
                {/* Pie Chart Placeholder */}
                <div className="flex items-center">
                  <div className="relative size-[143.623px]">
                    <svg viewBox="0 0 100 100" className="w-full h-full">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e5e5" strokeWidth="10" />
                      {/* You can add actual pie chart slices here */}
                    </svg>
                  </div>
                </div>
                {/* Legend */}
                <div className="flex items-start justify-between w-[159px]">
                  <div className="flex flex-col gap-[10px] items-start w-[102px]">
                    <div className="flex gap-[10px] items-center w-full">
                      <div className="bg-[#ccc2ff] shrink-0 size-[9px]" />
                      <p className="text-[14px] font-normal text-[#141414]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                        Total Cost
                      </p>
                    </div>
                    <div className="flex gap-[10px] items-center w-full">
                      <div className="bg-[#00c19c] shrink-0 size-[9px]" />
                      <p className="text-[14px] font-normal text-[#141414]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                        Forwarded
                      </p>
                    </div>
                    <div className="flex gap-[10px] items-center w-full">
                      <div className="bg-[rgba(0,193,156,0.6)] shrink-0 size-[9px]" />
                      <p className="text-[14px] font-normal text-[#141414]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                        Lead
                      </p>
                    </div>
                    <div className="flex gap-[10px] items-center w-full">
                      <div className="bg-[#fe9191] shrink-0 size-[9px]" />
                      <p className="text-[14px] font-normal text-[#141414]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                        Missed
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-[10px] items-end text-[14px] font-semibold text-[#141414]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    <p>${loadingOverview ? '0.00' : callStatusSummary.totalCost.toFixed(2)}</p>
                    <p>{loadingOverview ? '0' : callStatusSummary.forwarded}</p>
                    <p>{loadingOverview ? '0' : callStatusSummary.lead}</p>
                    <p>{loadingOverview ? '0' : callStatusSummary.missed}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Agent Schedule Table */}
            <div className="bg-[#f8f8f8] border border-[#f0f0f0] flex flex-col gap-[10px] items-center justify-center min-w-[487px] overflow-hidden px-5 py-4 rounded-[14px] flex-1">
              <div className="flex items-start justify-between pb-4 w-full">
                <p className="text-[14px] font-medium text-[#0a0a0a]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  Agent Schedule
                </p>
                <div className="flex gap-3 items-center justify-end">
                  <Button variant="outline" size="sm" className="h-9 px-4">
                    List: All Lists
                  </Button>
                  <Button variant="outline" size="sm" className="h-9 px-4">
                    Status: All Status
                  </Button>
                </div>
              </div>
              <div className="border border-[#e5e5e5] flex items-start overflow-hidden rounded-[8px] w-full">
                <table className="w-full">
                  <thead>
                    <tr className="bg-white border-b border-[#e5e5e5]">
                      <th className="h-10 px-5 text-left">
                        <div className="flex gap-2 items-center">
                          <span className="text-[14px] font-medium text-[#737373]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                            Date
                          </span>
                          <Settings className="w-4 h-4" />
                        </div>
                      </th>
                      <th className="h-10 px-2 text-left">
                        <span className="text-[14px] font-medium text-[#737373]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                          Time
                        </span>
                      </th>
                      <th className="h-10 px-2 text-left">
                        <span className="text-[14px] font-medium text-[#737373]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                          List
                        </span>
                      </th>
                      <th className="h-10 px-2 text-left">
                        <span className="text-[14px] font-medium text-[#737373]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                          Contacts
                        </span>
                      </th>
                      <th className="h-10 px-2 text-left">
                        <span className="text-[14px] font-medium text-[#737373]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                          Status
                        </span>
                      </th>
                      <th className="h-10 w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingOverview ? (
                      <tr>
                        <td colSpan={6} className="h-[53px] px-5 text-center text-[#737373]">
                          Loading...
                        </td>
                      </tr>
                    ) : agentSchedule.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="h-[53px] px-5 text-center text-[#737373]">
                          No schedule data available
                        </td>
                      </tr>
                    ) : (
                      agentSchedule.map((schedule) => {
                        const date = schedule.call_start_time ? new Date(schedule.call_start_time) : null;
                        const formattedDate = date ? `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}` : '-';
                        const formattedTime = date ? date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-';
                        const status = schedule.call_status || 'pending';
                        const isComplete = status === 'answered' || status === 'completed';
                        const isFailed = status === 'failed' || status === 'missed';
                        const isPending = status === 'pending' || status === 'initiated';

                        return (
                          <tr key={schedule.id} className="bg-white border-b border-[#e5e5e5]">
                            <td className="h-[53px] px-5 py-2">
                              <p className="text-[14px] font-normal text-[#0a0a0a]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                {formattedDate}
                              </p>
                            </td>
                            <td className="h-[53px] px-2 py-2">
                              <p className="text-[14px] font-normal text-[#0a0a0a]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                {formattedTime}
                              </p>
                            </td>
                            <td className="h-[53px] px-2 py-2">
                              <p className="text-[14px] font-normal text-[#0a0a0a]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                {schedule.metadata?.list_id || '-'}
                              </p>
                            </td>
                            <td className="h-[53px] px-2 py-2">
                              <p className="text-[14px] font-normal text-[#0a0a0a]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                {schedule.caller_number || '-'}
                              </p>
                            </td>
                            <td className="h-[53px] px-2 py-2">
                              <Badge
                                className={`text-[12px] font-medium ${isComplete
                                  ? 'bg-[#f0fdf4] border border-[#05df72] text-[#016630]'
                                  : isFailed
                                    ? 'bg-[#fef2f2] border border-[#ff6467] text-[#9f0712]'
                                    : 'bg-[#fff7ed] border border-[#ff8904] text-[#9f2d00]'
                                  }`}
                                style={{ fontFamily: "'Manrope', sans-serif" }}
                              >
                                {isComplete ? 'Complete' : isFailed ? 'Failed' : status === 'initiated' ? 'In Progress' : 'Scheduled'}
                              </Badge>
                            </td>
                            <td className="h-[53px] px-2 py-2 w-16">
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <Settings className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex h-[52px] items-center justify-between pb-4 pt-[30px] w-full">
                <Button className="bg-[#00c19c] hover:bg-[#00c19c]/90 text-white h-9 px-4">
                  <Plus className="w-5 h-5 mr-2" />
                  Add New Schedule
                </Button>
                <div className="flex gap-1 items-center">
                  <Button variant="ghost" size="sm" className="h-9 px-4">
                    Previous
                  </Button>
                  <Button variant="ghost" size="sm" className="h-9 w-9">
                    1
                  </Button>
                  <Button variant="outline" size="sm" className="h-9 w-9">
                    2
                  </Button>
                  <Button variant="ghost" size="sm" className="h-9 w-9">
                    3
                  </Button>
                  <Button variant="ghost" size="sm" className="h-9 w-9">
                    ...
                  </Button>
                  <Button variant="outline" size="sm" className="h-9 px-4 border-[#00c19c] text-[#00c19c]">
                    Next
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="border border-[#f0f0f0] flex flex-col items-start relative rounded-[14px] w-full">
          {/* Header with Search and Filters */}
          <div className="flex items-end justify-between p-5 w-full">
            <div className="flex flex-[1_0_0] flex-col gap-[22px] items-start max-w-[384px]">
              <p className="text-[14px] font-medium text-[#0a0a0a]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                Call Logs
              </p>
              <div className="bg-white border border-[#e5e5e5] flex gap-1 h-9 items-center overflow-hidden px-3 py-1 relative rounded-[8px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] w-full">
                <Search className="w-4 h-4 text-[#737373]" />
                <Input
                  type="text"
                  placeholder="Search"
                  value={logsSearch}
                  onChange={(e) => setLogsSearch(e.target.value)}
                  className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-[14px] text-[#737373]"
                  style={{ fontFamily: "'Manrope', sans-serif" }}
                />
              </div>
            </div>
            <div className="flex gap-3 items-center justify-end">
              <Select value={logsDateFilter} onValueChange={setLogsDateFilter}>
                <SelectTrigger className="bg-white border border-[#e5e5e5] h-9 px-4 text-[14px] font-medium text-[#27272b] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
                  <div className="flex items-center justify-center relative shrink-0 size-4 mr-2">
                    <ChevronRight className="w-4 h-4 rotate-90" />
                  </div>
                  <SelectValue placeholder="Date Range: All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
              <Select value={logsStatusFilter} onValueChange={setLogsStatusFilter}>
                <SelectTrigger className="bg-white border border-[#e5e5e5] h-9 px-4 text-[14px] font-medium text-[#27272b] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
                  <div className="flex items-center justify-center relative shrink-0 size-4 mr-2">
                    <ChevronRight className="w-4 h-4 rotate-90" />
                  </div>
                  <SelectValue placeholder="Status: All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="answered">Answered</SelectItem>
                  <SelectItem value="missed">Missed</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="h-9 px-4">
                <div className="flex items-center justify-center relative shrink-0 size-4 mr-2">
                  <ChevronRight className="w-4 h-4 rotate-90" />
                </div>
                Edit Column
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="flex h-[581px] items-start relative w-full">
            <div className="flex flex-col h-full items-start relative shrink-0 w-[140px]">
              {/* Date Header */}
              <div className="bg-[#f8f8f8] flex flex-[1_0_0] gap-1 items-center min-h-0 min-w-0 overflow-hidden px-5 relative w-full">
                <p className="text-[14px] font-bold text-black text-center" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  Date
                </p>
                <ArrowUpDown className="w-4 h-4" />
              </div>
              {/* Date Rows */}
              {loadingLogs ? (
                <div className="bg-white flex flex-[1_0_0] items-center min-h-0 min-w-0 px-5 relative w-full">
                  <p className="text-[14px] text-center">Loading...</p>
                </div>
              ) : callLogs.length === 0 ? (
                <div className="bg-white flex flex-[1_0_0] items-center min-h-0 min-w-0 px-5 relative w-full">
                  <p className="text-[14px] text-center">No logs found</p>
                </div>
              ) : (
                callLogs.map((log, index) => {
                  const date = log.call_start_time ? new Date(log.call_start_time) : null;
                  const formattedDate = date ? `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}` : '-';
                  return (
                    <div
                      key={log.id}
                      className={`flex flex-[1_0_0] items-center min-h-0 min-w-0 px-5 relative w-full ${index % 2 === 0 ? 'bg-white' : 'bg-[#f8f8f8]'
                        }`}
                    >
                      <p className="text-[14px] font-medium text-[#0a0a0a] text-center" style={{ fontFamily: "'Manrope', sans-serif" }}>
                        {formattedDate}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            {/* Time Column */}
            <div className="flex flex-col h-full items-start relative shrink-0 w-[118px]">
              <div className="bg-[#f8f8f8] flex flex-[1_0_0] items-center min-h-0 min-w-0 overflow-hidden relative w-full">
                <p className="text-[14px] font-bold text-black text-center leading-normal" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  Time
                </p>
              </div>
              {callLogs.map((log, index) => {
                const date = log.call_start_time ? new Date(log.call_start_time) : null;
                const formattedTime = date ? date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-';
                return (
                  <div
                    key={log.id}
                    className={`flex flex-[1_0_0] items-center min-h-0 min-w-0 relative w-full ${index % 2 === 0 ? 'dark:bg-[#1d212b] bg-white' : 'dark:bg-[#2f3541] bg-[#f8f8f8]'
                      }`}
                  >
                    <p className="text-[14px] font-medium dark:text-[#f9fafb] text-black text-center leading-normal" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      {formattedTime}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Contacts Column */}
            <div className="flex flex-[1_0_0] flex-col h-full items-start min-h-0 min-w-0 relative">
              <div className="dark:bg-[#2f3541] bg-[#f8f8f8] flex flex-[1_0_0] gap-1 items-center min-h-0 min-w-0 overflow-hidden relative w-full">
                <p className="text-[14px] font-bold dark:text-[#f9fafb] text-black text-center" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  Contacts
                </p>
                <ArrowUpDown className="w-4 h-4" />
              </div>
              {callLogs.map((log, index) => (
                <div
                  key={log.id}
                  className={`flex flex-[1_0_0] items-center min-h-0 min-w-0 relative w-full ${index % 2 === 0 ? 'bg-white' : 'bg-[#f8f8f8]'
                    }`}
                >
                  <p className="text-[14px] font-medium text-black text-center leading-normal" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    {log.metadata?.contact_name || log.caller_number || '-'}
                  </p>
                </div>
              ))}
            </div>

            {/* Type Column */}
            <div className="flex flex-[1_0_0] flex-col h-full items-start min-h-0 min-w-0 relative">
              <div className="bg-[#f8f8f8] flex flex-[1_0_0] gap-2 items-center min-h-0 min-w-0 relative w-full">
                <p className="text-[14px] font-bold text-black leading-normal" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  Type
                </p>
              </div>
              {callLogs.map((log, index) => (
                <div
                  key={log.id}
                  className={`flex flex-[1_0_0] items-center min-h-0 min-w-0 relative w-full ${index % 2 === 0 ? 'bg-white' : 'bg-[#f8f8f8]'
                    }`}
                >
                  <div className="border dark:border-[#818898] border-[#737373] border-solid flex items-center justify-center overflow-hidden px-2 py-[3px] rounded-[6px] shrink-0">
                    <p className="text-[12px] font-medium dark:text-[#818898] text-[#737373] text-center whitespace-nowrap leading-[16px]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      outboundPhoneCall
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Phone Column */}
            <div className="flex flex-[1_0_0] flex-col h-full items-start min-h-0 min-w-0 relative">
              <div className="bg-[#f8f8f8] flex flex-[1_0_0] items-center min-h-0 min-w-0 relative w-full">
                <p className="text-[14px] font-bold text-black leading-normal" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  Phone
                </p>
              </div>
              {callLogs.map((log, index) => (
                <div
                  key={log.id}
                  className={`flex flex-[1_0_0] items-center min-h-0 min-w-0 relative w-full ${index % 2 === 0 ? 'bg-white' : 'bg-[#f8f8f8]'
                    }`}
                >
                  <p className="text-[14px] font-medium text-black leading-normal" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    {log.caller_number || '-'}
                  </p>
                </div>
              ))}
            </div>

            {/* List Column */}
            <div className="flex flex-[1_0_0] flex-col h-full items-start min-h-0 min-w-0 relative">
              <div className="bg-[#f8f8f8] flex flex-[1_0_0] items-center min-h-0 min-w-0 py-[10px] relative w-full">
                <p className="text-[14px] font-bold text-black leading-normal" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  List
                </p>
              </div>
              {callLogs.map((log, index) => (
                <div
                  key={log.id}
                  className={`flex flex-[1_0_0] items-center min-h-0 min-w-0 relative w-full ${index % 2 === 0 ? 'bg-white' : 'bg-[#f8f8f8]'
                    }`}
                >
                  <p className="text-[14px] font-medium text-black leading-normal" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    {log.metadata?.list_name || 'DEMO LIST 10'}
                  </p>
                </div>
              ))}
            </div>

            {/* Status Column */}
            <div className="flex flex-col h-full items-center relative shrink-0 w-[119px]">
              <div className="bg-[#f8f8f8] flex flex-[1_0_0] gap-2 items-center min-h-0 min-w-0 relative w-full">
                <p className="text-[14px] font-bold text-black leading-normal" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  Status
                </p>
              </div>
              {callLogs.map((log, index) => {
                const isComplete = log.call_status === 'answered' || log.call_status === 'completed';
                const isFailed = log.call_status === 'failed' || log.call_status === 'missed';
                return (
                  <div
                    key={log.id}
                    className={`flex flex-[1_0_0] items-center min-h-0 min-w-0 relative w-full ${index % 2 === 0 ? 'dark:bg-[#1d212b] bg-white' : 'dark:bg-[#2f3541] bg-[#f8f8f8]'
                      }`}
                  >
                    <div
                      className={`border border-solid flex items-center justify-center overflow-hidden pl-[3px] pr-2 py-[3px] rounded-[6px] shrink-0 ${isComplete
                        ? 'bg-[#f0fdf4] border-[#05df72] text-[#016630]'
                        : isFailed
                          ? 'bg-[#fef2f2] border-[#ff6467] text-[#9f0712]'
                          : 'bg-[#fff7ed] border-[#ff8904] text-[#9f2d00]'
                        }`}
                    >
                      <p className="text-[12px] font-medium text-center whitespace-nowrap leading-[16px]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                        {isComplete ? 'Complete' : isFailed ? 'Failed' : 'Pending'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Action Column */}
            <div className="flex flex-col h-full items-center relative shrink-0 w-[117px]">
              <div className="bg-[#f8f8f8] flex flex-[1_0_0] gap-2 items-center justify-end min-h-0 min-w-0 overflow-hidden px-5 relative w-full">
                <p className="text-[14px] font-bold text-black leading-normal" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  Action
                </p>
              </div>
              {callLogs.map((log, index) => (
                <div
                  key={log.id}
                  className={`flex flex-[1_0_0] items-center justify-end min-h-0 min-w-0 px-5 relative w-full ${index % 2 === 0 ? 'bg-white' : 'bg-[#f8f8f8]'
                    }`}
                >
                  <button
                    onClick={() => {
                      setSelectedLog(log);
                      setShowLogDetail(true);
                    }}
                    className="text-[12px] font-medium text-[#00c19c] underline decoration-solid leading-[16px]"
                    style={{ fontFamily: "'Manrope', sans-serif" }}
                  >
                    View Detail
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Pagination */}
          <div className="flex h-[74px] items-center justify-center px-[25px] py-[55px] relative w-full">
            <div className="flex gap-1 items-center">
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-4"
                onClick={() => setLogsPage(prev => Math.max(1, prev - 1))}
                disabled={logsPage === 1}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9"
                onClick={() => setLogsPage(1)}
              >
                1
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-9"
                onClick={() => setLogsPage(2)}
              >
                2
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9"
                onClick={() => setLogsPage(3)}
              >
                3
              </Button>
              <Button variant="ghost" size="sm" className="h-9 w-9">
                ...
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-4 border-[#00c19c] text-[#00c19c]"
                onClick={() => setLogsPage(prev => prev + 1)}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Log Detail Dialog */}
      {showLogDetail && selectedLog && (
        <Dialog open={showLogDetail} onOpenChange={setShowLogDetail}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card text-foreground border-border">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="text-[18px] font-bold text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  Call ID: {selectedLog.id.substring(0, 8)}
                </DialogTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowLogDetail(false)}
                  className="h-8 w-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </DialogHeader>

            <div className="space-y-6 mt-4">
              {/* Call Details */}
              <div>
                <h3 className="text-[16px] font-bold dark:text-[#f9fafb] text-[#27272b] mb-3" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  Call Details
                </h3>
                <div className="space-y-2 text-[14px]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Call Status:</span>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span>{selectedLog.call_status === 'answered' || selectedLog.call_status === 'completed' ? 'Completed' : selectedLog.call_status}</span>
                    </div>
                  </div>
                  <div>
                    <span className="font-medium">Call Duration:</span>{' '}
                    {selectedLog.call_duration
                      ? `${Math.floor(selectedLog.call_duration / 60)}:${String(selectedLog.call_duration % 60).padStart(2, '0')}:00`
                      : '00:00:00'}
                  </div>
                  {selectedLog.call_start_time && (
                    <>
                      <div>
                        <span className="font-medium">Call Date:</span>{' '}
                        {new Date(selectedLog.call_start_time).toLocaleDateString()}
                      </div>
                      <div>
                        <span className="font-medium">Call Time:</span>{' '}
                        {new Date(selectedLog.call_start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </div>
                    </>
                  )}
                  <div>
                    <span className="font-medium">Customer Number:</span> {selectedLog.caller_number || '-'}
                  </div>
                  <div>
                    <span className="font-medium">Agent Number:</span> {selectedLog.called_number || '-'}
                  </div>
                  <div>
                    <span className="font-medium">Call Cost:</span> ${selectedLog.call_cost ? Number(selectedLog.call_cost).toFixed(2) : '0.00'}
                  </div>
                  {selectedLog.recording_url && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Recording:</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (currentAudio) {
                            currentAudio.pause();
                            setCurrentAudio(null);
                            setPlayingAudio(null);
                          }
                          const audio = new Audio(selectedLog.recording_url);
                          audio.play();
                          setCurrentAudio(audio);
                          setPlayingAudio(selectedLog.id);
                          audio.onended = () => {
                            setCurrentAudio(null);
                            setPlayingAudio(null);
                          };
                        }}
                        className="h-8"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Play Recording
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Agent Details */}
              {editingAgent && (
                <div>
                  <h3 className="text-[16px] font-bold dark:text-[#f9fafb] text-[#27272b] mb-3" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    Agent Details
                  </h3>
                  <div className="space-y-2 text-[14px]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    <div>
                      <span className="font-medium">Agent Name:</span> {editingAgent.name || '-'}
                    </div>
                    <div>
                      <span className="font-medium">Agent ID:</span> {editingAgent.id.substring(0, 8) || '-'}
                    </div>
                    <div>
                      <span className="font-medium">Agent Type:</span> Voice Agent
                    </div>
                  </div>
                </div>
              )}

              {/* Transcript */}
              {selectedLog.transcript && (
                <div>
                  <h3 className="text-[16px] font-bold dark:text-[#f9fafb] text-[#27272b] mb-3" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    Transcript
                  </h3>
                  <div className="dark:bg-[#2f3541] bg-[#f8f8f8] rounded-lg p-4 max-h-[400px] overflow-y-auto">
                    <div className="space-y-3 text-[14px] whitespace-pre-wrap" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      {selectedLog.transcript.split('\n').map((line: string, idx: number) => {
                        if (line.includes('Agent:') || line.includes('Customer:')) {
                          const parts = line.split(':');
                          const speaker = parts[0];
                          const text = parts.slice(1).join(':');
                          const timestamp = line.match(/\[(\d{2}:\d{2}:\d{2})\]/)?.[1] || '';
                          return (
                            <div key={idx} className="mb-2">
                              <span className="font-bold dark:text-[#f9fafb] text-[#27272b]">{speaker}:</span>
                              {timestamp && <span className="dark:text-[#818898] text-[#737373] ml-2">[{timestamp}]</span>}
                              <p className="dark:text-[#f9fafb] text-[#27272b] mt-1">{text.trim()}</p>
                            </div>
                          );
                        }
                        return <p key={idx} className="dark:text-[#f9fafb] text-[#27272b]">{line}</p>;
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* AI Autofill Dialog */}
      <Dialog open={showAutofillDialog} onOpenChange={setShowAutofillDialog}>
        <DialogContent className="bg-card text-foreground border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              AI Agent Autofill
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Describe your business or agent requirements, and AI will generate complete agent configuration details for you.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* API Key Status Indicator */}
            {(!process.env.REACT_APP_OPENAI_API && !process.env.REACT_APP_OPENAI_API_KEY) && (
              <Alert variant="destructive">
                <AlertDescription>
                  <strong>Configuration Required:</strong> OpenAI API key not found. Please add <code className="text-xs bg-muted px-1 py-0.5 rounded">REACT_APP_OPENAI_API</code> to your <code className="text-xs bg-muted px-1 py-0.5 rounded">.env.local</code> file and restart the development server.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="autofillPrompt" className="text-foreground">
                Describe your agent or business
              </Label>
              <div className="space-y-2">
                <Textarea
                  id="autofillPrompt"
                  value={autofillPrompt}
                  onChange={(e) => {
                    setAutofillPrompt(e.target.value);
                    setAutofillError(null); // Clear error when user types
                  }}
                  onKeyDown={(e) => {
                    // Allow Ctrl+Enter or Cmd+Enter to submit
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && autofillPrompt.trim() && !autofillLoading) {
                      e.preventDefault();
                      handleGenerateAutofill();
                    }
                  }}
                  placeholder="Describe your business and what you need the agent to do. For example: 'I run a real estate agency. I need an agent that can answer property inquiries, schedule viewings, and qualify leads. The agent should be professional, knowledgeable about our listings, and able to capture contact information.'"
                  rows={6}
                  className="bg-background text-foreground border-border resize-none"
                  disabled={autofillLoading}
                />
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs text-muted-foreground">Quick suggestions:</span>
                  <button
                    type="button"
                    onClick={() => setAutofillPrompt('Real estate agency - answer property inquiries, schedule viewings, qualify leads')}
                    className="text-xs px-2 py-1 bg-primary/10 text-primary rounded hover:bg-primary/20"
                    disabled={autofillLoading}
                  >
                    Real Estate
                  </button>
                  <button
                    type="button"
                    onClick={() => setAutofillPrompt('E-commerce store - handle product questions, process orders, provide shipping updates')}
                    className="text-xs px-2 py-1 bg-primary/10 text-primary rounded hover:bg-primary/20"
                    disabled={autofillLoading}
                  >
                    E-commerce
                  </button>
                  <button
                    type="button"
                    onClick={() => setAutofillPrompt('Healthcare clinic - schedule appointments, answer questions about services, provide clinic information')}
                    className="text-xs px-2 py-1 bg-primary/10 text-primary rounded hover:bg-primary/20"
                    disabled={autofillLoading}
                  >
                    Healthcare
                  </button>
                  <button
                    type="button"
                    onClick={() => setAutofillPrompt('Restaurant - take reservations, answer menu questions, provide hours and location')}
                    className="text-xs px-2 py-1 bg-primary/10 text-primary rounded hover:bg-primary/20"
                    disabled={autofillLoading}
                  >
                    Restaurant
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Be as detailed as possible. Include your company name, business type, services offered, and what you want the agent to do. Press Ctrl+Enter (or Cmd+Enter on Mac) to generate.
                </p>
              </div>
            </div>

            {autofillError && (
              <Alert variant="destructive">
                <AlertDescription>{autofillError}</AlertDescription>
              </Alert>
            )}

            {autofillLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Generating agent details with AI...
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseAutofillDialog}
              disabled={autofillLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={(e) => {
                console.log('Generate button clicked');
                handleGenerateAutofill(e);
              }}
              disabled={autofillLoading || !autofillPrompt.trim()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {autofillLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate & Fill
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Warning Dialog for Number Reassignment */}
      <Dialog open={showNumberWarning} onOpenChange={setShowNumberWarning}>
        <DialogContent className="bg-card text-foreground border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Phone Number Already Assigned</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              This phone number is currently assigned to another agent.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Alert variant="warning">
              <AlertDescription>
                <strong>Current Assignment:</strong> {previousAgent?.name || 'Unknown Agent'}
              </AlertDescription>
            </Alert>
            <p className="text-sm text-foreground">
              If you proceed, the number will be removed from <strong>{previousAgent?.name || 'the previous agent'}</strong> and that agent will be set to <strong>inactive</strong>.
              The number will then be assigned to {isEditMode ? 'this agent' : 'the new agent'}.
            </p>
            {!isEditMode && (
              <p className="text-sm text-foreground font-medium">
                Note: Only one number can be assigned to one agent at a time. Creating this agent will disable the previous agent.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelNumberReassignment}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmNumberReassignment}
              disabled={loading}
              variant="destructive"
            >
              Proceed & Disable Previous Agent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Saved Prompts Selection Dialog */}
      <Dialog open={showPromptDialog} onOpenChange={setShowPromptDialog}>
        <DialogContent className="max-w-[600px] max-h-[80vh] overflow-y-auto bg-card text-foreground border-border">
          <DialogHeader>
            <DialogTitle>Select a Saved Prompt</DialogTitle>
            <DialogDescription>
              Choose a prompt to autofill your agent configuration, or generate a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            {/* Generate Prompt Button */}
            <Button
              onClick={openGeneratePromptDialog}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground mb-2"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Generate New Prompt
            </Button>

            <Separator />

            {loadingPrompts ? (
              <div className="flex justify-center p-4"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>
            ) : savedPrompts.length === 0 ? (
              <div className="text-center p-8 dark:text-[#818898] text-gray-500 border-2 dark:border-[#2f3541] border-dashed rounded-lg">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No saved prompts found.</p>
                <p className="text-sm mt-1">Click "Generate New Prompt" above to create one.</p>
              </div>
            ) : (
              savedPrompts.map((prompt) => (
                <div
                  key={prompt.id}
                  className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted cursor-pointer transition-colors group"
                  onClick={() => handleSelectPrompt(prompt.id)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm text-foreground">{prompt.name}</h4>
                      <span className="text-[10px] px-2 py-0.5 bg-muted rounded-full text-muted-foreground uppercase tracking-wide">{prompt.category}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Created: {new Date(prompt.created_at).toLocaleDateString()}</p>
                    {prompt.system_prompt && (
                      <div className="text-xs text-muted-foreground mt-2 line-clamp-2 font-mono bg-muted p-2 rounded border border-border">{prompt.system_prompt.substring(0, 150)}...</div>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity text-primary">Select <ChevronRight className="w-4 h-4 ml-1" /></Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Generate Prompt Dialog */}
      <Dialog open={showGeneratePromptDialog} onOpenChange={setShowGeneratePromptDialog}>
        <DialogContent className="max-w-[700px] max-h-[90vh] overflow-y-auto bg-card text-foreground border-border">
          <DialogHeader>
            <DialogTitle>Generate New Prompt</DialogTitle>
            <DialogDescription>
              Fill in the essential information to generate a prompt. The generated prompt will be saved and used to autofill your agent form.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Essential Fields */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gen-company-name">Company Name <span className="text-destructive">*</span></Label>
                <Input
                  id="gen-company-name"
                  value={promptGenFormData.companyName || ''}
                  onChange={(e) => setPromptGenFormData(prev => ({ ...prev, companyName: e.target.value }))}
                  placeholder="e.g., NSOL BPO"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gen-business-industry">Business Industry</Label>
                <Input
                  id="gen-business-industry"
                  value={promptGenFormData.businessIndustry || ''}
                  onChange={(e) => setPromptGenFormData(prev => ({ ...prev, businessIndustry: e.target.value }))}
                  placeholder="e.g., BPO, Healthcare, Real Estate"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gen-call-type">Call Type <span className="text-destructive">*</span></Label>
                  <Select
                    value={promptGenFormData.callType}
                    onValueChange={(value: AgentPromptProfile['callType']) => setPromptGenFormData(prev => ({ ...prev, callType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sales">Sales</SelectItem>
                      <SelectItem value="Support">Support</SelectItem>
                      <SelectItem value="Booking">Booking</SelectItem>
                      <SelectItem value="Billing">Billing</SelectItem>
                      <SelectItem value="Complaint">Complaint</SelectItem>
                      <SelectItem value="Mixed">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gen-call-goal">Call Goal</Label>
                  <Select
                    value={promptGenFormData.callGoal}
                    onValueChange={(value: AgentPromptProfile['callGoal']) => setPromptGenFormData(prev => ({ ...prev, callGoal: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Book Appointment">Book Appointment</SelectItem>
                      <SelectItem value="Close Sale">Close Sale</SelectItem>
                      <SelectItem value="Qualify Lead">Qualify Lead</SelectItem>
                      <SelectItem value="Collect Information">Collect Information</SelectItem>
                      <SelectItem value="Support Resolution">Support Resolution</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gen-agent-purpose">Agent Purpose <span className="text-destructive">*</span></Label>
                <Textarea
                  id="gen-agent-purpose"
                  value={promptGenFormData.agentPurpose || ''}
                  onChange={(e) => setPromptGenFormData(prev => ({ ...prev, agentPurpose: e.target.value }))}
                  placeholder="e.g., Handle inbound customer support calls and book appointments"
                  className="min-h-[80px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gen-target-audience">Target Audience</Label>
                <Input
                  id="gen-target-audience"
                  value={promptGenFormData.targetAudience || ''}
                  onChange={(e) => setPromptGenFormData(prev => ({ ...prev, targetAudience: e.target.value }))}
                  placeholder="e.g., Small business owners looking for IT services"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gen-tone">Tone</Label>
                <Select
                  value={promptGenFormData.tone}
                  onValueChange={(value: AgentPromptProfile['tone']) => setPromptGenFormData(prev => ({ ...prev, tone: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Friendly">Friendly</SelectItem>
                    <SelectItem value="Professional">Professional</SelectItem>
                    <SelectItem value="Empathetic">Empathetic</SelectItem>
                    <SelectItem value="Energetic">Energetic</SelectItem>
                    <SelectItem value="Strict">Strict</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Services Input */}
              <div className="space-y-2">
                <Label>Services (Optional)</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a service"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const input = e.currentTarget;
                        if (input.value.trim()) {
                          setPromptGenFormData(prev => ({
                            ...prev,
                            services: [...(prev.services || []), input.value.trim()],
                          }));
                          input.value = '';
                        }
                      }
                    }}
                  />
                </div>
                {promptGenFormData.services && promptGenFormData.services.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {promptGenFormData.services.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 bg-primary/10 px-3 py-1 rounded-full">
                        <span className="text-sm">{s}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0"
                          onClick={() => {
                            setPromptGenFormData(prev => ({
                              ...prev,
                              services: (prev.services || []).filter((_, idx) => idx !== i),
                            }));
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Generated Prompt Preview */}
            {generatedPromptData && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Prompt Name <span className="text-destructive">*</span></Label>
                    <Input
                      value={promptSaveName}
                      onChange={(e) => setPromptSaveName(e.target.value)}
                      placeholder="e.g., Sales Agent Prompt"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={promptSaveCategory} onValueChange={setPromptSaveCategory}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="sales">Sales</SelectItem>
                        <SelectItem value="support">Support</SelectItem>
                        <SelectItem value="appointment">Appointment</SelectItem>
                        <SelectItem value="follow-up">Follow-up</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Generated Prompt Preview</Label>
                    <div className="p-3 bg-muted rounded-lg border border-border max-h-[200px] overflow-y-auto">
                      <pre className="text-xs whitespace-pre-wrap font-mono">{generatedPromptData.finalPrompt.substring(0, 500)}...</pre>
                    </div>
                  </div>

                  {generatedPromptData.welcomeMessages.length > 0 && (
                    <div className="space-y-2">
                      <Label>Generated Welcome Messages ({generatedPromptData.welcomeMessages.length})</Label>
                      <div className="space-y-1 max-h-[150px] overflow-y-auto">
                        {generatedPromptData.welcomeMessages.map((msg, i) => (
                          <div key={i} className="text-xs bg-muted p-2 rounded border border-border">
                            {i + 1}. {msg}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowGeneratePromptDialog(false);
                setGeneratedPromptData(null);
              }}
              disabled={isGeneratingPrompt || isSavingPrompt}
            >
              Cancel
            </Button>
            {!generatedPromptData ? (
              <Button
                onClick={handleGeneratePromptInDialog}
                disabled={isGeneratingPrompt || !promptGenFormData.companyName || !promptGenFormData.agentPurpose || !promptGenFormData.callType}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isGeneratingPrompt ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Prompt
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleSaveAndUsePrompt}
                disabled={isSavingPrompt || !promptSaveName.trim()}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isSavingPrompt ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Save & Use Prompt
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreateVoiceAgent;
