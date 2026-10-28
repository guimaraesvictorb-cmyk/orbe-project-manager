# WhatsApp tracking in Orbe OS

Rastreamento now opens a client hub, the general UTM generator, and a private ORBE
pilot. Client details include the same tracking tab. Each connected number has
its own messages, contacts, clicks, saved greeting links and five UTM fields. GCLID and FBCLID are captured when present on incoming
tracking URLs and remain outside the WhatsApp greeting. They are not generated
or inferred. Landing-page buttons must forward these parameters; historical
clicks without stored IDs cannot be backfilled. No conversion API is activated.

The pilot source is the existing tracker SQLite outbox on the ORBE VPS. A new
read-only bridge independently mirrors it to the server-only Vercel endpoint
`/api/whatsapp-sync`. The Sheets consumer and its acknowledgements are unchanged.
The bridge runs every 30 seconds. The UI refreshes every 30 seconds while visible.

## Security and consistency

- Supabase tables use RLS. Only the connection owner and explicit members can read
  tracking data. Existing financial and client policies are unchanged.
- Vercel requires server-only `SUPABASE_SERVICE_ROLE_KEY`; never prefix it VITE_.
- The VPS holds a connection-scoped ingestion token, not the Supabase service key.
  Only its SHA-256 hash is in the inaccessible ingestion-key table.
- The receiver fixes the connection from this token and checks instance,
  destination, field types and pilot sender allowlist. Public requests cannot
  choose a different connection or write arbitrary fields.
- Outbox ID is the monotonic revision. Retrying a delivery cannot duplicate a
  record or overwrite a newer revision. The checkpoint advances only after ack.
- Bridge data requests do not follow redirects. Credentials and message bodies
  are not logged. Private files must be owner-only 0600.
- Source without evidence remains unidentified. A click is not a received lead.
  Invisible markers are editable text and are not guaranteed across all clients.

## Provisioning / current boundary

The live pilot is the existing Evolution number and authorized sender only.
Client setup forms store the preferred method (QR, Kommo, other official API),
CRM, destination and notes. Saving does not provision a number, generate a QR,
authorize an external CRM, activate a webhook or start collecting client data.
Those steps must be performed and verified for each client before creating an
enabled `wa_tracking_connections` row and its scoped key. Never point a new
client at the pilot redirect URL or expand the pilot sender allowlist.

Client plans: Rayafit/Kommo; Evidence B2B/Bitrix; Evidence ecommerce/VTEX;
LK and Octagon/individual Sheets; SLR/RD Station with traffic inactive.
VTEX and Sheets are separate from the WhatsApp connection. These external client
integrations and new client spreadsheets have not been activated by this rollout.

## Deployment and rollback

SQL change records in `supabase/changes` are additive and applied explicitly in
the authenticated dashboard, not through a generic migrations runner. Deploy
the versioned application through the existing GitHub main → Vercel flow.

VPS files: `operations/orbe_os_sync.py`, `/etc/systemd/system/orbe-os-sync.service`,
`/etc/systemd/system/orbe-os-sync.timer`. Private configuration is
`private/orbe-os-integration.json` with connection_id, endpoint, token, instance,
destination. No credential belongs in Git or the browser.

Rollback: disable only `orbe-os-sync.timer` and restore the preceding Vercel
deployment. Keep additive tables and SQLite intact. Revoking the scoped key stops
this bridge without changing Evolution, Sheets, n8n or other VPS workloads.

Validation: `npm run test:tracking`, `python3 -m unittest discover -s tests -p
'test_*.py'`, targeted ESLint and `npm run build`. Verify live owner access,
outsider isolation, ingestion grants, replay idempotency and older revision
protection in a transaction ending with ROLLBACK. Then check the real pilot
message and live timer updates through the production UI.
