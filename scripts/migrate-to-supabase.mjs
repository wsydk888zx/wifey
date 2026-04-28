#!/usr/bin/env node
/**
 * migrate-to-supabase.mjs
 * Creates the story_content table in Supabase and seeds it with the current story data.
 * Usage: SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/migrate-to-supabase.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { storyContent } from '../packages/story-content/src/storyData.js';

const SUPABASE_URL = 'https://bxeoleynlmnhagveqrmn.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY env var is required.');
  console.error('Usage: SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/migrate-to-supabase.mjs');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function runSQL(sql) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql }),
  });
  return res;
}

async function main() {
  console.log('Creating story_content table...');

  // Use Supabase's postgres endpoint via the management API
  const ddlRes = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });

  // Create table via pg RPC if available, otherwise seed directly
  // First try inserting — if table doesn't exist we'll get an error and need manual SQL
  const { error: checkError } = await supabase
    .from('story_content')
    .select('id')
    .limit(1);

  if (checkError && checkError.code === 'PGRST205') {
    console.log('\nTable does not exist. Please run this SQL in the Supabase SQL editor:');
    console.log('─'.repeat(60));
    console.log(`
CREATE TABLE IF NOT EXISTS public.story_content (
  id text PRIMARY KEY,
  content jsonb NOT NULL,
  flow_map jsonb NOT NULL DEFAULT '{"rules": []}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.story_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read" ON public.story_content
  FOR SELECT USING (true);

CREATE POLICY "public_write" ON public.story_content
  FOR ALL USING (true) WITH CHECK (true);
    `.trim());
    console.log('─'.repeat(60));
    console.log('\nThen re-run this script to seed the data.');
    process.exit(0);
  }

  if (checkError) {
    console.error('Unexpected error checking table:', checkError);
    process.exit(1);
  }

  console.log('Table exists. Seeding story content...');

  const { error: upsertError } = await supabase
    .from('story_content')
    .upsert(
      {
        id: 'main',
        content: storyContent,
        flow_map: storyContent.defaultFlowMap || { rules: [] },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );

  if (upsertError) {
    console.error('Seed failed:', upsertError);
    process.exit(1);
  }

  console.log('✓ Story content seeded to Supabase story_content table (id: main).');
}

main();
