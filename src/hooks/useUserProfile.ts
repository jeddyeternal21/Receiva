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

      // 2. Fetch the corresponding profile and join with the shop details
      const { data: profileData, error: profileError } = await supabase
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

      if (profileError) throw profileError;

      setProfile(profileData as unknown as ProfileWithShop);
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
