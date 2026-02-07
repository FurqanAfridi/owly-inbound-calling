import { supabase } from '../lib/supabase';
import { fetchPackageById, PackageWithDetails } from './packageService';

/**
 * Assign free package to a new user
 * Prevents subscription if user already has ANY active subscription
 */
export async function assignFreePackageToUser(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if user already has ANY active subscription
    // Use maybeSingle() to handle case where no subscription exists (new user)
    const { data: existingSubscription } = await supabase
      .from('user_subscriptions')
      .select('id, package_id, status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    // If user already has an active subscription, prevent free package subscription
    if (existingSubscription) {
      return { success: false, error: 'You already have an active subscription. Cannot subscribe to free package.' };
    }

    // Find free package from packages table (since user_subscriptions.package_id references packages(id))
    const { data: freePackage, error: packageError } = await supabase
      .from('packages')
      .select('*')
      .eq('tier', 'free')
      .eq('is_active', true)
      .single();

    if (packageError || !freePackage) {
      console.error('Free package not found:', packageError);
      return { success: false, error: 'Free package not found' };
    }

    // Calculate period dates
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setFullYear(periodEnd.getFullYear() + 1); // Free package is typically long-term

    // Create subscription with status 'active'
    const { data: _newSubscription, error: subscriptionError } = await supabase
      .from('user_subscriptions')
      .insert({
        user_id: userId,
        package_id: freePackage.id,
        status: 'active', // Ensure status is active
        billing_cycle: 'monthly',
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        auto_renew: false, // Free package doesn't auto-renew
        metadata: {
          auto_assigned: true,
          assigned_at: now.toISOString(),
        },
      })
      .select()
      .single();

    if (subscriptionError) {
      console.error('Error creating free subscription:', subscriptionError);
      return { success: false, error: subscriptionError.message };
    }

    // Add credits from packages.credits_included
    if (freePackage.credits_included && freePackage.credits_included > 0) {
      const { error: creditsError } = await supabase.rpc('add_credits', {
        p_user_id: userId,
        p_amount: freePackage.credits_included,
        p_transaction_type: 'subscription_credit',
        p_purchase_id: null,
      });

      if (creditsError) {
        console.error('Error adding free package credits:', creditsError);
        // Don't fail the whole process if credits fail, but log it
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error assigning free package:', error);
    return { success: false, error: error.message || 'Failed to assign free package' };
  }
}

/**
 * Check if user has free package
 */
export async function userHasFreePackage(userId: string): Promise<boolean> {
  try {
    const { data: freePackage } = await supabase
      .from('packages')
      .select('id')
      .eq('tier', 'free')
      .eq('is_active', true)
      .single();

    if (!freePackage) return false;

    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('package_id', freePackage.id)
      .eq('status', 'active')
      .single();

    return !!subscription;
  } catch (error) {
    return false;
  }
}

/**
 * Get user's current subscription package details
 */
export async function getUserSubscriptionPackage(userId: string): Promise<PackageWithDetails | null> {
  try {
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('package_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!subscription) return null;

    return await fetchPackageById(subscription.package_id);
  } catch (error) {
    return null;
  }
}
