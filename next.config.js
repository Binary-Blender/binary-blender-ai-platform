const nextConfig = {
  images: {
    domains: [
      // S3 domains for AWS
      'binary-blender-ai-platform.s3.amazonaws.com',
      'binary-blender-ai-platform.s3.us-east-2.amazonaws.com',
      's3.amazonaws.com',
      // Common image hosting domains
      'replicate.delivery',
      'replicate.com',
      'runwayml.com',
      'akool.com',
      // Add any other domains you're using for assets
    ],
    unoptimized: true, // Allow unoptimized images for external URLs
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: '**.s3.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: 'replicate.delivery',
      },
      {
        protocol: 'https',
        hostname: '**.replicate.delivery',
      },
    ],
  },
};

module.exports = nextConfig;
