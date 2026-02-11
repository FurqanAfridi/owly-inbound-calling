import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Phone, MoreVertical, Eye, Pencil, Trash2, GraduationCap, Power, PowerOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface VoiceAgent {
  id: string;
  name: string;
  company_name: string | null;
  phone_number: string;
  phone_provider: string | null;
  phone_label: string | null;
  status: string;
  agent_type: string | null;
  tool: string | null;
  created_at: string;
  updated_at: string;
}

interface InboundNumber {
  id: string;
  phone_number: string;
  phone_label: string | null;
}

const VoiceAgents: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [agents, setAgents] = useState<VoiceAgent[]>([]);
  const [inboundNumbers, setInboundNumbers] = useState<InboundNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadAgents();
    loadInboundNumbers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadAgents = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('voice_agents')
        .select('id, name, company_name, phone_number, phone_provider, phone_label, status, agent_type, tool, created_at, updated_at')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setAgents(data || []);
    } catch (err: any) {
      console.error('Error loading agents:', err);
      setError(err.message || 'Failed to load agents');
      setAgents([]);
    } finally {
      setLoading(false);
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

      if (error) {
        console.error('Error loading inbound numbers:', error);
        setInboundNumbers([]);
      } else {
        setInboundNumbers(data || []);
      }
    } catch (error) {
      console.error('Error loading inbound numbers:', error);
      setInboundNumbers([]);
    }
  };


  const handleDelete = async (agentId: string, agentName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${agentName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error: deleteError } = await supabase
        .from('voice_agents')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', agentId)
        .eq('user_id', user?.id);

      if (deleteError) {
        throw deleteError;
      }

      loadAgents();
      setOpenMenuId(null);
    } catch (err: any) {
      console.error('Error deleting agent:', err);
      alert('Failed to delete agent. Please try again.');
    }
  };

  const handleView = (agentId: string) => {
    navigate(`/edit-agent/${agentId}`);
    setOpenMenuId(null);
  };

  const handleEdit = (agentId: string) => {
    navigate(`/edit-agent/${agentId}`);
    setOpenMenuId(null);
  };

  const handleToggleStatus = async (agent: VoiceAgent) => {
    const newStatus = agent.status === 'active' ? 'inactive' : 'active';
    const webhookUrl = newStatus === 'active' 
      ? process.env.REACT_APP_BIND_WEBHOOK_URL 
      : process.env.REACT_APP_UN_BIND_WEBHOOK_URL;

    if (!webhookUrl) {
      alert(`Webhook URL is not configured for ${newStatus === 'active' ? 'binding' : 'unbinding'}`);
      return;
    }

    if (!window.confirm(`Are you sure you want to ${newStatus === 'active' ? 'enable' : 'disable'} "${agent.name}"?`)) {
      return;
    }

    try {
      // Get complete agent data
      const { data: fullAgent, error: fetchError } = await supabase
        .from('voice_agents')
        .select('*')
        .eq('id', agent.id)
        .eq('user_id', user?.id)
        .single();

      if (fetchError || !fullAgent) {
        throw new Error('Failed to fetch agent details');
      }

      // Prepare webhook payload with all agent details
      const webhookPayload = {
        agent_id: fullAgent.id,
        owner_user_id: user?.id,
        ...fullAgent,
        status: newStatus,
      };

      // Call webhook
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const webhookResponse = await fetch(webhookUrl, {
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

      // Update agent status in database
      const { error: updateError } = await supabase
        .from('voice_agents')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', agent.id)
        .eq('user_id', user?.id);

      if (updateError) {
        throw updateError;
      }

      // Reload agents
      loadAgents();
      setOpenMenuId(null);
    } catch (err: any) {
      console.error('Error toggling agent status:', err);
      alert(`Failed to ${newStatus === 'active' ? 'enable' : 'disable'} agent: ${err.message || 'Unknown error'}`);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Calculate agent usage (assuming max 30 agents for now)
  const maxAgents = 30;
  const agentsUsed = agents.length;

  return (
    <div className="space-y-[25px]" style={{ fontFamily: "'Manrope', sans-serif" }}>
      {/* Header Section */}
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-[4px]">
          <h1 className="text-[24px] font-bold text-[#27272b] leading-[32px] tracking-[-0.6px]" style={{ fontFamily: "'Manrope', sans-serif" }}>
            Agents
          </h1>
          <p className="text-[16px] font-normal text-[#737373] leading-[24px] max-w-[361px]" style={{ fontFamily: "'Manrope', sans-serif" }}>
            Manage calling agents, update their details, and control availability.
          </p>
        </div>
        <div className="flex gap-[12px] items-center justify-end">
          <Button
            onClick={() => navigate('/create-agent')}
            className="bg-[#0b99ff] hover:bg-[#0b99ff]/90 text-white text-[14px] font-medium h-[36px] px-4 rounded-[8px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Agent
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" onClose={() => setError(null)}>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Agents List Card */}
      <Card className="bg-[#f8f8f8] border border-[#f0f0f0] rounded-[14px]">
        <CardContent className="p-5">
          {/* Agents Header */}
          <div className="flex items-start justify-between mb-[10px]">
            <div className="flex gap-[6px] items-center">
              <GraduationCap className="w-4 h-4 text-[#141414]" />
              <p className="text-[14px] font-medium text-[#141414] leading-[1.5]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                Agents
              </p>
            </div>
            <p className="text-[14px] font-medium text-[#141414] leading-[1.5]" style={{ fontFamily: "'Manrope', sans-serif" }}>
              {agentsUsed}/{maxAgents} agents used
            </p>
          </div>

          {/* Agents List */}
          {agents.length === 0 ? (
            <div className="flex flex-col items-center gap-4 text-center py-12">
              <div className="w-20 h-20 rounded-full bg-[#0b99ff]/20 flex items-center justify-center">
                <Phone className="w-10 h-10 text-[#0b99ff]" />
              </div>
              <div>
                <h3 className="text-[24px] font-bold text-[#27272b] mb-2" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  No Voice Agents
                </h3>
                <p className="text-[16px] text-[#737373] max-w-md" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  You haven't created any voice agents yet. Create your first agent to get started.
                </p>
              </div>
              <Button
                onClick={() => navigate('/create-agent')}
                className="mt-4 bg-[#0b99ff] hover:bg-[#0b99ff]/90 text-white text-[14px] font-medium"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                <Plus className="w-5 h-5 mr-2" />
                Create Your First Agent
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-[10px]">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="bg-white flex items-center justify-between p-[10px] rounded-[8px]"
                >
                  <div className="flex flex-col leading-[1.5] pb-px">
                    <p className="text-[14px] font-medium text-[#141414]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      {agent.name}
                    </p>
                    <p className="text-[12px] font-normal text-[#0b99ff]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      {agent.company_name || 'No company'}
                    </p>
                  </div>
                  <div className="flex items-center justify-end">
                    <DropdownMenu 
                      open={openMenuId === agent.id} 
                      onOpenChange={(open) => setOpenMenuId(open ? agent.id : null)}
                    >
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[140px] p-1">
                        <DropdownMenuItem 
                          onClick={() => handleView(agent.id)} 
                          className="gap-2 text-[14px] px-2 py-1.5"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleEdit(agent.id)} 
                          className="gap-2 text-[14px] px-2 py-1.5"
                        >
                          <Pencil className="w-4 h-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleToggleStatus(agent)} 
                          className={`gap-2 text-[14px] px-2 py-1.5 ${
                            agent.status === 'active' ? 'text-[#e7000b]' : 'text-[#016630]'
                          }`}
                        >
                          {agent.status === 'active' ? (
                            <>
                              <PowerOff className="w-4 h-4" />
                              Disable
                            </>
                          ) : (
                            <>
                              <Power className="w-4 h-4" />
                              Enable
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDelete(agent.id, agent.name)} 
                          className="gap-2 text-[14px] text-[#e7000b] px-2 py-1.5"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VoiceAgents;
