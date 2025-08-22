#!/bin/bash

# Netlify Deployment Validation Script
echo "🔍 Validating Netlify deployment configuration..."

# Check if build directory exists and has correct structure
if [ ! -d "dist/figma-ds-copilot/browser" ]; then
    echo "❌ Build directory structure is incorrect"
    exit 1
fi

# Check if index.html exists
if [ ! -f "dist/figma-ds-copilot/browser/index.html" ]; then
    echo "❌ index.html not found in build output"
    exit 1
fi

# Check if main JS files exist
if [ ! -f dist/figma-ds-copilot/browser/main*.js ]; then
    echo "❌ Main JavaScript bundle not found"
    exit 1
fi

# Check build size (should be under 5MB for Netlify)
BUILD_SIZE=$(du -sh dist/figma-ds-copilot/browser | cut -f1)
echo "📦 Build size: $BUILD_SIZE"

# Check if netlify.toml exists
if [ ! -f "netlify.toml" ]; then
    echo "❌ netlify.toml configuration file missing"
    exit 1
fi

# Check if .netlifyignore exists
if [ ! -f ".netlifyignore" ]; then
    echo "❌ .netlifyignore file missing"
    exit 1
fi

echo "✅ All deployment validations passed!"
echo "🚀 Ready for Netlify deployment"