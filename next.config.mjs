/** @type {import('next').NextConfig} */
const nextConfig = {
  // "standalone" bundles a minimal server into .next/standalone —
  // this is what the Docker image will run in Stage 3.
  output: "standalone",
};

export default nextConfig;
