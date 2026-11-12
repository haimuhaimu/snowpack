# Snowpack personal sync backend

This directory is an independent Vercel Node Function project. The GitHub Pages frontend remains in `../docs`. The service owns one personal namespace in one **private** Vercel Blob store. It exposes no listing, deletion, direct-upload token, or public-asset endpoint.

## Deployment setup

1. Run `npm run prepare:server` from the repository root before deploying this directory. It copies the canonical validation modules from `docs/` into `shared/` and removes browser cache query strings from module imports so Vercel can trace them into the function bundle.
2. Install with `npm ci`. The storage SDK is pinned to `@vercel/blob` 2.9.0 and the Vercel runtime is Node 22.
3. Connect a private Blob store to the deployment environment. Current Vercel connections provide `BLOB_STORE_ID` and managed `VERCEL_OIDC_TOKEN`; the SDK uses those automatically. A manually managed `BLOB_READ_WRITE_TOKEN` is only an alternative for environments without OIDC. Never put storage credentials into the frontend.
4. Generate a random 32-byte base64url value and prefix it with `SNOW1-`. Set `SNOWPACK_TOKEN_HASH` to the 64-character lowercase hex SHA-256 of that **complete** code, prefix included. Keep the original code outside the repository and give it only to the owner. The server stores only the hash.
5. Set `NODEJS_HELPERS=0` in each Vercel environment **before building/deploying**. The default Node helpers pre-read the request stream; disabling them preserves this handler's bounded raw-body processing. Next.js `api.bodyParser:false` does not configure a standalone Vercel Node function.
6. Deploy with this directory as the Vercel root. Do not use static output mode. Copy the resulting HTTPS API URL into the frontend configuration. The server does not require cookies.

Allowed browser origins are `https://haimuhaimu.github.io`, `http://127.0.0.1:8081`, and `http://localhost:8081` (the last two support local verification). No wildcard or credentialed CORS is enabled. Requests without an Origin header still require the access code. Adjust the explicit allowlist in `lib/handler.mjs` if local verification is no longer wanted.

## Protocol

Every non-preflight request requires `Authorization: Bearer SNOW1-<43 base64url characters>`. All responses use `Cache-Control: private, no-store`. Errors contain only a stable `error` code; request bodies, credentials, and provider exception details are never logged by the handler.

| Request | Input | Result |
| --- | --- | --- |
| `GET /api/sync?kind=state` | None | `{revision: string|null, snapshot: object|null}`; both values are null for an empty store. |
| `PUT /api/sync?kind=state` | JSON `{snapshot}`; `If-None-Match: *` for first creation, otherwise exact `If-Match` from the last revision | `{revision}`; HTTP 409 if another write won. Missing condition is 428. |
| `GET /api/sync?kind=asset&hash=<sha256>` | 64 lowercase hex characters | The original data URL as `text/plain`; 404 when missing. |
| `PUT /api/sync?kind=asset&hash=<sha256>` | `text/plain` data URL | `{hash}`. Writes are immutable. Repeated uploads succeed only after the existing content is verified. |

Revisions are opaque quoted ETags; preserve the quotes. State reads and asset verification use private Blob `get(..., {useCache:false})`. Updates use Blob `ifMatch`, never a separate read-then-unconditional-write. First creation uses `allowOverwrite:false` atomically. An uncertain create response is reconciled by reading the resulting object; an existing state yields 409 so the client can fetch it.

State requests are limited to **2,000,000 UTF-8 bytes**, including the JSON envelope. Metadata must pass the shared v1 snapshot validator: photos are `asset:<sha256>` references, and embedded photos are rejected. Assets are limited to **1,500,000 ASCII characters/bytes** and must be canonical base64 PNG, JPEG, or WebP data URLs. The hash covers the exact UTF-8 data URL string, including its media type and prefix. Reads are bounded too. These checks validate the representation and hash; they do not decode or re-encode image pixels.

Storage paths are `snowpack/v1/state.json` and `snowpack/v1/assets/<hash>.txt`. Replaced or removed photos remain as immutable blobs; this initial version has no automatic garbage collection. Do not describe this service as end-to-end encryption: transport is HTTPS and storage is private, but the server can process the content.

## Verification

Run `npm test` from the repository root. Backend tests inject only the external storage boundary and use the real shared snapshot validator. They cover authorization before storage access, CORS, raw body limits, malformed content, immutable uploads, corruption, conditional state updates, and error redaction. Deployment verification must additionally prove the real private store's read/write and stale-version behavior; passing unit tests alone does not establish that the deployed environment is configured correctly.

SDK and runtime references: [Blob JavaScript SDK](https://vercel.com/docs/vercel-blob/using-blob-sdk), [private Blob storage](https://vercel.com/docs/vercel-blob/private-storage), [Node.js runtime](https://vercel.com/docs/functions/runtimes/node-js).
