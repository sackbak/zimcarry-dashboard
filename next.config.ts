import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // 크레탑·DART 등에서 받은 엑셀이 종종 수 MB. 기본 1MB 너무 작음.
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
