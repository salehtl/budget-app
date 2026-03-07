// Cloudflare Pages Function: proxies /api/anthropic/* to Anthropic's API.
// Mirrors the Vite dev server plugin for production use.
// Required because COEP (require-corp) blocks direct browser→Anthropic calls.

interface Env {}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-api-key, anthropic-version",
      "Access-Control-Max-Age": "86400",
      "Cross-Origin-Resource-Policy": "cross-origin",
    },
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { params, request } = context;
  const pathSegments = params.path as string[];
  const targetPath = "/" + pathSegments.join("/");
  const targetUrl = `https://api.anthropic.com${targetPath}`;

  const headers: Record<string, string> = {
    "Content-Type": request.headers.get("content-type") || "application/json",
  };

  const apiKey = request.headers.get("x-api-key");
  if (apiKey) headers["x-api-key"] = apiKey;

  const version = request.headers.get("anthropic-version");
  if (version) headers["anthropic-version"] = version;

  try {
    const upstream = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: request.body,
    });

    const responseHeaders = new Headers({
      "Content-Type": upstream.headers.get("content-type") || "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cross-Origin-Resource-Policy": "cross-origin",
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return new Response(
      JSON.stringify({
        error: {
          type: "proxy_error",
          message: "Failed to connect to upstream API.",
        },
      }),
      {
        status: 502,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cross-Origin-Resource-Policy": "cross-origin",
        },
      },
    );
  }
};
