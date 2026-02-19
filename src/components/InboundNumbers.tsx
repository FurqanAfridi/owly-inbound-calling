import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Phone, RefreshCw, Play, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useDialog } from '../contexts/DialogContext';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';

interface InboundNumber {
  id: string;
  phone_number: string;
  country_code: string;
  phone_label: string | null;
  call_forwarding_number: string | null;
  provider: string;
  status: 'active' | 'activating' | 'suspended' | 'error' | 'pending' | 'inactive';
  health_status: 'healthy' | 'unhealthy' | 'unknown' | 'testing' | null;
  webhook_status: 'active' | 'inactive' | 'error' | 'unknown' | null;
  assigned_to_agent_id: string | null;
  is_in_use: boolean;
  created_at: string;
  updated_at: string;
  twilio_sid?: string | null;
  vonage_api_key?: string | null;
  callhippo_api_key?: string | null;
}

const InboundNumbers: React.FC = () => {
  const { user } = useAuth();
  const { setAddInboundNumberDialog } = useDialog();
  const [numbers, setNumbers] = useState<InboundNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; number: InboundNumber | null }>({
    open: false,
    number: null,
  });
  const [testingNumber, setTestingNumber] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    fetchNumbers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Listen for refresh event from MainLayout when dialog closes successfully
  useEffect(() => {
    const handleRefresh = () => {
      fetchNumbers();
    };
    window.addEventListener('inboundNumbersRefresh', handleRefresh);
    return () => {
      window.removeEventListener('inboundNumbersRefresh', handleRefresh);
    };
  }, []);

  const fetchNumbers = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('inbound_numbers')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setNumbers(data || []);
    } catch (err: any) {
      console.error('Error fetching inbound numbers:', err);
      setError(err.message || 'Failed to load inbound numbers');
    } finally {
      setLoading(false);
    }
  };

  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDelete = async () => {
    if (!deleteDialog.number || !user) return;

    setDeleteLoading(true);
    setError(null);

    const numberToDelete = deleteDialog.number;

    try {
      // 1. Fetch full number data for webhook payload
      const { data: fullNumberData, error: fetchError } = await supabase
        .from('inbound_numbers')
        .select('*')
        .eq('id', numberToDelete.id)
        .single();

      if (fetchError) {
        console.error('Error fetching number data for webhook:', fetchError);
      }

      // 2. Call delete webhook if configured
      const deleteWebhookUrl = process.env.REACT_APP_DELETE_NUMBER_WEBHOOK_URL;
      if (deleteWebhookUrl && fullNumberData) {
        try {
          const deletePayload = {
            id: fullNumberData.id,
            user_id: user.id,
            phone_number: fullNumberData.phone_number,
            country_code: fullNumberData.country_code,
            provider: fullNumberData.provider,
            phone_label: fullNumberData.phone_label,
            assigned_to_agent_id: fullNumberData.assigned_to_agent_id,
            ...fullNumberData,
          };

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);

          const deleteResponse = await fetch(deleteWebhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify(deletePayload),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!deleteResponse.ok) {
            const errorText = await deleteResponse.text().catch(() => 'No error details available');
            console.error(`Delete number webhook failed: ${deleteResponse.status} - ${errorText}`);
            // Continue with deletion even if webhook fails
          } else {
            try {
              const responseData = await deleteResponse.json();
              console.log('Delete number webhook success:', responseData);
            } catch {
              console.log('Delete number webhook returned non-JSON response');
            }
          }
        } catch (webhookError: any) {
          if (webhookError.name === 'AbortError') {
            console.error('Delete number webhook timed out');
          } else {
            console.error('Error calling delete number webhook:', webhookError);
          }
          // Continue with deletion even if webhook fails
        }
      }

      // 3. If this number is assigned to an agent, deactivate that agent
      if (numberToDelete.assigned_to_agent_id) {
        const { error: agentUpdateError } = await supabase
          .from('voice_agents')
          .update({
            status: 'inactive',
            phone_number: null,
            phone_label: null,
            phone_provider: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', numberToDelete.assigned_to_agent_id)
          .eq('user_id', user.id);

        if (agentUpdateError) {
          console.error('Error deactivating agent:', agentUpdateError);
        } else {
          console.log(`Agent ${numberToDelete.assigned_to_agent_id} deactivated due to number deletion`);
        }
      }

      // 4. Permanently delete the number from the database
      const { error: deleteError } = await supabase
        .from('inbound_numbers')
        .delete()
        .eq('id', numberToDelete.id);

      if (deleteError) throw deleteError;

      setDeleteDialog({ open: false, number: null });
      fetchNumbers();
    } catch (err: any) {
      console.error('Error deleting number:', err);
      setError(err.message || 'Failed to delete number');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleTestWebhook = async (number: InboundNumber) => {
    setTestingNumber(number.id);
    try {
      const testResponse = await fetch(`${process.env.REACT_APP_PHONE_NUMBER_WEBHOOK_URL}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: number.phone_number,
          provider: number.provider,
        }),
      });

      if (testResponse.ok) {
        const result = await testResponse.json();
        
        await supabase
          .from('inbound_numbers')
          .update({
            webhook_status: result.status || 'active',
            last_webhook_test: new Date().toISOString(),
            webhook_test_result: result,
          })
          .eq('id', number.id);

        fetchNumbers();
      } else {
        throw new Error('Webhook test failed');
      }
    } catch (err: any) {
      console.error('Error testing webhook:', err);
      setError('Failed to test webhook: ' + err.message);
    } finally {
      setTestingNumber(null);
    }
  };

  const handleHealthCheck = async (number: InboundNumber) => {
    try {
      await supabase
        .from('inbound_numbers')
        .update({
          health_status: 'testing',
          last_health_check: new Date().toISOString(),
        })
        .eq('id', number.id);

      const healthResponse = await fetch(`${process.env.REACT_APP_PHONE_NUMBER_WEBHOOK_URL}/health`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: number.phone_number,
          provider: number.provider,
        }),
      });

      const healthStatus = healthResponse.ok ? 'healthy' : 'unhealthy';
      const errorText = healthResponse.ok ? null : await healthResponse.text().catch(() => 'Unknown error');

      await supabase
        .from('inbound_numbers')
        .update({
          health_status: healthStatus,
          last_health_check: new Date().toISOString(),
          health_check_error: errorText,
        })
        .eq('id', number.id);

      fetchNumbers();
    } catch (err: any) {
      console.error('Error checking health:', err);
      await supabase
        .from('inbound_numbers')
        .update({
          health_status: 'unhealthy',
          last_health_check: new Date().toISOString(),
          health_check_error: err.message,
        })
        .eq('id', number.id);
      fetchNumbers();
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: { [key: string]: { variant: 'default' | 'success' | 'warning' | 'destructive'; label: string; className?: string } } = {
      active: { variant: 'success', label: 'Active' },
      activating: { variant: 'default', label: 'Activating...', className: 'bg-[#ecfdf5] border border-[#00c19c] text-[#008068] animate-pulse' },
      suspended: { variant: 'warning', label: 'Suspended' },
      error: { variant: 'destructive', label: 'Error' },
      pending: { variant: 'default', label: 'Pending' },
      inactive: { variant: 'default', label: 'Inactive' },
    };

    const config = statusConfig[status] || { variant: 'default' as const, label: status };
    return <Badge variant={config.variant} className={config.className}>{config.label}</Badge>;
  };

  const getHealthIcon = (healthStatus: string | null) => {
    switch (healthStatus) {
      case 'healthy':
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'unhealthy':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'testing':
        return <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-warning" />;
    }
  };

  const getWebhookBadge = (webhookStatus: string | null) => {
    if (webhookStatus === 'active') {
      return <Badge variant="success">Active</Badge>;
    } else if (webhookStatus === 'error') {
      return <Badge variant="destructive">Error</Badge>;
    } else {
      return <Badge variant="default">{webhookStatus || 'Unknown'}</Badge>;
    }
  };

  const formatPhoneNumber = (phoneNumber: string, countryCode: string | null) => {
    if (!phoneNumber) return '-';
    
    // Remove any existing country code prefix from phone_number
    let cleanedNumber = phoneNumber.trim();
    
    // If country code exists and phone number starts with it, remove it
    if (countryCode) {
      const codePrefix = countryCode.startsWith('+') ? countryCode : `+${countryCode}`;
      if (cleanedNumber.startsWith(codePrefix)) {
        cleanedNumber = cleanedNumber.substring(codePrefix.length).trim();
      }
      // If phone number already starts with +, use it as is, otherwise add country code
      if (cleanedNumber.startsWith('+')) {
        return cleanedNumber;
      }
      return `${codePrefix} ${cleanedNumber}`;
    }
    
    // If no country code, return phone number as is (might already have +)
    return cleanedNumber.startsWith('+') ? cleanedNumber : `+${cleanedNumber}`;
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
        <div className="flex justify-end">
          <Button
            onClick={() => {
              setAddInboundNumberDialog(true, null);
            }}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-[16px] font-medium"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Number
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" onClose={() => setError(null)}>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {numbers.length === 0 ? (
          <Card className="dark:bg-[#1d212b] dark:border-[#2f3541] rounded-[14px]">
            <CardContent className="py-12">
              <div className="flex flex-col items-center gap-4 text-center" style={{ fontFamily: "'Manrope', sans-serif" }}>
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
                  <Phone className="w-10 h-10 text-primary" />
                </div>
                <div>
                  <h3 className="text-[24px] font-bold dark:text-[#f9fafb] text-[#27272b] mb-2" style={{ fontFamily: "'Manrope', sans-serif" }}>No Inbound Numbers</h3>
                  <p className="text-[16px] dark:text-[#818898] text-[#737373] mb-4" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    Import your first inbound number to get started
                  </p>
                </div>
                <Button
                  onClick={() => {
                    setAddInboundNumberDialog(true, null);
                  }}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground text-[16px] font-medium"
                  size="lg"
                  style={{ fontFamily: "'Manrope', sans-serif" }}
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Add Your First Number
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="dark:bg-[#1d212b] dark:border-[#2f3541] rounded-[14px]">
            <CardHeader className="px-5 pt-5 pb-0">
              <CardTitle className="text-[18px] font-semibold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>Inbound Numbers ({numbers.length})</CardTitle>
            </CardHeader>
            <CardContent className="px-5 py-5">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[16px] font-semibold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>Phone Number</TableHead>
                      <TableHead className="text-[16px] font-semibold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>Label</TableHead>
                      <TableHead className="text-[16px] font-semibold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>Provider</TableHead>
                      <TableHead className="text-[16px] font-semibold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>Call Forwarding</TableHead>
                      <TableHead className="text-[16px] font-semibold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>Status</TableHead>
                      <TableHead className="text-[16px] font-semibold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>Health</TableHead>
                      <TableHead className="text-[16px] font-semibold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>In Use</TableHead>
                      <TableHead className="text-right text-[16px] font-semibold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {numbers.map((number) => (
                      <TableRow key={number.id}>
                        <TableCell className="text-[16px] font-medium dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                          {formatPhoneNumber(number.phone_number, number.country_code)}
                        </TableCell>
                        <TableCell className="text-[16px] dark:text-[#818898] text-[#737373]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                          {number.phone_label || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[14px]" style={{ fontFamily: "'Manrope', sans-serif" }}>{number.provider}</Badge>
                        </TableCell>
                        <TableCell className="text-[16px] dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                          {number.call_forwarding_number ? (
                            <span>{formatPhoneNumber(number.call_forwarding_number, number.country_code)}</span>
                          ) : (
                            <span className="dark:text-[#818898] text-[#737373]">-</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(number.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getHealthIcon(number.health_status)}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleHealthCheck(number)}
                              disabled={testingNumber === number.id}
                            >
                              <RefreshCw className={`w-4 h-4 ${testingNumber === number.id ? 'animate-spin' : ''}`} />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={number.is_in_use ? 'success' : 'default'} className="text-[14px]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                            {number.is_in_use ? 'Yes' : 'No'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setAddInboundNumberDialog(true, number);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteDialog({ open: true, number })}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
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

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialog.open} onOpenChange={(open) => !deleteLoading && !open && setDeleteDialog({ open: false, number: null })}>
          <DialogContent className="bg-card text-foreground border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">Delete Inbound Number</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Are you sure you want to delete{' '}
                <strong className="text-foreground">
                  {deleteDialog.number ? formatPhoneNumber(deleteDialog.number.phone_number, deleteDialog.number.country_code) : ''}
                </strong>
                ? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            {deleteDialog.number?.assigned_to_agent_id && (
              <Alert variant="destructive" className="mt-2">
                <AlertDescription>
                  This number is currently assigned to an agent. Deleting it will <strong>deactivate the agent</strong>. 
                  The agent cannot be reactivated until you edit it and assign a different number.
                </AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteDialog({ open: false, number: null })}
                disabled={deleteLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDelete}
                variant="destructive"
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                disabled={deleteLoading}
              >
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default InboundNumbers;
