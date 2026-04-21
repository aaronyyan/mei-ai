import type { NextConfig } from 'next';

export default function nextConfig(): NextConfig {
  return {
    distDir: process.env.NEXT_DIST_DIR || '.next',
    experimental: {
      reactCompiler: false,
    },
  };
}
