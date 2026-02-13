import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stack,
  Divider,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  TextField,
  Alert,
  CircularProgress,
  Paper,
  Card,
  CardContent,
  IconButton,
} from '@mui/material';
import {
  CreditCard as CreditCardIcon,
  AccountBalance as BankIcon,
  Payment as PayPalIcon,
  Upload as UploadIcon,
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe, Stripe, type StripeElementsOptions } from '@stripe/stripe-js';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  createPaymentIntent,
  createPayPalOrder,
  getBankAccountDetails,
  uploadPaymentProof,
} from '../services/paymentService';
import { CREDIT_RATES } from '../services/creditService';
import { renderFeatureTemplate, PackageWithDetails } from '../services/packageService';

// Initialize Stripe
let stripePromise: Promise<Stripe | null> | null = null;
const getStripe = (): Promise<Stripe | null> => {
  if (!stripePromise) {
    const stripeKey = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
    if (!stripeKey) {
      console.error('Stripe publishable key is not configured');
      return Promise.resolve(null);
    }
    stripePromise = loadStripe(stripeKey);
  }
  return stripePromise;
};

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  purchaseType: 'package' | 'credits';
  selectedPackage?: PackageWithDetails | null;
  creditsAmount?: number;
  amount: number;
  billingPeriod?: 'monthly' | 'yearly';
  discountAmount?: number;
  couponCode?: string;
  subscriptionId?: string;
}

type PaymentMethod = 'stripe' | 'paypal' | 'bank_transfer' | null;

// Stripe Payment Wrapper Component
const StripePaymentWrapper: React.FC<{
  clientSecret: string;
  onSuccess: () => void;
  onError: (error: string) => void;
  disabled: boolean;
}> = ({ clientSecret, onSuccess, onError, disabled }) => {
  const [stripeInstance, setStripeInstance] = useState<Stripe | null>(null);

  useEffect(() => {
    const loadStripeInstance = async () => {
      const stripe = await getStripe();
      if (stripe) {
        setStripeInstance(stripe);
      }
    };
    loadStripeInstance();
  }, []);

  if (!stripeInstance) {
    return <CircularProgress />;
  }

  const options: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: 'stripe',
    },
  };

  return (
    <Elements stripe={stripeInstance} options={options}>
      <StripeCardForm
        clientSecret={clientSecret}
        onSuccess={onSuccess}
        onError={onError}
        disabled={disabled}
      />
    </Elements>
  );
};

// Stripe Card Form Component
const StripeCardForm: React.FC<{
  clientSecret: string;
  onSuccess: () => void;
  onError: (error: string) => void;
  disabled: boolean;
}> = ({ clientSecret, onSuccess, onError, disabled }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || !clientSecret) return;

    setProcessing(true);

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      onError('Card element not found');
      setProcessing(false);
      return;
    }

    const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: cardElement,
      },
    });

    if (confirmError) {
      onError(confirmError.message || 'Payment failed');
      setProcessing(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      onSuccess();
    } else {
      onError('Payment was not successful');
    }
    setProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Box sx={{ mb: 2, p: 2, border: '1px solid', borderColor: 'grey.300', borderRadius: 1 }}>
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': {
                  color: '#aab7c4',
                },
              },
              invalid: {
                color: '#9e2146',
              },
            },
          }}
        />
      </Box>
      <Button
        type="submit"
        variant="contained"
        fullWidth
        disabled={!stripe || processing || disabled}
        startIcon={processing ? <CircularProgress size={20} /> : <CreditCardIcon />}
      >
        {processing ? 'Processing...' : 'Pay with Card'}
      </Button>
    </form>
  );
};

