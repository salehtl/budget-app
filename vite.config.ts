import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

function anthropicProxyPlugin(): PluginOption {
  return {
    name: "anthropic-proxy",
    configureServer(server) {
      // Must run before Vite's internal middleware (including proxy)
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/api/anthropic")) return next();

        // Handle CORS preflight locally — never forward OPTIONS to Anthropic
        if (req.method === "OPTIONS") {
          res.writeHead(204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers":
              "Content-Type, x-api-key, anthropic-version",
            "Access-Control-Max-Age": "86400",
            "Cross-Origin-Resource-Policy": "cross-origin",
          });
          res.end();
          return;
        }

        // Forward POST (and other methods) to Anthropic as server-to-server
        const targetPath = req.url.replace(/^\/api\/anthropic/, "");
        const targetUrl = `https://api.anthropic.com${targetPath}`;

        // Collect request body
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", async () => {
          try {
            const body = Buffer.concat(chunks);

            // Forward only the headers Anthropic needs (strip browser headers)
            const headers: Record<string, string> = {
              "Content-Type": req.headers["content-type"] || "application/json",
            };
            if (req.headers["x-api-key"]) headers["x-api-key"] = req.headers["x-api-key"] as string;
            if (req.headers["anthropic-version"]) headers["anthropic-version"] = req.headers["anthropic-version"] as string;

            const upstream = await fetch(targetUrl, {
              method: req.method || "POST",
              headers,
              body,
            });

            // Relay status + body back to browser with CORS headers
            const responseBody = await upstream.arrayBuffer();
            res.writeHead(upstream.status, {
              "Content-Type": upstream.headers.get("content-type") || "application/json",
              "Access-Control-Allow-Origin": "*",
              "Cross-Origin-Resource-Policy": "cross-origin",
            });
            res.end(Buffer.from(responseBody));
          } catch (e: any) {
            res.writeHead(502, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Cross-Origin-Resource-Policy": "cross-origin",
            });
            res.end(JSON.stringify({ error: { type: "proxy_error", message: "Failed to connect to upstream API." } }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [
    anthropicProxyPlugin(),
    TanStackRouterVite({
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
    }),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["fonts/*.woff2", "meta-media/*"],
      manifest: {
        name: "Cactus Money",
        short_name: "Cactus",
        description: "Personal finance tracker - track spending, plan budgets, stay sharp.",
        theme_color: "#2D1CD1",
        background_color: "#ffffff",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "meta-media/manifest-icon-192.jpg",
            sizes: "192x192",
            type: "image/jpeg",
          },
          {
            src: "meta-media/manifest-icon-512.jpg",
            sizes: "512x512",
            type: "image/jpeg",
          },
          {
            src: "meta-media/manifest-icon-512.jpg",
            sizes: "512x512",
            type: "image/jpeg",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,woff2,wasm,png,svg}"],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  worker: {
    format: "es",
  },
  optimizeDeps: {
    exclude: ["wa-sqlite"],
  },
});
