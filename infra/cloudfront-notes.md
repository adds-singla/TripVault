# CloudFront setup (one distribution, two origins)

**Origin 1: web bucket (default behavior)**
- S3 origin, **Origin Access Control (OAC)** (not public website hosting). Bucket keeps *Block Public Access ON*.
- Add the bucket policy CloudFront suggests (allows `cloudfront.amazonaws.com` for your distribution ARN).
- Default root object: `index.html`.
- Viewer protocol policy: redirect HTTP to HTTPS. Cache policy: `CachingOptimized`.
- Because the site is a static export with `trailingSlash`, paths like `/trip/overview/` resolve to `trip/overview/index.html` only if
  a CloudFront Function rewrites directory URLs. Attach this **viewer-request** function to the default behavior:

```js
function handler(event) {
  var r = event.request, u = r.uri;
  if (u.endsWith('/')) r.uri = u + 'index.html';
  else if (!u.includes('.')) r.uri = u + '/index.html';
  return r;
}
```

**Origin 2: EC2 (behavior path `/api/*`)**
- Custom origin = the EC2 public DNS, protocol **HTTP only**, port 80 (Nginx listens there).
- Cache policy: **CachingDisabled**. Origin request policy: **AllViewerExceptHostHeader**
  (forwards the `Authorization` header, cookies and query strings).
- Allowed methods: GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE.
- Lock EC2's security group port 80 to the CloudFront managed prefix list `com.amazonaws.global.cloudfront.origin-facing`.

**Custom error responses:** 403/404 -> `/index.html` is NOT needed (all routes are real files).

**Files bucket (separate, private):** Block Public Access ON, default encryption SSE-S3, CORS = `s3-cors-files.json`
with your CloudFront domain. The browser uploads/downloads with pre-signed URLs directly against this bucket.
