/** @type {import('next').NextConfig} */
const nextConfig = {
  rewrites: async () => {
    return [
      // Handle auth routes with Next.js
      {
        source: "/api/auth/:path*",
        destination: "/api/auth/:path*",
      },
      // Forward all other API routes to Python backend
      {
        source: "/api/:path*",
        destination:
          process.env.NODE_ENV === "development"
            ? "http://127.0.0.1:3001/api/:path*"
            : "/api/:path*",
        has: [
          {
            type: "header",
            key: "accept",
            value: "(?!.*auth.*)",
          },
        ],
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Authorization",
            value: "{authorization}",
          },
          {
            key: "Accept",
            value: "{accept}",
          },
          {
            key: "Content-Type",
            value: "{content-type}",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
