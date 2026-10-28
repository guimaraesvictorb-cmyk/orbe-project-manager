# Kommo activation

The previous form only saved configuration. Version 1.17 adds a private-integration authorization path, webhook registration, durable message ingestion, contact enrichment, tracking redirects and verification from Orbe OS.

## Account authorization

An owner of an active client setup opens its Kommo account, creates a private integration with **Account data access** only, and generates a long-lived token. The private-integration scope grants CRM access, not a read-only permission. Our backend only reads account/contact/webhook metadata and registers its own `add_message` webhook; it never sends messages, changes leads, replaces the WhatsApp provider or fetches conversation history. Other installed hooks are preserved. The initial authorization screen explains collection of new WhatsApp messages and contact lookup. Never paste the token into chat, notes or logs.

`KOMMO_ENCRYPTION_KEY` is a 32-byte hex secret configured only on the production server. AES-256-GCM binds credentials to the client ID. The credential table has RLS and no privileges for anon/authenticated. The application validates Supabase Auth plus the setup owner before making any Kommo request. Only exact HTTPS `*.kommo.com` account origins are allowed; redirects are refused. Account-to-client binding and destination remain immutable on reconnect.

The webhook callback has a random 256-bit capability token. Only its hash is used to authorize ingestion; the recoverable token is encrypted for reconnect and subscription verification. CRM webhooks do not have a documented HMAC; this does not provide body-signature integrity. Keep callback URLs private, including in hosting request logs. There are no application logs of tokens, callback URLs or message bodies.

## Data and attribution

The receiver accepts bounded form-encoded incoming WhatsApp events, requires the fixed account ID and subdomain, and ignores other messenger origins, internal authors and outgoing messages. The account-level connection includes its WhatsApp channels; the configured phone is the destination for generated links, not proof of which account phone handled every incoming event. The first real payload must verify its origin vocabulary and account binding.

Normalized message text, original IDs and timestamps commit before responding. Retries deduplicate atomically; no transcript/media blobs are retained. Names and telephone come from the CRM contact after persistence using Vercel `waitUntil`. Multiple/absent telephone values remain unconfirmed. Contact lookup failure does not lose the message; the connection verification action retries up to ten pending identities. This enrichment is not a background durable queue; a prolonged CRM outage needs the verification action to finish missing identities.

New per-client redirects store five UTMs and optional GCLID/FBCLID, then insert the tested V2 invisible reference. Matching is per connection, within 30 days, before the message timestamp, and cannot reuse a click across contacts. Each message keeps its own attribution; contacts keep the first identified origin. Duplicate messages cannot mutate another click. Unmatched messages remain unidentified. Existing lead tags or CRM UTMs are not invented as message-level attribution. Direct Click-to-WhatsApp referral enrichment and conversion uploads are separate work.

Statuses distinguish configuration saved, authorization in progress, waiting for a message, and receiving messages. An installed webhook is not an end-to-end validation. Silence on an event-driven channel is not a disconnected WhatsApp.

## Deployment and rollback

Apply `supabase/changes/20261028_kommo_activation.sql`, configure the encryption key, then push the reviewed commit to main. `tests/kommo-database.sql` verifies isolation, deduplication, reference association and account checks within a rolled-back transaction. `npm run test:tracking`, targeted ESLint and the production build are the local checks.

To stop collection, disable the specific Kommo webhook and its ORBE connection/config; preserve all records and credentials until the operator chooses a recovery path. Reverting UI code alone does not revoke an external subscription. Never delete or alter other integrations or the existing pilot's timer/Sheets workflow.

## Official references

- https://developers.kommo.com/docs/private-integration
- https://developers.kommo.com/docs/long-lived-token
- https://developers.kommo.com/docs/webhooks-general
- https://developers.kommo.com/reference/add-webhooks
- https://developers.kommo.com/reference/list-webhooks
- https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package
