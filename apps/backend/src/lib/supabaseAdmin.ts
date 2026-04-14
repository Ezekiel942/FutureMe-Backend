import { createClient } from '@supabase/supabase-js';
import logger from '../utils/logger';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const createSupabaseAdminClient = (): any => {
  if (!supabaseUrl || !serviceRoleKey) {
    logger.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for supabaseAdmin');
    return new Proxy(
      {},
      {
        get: () => {
          return () => {
            throw new Error(
              'SUPABASE_SERVICE_ROLE_KEY is required to initialize supabaseAdmin. Please set SUPABASE_SERVICE_ROLE_KEY in your environment.'
            );
          };
        },
      }
    );
  }

  return createClient(supabaseUrl, serviceRoleKey);
};

export const supabaseAdmin = createSupabaseAdminClient();
