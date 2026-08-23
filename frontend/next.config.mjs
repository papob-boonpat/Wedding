/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: false,
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "localhost", "127.0.0.1"],
  },
  async rewrites() {
    // Helpful for local development proxying to backend on port 5000
    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3100";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: "/socket.io/:path*",
        destination: `${backendUrl}/socket.io/:path*`,
      },
    ];
  },
};

export default nextConfig;
