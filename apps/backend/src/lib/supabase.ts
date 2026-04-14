import { createClient } from '@supabase/supabase-js';
import logger from '../utils/logger';

let supabaseInstance: any = null;
let initAttempted = false;

const initializeSupabase = () => {
  if (initAttempted) {
    return supabaseInstance;
  }

  initAttempted = true;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    logger.warn('SUPABASE_URL or SUPABASE_ANON_KEY not set; database operations will fail', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey,
    });
    return null;
  }

  try {
    supabaseInstance = createClient(supabaseUrl, supabaseKey);
    logger.debug('Supabase client initialized');
    return supabaseInstance;
  } catch (error) {
    logger.error('Failed to initialize Supabase client', { error: (error as Error).message });
    return null;
  }
};

export const supabase = new Proxy(
  {},
  {
    get: (target, prop) => {
      const client = initializeSupabase();
      if (!client) {
        return () => {
          throw new Error(
            'Supabase client not initialized; SUPABASE_URL and SUPABASE_ANON_KEY are required'
          );
        };
      }
      return (client as any)[prop];
    },
  }
) as any;
