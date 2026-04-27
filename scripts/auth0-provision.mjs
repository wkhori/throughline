#!/usr/bin/env node
// Auth0 provisioning — patch P34. One-shot, idempotent setup of:
//   1. Permission scopes (IC, MANAGER, ADMIN) on the Throughline API.
//   2. Post-login Action that injects `permissions: [role]` into the access
//      token from `app_metadata.role`. Deployed + bound to the post-login flow.
//   3. Three demo users (ic / manager / admin) with `app_metadata.role` set.
//
// Reads M2M creds from .env.local. Run with `node scripts/auth0-provision.mjs`.
// Re-runnable: every step checks before mutating, so a second run is a no-op.

import { readFileSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const ENV_PATH = new URL('../.env.local', import.meta.url);

// --- env loader -----------------------------------------------------------
const envText = readFileSync(ENV_PATH, 'utf8');
const env = Object.fromEntries(
  envText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const eq = line.indexOf('=');
      return eq === -1 ? [line, ''] : [line.slice(0, eq).trim(), line.slice(eq + 1).trim()];
    }),
);

const required = ['VITE_AUTH0_DOMAIN', 'AUTH0_AUDIENCE', 'AUTH0_M2M_CLIENT_ID', 'AUTH0_M2M_CLIENT_SECRET'];
for (const k of required) {
  if (!env[k]) throw new Error(`.env.local is missing ${k}`);
}

const DOMAIN = env.VITE_AUTH0_DOMAIN;
const AUDIENCE = env.AUTH0_AUDIENCE;
const M2M_ID = env.AUTH0_M2M_CLIENT_ID;
const M2M_SECRET = env.AUTH0_M2M_CLIENT_SECRET;

// Demo users — emails MUST match what DemoSeeder.java seeds.
const USERS = [
  { email: 'ic@demo.throughline.app', role: 'IC', displayName: 'Demo IC' },
  { email: 'manager@demo.throughline.app', role: 'MANAGER', displayName: 'Demo Manager' },
  { email: 'admin@demo.throughline.app', role: 'ADMIN', displayName: 'Demo Admin' },
];

const SCOPES = [
  { value: 'IC', description: 'Individual contributor' },
  { value: 'MANAGER', description: 'People manager' },
  { value: 'ADMIN', description: 'Org admin' },
];

const ACTION_NAME = 'Throughline — inject permissions into access token';
const ACTION_CODE = `exports.onExecutePostLogin = async (event, api) => {
  const role = (event.user.app_metadata && event.user.app_metadata.role) || 'IC';
  api.accessToken.setCustomClaim('permissions', [role]);
  api.accessToken.setCustomClaim('https://api.throughline.app/email', event.user.email);
  api.accessToken.setCustomClaim('https://api.throughline.app/name', event.user.name || event.user.email);
};`;

// --- HTTP helpers ---------------------------------------------------------
const baseUrl = `https://${DOMAIN}/api/v2`;
let mgmtToken = null;

async function getMgmtToken() {
  if (mgmtToken) return mgmtToken;
  const res = await fetch(`https://${DOMAIN}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: M2M_ID,
      client_secret: M2M_SECRET,
      audience: `https://${DOMAIN}/api/v2/`,
      grant_type: 'client_credentials',
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to get Management API token: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  mgmtToken = json.access_token;
  return mgmtToken;
}

async function api(path, init = {}) {
  const token = await getMgmtToken();
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!res.ok && res.status !== 409) {
    throw new Error(`${init.method || 'GET'} ${path} → ${res.status} ${await res.text()}`);
  }
  if (res.status === 204) return null;
  if (res.headers.get('content-type')?.includes('application/json')) return res.json();
  return res.text();
}

// Generate a strong default password if not set in env.
function resolveDemoPassword() {
  if (env.DEMO_USERS_PASSWORD) return env.DEMO_USERS_PASSWORD;
  const generated = `Throughline!Demo${Math.floor(Math.random() * 9000) + 1000}`;
  console.log(`(generated demo password — will be persisted to .env.local)`);
  return generated;
}

function persistEnv(updates) {
  let next = envText;
  for (const [key, value] of Object.entries(updates)) {
    const re = new RegExp(`^${key}=.*$`, 'm');
    if (re.test(next)) {
      next = next.replace(re, `${key}=${value}`);
    } else {
      next += (next.endsWith('\n') ? '' : '\n') + `${key}=${value}\n`;
    }
  }
  writeFileSync(ENV_PATH, next);
}

