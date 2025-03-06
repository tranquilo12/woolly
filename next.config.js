/** @type {import('next').NextConfig} */
const nextConfig = {
  rewrites: async () => {
    // Get the API URL from environment variable or use a default for development
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL
      ? process.env.NEXT_PUBLIC_API_URL.replace("/api", "")
      : "http://backend:3001";

    return [
      {
        source: "/api/:path*",
        destination:
          process.env.NODE_ENV === "development"
            ? `${apiBaseUrl}/api/:path*`
            : "/api/",
      },
      {
        source: "/docs",
        destination:
          process.env.NODE_ENV === "development"
            ? `${apiBaseUrl}/docs`
            : "/api/docs",
      },
      {
        source: "/openapi.json",
        destination:
          process.env.NODE_ENV === "development"
            ? `${apiBaseUrl}/openapi.json`
            : "/api/openapi.json",
      },
    ];
  },
};

module.exports = nextConfig;
