import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { ProfileWithShop } from '../types';

export function useUserProfile() {
  const [profile, setProfile] = useState<ProfileWithShop | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUserProfileAndShop = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Retrieve the authenticated user session
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      if (!user) {
        setProfile(null);
        return;
      }

      const DEV_EMAIL = "jeddyeternal21@gmail.com";

      // 2. Fetch the corresponding profile and join with the shop details
      let profileData: any = null;
      let profileError: any = null;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select(`
            id,
            full_name,
            role,
            shop_id,
            shop:shops (
              id,
              name,
              current_tier,
              base_currency,
              created_at
            )
          `)
          .eq('id', user.id)
          .single();
        profileData = data;
        profileError = error;
      } catch (err) {
        profileError = err;
      }

      if (profileError && user.email !== DEV_EMAIL) {
        throw profileError;
      }

      let finalProfile: ProfileWithShop | null = null;
      if (profileData) {
        finalProfile = profileData as unknown as ProfileWithShop;
      } else if (user.email === DEV_EMAIL) {
        // Fallback profile if it doesn't exist in DB yet
        finalProfile = {
          id: user.id,
          full_name: 'Developer Admin',
          role: 'owner',
          shop_id: 'dev-shop-id',
          shop: null
        };
      }

      // Apply developer bypass overrides
      if (finalProfile && user.email === DEV_EMAIL) {
        finalProfile.role = 'owner';
        if (!finalProfile.shop) {
          finalProfile.shop = {
            id: finalProfile.shop_id || 'dev-shop-id',
            name: 'Developer Shop',
            current_tier: 'enterprise',
            base_currency: 'GHS',
            created_at: new Date().toISOString()
          };
        } else {
          finalProfile.shop.current_tier = 'enterprise';
        }
      }

      setProfile(finalProfile);
    } catch (err: any) {
      setError(err instanceof Error ? err : new Error(err?.message || 'An unknown error occurred while fetching user profile.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserProfileAndShop();

    // Set up real-time session monitoring to automatically reload on auth state updates
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        fetchUserProfileAndShop();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUserProfileAndShop]);

  return {
    profile,
    loading,
    error,
    refetch: fetchUserProfileAndShop,
  };
}
