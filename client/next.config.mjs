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
        destination: `${process.env.API_URL ?? "http://localhost:4000"}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
