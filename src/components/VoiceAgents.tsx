import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, Phone, Users, Play, Pause } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import CallStatusSummary from './dashboard/CallStatusSummary';
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
  const [selectedAgentId, setSelectedAgentId] = useState<string>('all');
  const [selectedNumberId, setSelectedNumberId] = useState<string>('all');
  const [callStatusStats, setCallStatusStats] = useState({
    totalCalls: 0,
    completed: 0,
    failed: 0,
    inProgress: 0,
  });

  useEffect(() => {
    if (!user) return;
    loadAgents();
    loadInboundNumbers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (user) {
      loadCallStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents, selectedAgentId, selectedNumberId]);

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

  const loadCallStats = async () => {
    if (!user) return;

    try {
      // If no agents exist, set stats to zero
      if (agents.length === 0) {
        setCallStatusStats({ totalCalls: 0, completed: 0, failed: 0, inProgress: 0 });
        return;
      }

      // Build query to fetch from call_history table
      let query = supabase
        .from('call_history')
        .select('call_status, call_end_time, agent_id, called_number')
        .eq('user_id', user.id)
        .is('deleted_at', null);

      // Apply agent filter
      if (selectedAgentId !== 'all') {
        query = query.eq('agent_id', selectedAgentId);
      } else {
        // If "all" is selected, filter by all user's agents
        const agentIds = agents.map(agent => agent.id);
        if (agentIds.length > 0) {
          query = query.in('agent_id', agentIds);
        }
      }

      // Apply number filter
      if (selectedNumberId !== 'all') {
        const selectedNumber = inboundNumbers.find(n => n.id === selectedNumberId);
        if (selectedNumber) {
          query = query.eq('called_number', selectedNumber.phone_number);
        }
      }

      const { data: callsData, error: callsError } = await query;

      if (callsError) {
        console.error('Error fetching call stats:', callsError);
        setCallStatusStats({ totalCalls: 0, completed: 0, failed: 0, inProgress: 0 });
        return;
      }

      const allCalls = callsData || [];
      const totalCalls = allCalls.length;
      const completed = allCalls.filter(
        (c: any) => c.call_status === 'answered'
      ).length;
      const failed = allCalls.filter(
        (c: any) => c.call_status === 'failed' || c.call_status === 'busy' || c.call_status === 'no-answer' || c.call_status === 'canceled'
      ).length;
      const inProgress = allCalls.filter(
        (c: any) => c.call_status === 'answered' && !c.call_end_time
      ).length;

      setCallStatusStats({
        totalCalls,
        completed,
        failed,
        inProgress,
      });
    } catch (err: any) {
      console.error('Error loading call stats:', err);
      setCallStatusStats({ totalCalls: 0, completed: 0, failed: 0, inProgress: 0 });
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
      <div className="space-y-6">
        {/* Action Button */}
        <div className="flex justify-end">
          <Button
            onClick={() => navigate('/create-agent')}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
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

        {/* Call Status Summary */}
        {agents.length > 0 && (
          <CallStatusSummary
            totalCalls={callStatusStats.totalCalls}
            completed={callStatusStats.completed}
            failed={callStatusStats.failed}
            inProgress={callStatusStats.inProgress}
            voiceAgents={agents.map(agent => ({ id: agent.id, name: agent.name, phone_number: agent.phone_number, status: agent.status }))}
            inboundNumbers={inboundNumbers}
            selectedAgentId={selectedAgentId}
            selectedNumberId={selectedNumberId}
            onAgentChange={setSelectedAgentId}
            onNumberChange={setSelectedNumberId}
          />
        )}

        {agents.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
                  <Phone className="w-10 h-10 text-primary" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-foreground mb-2">No Voice Agents</h3>
                  <p className="text-muted-foreground max-w-md">
                    You haven't created any DNAI voice agents yet. Create your first agent to get started.
                  </p>
                </div>
                <Button
                  onClick={() => navigate('/create-agent')}
                  className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground"
                  size="lg"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Create Your First Agent
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">Your Agents ({agents.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-foreground">Name</TableHead>
                      <TableHead className="text-foreground">Company</TableHead>
                      <TableHead className="text-foreground">Phone Number</TableHead>
                      <TableHead className="text-foreground">Provider</TableHead>
                      <TableHead className="text-foreground">Type</TableHead>
                      <TableHead className="text-foreground">Status</TableHead>
                      <TableHead className="text-foreground">Created</TableHead>
                      <TableHead className="text-right text-foreground">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agents.map((agent) => (
                      <TableRow key={agent.id}>
                        <TableCell className="font-semibold text-foreground">
                          {agent.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {agent.company_name || '-'}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-foreground">{agent.phone_number}</p>
                            {agent.phone_label && (
                              <p className="text-xs text-muted-foreground">{agent.phone_label}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{agent.phone_provider || 'N/A'}</Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-muted-foreground">{agent.agent_type || '-'}</p>
                            {agent.tool && (
                              <p className="text-xs text-muted-foreground">{agent.tool}</p>
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
                        <TableCell className="text-muted-foreground">
                          {formatDate(agent.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/edit-agent/${agent.id}`)}
                              title="Edit Agent"
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
