import { writeFileSync } from 'node:fs';

const url = process.env.SUPABASE_URL?.trim();
const key = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();

if (!url || !key) {
  console.error(
    'Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY in the github-pages environment (variables or secrets).',
  );
  process.exit(1);
}

const chatAiEndpoint =
  process.env.CHAT_AI_ENDPOINT?.trim() || `${url.replace(/\/$/, '')}/functions/v1/match-categories`;

const contents = `export const environment = {
  supabaseUrl: ${JSON.stringify(url)},
  supabasePublishableKey: ${JSON.stringify(key)},
  chatAiEndpoint: ${JSON.stringify(chatAiEndpoint)},
};
`;

writeFileSync('src/environments/environment.ts', contents);
console.log('Created src/environments/environment.ts for CI build.');
