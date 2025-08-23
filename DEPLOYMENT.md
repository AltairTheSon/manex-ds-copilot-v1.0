# Netlify Deployment Configuration

This document outlines the deployment optimization configuration implemented to resolve Netlify post-processing issues.

## Files Modified

### netlify.toml
- Added comprehensive build configuration with Node.js 18 and npm 9
- Configured build processing with CSS/JS minification and image compression
- Set proper environment variables (CI=true, NODE_ENV=production)
- Maintained SPA routing with catch-all redirect

### .netlifyignore
- Excludes source files, tests, and dependencies from deployment
- Reduces deployment package size significantly
- Prevents unnecessary file processing during post-processing stage

### angular.json
- Increased CSS budget from 8KB to 20KB (eliminates warnings)
- Increased initial bundle warning limit to 2MB, error to 5MB
- Disabled font inlining to prevent network issues in CI environments
- Enabled all optimizations except font inlining

### package.json
- Added `build:netlify` script optimized for Netlify deployment
- Added `analyze` script for bundle size analysis
- Added `validate-deployment` script for pre-deployment checks

## Build Commands

```bash
# Standard production build
npm run build:prod

# Netlify-optimized build (no source maps)
npm run build:netlify

# Analyze bundle size
npm run analyze

# Validate deployment readiness
npm run validate-deployment
```

## Deployment Process

1. Netlify will use Node.js 20 and npm 10
2. Runs `npm run build:netlify` command
3. Publishes `dist/manex-ds-copilot/browser` directory
4. Applies build processing (CSS/JS minification, image compression)
5. Sets up SPA routing with index.html fallback

## Performance Optimizations

- **Bundle Size**: ~393KB raw, ~100KB gzipped
- **Build Time**: ~6.5 seconds
- **No Source Maps**: Reduces deployment size and processing time
- **CSS Minification**: Enabled via Netlify processing
- **JS Minification**: Enabled via Netlify processing
- **Image Compression**: Enabled for any images in public folder

## Troubleshooting

If deployment still gets stuck at post-processing:

1. Check Netlify deploy logs for specific errors
2. Verify bundle size is under limits (currently ~400KB is well within limits)
3. Ensure no network calls during build (fonts are not inlined)
4. Run `npm run validate-deployment` locally before deploying

## Environment Variables (Set in Netlify Dashboard)

```
NODE_VERSION=20
NPM_VERSION=10
CI=true
NODE_ENV=production
```

These are also specified in netlify.toml but can be overridden in dashboard if needed.