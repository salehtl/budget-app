export default {
  async fetch(request: Request): Promise<Response> {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    // Only allow POST
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders() });
    }

    // Forward to Anthropic API
    const url = new URL(request.url);
    const targetPath = url.pathname.replace(/^\//, "");
    const targetUrl = `https://api.anthropic.com/${targetPath}`;

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": request.headers.get("Content-Type") || "application/json",
        "x-api-key": request.headers.get("x-api-key") || "",
        "anthropic-version": request.headers.get("anthropic-version") || "2023-06-01",
      },
      body: request.body,
    });

    return new Response(response.body, {
      status: response.status,
      headers: {
        ...Object.fromEntries(response.headers.entries()),
        ...corsHeaders(),
      },
    });
  },
};

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-api-key, anthropic-version",
    "Cross-Origin-Resource-Policy": "cross-origin",
  };
}
