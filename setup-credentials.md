# 🔧 PDF Pro - Credentials Setup Guide

## 📋 Quick Setup Checklist

### ✅ Step 1: Stripe Configuration

1. **Create Stripe Account:**
   - Go to: https://dashboard.stripe.com/register
   - Complete account setup (use test mode)

2. **Get API Keys:**
   - Visit: https://dashboard.stripe.com/test/apikeys
   - Copy `Publishable key` (pk_test_...)
   - Copy `Secret key` (sk_test_...)

3. **Create Products:**
   Go to: https://dashboard.stripe.com/test/products

   **Product 1: Starter Plan**
   - Name: `PDF Pro - Starter`
   - Price: `$9.00 USD` / Monthly
   - Copy the Price ID

   **Product 2: Professional Plan**
   - Name: `PDF Pro - Professional`
   - Price: `$29.00 USD` / Monthly
   - Copy the Price ID

   **Product 3: Business Plan**
   - Name: `PDF Pro - Business`
   - Price: `$99.00 USD` / Monthly
   - Copy the Price ID

4. **Setup Webhook:**
   - Go to: https://dashboard.stripe.com/test/webhooks
   - Add endpoint: `http://localhost:3000/api/webhooks/stripe`
   - Select events:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
   - Copy the Webhook Secret (whsec_...)

### ✅ Step 2: Google Cloud OAuth

1. **Create Google Cloud Project:**
   - Go to: https://console.cloud.google.com/
   - Create new project: `PDF Pro App`

2. **Enable APIs:**
   - Go to: https://console.cloud.google.com/apis/library
   - Enable "Google+ API"

3. **Configure OAuth Consent:**
   - Go to: https://console.cloud.google.com/apis/credentials/consent
   - External user type
   - App name: `PDF Pro`
   - Add your email as support contact

4. **Create OAuth Credentials:**
   - Go to: https://console.cloud.google.com/apis/credentials
   - Create OAuth client ID (Web application)
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google`
     - `http://localhost:3001/api/auth/callback/google`
   - Copy Client ID and Client Secret

### ✅ Step 3: Update .env.local

Replace the placeholder values in `.env.local` with your actual credentials:

```bash
# Google OAuth
GOOGLE_CLIENT_ID="your-actual-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-actual-client-secret"

# Stripe
STRIPE_SECRET_KEY="sk_test_your-actual-secret-key"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_your-actual-publishable-key"
STRIPE_WEBHOOK_SECRET="whsec_your-actual-webhook-secret"

# Stripe Price IDs
NEXT_PUBLIC_STRIPE_PRICE_STARTER="price_your-starter-price-id"
NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL="price_your-professional-price-id"
NEXT_PUBLIC_STRIPE_PRICE_BUSINESS="price_your-business-price-id"
```

### ✅ Step 4: Test the Setup

1. **Restart the development server:**
   ```bash
   npm run dev
   ```

2. **Test Google Sign-in:**
   - Go to: http://localhost:3000
   - Click "Sign in with Google"
   - Should redirect to Google OAuth

3. **Test Stripe Payments:**
   - Go to: http://localhost:3000/pricing
   - Click "Upgrade Now" on any plan
   - Should redirect to Stripe checkout

### 🧪 Test Credit Cards (Stripe Test Mode)

Use these test card numbers:
- **Success:** `4242 4242 4242 4242`
- **Decline:** `4000 0000 0000 0002`
- **Requires 3D Secure:** `4000 0025 0000 3155`
- Any future expiry date, any CVC

### 🔍 Troubleshooting

**Google OAuth Issues:**
- Check redirect URIs match exactly
- Ensure APIs are enabled
- Verify client ID/secret are correct

**Stripe Issues:**
- Confirm you're in test mode
- Check webhook endpoint is accessible
- Verify price IDs are correct

**Environment Variables:**
- Restart server after changing .env.local
- Check for typos in variable names
- Ensure no extra spaces in values

### 📞 Need Help?

If you encounter issues:
1. Check the browser console for errors
2. Check the terminal for server errors
3. Verify all credentials are correctly copied
4. Ensure webhook endpoint is reachable
