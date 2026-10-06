import type { NextConfig } from "next";
import os from "os";

// Dynamically detect all local network IPs so mobile devices can access
// Next.js dev resources (JS chunks, HMR websocket) via LAN IP without 403.
function getLocalIps(): string[] {
  const ips: string[] = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

const localIps = getLocalIps();

const nextConfig: NextConfig = {
  // Allow mobile devices and LAN clients to load Next.js dev resources without 403 Forbidden
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    '*.local',
    ...localIps,
    '10.129.87.66',
    // Standard RFC 1918 private network wildcard patterns
    '10.*.*.*',
    '192.168.*.*',
    '172.16.*.*',
    '172.17.*.*',
    '172.18.*.*',
    '172.19.*.*',
    '172.20.*.*',
    '172.21.*.*',
    '172.22.*.*',
    '172.23.*.*',
    '172.24.*.*',
    '172.25.*.*',
    '172.26.*.*',
    '172.27.*.*',
    '172.28.*.*',
    '172.29.*.*',
    '172.30.*.*',
    '172.31.*.*',
    // Public tunnel providers for cellular mobile network testing
    '*.trycloudflare.com',
    '*.loca.lt',
    '*.ngrok-free.app',
    '*.ngrok.io',
    '*.pinggy.link',
    '*.serveo.net',
  ],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:5000/api/:path*',
      },
    ];
  },
};

export default nextConfig;
