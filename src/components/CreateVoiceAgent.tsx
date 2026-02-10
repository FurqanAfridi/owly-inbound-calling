import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { User, Building2, Globe, Mic, FileText, Phone, Settings, Plus, Sparkles, X, Play, Volume2, Coins } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { hasEnoughCredits, deductAgentCreationCredits, CREDIT_RATES } from '../services/creditService';
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
} from './ui/select';
import { Separator } from './ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Slider } from './ui/slider';
import { allVoices, vapiVoices, deepgramVoices, VoiceConfig } from '../data/voices';

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

const CreateVoiceAgent: React.FC = () => {
  const navigate = useNavigate();
  const { id: agentId } = useParams<{ id?: string }>();
  const { user } = useAuth();
  const isEditMode = !!agentId;
  const [loading, setLoading] = useState(false);
  const [loadingAgent, setLoadingAgent] = useState(isEditMode);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [inboundNumbers, setInboundNumbers] = useState<InboundNumber[]>([]);
  const [selectedNumberId, setSelectedNumberId] = useState<string>('');
  const [loadingNumbers, setLoadingNumbers] = useState(true);
  const [editingAgent, setEditingAgent] = useState<any>(null);
  const [showNumberWarning, setShowNumberWarning] = useState(false);
  const [pendingNumberId, setPendingNumberId] = useState<string>('');
  const [previousAgent, setPreviousAgent] = useState<{ id: string; name: string } | null>(null);
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<Array<{ id: string; name: string }>>([]);

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
      if (isEditMode && agentId && user) {
        // Wait a bit for inbound numbers to be loaded
        setTimeout(() => {
          loadAgentForEdit(agentId);
        }, 100);
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

  const fetchInboundNumbers = async () => {
    if (!user) return;

    setLoadingNumbers(true);
    try {
      const { data, error } = await supabase
        .from('inbound_numbers')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .is('deleted_at', null)
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
        // Populate form with agent data
        setFormData({
          agentName: data.name || '',
          companyName: data.company_name || 'DNAI', // Default to DNAI if not set
          websiteUrl: data.website_url || 'https://duhanashrah.ai', // Default to duhanashrah.ai if not set
          goal: data.goal || '',
          backgroundContext: data.background || '',
          welcomeMessage: data.welcome_message || '',
          instructionVoice: data.instruction_voice || '',
          script: data.script || '',
          language: data.language || 'en-US',
          timezone: data.timezone || '',
          agentType: data.agent_type || '',
          tool: data.tool || '',
          voice: data.voice || 'helena',
          temperature: data.temperature || 0.7,
          confidence: data.confidence || 0.8,
          verbosity: data.verbosity || 0.7,
          fallbackEnabled: data.fallback_enabled || false,
          fallbackNumber: data.fallback_number || '',
          knowledgeBaseId: data.knowledge_base_id || '',
          callAvailabilityStart: data.metadata?.call_availability_start || '09:00',
          callAvailabilityEnd: data.metadata?.call_availability_end || '17:00',
          callAvailabilityDays: data.metadata?.call_availability_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        });

        // Find and set the selected inbound number
        // Re-fetch inbound numbers to ensure we have the latest data
        const { data: numbersData } = await supabase
          .from('inbound_numbers')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .is('deleted_at', null);

        if (numbersData && data.phone_number) {
          const matchingNumber = numbersData.find(
            (n: InboundNumber) => n.phone_number === data.phone_number
          );
          if (matchingNumber) {
            setSelectedNumberId(matchingNumber.id);
          }
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
  };

  const handleTemperatureChange = (value: number[]) => {
    setFormData(prev => ({ ...prev, temperature: value[0] }));
  };

  const handleConfidenceChange = (value: number[]) => {
    setFormData(prev => ({ ...prev, confidence: value[0] }));
  };

  const handleVerbosityChange = (value: number[]) => {
    setFormData(prev => ({ ...prev, verbosity: value[0] }));
  };

  const getSelectedNumber = (): InboundNumber | null => {
    return inboundNumbers.find(n => n.id === selectedNumberId) || null;
  };

  const autofillForm = () => {
    setFormData({
      agentName: 'julie2',
      companyName: 'EduCare',
      websiteUrl: 'https://educare.com',
      goal: 'The core business goal, in order of priority, is:\n\nConvert inbound inquiries into booked trial classes\n\nCapture and validate lead information step-by-step\n\nDeliver trial classes as the primary conversion mechanism',
      backgroundContext: 'EduCare is positioned as an online live tuition platform that provides:\n\nDedicated 1-to-1 or live online classes\n\nAcademic and professional subject tutoring\n\nServices delivered through human-like inbound voice support',
      welcomeMessage: 'Hi, thank you for calling our online tuition support line… this is EduCare. How can I help you today?',
      instructionVoice: 'Be friendly, professional, and helpful. Listen carefully to the caller\'s needs and provide accurate information.',
      script: 'You are **EduCare**, a **human‑sounding inbound voice agent** for an **online live tuition platform**.',
      language: 'en-US',
      timezone: 'America/New_York',
      agentType: 'sales',
      tool: 'calendar',
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

    if (inboundNumbers.length > 0) {
      setSelectedNumberId(inboundNumbers[0].id);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!selectedNumberId) {
      setStatusMessage({ type: 'error', text: 'Please select an inbound number before creating the agent' });
      return;
    }

    const selectedNumber = getSelectedNumber();
    if (!selectedNumber) {
      setStatusMessage({ type: 'error', text: 'Selected number not found. Please refresh and try again.' });
      return;
    }

    if (!user) {
      setStatusMessage({ type: 'error', text: 'You must be logged in to create an agent' });
      return;
    }

    // Only check credits for new agents, not edits
    if (!isEditMode) {
      const creditCheck = await hasEnoughCredits(user.id, CREDIT_RATES.AGENT_CREATION);
      
      if (!creditCheck.hasEnough) {
        setStatusMessage({ 
          type: 'error', 
          text: creditCheck.message || 'Insufficient credits. Creating an agent requires 5 credits.' 
        });
        return;
      }
    }

    setLoading(true);

    try {
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
        welcome_message: formData.welcomeMessage,
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
        phone_provider: selectedNumber.provider,
        phone_number: selectedNumber.phone_number,
        phone_label: selectedNumber.phone_label || '',
        status: 'active',
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

      if (selectedNumber.provider === 'twilio') {
        agentData.twilio_sid = selectedNumber.twilio_sid;
        agentData.twilio_auth_token = selectedNumber.twilio_auth_token;
        agentData.sms_enabled = selectedNumber.sms_enabled || false;
      } else if (selectedNumber.provider === 'vonage') {
        agentData.vonage_api_key = selectedNumber.vonage_api_key;
        agentData.vonage_api_secret = selectedNumber.vonage_api_secret;
      } else if (selectedNumber.provider === 'telnyx') {
        agentData.telnyx_api_key = selectedNumber.telnyx_api_key;
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
      if (isEditMode) {
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

      let data;
      if (isEditMode) {
        // Update existing agent - preserve existing metadata and merge with new call availability
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
      } else {
        // Insert new agent
        const { data: insertData, error: insertError } = await supabase
          .from('voice_agents')
          .insert(agentData)
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }
        data = insertData;

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

      setStatusMessage({ 
        type: 'success', 
        text: isEditMode 
          ? 'Agent updated successfully!' 
          : `Agent created successfully! ${isEditMode ? '' : '5 credits deducted.'}` 
      });
      
      setTimeout(() => {
        navigate('/agents');
      }, 2000);
    } catch (error: any) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} agent:`, error);
      setStatusMessage({ type: 'error', text: error.message || `Failed to ${isEditMode ? 'update' : 'create'} agent. Please try again.` });
    } finally {
      setLoading(false);
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

  return (
    <>
      <div className="space-y-6">
        {/* Action Button */}
        <div className="flex justify-end">
          <Button 
            variant="outline" 
            onClick={autofillForm}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Autofill
          </Button>
        </div>

        {statusMessage && (
          <Alert variant={statusMessage.type === 'success' ? 'success' : 'destructive'}>
            <AlertDescription>{statusMessage.text}</AlertDescription>
          </Alert>
        )}

        {loadingAgent ? (
          <div className="flex justify-center items-center min-h-[60vh]">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">{isEditMode ? 'Edit Voice Agent' : 'Create New Voice Agent'}</CardTitle>
            <CardDescription className="text-muted-foreground">
              {isEditMode ? 'Update your DNAI voice agent configuration' : 'Configure your DNAI voice agent to handle inbound calls'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Agent Name */}
              <div className="space-y-2">
                <Label htmlFor="agentName" className="text-foreground">Agent Name *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="agentName"
                    name="agentName"
                    value={formData.agentName}
                    onChange={handleInputChange}
                    placeholder="Ex. Sales Agent, Support Agent"
                    required
                    className="pl-10 bg-background text-foreground border-border"
                  />
                </div>
              </div>

              {/* Company Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName" className="text-foreground">Company Name *</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="companyName"
                      name="companyName"
                      value={formData.companyName}
                      onChange={handleInputChange}
                      placeholder="Enter your company name"
                      required
                      className="pl-10 bg-background text-foreground border-border"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="websiteUrl" className="text-foreground">Website URL *</Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="websiteUrl"
                      name="websiteUrl"
                      value={formData.websiteUrl}
                      onChange={handleInputChange}
                      placeholder="http://company.com"
                      type="url"
                      required
                      className="pl-10 bg-background text-foreground border-border"
                    />
                  </div>
                </div>
              </div>

              {/* Goals & Context */}
              <div className="space-y-2">
                <Label htmlFor="goal" className="text-foreground">Goal *</Label>
                <Textarea
                  id="goal"
                  name="goal"
                  value={formData.goal}
                  onChange={handleInputChange}
                  placeholder="Ex. Convert inquiries into booked appointments, Schedule meetings"
                  rows={3}
                  required
                  className="bg-background text-foreground border-border"
                />
                <p className="text-xs text-muted-foreground">Define the primary objectives for this agent</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="backgroundContext" className="text-foreground">Background Context *</Label>
                <Textarea
                  id="backgroundContext"
                  name="backgroundContext"
                  value={formData.backgroundContext}
                  onChange={handleInputChange}
                  placeholder="Describe history about your company, mission, or product."
                  rows={4}
                  required
                  className="bg-background text-foreground border-border"
                />
                <p className="text-xs text-muted-foreground">Provide context about your business to help the agent understand your brand</p>
              </div>

              {/* Voice Configuration */}
              <Separator />
              <div className="flex items-center gap-2">
                <Mic className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">Voice Configuration</h3>
              </div>

              {/* Voice Selection */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="voice" className="text-foreground">Select Voice *</Label>
                  <Tabs defaultValue="deepgram" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-muted/50">
                      <TabsTrigger value="deepgram" className="text-foreground">Deepgram Voices</TabsTrigger>
                      <TabsTrigger value="vapi" className="text-foreground">VAPI Voices</TabsTrigger>
                    </TabsList>
                    <TabsContent value="deepgram" className="mt-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto p-2">
                        {deepgramVoices.map((voice) => (
                          <button
                            key={voice.value}
                            type="button"
                            onClick={() => handleSelectChange('voice', voice.value)}
                            className={`p-3 rounded-lg border-2 transition-all text-left ${
                              formData.voice === voice.value
                                ? 'border-primary bg-primary/10'
                                : 'border-border bg-muted/30 hover:border-primary/50'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-semibold text-sm text-foreground">{voice.label}</p>
                                  <Badge variant="outline" className="text-xs">
                                    {voice.gender === 'masculine' ? 'Male' : 'Female'}
                                  </Badge>
                                </div>
                                {voice.description && (
                                  <p className="text-xs text-muted-foreground mb-1">{voice.description}</p>
                                )}
                                {voice.useCase && (
                                  <p className="text-xs text-muted-foreground italic">Use: {voice.useCase}</p>
                                )}
                              </div>
                              {voice.audioUrl && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePlayAudio(voice.audioUrl!, voice.value);
                                  }}
                                  className="p-1.5 rounded-full bg-primary/20 hover:bg-primary/30 transition-colors"
                                >
                                  {playingAudio === voice.value ? (
                                    <Volume2 className="w-4 h-4 text-primary" />
                                  ) : (
                                    <Play className="w-4 h-4 text-primary" />
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
                            className={`p-3 rounded-lg border-2 transition-all text-left ${
                              formData.voice === voice.value
                                ? 'border-primary bg-primary/10'
                                : 'border-border bg-muted/30 hover:border-primary/50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-sm text-foreground">{voice.label}</p>
                                  <Badge variant="outline" className="text-xs">
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
                  {formData.voice && getSelectedVoice() && (
                    <div className="mt-2 p-3 rounded-lg bg-primary/10 border border-primary/30">
                      <p className="text-sm text-foreground">
                        <strong>Selected:</strong> {getSelectedVoice()?.label}
                        {getSelectedVoice()?.description && (
                          <span className="text-muted-foreground"> - {getSelectedVoice()?.description}</span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="welcomeMessage" className="text-foreground">Welcome Message *</Label>
                <div className="relative">
                  <Mic className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
                  <Textarea
                    id="welcomeMessage"
                    name="welcomeMessage"
                    value={formData.welcomeMessage}
                    onChange={handleInputChange}
                    placeholder="Hello! How can I help you today?"
                    rows={2}
                    required
                    className="pl-10 bg-background text-foreground border-border"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="instructionVoice" className="text-foreground">Instruction Voice *</Label>
                <Textarea
                  id="instructionVoice"
                  name="instructionVoice"
                  value={formData.instructionVoice}
                  onChange={handleInputChange}
                  placeholder="Describe the voice tone and style"
                  rows={3}
                  required
                  className="bg-background text-foreground border-border"
                />
                <p className="text-xs text-muted-foreground">Describe how the agent should speak and interact</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="script" className="text-foreground">Script *</Label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
                  <Textarea
                    id="script"
                    name="script"
                    value={formData.script}
                    onChange={handleInputChange}
                    placeholder="Drag file or type script for your DNAI agent."
                    rows={5}
                    required
                    className="pl-10 bg-background text-foreground border-border"
                  />
                </div>
              </div>

              {/* Call Availability Time */}
              <Separator />
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">Call Availability Time</h3>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="callAvailabilityStart" className="text-foreground">Start Time *</Label>
                    <Input
                      id="callAvailabilityStart"
                      name="callAvailabilityStart"
                      type="time"
                      value={formData.callAvailabilityStart}
                      onChange={handleInputChange}
                      required
                      className="bg-background text-foreground border-border"
                    />
                    <p className="text-xs text-muted-foreground">When calls can start being received</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="callAvailabilityEnd" className="text-foreground">End Time *</Label>
                    <Input
                      id="callAvailabilityEnd"
                      name="callAvailabilityEnd"
                      type="time"
                      value={formData.callAvailabilityEnd}
                      onChange={handleInputChange}
                      required
                      className="bg-background text-foreground border-border"
                    />
                    <p className="text-xs text-muted-foreground">When calls stop being received</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground">Available Days *</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { value: 'monday', label: 'Monday' },
                      { value: 'tuesday', label: 'Tuesday' },
                      { value: 'wednesday', label: 'Wednesday' },
                      { value: 'thursday', label: 'Thursday' },
                      { value: 'friday', label: 'Friday' },
                      { value: 'saturday', label: 'Saturday' },
                      { value: 'sunday', label: 'Sunday' },
                    ].map((day) => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => {
                          const currentDays = [...formData.callAvailabilityDays];
                          const index = currentDays.indexOf(day.value);
                          if (index > -1) {
                            currentDays.splice(index, 1);
                          } else {
                            currentDays.push(day.value);
                          }
                          setFormData(prev => ({ ...prev, callAvailabilityDays: currentDays }));
                        }}
                        className={`p-2 rounded-lg border-2 transition-all text-sm ${
                          formData.callAvailabilityDays.includes(day.value)
                            ? 'border-primary bg-primary/10 text-foreground'
                            : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Select the days when the agent is available to receive calls</p>
                </div>
              </div>

              {/* Phone Number Selection */}
              <Separator />
              <div className="flex items-center gap-2">
                <Phone className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">Phone Number</h3>
              </div>

              {loadingNumbers ? (
                <p className="text-sm text-muted-foreground">Loading inbound numbers...</p>
              ) : inboundNumbers.length === 0 ? (
                <div className="space-y-4">
                  <Alert variant="default">
                    <AlertDescription>No inbound numbers available. Please import a number first.</AlertDescription>
                  </Alert>
                  <Button
                    type="button"
                    onClick={() => navigate('/inbound-numbers')}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    Go to Inbound Numbers
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber" className="text-foreground">Select Inbound Number *</Label>
                    <Select value={selectedNumberId} onValueChange={handleNumberSelection}>
                      <SelectTrigger className="bg-background text-foreground border-border">
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
                                  <Badge variant="warning" className="ml-2 text-xs">
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
                    <p className="text-xs text-muted-foreground">
                      <Link to="/inbound-numbers" className="text-primary hover:underline">
                        Manage inbound numbers
                      </Link>
                    </p>
                  </div>
                  {selectedNumberId && (() => {
                    const selected = getSelectedNumber();
                    if (!selected) return null;
                    return (
                      <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-2">
                        <div className="flex gap-2">
                          <Badge variant="default">{selected.provider}</Badge>
                          {selected.provider === 'twilio' && selected.sms_enabled && (
                            <Badge variant="success">SMS Enabled</Badge>
                          )}
                        </div>
                        <p className="text-sm text-foreground">
                          <strong>Number:</strong> {formatPhoneDisplay(selected.phone_number, selected.country_code)}
                        </p>
                        {selected.phone_label && (
                          <p className="text-sm text-muted-foreground">
                            <strong>Label:</strong> {selected.phone_label}
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Agent Settings */}
              <Separator />
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">Agent Settings</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="language" className="text-foreground">Language *</Label>
                  <Select value={formData.language} onValueChange={(value) => handleSelectChange('language', value)}>
                    <SelectTrigger className="bg-background text-foreground border-border">
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

                <div className="space-y-2">
                  <Label htmlFor="timezone" className="text-foreground">Timezone *</Label>
                  <Select value={formData.timezone} onValueChange={(value) => handleSelectChange('timezone', value)}>
                    <SelectTrigger className="bg-background text-foreground border-border">
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                      <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="agentType" className="text-foreground">Agent Type *</Label>
                  <Select value={formData.agentType} onValueChange={(value) => handleSelectChange('agentType', value)}>
                    <SelectTrigger className="bg-background text-foreground border-border">
                      <SelectValue placeholder="Select agent type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sales">Sales Agent</SelectItem>
                      <SelectItem value="support">Support Agent</SelectItem>
                      <SelectItem value="booking">Booking Agent</SelectItem>
                      <SelectItem value="general">General Assistant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tool" className="text-foreground">Tool *</Label>
                  <Select value={formData.tool} onValueChange={(value) => handleSelectChange('tool', value)}>
                    <SelectTrigger className="bg-background text-foreground border-border">
                      <SelectValue placeholder="Select tool" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="calendar">Calendar Integration</SelectItem>
                      <SelectItem value="crm">CRM Integration</SelectItem>
                      <SelectItem value="email">Email Integration</SelectItem>
                      <SelectItem value="sms">SMS Integration</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Model Temperature */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="temperature" className="text-foreground">Model Temperature *</Label>
                  <span className="text-sm font-semibold text-primary bg-primary/10 px-3 py-1 rounded-md">
                    {formData.temperature.toFixed(2)}
                  </span>
                </div>
                <div className="px-2">
                  <Slider
                    value={[formData.temperature]}
                    onValueChange={handleTemperatureChange}
                    min={0}
                    max={1}
                    step={0.01}
                    className="w-full"
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0.0 (Deterministic)</span>
                  <span>0.5 (Balanced)</span>
                  <span>1.0 (Creative)</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Controls the randomness of the model's responses. Lower values make responses more focused and deterministic, while higher values make them more creative and varied.
                </p>
              </div>

              {/* Confidence Control */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="confidence" className="text-foreground">Confidence Level *</Label>
                  <span className="text-sm font-semibold text-primary bg-primary/10 px-3 py-1 rounded-md">
                    {formData.confidence.toFixed(2)}
                  </span>
                </div>
                <div className="px-2">
                  <Slider
                    value={[formData.confidence]}
                    onValueChange={handleConfidenceChange}
                    min={0}
                    max={1}
                    step={0.01}
                    className="w-full"
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0.0 (Low)</span>
                  <span>0.5 (Medium)</span>
                  <span>1.0 (High)</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Controls how confident the agent should be before responding. Higher values make the agent more decisive.
                </p>
              </div>

              {/* Verbosity Control */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="verbosity" className="text-foreground">Verbosity Level *</Label>
                  <span className="text-sm font-semibold text-primary bg-primary/10 px-3 py-1 rounded-md">
                    {formData.verbosity.toFixed(2)}
                  </span>
                </div>
                <div className="px-2">
                  <Slider
                    value={[formData.verbosity]}
                    onValueChange={handleVerbosityChange}
                    min={0}
                    max={1}
                    step={0.01}
                    className="w-full"
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0.0 (Concise)</span>
                  <span>0.5 (Balanced)</span>
                  <span>1.0 (Detailed)</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Controls response length. Lower values make responses brief, higher values provide more detail.
                </p>
              </div>

              {/* Fallback Number Configuration */}
              <Separator />
              <div className="flex items-center gap-2">
                <Phone className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">Fallback Configuration</h3>
              </div>

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="fallbackEnabled"
                    checked={formData.fallbackEnabled}
                    onChange={(e) => setFormData(prev => ({ ...prev, fallbackEnabled: e.target.checked }))}
                    className="rounded"
                  />
                  <Label htmlFor="fallbackEnabled" className="text-foreground">
                    Enable Fallback Number
                  </Label>
                </div>
                
                {formData.fallbackEnabled && (
                  <div className="space-y-2">
                    <Label htmlFor="fallbackNumber" className="text-foreground">Fallback Phone Number</Label>
                    <Input
                      id="fallbackNumber"
                      name="fallbackNumber"
                      value={formData.fallbackNumber}
                      onChange={handleInputChange}
                      placeholder="+1234567890"
                      className="bg-background text-foreground border-border"
                    />
                    <p className="text-xs text-muted-foreground">
                      Number to call if the agent fails or after retries are exhausted
                    </p>
                  </div>
                )}
              </div>

              {/* Knowledge Base Selection */}
              <Separator />
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">Knowledge Base</h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="knowledgeBase" className="text-foreground">Assign Knowledge Base (Optional)</Label>
                <Select 
                  value={formData.knowledgeBaseId || 'none'} 
                  onValueChange={(value) => handleSelectChange('knowledgeBaseId', value === 'none' ? '' : value)}
                >
                  <SelectTrigger className="bg-background text-foreground border-border">
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
                <p className="text-xs text-muted-foreground">
                  Select a knowledge base to provide FAQs and documents to this agent.{' '}
                  <Link to="/knowledge-bases" className="text-primary hover:underline">
                    Manage knowledge bases
                  </Link>
                </p>
              </div>

              {/* Credit Usage Info */}
              {!isEditMode && (
                <div className="pt-4 border-t border-border">
                  <Alert className="bg-primary/10 border-primary/30">
                    <AlertDescription className="flex items-center gap-2">
                      <Coins className="w-4 h-4 text-primary" />
                      <span className="text-sm">
                        <span className="font-semibold">Credit Cost:</span> Creating this agent will use{' '}
                        <span className="font-bold text-primary">{CREDIT_RATES.AGENT_CREATION} credits</span>.
                      </span>
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-6 border-t border-border">
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={resetForm}
                  size="lg"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={loading}
                  size="lg"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                      {isEditMode ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      {isEditMode ? 'Update Agent' : 'Create Agent'}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        )}

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
                If you proceed, the number will be removed from <strong>{previousAgent?.name || 'the previous agent'}</strong> and that agent will be disabled. 
                The number will then be assigned to {isEditMode ? 'this agent' : 'the new agent'}.
              </p>
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
      </div>
    </>
  );
};

export default CreateVoiceAgent;
