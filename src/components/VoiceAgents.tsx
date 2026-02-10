import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, Phone, Users, Play, Pause } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';

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
    } catch (err: any) {
      console.error('Error deleting agent:', err);
      alert('Failed to delete agent. Please try again.');
    }
  };

  const handleToggleStatus = async (agentId: string, currentStatus: string, agentName: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const action = newStatus === 'active' ? 'enable' : 'disable';
    
    if (!window.confirm(`Are you sure you want to ${action} "${agentName}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('voice_agents')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', agentId)
        .eq('user_id', user?.id);

      if (error) {
        throw error;
      }
      
      loadAgents(); // Refresh list
    } catch (err: any) {
      console.error('Error updating agent status:', err);
      alert(`Failed to ${action} agent. Please try again.`);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: { [key: string]: { variant: 'default' | 'success' | 'warning' | 'destructive'; label: string } } = {
      active: { variant: 'success', label: 'Active' },
      inactive: { variant: 'default', label: 'Inactive' },
      archived: { variant: 'warning', label: 'Archived' },
      testing: { variant: 'default', label: 'Testing' },
    };

    const config = statusConfig[status] || { variant: 'default' as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6" style={{ fontFamily: "'Manrope', sans-serif" }}>
        {/* Action Button */}
        <div className="flex justify-end">
          <Button
            onClick={() => navigate('/create-agent')}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-[16px] font-medium"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Agent
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" onClose={() => setError(null)}>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {agents.length === 0 ? (
          <Card className="rounded-[14px]">
            <CardContent className="py-12">
              <div className="flex flex-col items-center gap-4 text-center" style={{ fontFamily: "'Manrope', sans-serif" }}>
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
                  <Phone className="w-10 h-10 text-primary" />
                </div>
                <div>
                  <h3 className="text-[24px] font-bold text-[#27272b] mb-2" style={{ fontFamily: "'Manrope', sans-serif" }}>No Voice Agents</h3>
                  <p className="text-[16px] text-[#737373] max-w-md" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    You haven't created any Owly voice agents yet. Create your first agent to get started.
                  </p>
                </div>
                <Button
                  onClick={() => navigate('/create-agent')}
                  className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground text-[16px] font-medium"
                  size="lg"
                  style={{ fontFamily: "'Manrope', sans-serif" }}
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Create Your First Agent
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-[14px]">
            <CardHeader className="px-5 pt-5 pb-0">
              <CardTitle className="text-[18px] font-semibold text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>Your Agents ({agents.length})</CardTitle>
            </CardHeader>
            <CardContent className="px-5 py-5">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[16px] font-semibold text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>Name</TableHead>
                      <TableHead className="text-[16px] font-semibold text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>Company</TableHead>
                      <TableHead className="text-[16px] font-semibold text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>Phone Number</TableHead>
                      <TableHead className="text-[16px] font-semibold text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>Provider</TableHead>
                      <TableHead className="text-[16px] font-semibold text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>Type</TableHead>
                      <TableHead className="text-[16px] font-semibold text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>Status</TableHead>
                      <TableHead className="text-[16px] font-semibold text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>Created</TableHead>
                      <TableHead className="text-right text-[16px] font-semibold text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agents.map((agent) => (
                      <TableRow key={agent.id}>
                        <TableCell className="text-[16px] font-medium text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                          <button
                            onClick={() => navigate(`/edit-agent/${agent.id}`)}
                            className="hover:text-primary hover:underline cursor-pointer text-left"
                          >
                            {agent.name}
                          </button>
                        </TableCell>
                        <TableCell className="text-[16px] text-[#737373]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                          {agent.company_name || '-'}
                        </TableCell>
                        <TableCell>
                          <div style={{ fontFamily: "'Manrope', sans-serif" }}>
                            <p className="text-[16px] text-[#27272b]">{agent.phone_number}</p>
                            {agent.phone_label && (
                              <p className="text-[14px] text-[#737373]">{agent.phone_label}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[14px]" style={{ fontFamily: "'Manrope', sans-serif" }}>{agent.phone_provider || 'N/A'}</Badge>
                        </TableCell>
                        <TableCell>
                          <div style={{ fontFamily: "'Manrope', sans-serif" }}>
                            <p className="text-[16px] text-[#737373]">{agent.agent_type || '-'}</p>
                            {agent.tool && (
                              <p className="text-[14px] text-[#737373]">{agent.tool}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(agent.status)}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleStatus(agent.id, agent.status, agent.name)}
                              title={agent.status === 'active' ? 'Disable Agent' : 'Enable Agent'}
                              className="h-7 w-7 p-0"
                            >
                              {agent.status === 'active' ? (
                                <Pause className="w-4 h-4" />
                              ) : (
                                <Play className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-[16px] text-[#737373]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                          {formatDate(agent.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/edit-agent/${agent.id}`)}
                              title="View/Edit Agent"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(agent.id, agent.name)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              title="Delete Agent"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
};

export default VoiceAgents;
