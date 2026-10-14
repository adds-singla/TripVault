const dev = process.env.NODE_ENV === "development";
/** Static export for S3 + CloudFront. In dev only, proxy /api to the local backend. */
export default {
  ...(dev ? {} : { output: "export", trailingSlash: true }),
  images: { unoptimized: true },
  ...(dev ? { async rewrites() { return [{ source: "/api/:path*", destination: "http://localhost:8000/api/:path*" }]; } } : {}),
};
