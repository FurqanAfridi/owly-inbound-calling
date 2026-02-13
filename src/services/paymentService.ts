import { loadStripe, Stripe } from '@stripe/stripe-js';

// Initialize Stripe
let stripePromise: Promise<Stripe | null> | null = null;

const getStripe = () => {
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

interface CreateCheckoutSessionParams {
  userId: string;
  amount: number;
  creditsAmount: number;
  purchaseId: string;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Creates a Stripe Checkout session for credit purchase
 * This requires a backend endpoint to create the session securely
 */
export const createCheckoutSession = async (params: CreateCheckoutSessionParams) => {
  try {
    const checkoutWebhookUrl = process.env.REACT_APP_STRIPE_CHECKOUT_WEBHOOK_URL;
    
    if (!checkoutWebhookUrl) {
      throw new Error('Stripe checkout webhook URL is not configured. Please set REACT_APP_STRIPE_CHECKOUT_WEBHOOK_URL');
    }

    // Call your backend webhook/API to create checkout session
    const response = await fetch(checkoutWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        user_id: params.userId,
        amount: params.amount,
        credits_amount: params.creditsAmount,
        purchase_id: params.purchaseId,
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        currency: 'usd',
        metadata: {
          purchase_id: params.purchaseId,
          user_id: params.userId,
          type: 'credit_purchase',
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to create checkout session: ${errorText}`);
    }

    const { sessionId, url } = await response.json();

    if (!sessionId || !url) {
      throw new Error('Invalid response from checkout session creation');
    }

    return { sessionId, url };
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
};

/**
 * Redirects to Stripe Checkout
 */
export const redirectToCheckout = async (checkoutUrl: string) => {
  window.location.href = checkoutUrl;
};

/**
 * Processes payment after successful checkout
 * This is called when user returns from Stripe Checkout
 */
export const processPaymentSuccess = async (sessionId: string, purchaseId: string) => {
  try {
    // Verify payment with backend
    const paymentWebhookUrl = process.env.REACT_APP_STRIPE_PAYMENT_WEBHOOK_URL;
    
    if (!paymentWebhookUrl) {
      throw new Error('Stripe payment webhook URL is not configured');
    }

    const response = await fetch(paymentWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId,
        purchase_id: purchaseId,
        action: 'verify_payment',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Payment verification failed: ${errorText}`);
    }

    const result = await response.json();
    return result;
  } catch (error: any) {
    console.error('Error processing payment:', error);
    throw error;
  }
};

/**
 * Alternative: Direct payment using Stripe Elements (embedded form)
 * This requires a backend to create PaymentIntent
 */
export const createPaymentIntent = async (params: {
  userId: string;
  amount: number;
  creditsAmount: number;
  purchaseId: string;
}) => {
  try {
    const paymentIntentWebhookUrl = process.env.REACT_APP_STRIPE_PAYMENT_INTENT_WEBHOOK_URL;
    
    if (!paymentIntentWebhookUrl) {
      throw new Error('Stripe payment intent webhook URL is not configured');
    }

    const response = await fetch(paymentIntentWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        user_id: params.userId,
        amount: Math.round(params.amount * 100), // Convert to cents
        credits_amount: params.creditsAmount,
        purchase_id: params.purchaseId,
        currency: 'usd',
        metadata: {
          purchase_id: params.purchaseId,
          user_id: params.userId,
          type: 'credit_purchase',
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to create payment intent: ${errorText}`);
    }

    const { clientSecret, paymentIntentId } = await response.json();

    if (!clientSecret) {
      throw new Error('Invalid response from payment intent creation');
    }

    return { clientSecret, paymentIntentId };
  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    throw error;
  }
};

/**
 * Confirms payment with Stripe using client secret
 */
export const confirmPayment = async (clientSecret: string, paymentMethodId: string) => {
  try {
    const stripe = await getStripe();
    if (!stripe) {
      throw new Error('Stripe is not initialized');
    }

    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: paymentMethodId,
    });

    if (error) {
      throw new Error(error.message || 'Payment failed');
    }

    return paymentIntent;
  } catch (error: any) {
    console.error('Error confirming payment:', error);
    throw error;
  }
};

/**
 * PayPal Payment Functions
 */

/**
 * Creates a PayPal order
 */
export const createPayPalOrder = async (params: {
  userId: string;
  amount: number;
  creditsAmount: number;
  purchaseId: string;
  returnUrl: string;
  cancelUrl: string;
}) => {
  try {
    const paypalWebhookUrl = process.env.REACT_APP_PAYPAL_CREATE_ORDER_WEBHOOK_URL;
    
    if (!paypalWebhookUrl) {
      throw new Error('PayPal create order webhook URL is not configured. Please set REACT_APP_PAYPAL_CREATE_ORDER_WEBHOOK_URL');
    }

    const response = await fetch(paypalWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        user_id: params.userId,
        amount: params.amount,
        credits_amount: params.creditsAmount,
        purchase_id: params.purchaseId,
        return_url: params.returnUrl,
        cancel_url: params.cancelUrl,
        currency: 'USD',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to create PayPal order: ${errorText}`);
    }

    const { orderId, approvalUrl } = await response.json();

    if (!orderId || !approvalUrl) {
      throw new Error('Invalid response from PayPal order creation');
    }

    return { orderId, approvalUrl };
  } catch (error: any) {
    console.error('Error creating PayPal order:', error);
    throw error;
  }
};

/**
 * Verifies PayPal payment after return from PayPal
 */
export const verifyPayPalPayment = async (orderId: string, purchaseId: string) => {
  try {
    const paypalVerifyUrl = process.env.REACT_APP_PAYPAL_VERIFY_WEBHOOK_URL;
    
    if (!paypalVerifyUrl) {
      throw new Error('PayPal verify webhook URL is not configured');
    }

    const response = await fetch(paypalVerifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        order_id: orderId,
        purchase_id: purchaseId,
        action: 'verify_payment',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`PayPal payment verification failed: ${errorText}`);
    }

    const result = await response.json();
    return result;
  } catch (error: any) {
    console.error('Error verifying PayPal payment:', error);
    throw error;
  }
};

/**
 * Bank Transfer Functions
 */

/**
 * Fetches bank account details for bank transfer
 */
export const getBankAccountDetails = async () => {
  try {
    const { supabase } = await import('../lib/supabase');
    const { data, error } = await supabase
      .from('bank_account_details')
      .select('*')
      .eq('is_active', true)
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('Error fetching bank account details:', error);
    throw error;
  }
};

/**
 * Uploads payment proof for bank transfer
 */
export const uploadPaymentProof = async (
  purchaseId: string,
  userId: string,
  file: File,
  transactionReference: string
) => {
  try {
    const { supabase } = await import('../lib/supabase');
    
    // Upload file to Supabase Storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/payment-proofs/${purchaseId}-${Date.now()}.${fileExt}`;
    const filePath = fileName;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('payment-proofs')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('payment-proofs')
      .getPublicUrl(filePath);

    // Create payment proof record
    const { data: proofData, error: proofError } = await supabase
      .from('payment_proofs')
      .insert({
        purchase_id: purchaseId,
        user_id: userId,
        file_url: publicUrl,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        transaction_reference: transactionReference,
      })
      .select()
      .single();

    if (proofError) throw proofError;

    // Update purchase with payment proof URL
    await supabase
      .from('purchases')
      .update({
        payment_proof_url: publicUrl,
        transaction_reference: transactionReference,
        payment_status: 'processing',
      })
      .eq('id', purchaseId);

    return proofData;
  } catch (error: any) {
    console.error('Error uploading payment proof:', error);
    throw error;
  }
};