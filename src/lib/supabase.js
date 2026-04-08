import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kisnqqbursalvibyfbbe.supabase.co';
const SUPABASE_KEY = 'sb_publishable_CvHgy1mXH3-OivEQtH2u6w_iS54S9Gc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Single row id — the entire app state is one JSON blob
export const SYNC_ROW_ID = 'main';