// --- step 1: API + scopes -------------------------------------------------
async function ensureApiScopes() {
  console.log('1. Ensuring permission scopes on Throughline API…');
  const apis = await api(`/resource-servers?identifiers=${encodeURIComponent(AUDIENCE)}`);
  if (!apis?.length) {
    throw new Error(
      `No API with identifier ${AUDIENCE} — create it in the Auth0 dashboard first.`,
    );
  }
  const apiObj = apis[0];
  const existing = new Set((apiObj.scopes || []).map((s) => s.value));
  const merged = [
    ...(apiObj.scopes || []),
    ...SCOPES.filter((s) => !existing.has(s.value)),
  ];
  if (merged.length === (apiObj.scopes || []).length) {
    console.log('   ✓ All scopes already present, no patch needed.');
    return apiObj;
  }
  await api(`/resource-servers/${apiObj.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ scopes: merged }),
  });
  console.log(`   ✓ Patched API; scopes now: ${merged.map((s) => s.value).join(', ')}`);
  return apiObj;
}

// --- step 2: post-login Action --------------------------------------------
async function ensurePostLoginAction() {
  console.log('2. Ensuring post-login Action…');
  const list = await api(`/actions/actions?triggerId=post-login&actionName=${encodeURIComponent(ACTION_NAME)}`);
  let action = list?.actions?.find((a) => a.name === ACTION_NAME);

  if (!action) {
    console.log('   creating new Action…');
    action = await api('/actions/actions', {
      method: 'POST',
      body: JSON.stringify({
        name: ACTION_NAME,
        supported_triggers: [{ id: 'post-login', version: 'v3' }],
        code: ACTION_CODE,
        runtime: 'node22',
      }),
    });
  } else if (action.code !== ACTION_CODE) {
    console.log('   updating existing Action body…');
    action = await api(`/actions/actions/${action.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ code: ACTION_CODE }),
    });
  }

  // Deploy the latest version.
  let attempt = 0;
  while (attempt++ < 5) {
    try {
      await api(`/actions/actions/${action.id}/deploy`, { method: 'POST' });
      break;
    } catch (err) {
      if (attempt === 5) throw err;
      await sleep(1500);
    }
  }
  console.log(`   ✓ Action deployed (id ${action.id})`);

  // Bind to the post-login flow.
  const flow = await api('/actions/triggers/post-login/bindings');
  const already = (flow?.bindings || []).some(
    (b) => b.action?.id === action.id || b.display_name === ACTION_NAME,
  );
  if (already) {
    console.log('   ✓ Action already bound to post-login flow.');
  } else {
    const bindings = [
      ...(flow?.bindings || []).map((b) => ({
        ref: { type: 'action_id', value: b.action.id },
        display_name: b.display_name,
      })),
      { ref: { type: 'action_id', value: action.id }, display_name: ACTION_NAME },
    ];
    await api('/actions/triggers/post-login/bindings', {
      method: 'PATCH',
      body: JSON.stringify({ bindings }),
    });
    console.log('   ✓ Bound Action to post-login flow.');
  }
  return action;
}

// --- step 3: demo users ---------------------------------------------------
async function ensureDemoUsers(password) {
  console.log('3. Ensuring demo users…');
  const subs = {};
  for (const u of USERS) {
    const existing = await api(`/users-by-email?email=${encodeURIComponent(u.email)}`);
    let userObj = existing?.[0];
    if (!userObj) {
      console.log(`   creating ${u.email}…`);
      userObj = await api('/users', {
        method: 'POST',
        body: JSON.stringify({
          email: u.email,
          password,
          name: u.displayName,
          email_verified: true,
          connection: 'Username-Password-Authentication',
          app_metadata: { role: u.role },
        }),
      });
    } else if (userObj.app_metadata?.role !== u.role) {
      console.log(`   updating ${u.email} role → ${u.role}…`);
      await api(`/users/${encodeURIComponent(userObj.user_id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ app_metadata: { role: u.role } }),
      });
    } else {
      console.log(`   ✓ ${u.email} already provisioned (${u.role}).`);
    }
    subs[u.role] = userObj.user_id;
  }
  return subs;
}

// --- main -----------------------------------------------------------------
const password = resolveDemoPassword();

await ensureApiScopes();
await ensurePostLoginAction();
const subs = await ensureDemoUsers(password);

persistEnv({
  DEMO_USERS_PASSWORD: password,
  AUTH0_SUB_IC: subs.IC,
  AUTH0_SUB_MANAGER: subs.MANAGER,
  AUTH0_SUB_ADMIN: subs.ADMIN,
});

console.log('\n──────────────────────────────────────────────────────────────────');
console.log('Auth0 provisioning complete.');
console.log('──────────────────────────────────────────────────────────────────');
console.log('Demo password (also written to .env.local as DEMO_USERS_PASSWORD):');
console.log(`  ${password}`);
console.log('\nauth0_sub values (also written to .env.local):');
for (const [role, sub] of Object.entries(subs)) {
  console.log(`  ${role.padEnd(8)} ${sub}`);
}
console.log('\nNext step: agent updates DemoSeeder.java to use these auth0_sub values');
console.log('so real Auth0 logins resolve to the seeded user rows.');
