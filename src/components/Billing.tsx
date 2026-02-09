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
  Alert,
  CircularProgress,
  Stack,
  Paper,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Switch,
  FormControlLabel,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  useTheme,
} from '@mui/material';
import {
  AccountBalance as BillingIcon,
  CreditCard as CreditCardIcon,
  Receipt as InvoiceIcon,
  ShoppingCart as PurchaseIcon,
  Download as DownloadIcon,
  Add as AddIcon,
  Settings as SettingsIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { createCheckoutSession, redirectToCheckout, processPaymentSuccess } from '../services/paymentService';
import { createPaidSubscription, activateSubscription } from '../services/subscriptionService';
import { useSearchParams } from 'react-router-dom';
import { CREDIT_RATES } from '../services/creditService';
import { fetchPackages, fetchPackageById, renderFeatureTemplate, PackageWithDetails } from '../services/packageService';
import { validateCoupon, recordCouponUsage, CouponValidationResult } from '../services/couponService';

interface UserCredits {
  balance: number;
  total_purchased: number;
  total_used: number;
  low_credit_threshold: number;
  low_credit_notified: boolean;
  auto_topup_enabled: boolean;
  auto_topup_amount: number | null;
  auto_topup_threshold: number | null;
  services_paused: boolean;
}

interface UserSubscription {
  id: string;
  package_id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  auto_renew: boolean;
  billing_cycle?: 'monthly' | 'yearly';
  package?: PackageWithDetails; // From packages table (user_subscriptions.package_id references packages.id)
}

interface CreditTransaction {
  id: string;
  transaction_type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string;
  created_at: string;
  agent_id?: string;
  call_id?: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  total_amount: number;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount: number;
  discount_code: string | null;
  status: string;
  pdf_url: string | null;
  package_id: string | null;
  purchase_id: string | null;
  subscription_id: string | null;
  billing_address: any;
  items: any[];
  notes: string | null;
}

const Billing: React.FC = () => {
  const { user } = useAuth();
  const theme = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [credits, setCredits] = useState<UserCredits | null>(null);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [packages, setPackages] = useState<any[]>([]); // Legacy subscription_packages (kept for backward compatibility)
  const [newPackages, setNewPackages] = useState<PackageWithDetails[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [currentTab, setCurrentTab] = useState(0);
  
  // Dialogs
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [showTopupDialog, setShowTopupDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showPackageDialog, setShowPackageDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedPackage, setSelectedPackage] = useState<PackageWithDetails | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [couponCode, setCouponCode] = useState('');
  const [couponValidation, setCouponValidation] = useState<CouponValidationResult | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [purchaseAmount, setPurchaseAmount] = useState(10);
  const [topupAmount, setTopupAmount] = useState(50);
  const [autoTopupEnabled, setAutoTopupEnabled] = useState(false);
  const [autoTopupAmount, setAutoTopupAmount] = useState(50);
  const [autoTopupThreshold, setAutoTopupThreshold] = useState(10);
  const [processingPayment, setProcessingPayment] = useState(false);

  useEffect(() => {
    if (user) {
      fetchBillingData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Handle payment success/cancel callback from Stripe
  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    const purchaseId = searchParams.get('purchase_id');
    const canceled = searchParams.get('canceled');
    
    if (canceled === 'true') {
      const subscriptionId = searchParams.get('subscription_id');
      if (subscriptionId) {
        // Cancel the pending subscription if payment was canceled
        supabase
          .from('user_subscriptions')
          .update({ status: 'canceled', canceled_at: new Date().toISOString() })
          .eq('id', subscriptionId);
      }
      setErrorMessage('Payment was canceled. You can try again when ready.');
      setShowErrorDialog(true);
      setSearchParams({});
      return;
    }
    
    if (sessionId && purchaseId && user) {
      const subscriptionId = searchParams.get('subscription_id');
      handlePaymentSuccess(sessionId, purchaseId, subscriptionId || undefined);
      // Clean up URL params
      setSearchParams({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, user]);

  const fetchBillingData = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch credits
      const { data: creditsData, error: creditsError } = await supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (creditsError && creditsError.code !== 'PGRST116') {
        throw creditsError;
      }

      if (!creditsData) {
        // Initialize credits for new user
        const { data: newCredits, error: insertError } = await supabase
          .from('user_credits')
          .insert({ user_id: user.id, balance: 0 })
          .select()
          .single();
        
        if (insertError) throw insertError;
        setCredits(newCredits);
      } else {
        setCredits(creditsData);
        setAutoTopupEnabled(creditsData.auto_topup_enabled);
        setAutoTopupAmount(creditsData.auto_topup_amount || 50);
        setAutoTopupThreshold(creditsData.auto_topup_threshold || 10);
      }

      // Fetch subscription - user_subscriptions.package_id references packages(id)
      const { data: subscriptionData } = await supabase
        .from('user_subscriptions')
        .select('*, package:packages(*)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (subscriptionData) {
        setSubscription(subscriptionData);
      } else {
        setSubscription(null);
      }

      // Fetch packages with features and variables from packages table
      const newPackagesData = await fetchPackages();
      setNewPackages(newPackagesData);

      // Fetch recent transactions
      const { data: transactionsData } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      setTransactions(transactionsData || []);

      // Fetch invoices with all fields
      const { data: invoicesData } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      setInvoices(invoicesData || []);

      // Check for low credits
      if (creditsData && creditsData.balance <= creditsData.low_credit_threshold && !creditsData.low_credit_notified) {
        // Show notification (you can integrate with your notification system)
        console.warn('Low credits warning');
      }
    } catch (err: any) {
      console.error('Error fetching billing data:', err);
      setError(err.message || 'Failed to load billing data');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchaseCredits = async () => {
    if (!user) return;

    setProcessingPayment(true);
    setError(null);
    setSuccess(null);

    try {
      // Validate amount
      if (purchaseAmount <= 0) {
        throw new Error('Purchase amount must be greater than 0');
      }

      // Calculate credits: $1 = 5 credits
      const creditsAmount = purchaseAmount * CREDIT_RATES.PURCHASE_RATE;
      const creditsRate = 1.0 / CREDIT_RATES.PURCHASE_RATE; // $0.20 per credit (1 credit = $0.20, so $1 = 5 credits)

      // Create purchase record
      const { data: purchase, error: purchaseError } = await supabase
        .from('purchases')
        .insert({
          user_id: user.id,
          purchase_type: 'credits',
          amount: purchaseAmount,
          credits_amount: creditsAmount, // $1 = 5 credits
          credits_rate: creditsRate,
          subtotal: purchaseAmount,
          total_amount: purchaseAmount,
          payment_status: 'pending',
        })
        .select()
        .single();

      if (purchaseError) throw purchaseError;

      // Create Stripe Checkout session
      const successUrl = `${window.location.origin}/billing?session_id={CHECKOUT_SESSION_ID}&purchase_id=${purchase.id}`;
      const cancelUrl = `${window.location.origin}/billing?canceled=true`;

      const { sessionId, url } = await createCheckoutSession({
        userId: user.id,
        amount: purchaseAmount,
        creditsAmount: purchaseAmount,
        purchaseId: purchase.id,
        successUrl,
        cancelUrl,
      });

      // Store session ID in purchase record
      await supabase
        .from('purchases')
        .update({
          payment_provider_id: sessionId,
          metadata: { checkout_session_id: sessionId },
        })
        .eq('id', purchase.id);

      // Redirect to Stripe Checkout
      await redirectToCheckout(url);
    } catch (err: any) {
      console.error('Error initiating payment:', err);
      setError(err.message || 'Failed to initiate payment. Please try again.');
      setProcessingPayment(false);
    }
  };

  const handlePaymentSuccess = async (sessionId: string, purchaseId: string, subscriptionId?: string) => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Verify payment with backend
      const result = await processPaymentSuccess(sessionId, purchaseId);

      if (result.success) {
        // Update purchase status
        await supabase
          .from('purchases')
          .update({
            payment_status: 'completed',
            completed_at: new Date().toISOString(),
            payment_provider_response: result,
          })
          .eq('id', purchaseId);

        // If this is a subscription purchase, activate the subscription
        if (subscriptionId) {
          const activationResult = await activateSubscription(subscriptionId, user!.id);
          if (!activationResult.success) {
            console.error('Failed to activate subscription:', activationResult.error);
          }
        }

        // Get purchase details
        const { data: purchase } = await supabase
          .from('purchases')
          .select('credits_amount, purchase_type, metadata')
          .eq('id', purchaseId)
          .single();

        if (purchase) {
          // Add credits if this is a credit purchase (not subscription)
          if (purchase.purchase_type === 'credits' && purchase.credits_amount > 0) {
            const { error: creditsError } = await supabase.rpc('add_credits', {
              p_user_id: user!.id,
              p_amount: purchase.credits_amount,
              p_transaction_type: 'purchase',
              p_purchase_id: purchaseId,
            });

            if (creditsError) throw creditsError;

            setSuccessMessage(`Successfully purchased ${purchase.credits_amount.toFixed(0)} credits!`);
          } else if (purchase.purchase_type === 'subscription') {
            setSuccessMessage(`Subscription activated successfully! Your package is now active.`);
          }

          // Generate invoice
          await generateInvoice(purchaseId, subscriptionId);

          setShowSuccessDialog(true);
          setShowPurchaseDialog(false);
          setPurchaseAmount(10);
          await fetchBillingData();
        }
      } else {
        throw new Error(result.error || 'Payment verification failed');
      }
    } catch (err: any) {
      console.error('Error processing payment success:', err);
      setErrorMessage(err.message || 'Failed to process payment. Please contact support.');
      setShowErrorDialog(true);
    } finally {
      setLoading(false);
    }
  };

  const generateInvoice = async (
    purchaseId?: string,
    subscriptionId?: string,
    couponCode?: string,
    discountAmount?: number
  ) => {
    if (!user) return;

    try {
      // Get user profile for billing address
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('company_name, company_address, company_registration_number, company_tax_id')
        .eq('id', user.id)
        .single();

      // Get tax configuration based on user location
      let taxRate = 0;
      
      // Try to get default tax rate or country-specific tax
      const { data: defaultTax } = await supabase
        .from('tax_configuration')
        .select('tax_rate')
        .eq('is_default', true)
        .eq('is_active', true)
        .single();
      
      if (defaultTax) {
        taxRate = defaultTax.tax_rate;
      }

      // Generate invoice number
      const { data: invoiceNumber } = await supabase.rpc('generate_invoice_number');

      // Prepare billing address from user profile
      let billingAddress = null;
      if (userProfile?.company_address) {
        // If company_address is a string, parse it; if it's already an object, use it
        try {
          billingAddress = typeof userProfile.company_address === 'string' 
            ? JSON.parse(userProfile.company_address) 
            : userProfile.company_address;
        } catch {
          // If parsing fails, create a simple address object
          billingAddress = { address: userProfile.company_address };
        }
      }

      let invoiceData: any = {
        user_id: user.id,
        invoice_number: invoiceNumber || `INV-${Date.now()}`,
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
        currency: 'USD',
        status: 'paid',
        paid_at: new Date().toISOString(),
        email_sent: false,
        discount_amount: discountAmount || 0,
        discount_code: couponCode || null,
        billing_address: billingAddress,
        tax_rate: taxRate,
      };

      // Handle purchase-based invoice
      if (purchaseId) {
        const { data: purchase } = await supabase
          .from('purchases')
          .select('*')
          .eq('id', purchaseId)
          .single();

        if (!purchase) return;

        // Use tax from purchase if available
        if (purchase.tax_rate) {
          taxRate = purchase.tax_rate;
        }

        // Create invoice items
        const invoiceItems = [
          {
            description: `Credit Purchase - ${purchase.credits_amount} credits`,
            quantity: 1,
            unit_price: purchase.amount,
            total: purchase.subtotal,
          },
        ];

        // Calculate final amounts
        const subtotal = purchase.subtotal;
        const discount = discountAmount || 0;
        const subtotalAfterDiscount = Math.max(0, subtotal - discount);
        const finalTaxAmount = subtotalAfterDiscount * taxRate;
        const totalAmount = subtotalAfterDiscount + finalTaxAmount;

        invoiceData = {
          ...invoiceData,
          purchase_id: purchaseId,
          subtotal: subtotalAfterDiscount,
          tax_rate: taxRate,
          tax_amount: finalTaxAmount,
          total_amount: totalAmount,
          currency: purchase.currency || 'USD',
          items: invoiceItems,
        };

        // Add package_id if this is a subscription purchase
        if (purchase.purchase_type === 'subscription') {
          // Try to get subscription_id from purchase metadata or find active subscription
          const { data: subscription } = await supabase
            .from('user_subscriptions')
            .select('id, package_id')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          if (subscription) {
            invoiceData.subscription_id = subscription.id;
            invoiceData.package_id = subscription.package_id;
          }
        }
      }
      // Handle subscription-based invoice
      else if (subscriptionId) {
        const { data: subscription } = await supabase
          .from('user_subscriptions')
          .select('*, package:subscription_packages(*)')
          .eq('id', subscriptionId)
          .single();

        if (!subscription) return;

        // Get package details from subscription_packages (since user_subscriptions.package_id references subscription_packages)
        const packageDetails = subscription.package;
        const packageId = subscription.package_id;

        // Determine price based on billing cycle
        // subscription_packages only has monthly_price, so calculate yearly as monthly * 12
        const monthlyPrice = packageDetails?.monthly_price || 0;
        const price = subscription.billing_cycle === 'yearly' 
          ? monthlyPrice * 12
          : monthlyPrice;

        // Create invoice items
        const invoiceItems = [
          {
            description: `Subscription - ${packageDetails?.package_name || 'Package'} (${subscription.billing_cycle})`,
            quantity: 1,
            unit_price: price,
            total: price,
          },
        ];

        // Calculate final amounts
        const subtotal = price;
        const discount = discountAmount || 0;
        const subtotalAfterDiscount = Math.max(0, subtotal - discount);
        const finalTaxAmount = subtotalAfterDiscount * taxRate;
        const totalAmount = subtotalAfterDiscount + finalTaxAmount;

        // Note: invoices.package_id references packages(id), but subscription uses subscription_packages
        // We'll set package_id to null for subscription invoices, or you can create a mapping
        invoiceData = {
          ...invoiceData,
          subscription_id: subscriptionId,
          package_id: null, // subscription_packages.id doesn't map to packages.id, leave null or create mapping
          subtotal: subtotalAfterDiscount,
          tax_rate: taxRate,
          tax_amount: finalTaxAmount,
          total_amount: totalAmount,
          currency: packageDetails?.currency || 'USD',
          items: invoiceItems,
        };
      } else {
        // No purchase or subscription ID provided
        return;
      }

      const { error: invoiceError } = await supabase
        .from('invoices')
        .insert(invoiceData);

      if (invoiceError) {
        console.error('Error creating invoice:', invoiceError);
        // Don't throw - invoice generation failure shouldn't block operations
      }
    } catch (err: any) {
      console.error('Error generating invoice:', err);
      // Don't throw - invoice generation failure shouldn't block operations
    }
  };

  const handleSaveAutoTopup = async () => {
    if (!user || !credits) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: updateError } = await supabase
        .from('user_credits')
        .update({
          auto_topup_enabled: autoTopupEnabled,
          auto_topup_amount: autoTopupEnabled ? autoTopupAmount : null,
          auto_topup_threshold: autoTopupEnabled ? autoTopupThreshold : null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setSuccess('Auto-topup settings saved successfully!');
      setShowSettingsDialog(false);
      await fetchBillingData();
      
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      console.error('Error saving auto-topup settings:', err);
      setError(err.message || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInvoice = async (invoiceId: string, invoiceNumber: string) => {
    try {
      const { data: invoice } = await supabase
        .from('invoices')
        .select('pdf_url')
        .eq('id', invoiceId)
        .single();

      if (invoice?.pdf_url) {
        window.open(invoice.pdf_url, '_blank');
      } else {
        setError('Invoice PDF not yet generated. Please contact support.');
      }
    } catch (err: any) {
      setError('Failed to download invoice');
    }
  };

  if (loading && !credits) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <Box>
        {/* Action Buttons */}
        <Box mb={3} display="flex" justifyContent="flex-end" gap={2} flexWrap="wrap">
          <Button
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={() => setShowSettingsDialog(true)}
            size="medium"
          >
            Settings
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setShowPurchaseDialog(true)}
            size="medium"
          >
            Buy Credits
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {/* Low Credits Warning */}
        {credits && credits.balance <= credits.low_credit_threshold && (
          <Alert 
            severity="warning" 
            sx={{ mb: 3 }}
            icon={<WarningIcon />}
            action={
              <Button color="inherit" size="small" onClick={() => setShowPurchaseDialog(true)}>
                Buy Credits
              </Button>
            }
          >
            Low credits! Your balance is {credits.balance.toFixed(2)} credits. 
            {credits.balance <= 0 && ' Services are paused. Please top up to continue.'}
          </Alert>
        )}

        {/* Services Paused Warning */}
        {credits && credits.services_paused && (
          <Alert severity="error" sx={{ mb: 3 }}>
            Your services are paused due to insufficient credits. Please purchase credits to resume.
          </Alert>
        )}

        <Stack spacing={3}>
          {/* Credit System Info */}
          <Card
            sx={{
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Credit System
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mt: 2 }}>
                <Paper sx={{ p: 2, flex: '1 1 200px' }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Purchase Rate
                  </Typography>
                  <Typography variant="h6" fontWeight={600}>
                    $1.00 = {CREDIT_RATES.PURCHASE_RATE} Credits
                  </Typography>
                </Paper>
                <Paper sx={{ p: 2, flex: '1 1 200px' }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Call Usage
                  </Typography>
                  <Typography variant="h6" fontWeight={600}>
                    1 Minute = {CREDIT_RATES.CALL_PER_MINUTE} Credits
                  </Typography>
                </Paper>
                <Paper sx={{ p: 2, flex: '1 1 200px' }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Agent Creation
                  </Typography>
                  <Typography variant="h6" fontWeight={600}>
                    1 Agent = {CREDIT_RATES.AGENT_CREATION} Credits
                  </Typography>
                </Paper>
              </Box>
            </CardContent>
          </Card>

          {/* Credits Overview */}
          <Card
            sx={{
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h6" fontWeight={600}>
                  Credit Balance
                </Typography>
                <Chip
                  label={credits?.services_paused ? 'Paused' : 'Active'}
                  color={credits?.services_paused ? 'error' : 'success'}
                  size="small"
                />
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                <Paper sx={{ p: 2, flex: '1 1 200px', textAlign: 'center' }}>
                  <Typography variant="h3" fontWeight={700} color="primary">
                    {credits?.balance.toFixed(2) || '0.00'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Current Balance
                  </Typography>
                </Paper>
                <Paper sx={{ p: 2, flex: '1 1 200px', textAlign: 'center' }}>
                  <Typography variant="h4" fontWeight={700} color="success.main">
                    {credits?.total_purchased.toFixed(2) || '0.00'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Purchased
                  </Typography>
                </Paper>
                <Paper sx={{ p: 2, flex: '1 1 200px', textAlign: 'center' }}>
                  <Typography variant="h4" fontWeight={700} color="error.main">
                    {credits?.total_used.toFixed(2) || '0.00'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Used
                  </Typography>
                </Paper>
              </Box>
            </CardContent>
          </Card>

          {/* Packages Section - Only show upgrade options when user has free package or no subscription */}
          {newPackages.length > 0 && 
           (!subscription || subscription.package?.tier === 'free') && (
            <Card
              sx={{
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  {subscription?.package?.tier === 'free' 
                    ? 'Upgrade Your Package' 
                    : 'Subscription Packages'}
                </Typography>
                <Box sx={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: { xs: 2, sm: 2, md: 2, lg: 3 }, 
                  mt: 2,
                  justifyContent: { xs: 'center', sm: 'flex-start' }
                }}>
                  {newPackages
                    .filter((pkg) => {
                      // Only show non-free packages if user has free package
                      // Show all packages if user has no subscription
                      if (!subscription) return true;
                      if (subscription.package?.tier === 'free') {
                        return pkg.tier !== 'free'; // Only show upgrade packages
                      }
                      return false;
                    })
                    .map((pkg) => {
                      // Check if this package matches the user's current subscription
                      // user_subscriptions.package_id references packages(id), so match by ID
                      const isCurrentPackage = subscription && 
                        subscription.package_id === pkg.id;
                      
                      return (
                        <Card
                          key={pkg.id}
                          sx={{
                            flex: { 
                              xs: '1 1 100%', 
                              sm: '1 1 calc(50% - 8px)', 
                              md: '1 1 calc(33.333% - 11px)', 
                              lg: '1 1 calc(33.333% - 16px)',
                              xl: '1 1 300px'
                            },
                            minWidth: { xs: '100%', sm: '280px', md: '250px' },
                            maxWidth: { xs: '100%', sm: '100%', md: '100%', lg: '400px' },
                            border: pkg.is_featured ? '2px solid' : '1px solid',
                            borderColor: pkg.is_featured ? 'primary.main' : 'divider',
                            position: 'relative',
                            opacity: isCurrentPackage ? 0.7 : 1,
                            transition: 'all 0.3s ease',
                            '&:hover': {
                              boxShadow: isCurrentPackage ? 0 : 4,
                              transform: isCurrentPackage ? 'none' : 'translateY(-4px)',
                            },
                          }}
                        >
                          {pkg.is_featured && (
                            <Chip
                              label="Featured"
                              color="primary"
                              size="small"
                              sx={{
                                position: 'absolute',
                                top: 16,
                                right: 16,
                              }}
                            />
                          )}
                          {isCurrentPackage && (
                            <Chip
                              label="Current Package"
                              color="success"
                              size="small"
                              sx={{
                                position: 'absolute',
                                top: 16,
                                left: 16,
                              }}
                            />
                          )}
                          <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3 } }}>
                            <Typography variant="h5" fontWeight={600} gutterBottom sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
                              {pkg.name}
                            </Typography>
                            {pkg.description && (
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                                {pkg.description}
                              </Typography>
                            )}
                            <Box sx={{ mb: 2 }}>
                              <Typography variant="h4" fontWeight={700} color="primary" sx={{ fontSize: { xs: '1.75rem', sm: '2rem', md: '2.125rem' } }}>
                                {billingPeriod === 'monthly'
                                  ? `$${pkg.price_monthly?.toFixed(2) || '0.00'}`
                                  : pkg.price_yearly
                                  ? `$${pkg.price_yearly.toFixed(2)}`
                                  : `$${((pkg.price_monthly || 0) * 12).toFixed(2)}`}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                                /{billingPeriod === 'monthly' ? 'month' : 'year'}
                                {billingPeriod === 'yearly' && pkg.price_yearly && (
                                  <span style={{ color: 'green' }}>
                                    {' '}
                                    (Save ${((pkg.price_monthly || 0) * 12 - pkg.price_yearly).toFixed(2)})
                                  </span>
                                )}
                              </Typography>
                            </Box>
                            {pkg.credits_included !== null && (
                              <Typography variant="body2" sx={{ mb: 2, fontWeight: 600 }}>
                                Credits: {pkg.credits_included}
                              </Typography>
                            )}
                            <Divider sx={{ my: 2 }} />
                            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                              Features:
                            </Typography>
                            <Stack spacing={1}>
                              {pkg.features
                                .sort((a, b) => a.display_order - b.display_order)
                                .map((feature) => {
                                  const rendered = renderFeatureTemplate(
                                    feature.feature_template,
                                    pkg.variables
                                  );
                                  return (
                                    <Box
                                      key={feature.id}
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: 1,
                                      }}
                                    >
                                      <CheckCircleIcon
                                        sx={{
                                          fontSize: 18,
                                          color: 'success.main',
                                          mt: 0.5,
                                        }}
                                      />
                                      <Typography
                                        variant="body2"
                                        sx={{
                                          fontWeight: feature.is_highlighted ? 600 : 400,
                                        }}
                                      >
                                        {rendered}
                                        {feature.is_highlighted && (
                                          <Chip
                                            label="Featured"
                                            size="small"
                                            color="primary"
                                            sx={{ ml: 1, height: 18 }}
                                          />
                                        )}
                                      </Typography>
                                    </Box>
                                  );
                                })}
                            </Stack>
                            <Button
                              variant={pkg.is_featured ? 'contained' : 'outlined'}
                              fullWidth
                              sx={{ mt: 3 }}
                              onClick={() => {
                                setSelectedPackage(pkg);
                                setShowPackageDialog(true);
                                setCouponCode('');
                                setCouponValidation(null);
                              }}
                              disabled={isCurrentPackage || (pkg.tier === 'free' && subscription !== null)}
                            >
                              {isCurrentPackage
                                ? 'Current Package'
                                : pkg.tier === 'free' && subscription !== null
                                ? 'Already Subscribed'
                                : pkg.tier === 'free'
                                ? 'Get Started'
                                : 'Subscribe'}
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Current Subscription Info */}
          {subscription && (
            <Card
              sx={{
                borderRadius: 2,
                border: '2px solid',
                borderColor: 'primary.main',
                bgcolor: 'action.hover',
              }}
            >
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2} mb={2}>
                  <Box>
                    <Typography variant="h5" fontWeight={600} gutterBottom>
                      {subscription.package?.name || 'Current Subscription'}
                    </Typography>
                    {subscription.package?.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {subscription.package.description}
                      </Typography>
                    )}
                    <Typography variant="h6" fontWeight={600} color="primary" sx={{ mt: 1 }}>
                      {subscription.billing_cycle === 'yearly'
                        ? subscription.package?.price_yearly
                          ? `$${subscription.package.price_yearly.toFixed(2)}/year`
                          : `$${((subscription.package?.price_monthly || 0) * 12).toFixed(2)}/year`
                        : subscription.package?.price_monthly
                        ? `$${subscription.package.price_monthly.toFixed(2)}/month`
                        : 'N/A'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Renews: {new Date(subscription.current_period_end).toLocaleDateString()}
                    </Typography>
                    {subscription.billing_cycle && (
                      <Chip
                        label={subscription.billing_cycle === 'yearly' ? 'Yearly Billing' : 'Monthly Billing'}
                        size="small"
                        sx={{ mt: 1 }}
                      />
                    )}
                  </Box>
                  <Chip label={subscription.status} color="success" size="medium" />
                </Box>

                {/* Package Info from packages table */}
                {subscription.package && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                      Package Details:
                    </Typography>
                    <Stack spacing={1} sx={{ mt: 1 }}>
                      {subscription.package.credits_included !== null && subscription.package.credits_included > 0 && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CheckCircleIcon sx={{ fontSize: 18, color: 'success.main' }} />
                          <Typography variant="body2">
                            {subscription.package.credits_included} credits included
                          </Typography>
                        </Box>
                      )}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CheckCircleIcon sx={{ fontSize: 18, color: 'success.main' }} />
                        <Typography variant="body2">
                          Tier: {subscription.package.tier || 'N/A'}
                        </Typography>
                      </Box>
                    </Stack>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Tabs for Transactions and Invoices */}
          <Card>
            <CardContent>
              <Tabs value={currentTab} onChange={(e, newValue) => setCurrentTab(newValue)} sx={{ mb: 3 }}>
                <Tab icon={<HistoryIcon />} iconPosition="start" label="Transactions" />
                <Tab icon={<InvoiceIcon />} iconPosition="start" label="Invoices" />
              </Tabs>

              {/* Transactions Tab */}
              {currentTab === 0 && (
                <Box>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    Credit Transactions
                  </Typography>
                  {transactions.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                      No transactions yet
                    </Typography>
                  ) : (
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.100' }}>
                            <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Amount</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Balance</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {transactions.map((tx) => (
                            <TableRow key={tx.id} hover>
                              <TableCell>{new Date(tx.created_at).toLocaleString()}</TableCell>
                              <TableCell>
                                <Chip
                                  label={tx.transaction_type}
                                  size="small"
                                  color={tx.amount > 0 ? 'success' : 'default'}
                                />
                              </TableCell>
                              <TableCell>
                                <Typography color={tx.amount > 0 ? 'success.main' : 'error.main'}>
                                  {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)}
                                </Typography>
                              </TableCell>
                              <TableCell>{tx.balance_after.toFixed(2)}</TableCell>
                              <TableCell>{tx.description || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Box>
              )}

              {/* Invoices Tab */}
              {currentTab === 1 && (
                <Box>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    Invoices
                  </Typography>
                  {invoices.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                      No invoices yet
                    </Typography>
                  ) : (
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.100' }}>
                            <TableCell sx={{ fontWeight: 600 }}>Invoice #</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Due Date</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Subtotal</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Tax</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Discount</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Total</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {invoices.map((invoice) => (
                            <TableRow key={invoice.id} hover>
                              <TableCell>{invoice.invoice_number}</TableCell>
                              <TableCell>{new Date(invoice.invoice_date).toLocaleDateString()}</TableCell>
                              <TableCell>
                                {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '-'}
                              </TableCell>
                              <TableCell>${(invoice.subtotal || invoice.total_amount).toFixed(2)}</TableCell>
                              <TableCell>
                                {invoice.tax_amount > 0 ? (
                                  <Typography variant="body2">
                                    ${invoice.tax_amount.toFixed(2)} ({((invoice.tax_rate || 0) * 100).toFixed(1)}%)
                                  </Typography>
                                ) : (
                                  '-'
                                )}
                              </TableCell>
                              <TableCell>
                                {invoice.discount_amount > 0 ? (
                                  <Typography variant="body2" color="success.main">
                                    -${invoice.discount_amount.toFixed(2)}
                                    {invoice.discount_code && ` (${invoice.discount_code})`}
                                  </Typography>
                                ) : (
                                  '-'
                                )}
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" fontWeight={600}>
                                  ${invoice.total_amount.toFixed(2)}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={invoice.status}
                                  size="small"
                                  color={
                                    invoice.status === 'paid'
                                      ? 'success'
                                      : invoice.status === 'overdue'
                                      ? 'error'
                                      : invoice.status === 'sent'
                                      ? 'warning'
                                      : 'default'
                                  }
                                />
                              </TableCell>
                              <TableCell align="right">
                                <Tooltip title="Download Invoice">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDownloadInvoice(invoice.id, invoice.invoice_number)}
                                  >
                                    <DownloadIcon />
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Stack>

        {/* Purchase Credits Dialog */}
        <Dialog open={showPurchaseDialog} onClose={() => setShowPurchaseDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Purchase Credits</DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>
              <TextField
                label="Amount ($)"
                type="number"
                value={purchaseAmount}
                onChange={(e) => setPurchaseAmount(parseFloat(e.target.value) || 0)}
                fullWidth
                inputProps={{ min: 1, step: 0.01 }}
              />
              <Alert severity="info">
                You will receive {(purchaseAmount * CREDIT_RATES.PURCHASE_RATE).toFixed(0)} credits ($1.00 = {CREDIT_RATES.PURCHASE_RATE} credits)
              </Alert>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowPurchaseDialog(false)} disabled={processingPayment}>
              Cancel
            </Button>
            <Button 
              onClick={handlePurchaseCredits} 
              variant="contained" 
              disabled={purchaseAmount <= 0 || processingPayment}
              startIcon={processingPayment ? <CircularProgress size={20} /> : null}
            >
              {processingPayment ? 'Processing...' : 'Proceed to Payment'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Auto-Topup Settings Dialog */}
        <Dialog open={showSettingsDialog} onClose={() => setShowSettingsDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Auto-Topup Settings</DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={autoTopupEnabled}
                    onChange={(e) => setAutoTopupEnabled(e.target.checked)}
                  />
                }
                label="Enable Auto-Topup"
              />
              {autoTopupEnabled && (
                <>
                  <TextField
                    label="Top-up Amount ($)"
                    type="number"
                    value={autoTopupAmount}
                    onChange={(e) => setAutoTopupAmount(parseFloat(e.target.value) || 0)}
                    fullWidth
                    inputProps={{ min: 1, step: 0.01 }}
                    helperText="Amount to add when threshold is reached"
                  />
                  <TextField
                    label="Threshold ($)"
                    type="number"
                    value={autoTopupThreshold}
                    onChange={(e) => setAutoTopupThreshold(parseFloat(e.target.value) || 0)}
                    fullWidth
                    inputProps={{ min: 0, step: 0.01 }}
                    helperText="Auto-topup triggers when balance falls below this amount"
                  />
                </>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowSettingsDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveAutoTopup} variant="contained" disabled={loading}>
              {loading ? 'Saving...' : 'Save Settings'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Package Subscription Dialog */}
        <Dialog
          open={showPackageDialog}
          onClose={() => {
            setShowPackageDialog(false);
            setSelectedPackage(null);
            setCouponCode('');
            setCouponValidation(null);
          }}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            Subscribe to {selectedPackage?.name || 'Package'}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>
              {selectedPackage && (
                <>
                  <FormControl fullWidth>
                    <InputLabel>Billing Period</InputLabel>
                    <Select
                      value={billingPeriod}
                      label="Billing Period"
                      onChange={(e) => setBillingPeriod(e.target.value as 'monthly' | 'yearly')}
                    >
                      <MenuItem value="monthly">Monthly</MenuItem>
                      <MenuItem value="yearly">Yearly</MenuItem>
                    </Select>
                  </FormControl>

                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Package Price
                    </Typography>
                    <Typography variant="h5" fontWeight={600}>
                      {billingPeriod === 'monthly'
                        ? `$${selectedPackage.price_monthly?.toFixed(2) || '0.00'}`
                        : selectedPackage.price_yearly
                        ? `$${selectedPackage.price_yearly.toFixed(2)}`
                        : `$${((selectedPackage.price_monthly || 0) * 12).toFixed(2)}`}
                      /{billingPeriod === 'monthly' ? 'month' : 'year'}
                    </Typography>
                  </Box>

                  <Divider />

                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Coupon Code (Optional)
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="Enter coupon code"
                        value={couponCode}
                        onChange={(e) => {
                          setCouponCode(e.target.value.toUpperCase());
                          setCouponValidation(null);
                        }}
                        disabled={validatingCoupon}
                      />
                      <Button
                        variant="outlined"
                        onClick={async () => {
                          if (!couponCode.trim() || !user || !selectedPackage) return;
                          setValidatingCoupon(true);
                          try {
                            const price =
                              billingPeriod === 'monthly'
                                ? selectedPackage.price_monthly || 0
                                : selectedPackage.price_yearly || (selectedPackage.price_monthly || 0) * 12;
                            const validation = await validateCoupon(
                              couponCode,
                              user.id,
                              price,
                              'subscriptions'
                            );
                            setCouponValidation(validation);
                          } catch (error: any) {
                            setCouponValidation({
                              valid: false,
                              coupon: null,
                              discount_amount: 0,
                              error: error.message || 'Failed to validate coupon',
                            });
                          } finally {
                            setValidatingCoupon(false);
                          }
                        }}
                        disabled={!couponCode.trim() || validatingCoupon}
                      >
                        {validatingCoupon ? 'Validating...' : 'Apply'}
                      </Button>
                    </Box>
                    {couponValidation && (
                      <Box sx={{ mt: 1 }}>
                        {couponValidation.valid ? (
                          <Alert severity="success" sx={{ mt: 1 }}>
                            Coupon applied! Discount: ${couponValidation.discount_amount.toFixed(2)}
                          </Alert>
                        ) : (
                          <Alert severity="error" sx={{ mt: 1 }}>
                            {couponValidation.error || 'Invalid coupon code'}
                          </Alert>
                        )}
                      </Box>
                    )}
                  </Box>

                  <Divider />

                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Total Amount
                    </Typography>
                    <Typography variant="h5" fontWeight={600}>
                      {(() => {
                        const basePrice =
                          billingPeriod === 'monthly'
                            ? selectedPackage.price_monthly || 0
                            : selectedPackage.price_yearly || (selectedPackage.price_monthly || 0) * 12;
                        const discount = couponValidation?.valid ? couponValidation.discount_amount : 0;
                        const total = Math.max(0, basePrice - discount);
                        return `$${total.toFixed(2)}`;
                      })()}
                    </Typography>
                    {couponValidation?.valid && (
                      <Typography variant="body2" color="text.secondary">
                        Original: $
                        {(
                          billingPeriod === 'monthly'
                            ? selectedPackage.price_monthly || 0
                            : selectedPackage.price_yearly || (selectedPackage.price_monthly || 0) * 12
                        ).toFixed(2)}{' '}
                        - Discount: ${couponValidation.discount_amount.toFixed(2)}
                      </Typography>
                    )}
                  </Box>

                  {selectedPackage.features.length > 0 && (
                    <>
                      <Divider />
                      <Box>
                        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                          Package Features:
                        </Typography>
                        <Stack spacing={1}>
                          {selectedPackage.features
                            .sort((a, b) => a.display_order - b.display_order)
                            .map((feature) => {
                              const rendered = renderFeatureTemplate(
                                feature.feature_template,
                                selectedPackage.variables
                              );
                              return (
                                <Box key={feature.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <CheckCircleIcon sx={{ fontSize: 18, color: 'success.main' }} />
                                  <Typography variant="body2">{rendered}</Typography>
                                </Box>
                              );
                            })}
                        </Stack>
                      </Box>
                    </>
                  )}
                </>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setShowPackageDialog(false);
                setSelectedPackage(null);
                setCouponCode('');
                setCouponValidation(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={async () => {
                if (!selectedPackage || !user) return;
                
                // Note: Free package subscription logic handled in subscriptionService

                setProcessingPayment(true);
                try {
                  const basePrice =
                    billingPeriod === 'monthly'
                      ? selectedPackage.price_monthly || 0
                      : selectedPackage.price_yearly || (selectedPackage.price_monthly || 0) * 12;
                  const discount = couponValidation?.valid ? couponValidation.discount_amount : 0;
                  const total = Math.max(0, basePrice - discount);

                  // For free package, assign directly without payment
                  if (selectedPackage.tier === 'free') {
                    // Check if user already has any subscription
                    if (subscription) {
                      setErrorMessage('You already have an active subscription. Cannot subscribe to free package.');
                      setShowErrorDialog(true);
                      setProcessingPayment(false);
                      return;
                    }

                    const { assignFreePackageToUser } = await import('../services/subscriptionService');
                    const result = await assignFreePackageToUser(user.id);
                    
                    if (result.success) {
                      setSuccessMessage('Free package activated successfully! Credits have been added to your balance.');
                      setShowSuccessDialog(true);
                      setShowPackageDialog(false);
                      await fetchBillingData();
                    } else {
                      setErrorMessage(result.error || 'Failed to activate free package');
                      setShowErrorDialog(true);
                    }
                    setProcessingPayment(false);
                    return;
                  }

                  // Paid package subscription flow
                  // Step 1: Create subscription record
                  const subscriptionResult = await createPaidSubscription(
                    user.id,
                    selectedPackage.id,
                    billingPeriod,
                    couponValidation?.valid ? couponCode : undefined,
                    discount
                  );

                  if (!subscriptionResult.success || !subscriptionResult.subscriptionId) {
                    setErrorMessage(subscriptionResult.error || 'Failed to create subscription');
                    setShowErrorDialog(true);
                    setProcessingPayment(false);
                    return;
                  }

                  // Step 2: Record coupon usage if applied
                  if (couponValidation?.valid && couponValidation.coupon) {
                    await recordCouponUsage(
                      couponValidation.coupon.id,
                      user.id,
                      discount,
                      undefined,
                      subscriptionResult.subscriptionId
                    );
                  }

                  // Step 3: Create purchase record for payment tracking
                  const { data: purchase, error: purchaseError } = await supabase
                    .from('purchases')
                    .insert({
                      user_id: user.id,
                      purchase_type: 'subscription',
                      amount: total,
                      credits_amount: selectedPackage.credits_included || 0,
                      credits_rate: 0,
                      subtotal: basePrice,
                      discount_amount: discount,
                      total_amount: total,
                      payment_status: 'pending',
                      metadata: {
                        subscription_id: subscriptionResult.subscriptionId,
                        package_id: selectedPackage.id,
                        billing_cycle: billingPeriod,
                        coupon_code: couponValidation?.valid ? couponCode : null,
                      },
                    })
                    .select()
                    .single();

                  if (purchaseError) {
                    setErrorMessage('Failed to create purchase record. Please try again.');
                    setShowErrorDialog(true);
                    setProcessingPayment(false);
                    return;
                  }

                  // Step 4: Create Stripe Checkout session
                  const successUrl = `${window.location.origin}/billing?session_id={CHECKOUT_SESSION_ID}&purchase_id=${purchase.id}&subscription_id=${subscriptionResult.subscriptionId}`;
                  const cancelUrl = `${window.location.origin}/billing?canceled=true&subscription_id=${subscriptionResult.subscriptionId}`;

                  try {
                    const { sessionId, url } = await createCheckoutSession({
                      userId: user.id,
                      amount: total,
                      creditsAmount: selectedPackage.credits_included || 0,
                      purchaseId: purchase.id,
                      successUrl,
                      cancelUrl,
                    });

                    // Store session ID in purchase record
                    await supabase
                      .from('purchases')
                      .update({
                        payment_provider_id: sessionId,
                        metadata: {
                          ...purchase.metadata,
                          checkout_session_id: sessionId,
                        },
                      })
                      .eq('id', purchase.id);

                    // Redirect to Stripe Checkout
                    await redirectToCheckout(url);
                  } catch (checkoutError: any) {
                    setErrorMessage(checkoutError.message || 'Failed to initiate payment. Please try again.');
                    setShowErrorDialog(true);
                    setProcessingPayment(false);
                  }
                } catch (error: any) {
                  setErrorMessage(error.message || 'Failed to process subscription');
                  setShowErrorDialog(true);
                  setProcessingPayment(false);
                }
              }}
              disabled={processingPayment}
            >
              {processingPayment
                ? 'Processing...'
                : selectedPackage?.tier === 'free'
                ? 'Activate Free Package'
                : 'Subscribe'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Success Dialog */}
        <Dialog
          open={showSuccessDialog}
          onClose={() => {
            setShowSuccessDialog(false);
            setSuccessMessage('');
          }}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CheckCircleIcon color="success" />
            Success!
          </DialogTitle>
          <DialogContent>
            <Typography variant="body1">{successMessage}</Typography>
          </DialogContent>
          <DialogActions>
            <Button
              variant="contained"
              onClick={() => {
                setShowSuccessDialog(false);
                setSuccessMessage('');
              }}
            >
              OK
            </Button>
          </DialogActions>
        </Dialog>

        {/* Error Dialog */}
        <Dialog
          open={showErrorDialog}
          onClose={() => {
            setShowErrorDialog(false);
            setErrorMessage('');
          }}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <WarningIcon color="error" />
            Error
          </DialogTitle>
          <DialogContent>
            <Typography variant="body1">{errorMessage}</Typography>
          </DialogContent>
          <DialogActions>
            <Button
              variant="contained"
              color="error"
              onClick={() => {
                setShowErrorDialog(false);
                setErrorMessage('');
              }}
            >
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </>
  );
};

export default Billing;
