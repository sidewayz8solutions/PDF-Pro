#!/bin/bash

echo "🔧 Starting PDF-Pro Production Fixes..."

# Update critical packages
echo "📦 Updating critical packages..."
npm update stripe@latest @stripe/stripe-js@latest
npm update next-auth@latest bcryptjs@latest
npm update react@latest react-dom@latest next@latest

# Remove unused packages
echo "🗑️ Removing unused packages..."
npm uninstall @headlessui/react @react-pdf/renderer cors critters jimp multer recharts helmet

# Install missing packages
echo "➕ Installing missing packages..."
npm install express-rate-limit express-slow-down
npm install @sentry/nextjs

# Build for production
echo "🏗️ Building for production..."
npm run build

# Run tests
echo "🧪 Running tests..."
npm test

echo "✅ Production fixes complete!"
echo "⚠️ Don't forget to:"
echo "  1. Create .env.production with production secrets"
echo "  2. Set up Supabase production database"
echo "  3. Configure Redis production instance"
echo "  4. Set up S3 bucket for production"
echo "  5. Configure Stripe production keys"