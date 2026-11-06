// Where /api/v1/* is forwarded. Read at BUILD time: on Vercel it must be set before deploying,
// otherwise the rewrite would point at localhost and every API call would fail.
const API_URL = process.env.API_URL ?? (process.env.VERCEL ? null : "http://localhost:4000");
if (!API_URL) {
  throw new Error("API_URL is not set. Add it in Vercel → Settings → Environment Variables (your Render URL, e.g. https://jobtrack-api.onrender.com), then redeploy.");
}
if (process.env.VERCEL && /localhost|127\.0\.0\.1/.test(API_URL)) {
  throw new Error(`API_URL points at ${API_URL}; on Vercel it must be your public Render URL.`);
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  cacheComponents: true,
  // Dev-only "N" badge: the default bottom-left spot covers the sidebar's Settings link.
  devIndicators: { position: "bottom-right" },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // The browser calls /api/v1/* on the Next.js origin; Next proxies it to Express.
  // Same origin means the Auth.js session cookie reaches the API with no CORS setup.
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${API_URL.replace(/\/+$/, "")}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