const PaymentDialog: React.FC<PaymentDialogProps> = ({
  open,
  onClose,
  onSuccess,
  purchaseType,
  selectedPackage,
  creditsAmount = 0,
  amount,
  billingPeriod = 'monthly',
  discountAmount = 0,
  couponCode,
  subscriptionId,
}) => {
  const { user } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purchaseId, setPurchaseId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripeLoaded, setStripeLoaded] = useState(false);
  const [bankDetails, setBankDetails] = useState<any>(null);
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [transactionReference, setTransactionReference] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate totals
  const subtotal = amount;
  const taxRate = 0; // You can fetch this from tax_configuration table
  const taxAmount = subtotal * taxRate;
  const finalAmount = subtotal - discountAmount + taxAmount;

  // Load Stripe and bank details
  useEffect(() => {
    if (open) {
      const loadStripe = async () => {
        const stripe = await getStripe();
        if (stripe) {
          setStripeLoaded(true);
        }
      };
      loadStripe();
      getBankAccountDetails()
        .then(setBankDetails)
        .catch((err) => console.error('Error loading bank details:', err));
    }
  }, [open]);

  // Create purchase record
  const createPurchaseRecord = async () => {
    if (!user) throw new Error('User not authenticated');

    const purchaseData: any = {
      user_id: user.id,
      purchase_type: purchaseType === 'package' ? 'subscription' : 'credits',
      amount: finalAmount,
      credits_amount: purchaseType === 'package' ? (selectedPackage?.credits_included || 0) : creditsAmount,
      subtotal: subtotal,
      discount_amount: discountAmount,
      total_amount: finalAmount,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      payment_status: 'pending',
      payment_method: paymentMethod,
      metadata: {
        billing_period: purchaseType === 'package' ? billingPeriod : null,
        package_id: purchaseType === 'package' ? selectedPackage?.id : null,
        subscription_id: subscriptionId || null,
        coupon_code: couponCode || null,
      },
    };

    if (purchaseType === 'package' && selectedPackage) {
      purchaseData.package_id = selectedPackage.id;
    }

    const { data, error: purchaseError } = await supabase
      .from('purchases')
      .insert(purchaseData)
      .select()
      .single();

    if (purchaseError) throw purchaseError;
    return data.id;
  };

  // Handle Stripe payment success
  const handleStripeSuccess = async () => {
    if (!user || !purchaseId) return;

    try {
      // Update purchase status
      await supabase
        .from('purchases')
        .update({
          payment_status: 'paid',
          completed_at: new Date().toISOString(),
        })
        .eq('id', purchaseId);

      // Activate subscription if this is a package purchase
      if (purchaseType === 'package' && subscriptionId) {
        const { activateSubscription } = await import('../services/subscriptionService');
        const activationResult = await activateSubscription(subscriptionId, user.id);
        if (!activationResult.success) {
          console.error('Failed to activate subscription:', activationResult.error);
          // Don't throw - payment succeeded, subscription activation can be retried
        }
      }

      // Add credits if needed
      if (purchaseType === 'credits' || (purchaseType === 'package' && selectedPackage?.credits_included)) {
        const creditsToAdd = purchaseType === 'package' ? (selectedPackage?.credits_included || 0) : creditsAmount;
        await supabase.rpc('add_credits', {
          p_user_id: user.id,
          p_amount: creditsToAdd,
          p_transaction_type: 'purchase',
          p_purchase_id: purchaseId,
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to process payment');
    }
  };

  // Initialize Stripe payment intent
  const initializeStripePayment = async () => {
    if (!user) return;

    setProcessing(true);
    setError(null);

    try {
      let purchase = purchaseId;
      if (!purchase) {
        purchase = await createPurchaseRecord();
        setPurchaseId(purchase);
      }

      if (!purchase) {
        throw new Error('Failed to create purchase record');
      }

      const { clientSecret: secret } = await createPaymentIntent({
        userId: user.id,
        amount: finalAmount,
        creditsAmount: purchaseType === 'package' ? (selectedPackage?.credits_included || 0) : creditsAmount,
        purchaseId: purchase,
      });

      setClientSecret(secret);
    } catch (err: any) {
      setError(err.message || 'Failed to initialize payment');
    } finally {
      setProcessing(false);
    }
  };

  // Handle PayPal payment
  const handlePayPalPayment = async () => {
    if (!user) return;

    setProcessing(true);
    setError(null);

    try {
      let purchase = purchaseId;
      if (!purchase) {
        purchase = await createPurchaseRecord();
        setPurchaseId(purchase);
      }

      if (!purchase) {
        throw new Error('Failed to create purchase record');
      }

      const returnUrl = `${window.location.origin}/billing?paypal_return=true&purchase_id=${purchase}`;
      const cancelUrl = `${window.location.origin}/billing?paypal_cancel=true&purchase_id=${purchase}`;

      const { approvalUrl } = await createPayPalOrder({
        userId: user.id,
        amount: finalAmount,
        creditsAmount: purchaseType === 'package' ? (selectedPackage?.credits_included || 0) : creditsAmount,
        purchaseId: purchase,
        returnUrl,
        cancelUrl,
      });

      // Redirect to PayPal
      window.location.href = approvalUrl;
    } catch (err: any) {
      setError(err.message || 'Failed to initiate PayPal payment');
      setProcessing(false);
    }
  };

  // Handle Bank Transfer
  const handleBankTransferSubmit = async () => {
    if (!user || !paymentProofFile || !transactionReference.trim()) {
      setError('Please upload payment proof and enter transaction reference');
      return;
    }

    setUploadingProof(true);
    setError(null);

    try {
      let purchase = purchaseId;
      if (!purchase) {
        purchase = await createPurchaseRecord();
        setPurchaseId(purchase);
      }

      if (!purchase) {
        throw new Error('Failed to create purchase record');
      }

      await uploadPaymentProof(purchase, user.id, paymentProofFile, transactionReference);

      setError(null);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to upload payment proof');
    } finally {
      setUploadingProof(false);
    }
  };

  // Initialize purchase when payment method is selected
  useEffect(() => {
    if (paymentMethod && !purchaseId && open) {
      createPurchaseRecord()
        .then(setPurchaseId)
        .catch((err) => {
          setError(err.message || 'Failed to create purchase record');
        });
    }
  }, [paymentMethod, purchaseId, open, createPurchaseRecord]);



  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Payment Details</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3}>
          {/* Invoice Summary */}
          <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Order Summary
            </Typography>
            {purchaseType === 'package' && selectedPackage && (
              <>
                <Typography variant="body2" color="text.secondary">
                  Package: <strong>{selectedPackage.name}</strong>
                </Typography>
                {selectedPackage.credits_included && (
                  <Typography variant="body2" color="text.secondary">
                    Credits Included: <strong>{selectedPackage.credits_included}</strong>
                  </Typography>
                )}
                {selectedPackage.features.length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="body2" fontWeight={600} gutterBottom>
                      Benefits:
                    </Typography>
                    <Stack spacing={0.5}>
                      {selectedPackage.features.slice(0, 5).map((feature) => {
                        const rendered = renderFeatureTemplate(
                          feature.feature_template,
                          selectedPackage.variables
                        );
                        return (
                          <Box key={feature.id} display="flex" alignItems="center" gap={1}>
                            <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />
                            <Typography variant="body2" fontSize="0.75rem">
                              {rendered}
                            </Typography>
                          </Box>
                        );
                      })}
                    </Stack>
                  </Box>
                )}
              </>
            )}
            {purchaseType === 'credits' && (
              <Typography variant="body2" color="text.secondary">
                Credits: <strong>{creditsAmount}</strong> ({CREDIT_RATES.PURCHASE_RATE} credits per $1)
              </Typography>
            )}
            <Divider sx={{ my: 2 }} />
            <Stack spacing={1}>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2">Subtotal:</Typography>
                <Typography variant="body2">${subtotal.toFixed(2)}</Typography>
              </Box>
              {discountAmount > 0 && (
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="success.main">
                    Discount {couponCode && `(${couponCode})`}:
                  </Typography>
                  <Typography variant="body2" color="success.main">
                    -${discountAmount.toFixed(2)}
                  </Typography>
                </Box>
              )}
              {taxAmount > 0 && (
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2">Tax ({(taxRate * 100).toFixed(1)}%):</Typography>
                  <Typography variant="body2">${taxAmount.toFixed(2)}</Typography>
                </Box>
              )}
              <Divider />
              <Box display="flex" justifyContent="space-between">
                <Typography variant="h6" fontWeight={600}>
                  Total:
                </Typography>
                <Typography variant="h6" fontWeight={600} color="primary">
                  ${finalAmount.toFixed(2)}
                </Typography>
              </Box>
            </Stack>
          </Paper>

          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Payment Method Selection */}
          <FormControl component="fieldset">
            <FormLabel component="legend" sx={{ mb: 2, fontWeight: 600 }}>
              Select Payment Method
            </FormLabel>
            <RadioGroup
              value={paymentMethod || ''}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            >
              <Card
                sx={{
                  mb: 2,
                  border: paymentMethod === 'stripe' ? '2px solid' : '1px solid',
                  borderColor: paymentMethod === 'stripe' ? 'primary.main' : 'grey.300',
                  cursor: 'pointer',
                }}
                onClick={() => setPaymentMethod('stripe')}
              >
                <CardContent>
                  <FormControlLabel
                    value="stripe"
                    control={<Radio />}
                    label={
                      <Box display="flex" alignItems="center" gap={1}>
                        <CreditCardIcon />
                        <Typography>Stripe (Card)</Typography>
                      </Box>
                    }
                  />
                </CardContent>
              </Card>

              <Card
                sx={{
                  mb: 2,
                  border: paymentMethod === 'paypal' ? '2px solid' : '1px solid',
                  borderColor: paymentMethod === 'paypal' ? 'primary.main' : 'grey.300',
                  cursor: 'pointer',
                }}
                onClick={() => setPaymentMethod('paypal')}
              >
                <CardContent>
                  <FormControlLabel
                    value="paypal"
                    control={<Radio />}
                    label={
                      <Box display="flex" alignItems="center" gap={1}>
                        <PayPalIcon />
                        <Typography>PayPal</Typography>
                      </Box>
                    }
                  />
                </CardContent>
              </Card>

              <Card
                sx={{
                  mb: 2,
                  border: paymentMethod === 'bank_transfer' ? '2px solid' : '1px solid',
                  borderColor: paymentMethod === 'bank_transfer' ? 'primary.main' : 'grey.300',
                  cursor: 'pointer',
                }}
                onClick={() => setPaymentMethod('bank_transfer')}
              >
                <CardContent>
                  <FormControlLabel
                    value="bank_transfer"
                    control={<Radio />}
                    label={
                      <Box display="flex" alignItems="center" gap={1}>
                        <BankIcon />
                        <Typography>Bank Transfer</Typography>
                      </Box>
                    }
                  />
                </CardContent>
              </Card>
            </RadioGroup>
          </FormControl>

          {/* Stripe Payment Form */}
          {paymentMethod === 'stripe' && stripeLoaded && (
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Enter Card Details
              </Typography>
              {clientSecret ? (
                <StripePaymentWrapper
                  clientSecret={clientSecret}
                  onSuccess={handleStripeSuccess}
                  onError={(err) => setError(err)}
                  disabled={processing}
                />
              ) : (
                <Box>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Click "Initialize Payment" to securely enter your card details.
                  </Alert>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={initializeStripePayment}
                    disabled={processing || !purchaseId}
                    startIcon={processing ? <CircularProgress size={20} /> : <CreditCardIcon />}
                  >
                    {processing ? 'Initializing...' : 'Initialize Payment'}
                  </Button>
                </Box>
              )}
            </Paper>
          )}

          {/* PayPal Payment */}
          {paymentMethod === 'paypal' && (
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                PayPal Payment
              </Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                You will be redirected to PayPal to complete your payment securely.
              </Alert>
              <Button
                variant="contained"
                fullWidth
                onClick={handlePayPalPayment}
                disabled={processing || !purchaseId}
                startIcon={processing ? <CircularProgress size={20} /> : <PayPalIcon />}
              >
                {processing ? 'Redirecting...' : 'Pay with PayPal'}
              </Button>
            </Paper>
          )}

          {/* Bank Transfer */}
          {paymentMethod === 'bank_transfer' && bankDetails && (
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Bank Transfer Details
              </Typography>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Account Title:
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {bankDetails.account_title}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    IBAN:
                  </Typography>
                  <Typography variant="body1" fontWeight={600} sx={{ fontFamily: 'monospace' }}>
                    {bankDetails.iban}
                  </Typography>
                </Box>
                {bankDetails.bank_name && (
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Bank Name:
                    </Typography>
                    <Typography variant="body1">{bankDetails.bank_name}</Typography>
                  </Box>
                )}
                {bankDetails.qr_code_url && (
                  <Box textAlign="center">
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Scan QR Code:
                    </Typography>
                    <img
                      src={bankDetails.qr_code_url}
                      alt="Payment QR Code"
                      style={{ maxWidth: '200px', maxHeight: '200px' }}
                    />
                  </Box>
                )}
                <Divider />
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  Upload Payment Proof
                </Typography>
                <TextField
                  label="Transaction Reference / Payment ID"
                  fullWidth
                  value={transactionReference}
                  onChange={(e) => setTransactionReference(e.target.value)}
                  required
                  helperText="Enter the transaction reference from your bank transfer"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 10 * 1024 * 1024) {
                        setError('File size must be less than 10MB');
                        return;
                      }
                      setPaymentProofFile(file);
                    }
                  }}
                />
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<UploadIcon />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {paymentProofFile ? `Selected: ${paymentProofFile.name}` : 'Upload Payment Proof'}
                </Button>
                {paymentProofFile && (
                  <Alert severity="success">
                    File selected: {paymentProofFile.name} ({(paymentProofFile.size / 1024).toFixed(2)} KB)
                  </Alert>
                )}
                <Alert severity="info">
                  After uploading, your payment will be reviewed. Credits will be added once approved.
                </Alert>
              </Stack>
            </Paper>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={processing || uploadingProof}>
          Cancel
        </Button>
        {paymentMethod === 'bank_transfer' && (
          <Button
            variant="contained"
            onClick={handleBankTransferSubmit}
            disabled={!paymentProofFile || !transactionReference.trim() || uploadingProof || !purchaseId}
            startIcon={uploadingProof ? <CircularProgress size={20} /> : <UploadIcon />}
          >
            {uploadingProof ? 'Uploading...' : 'Submit Payment Proof'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default PaymentDialog;
