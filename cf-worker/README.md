# Anthropic API Proxy (Cloudflare Worker)

Required in production because the app uses COEP `require-corp` headers, which block direct cross-origin API calls.

## Deploy

```bash
cd cf-worker
npx wrangler deploy
```

## Usage

After deploying, set the Worker URL (e.g. `https://budget-app-anthropic-proxy.<your-account>.workers.dev`) as the **Proxy URL** in the app's Settings page.

During local development, the Vite dev server proxies `/api/anthropic` automatically — no Worker needed.
