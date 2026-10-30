# QR connection in Studio

The owner saves a QR setup, clicks Generate QR, and scans it using WhatsApp Linked devices. The server verifies the registered destination before enabling inbound capture. A scoped VPS worker polls the control plane outbound; the Evolution management API stays private. The worker only has its own instance key, never the global API key or Supabase service key.

Control plane: `/api/whatsapp-qr`, authenticated owner or hashed per-connection worker token. QR is encrypted with the existing server encryption key, expires after three minutes, and never appears in logs or a public bucket. Heartbeat expires after 45 seconds. Duplicate clicks share one pending request. Old worker replies cannot replace a newer request.

Messages: direct inbound only, no history/groups/outgoing, PN alternate required for LID. Worker filters pilot senders before private SQLite outbox storage; retries only delete outbox rows after cloud acknowledgement. The cloud binds every event to the worker connection and deduplicates message IDs. Reference matching is restricted to that connection and a preceding click within 30 days. Leads use the existing contact aggregation function.

LK test: destination 5511988878736, sender allowlist 5511996073333, connection c9503338-e251-42ee-8dfa-c0378fab7410. Pilot ORBE and Rayafit Kommo are separate. Do not broaden capture or pair a different number without authorization.

VPS: `/opt/orbe/whatsapp/operations/compose.qr-lk.yml`, separate project `orbe-qr-lk`, no host ports. Config `/opt/orbe/whatsapp/private/qr-lk/config.json` mode 0600, outbox under `data/qr-lk`. `qr_prepare.py` uses the existing global key locally only to provision the named instance, with history/read receipts disabled. It never requests a QR. Rollback: stop only the `orbe-qr-lk` compose project, disable its ingest key and connection; preserve the data for recovery. Do not stop the other ORBE containers.

Checks: `npm run test:tracking`, Python `tests/qr-worker.test.py`, targeted ESLint, production build, rolled-back database receive/deduplication/privilege test, then real QR generation in Studio. Pairing and a real inbound test are required before calling the whole flow validated. Sheets delivery remains a separate integration.
