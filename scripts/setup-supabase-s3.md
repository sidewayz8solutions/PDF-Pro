# 🚀 Supabase + AWS S3 Setup Guide

This guide will help you set up Supabase and AWS S3 for your PDF-Pro application.

## 📋 Prerequisites

- Supabase account (https://supabase.com)
- AWS account (https://aws.amazon.com)
- Node.js and npm installed

## 🗄️ Supabase Setup

### 1. Create a New Supabase Project

1. Go to https://supabase.com and sign in
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - **Name**: PDF-Pro
   - **Database Password**: Choose a strong password
   - **Region**: Choose closest to your users
5. Click "Create new project"

### 2. Get Your Supabase Credentials

Once your project is created:

1. Go to **Settings** → **API**
2. Copy the following values:
   - **Project URL**: `https://your-project-id.supabase.co`
   - **Anon (public) key**: `eyJ...` (starts with eyJ)
   - **Service role key**: `eyJ...` (starts with eyJ, different from anon key)

### 3. Update Environment Variables

Update your `.env.local` file:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL="https://your-project-id.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your_anon_key_here"
SUPABASE_SERVICE_ROLE_KEY="your_service_role_key_here"
```

### 4. Run Database Migration

1. Go to **SQL Editor** in your Supabase dashboard
2. Copy the contents of `supabase/migrations/001_initial_schema.sql`
3. Paste and run the SQL script
4. Verify tables are created in **Table Editor**

### 5. Configure Authentication

1. Go to **Authentication** → **Settings**
2. Enable the providers you want:
   - **Email**: Already enabled
   - **Google**: Add your Google OAuth credentials
3. Set **Site URL**: `http://localhost:3000` (for development)
4. Add **Redirect URLs**: 
   - `http://localhost:3000/api/auth/callback/google`
   - `https://yourdomain.com/api/auth/callback/google` (for production)

## ☁️ AWS S3 Setup

### 1. Create an S3 Bucket

1. Go to AWS Console → S3
2. Click "Create bucket"
3. Configure:
   - **Bucket name**: `pdfpro-files` (must be globally unique)
   - **Region**: Choose same region as your app
   - **Block Public Access**: Keep all blocked (we'll use signed URLs)
   - **Bucket Versioning**: Enable (optional)
   - **Server-side encryption**: Enable with S3 managed keys
4. Click "Create bucket"

### 2. Create IAM User for S3 Access

1. Go to AWS Console → IAM
2. Click "Users" → "Add users"
3. Enter username: `pdfpro-s3-user`
4. Select "Programmatic access"
5. Click "Next: Permissions"
6. Click "Attach existing policies directly"
7. Search and select: `AmazonS3FullAccess` (or create custom policy)
8. Click through to create user
9. **IMPORTANT**: Save the Access Key ID and Secret Access Key

### 3. Configure S3 CORS (if needed for direct uploads)

1. Go to your S3 bucket
2. Click "Permissions" → "Cross-origin resource sharing (CORS)"
3. Add this configuration:

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
        "AllowedOrigins": ["http://localhost:3000", "https://yourdomain.com"],
        "ExposeHeaders": ["ETag"]
    }
]
```

### 4. Update Environment Variables

Add to your `.env.local`:

```env
# AWS S3 Configuration
AWS_ACCESS_KEY_ID="your_access_key_here"
AWS_SECRET_ACCESS_KEY="your_secret_key_here"
AWS_REGION="us-east-1"
AWS_S3_BUCKET="pdfpro-files"
```

## 🔧 Application Configuration

### 1. Install Dependencies

```bash
npm install @supabase/supabase-js @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### 2. Test the Connection

Create a test script to verify everything works:

```javascript
// test-setup.js
const { supabase } = require('./src/lib/supabase');
const { s3Storage } = require('./src/lib/aws-s3');

async function testSetup() {
  try {
    // Test Supabase connection
    const { data, error } = await supabase.from('users').select('count');
    if (error) throw error;
    console.log('✅ Supabase connection successful');

    // Test S3 connection
    const buckets = await s3Storage.client.send(new ListBucketsCommand({}));
    console.log('✅ S3 connection successful');
    
    console.log('🎉 Setup complete!');
  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

testSetup();
```

## 🔐 Security Best Practices

### 1. Environment Variables

- Never commit `.env.local` to version control
- Use different credentials for development/production
- Rotate keys regularly

### 2. Supabase Security

- Enable Row Level Security (RLS) on all tables ✅ (already done in migration)
- Use service role key only on server-side
- Validate user permissions in API routes

### 3. S3 Security

- Use IAM policies with minimal required permissions
- Enable bucket encryption
- Use signed URLs for file access
- Set appropriate expiration times

## 📊 Monitoring and Maintenance

### 1. Supabase Monitoring

- Monitor database usage in Supabase dashboard
- Set up alerts for high usage
- Regular backups (automatic in Supabase)

### 2. S3 Monitoring

- Monitor storage costs in AWS billing
- Set up lifecycle policies for old files
- Use CloudWatch for monitoring

### 3. Cleanup Jobs

Set up cron jobs to:
- Clean expired files from S3
- Remove old usage records
- Reset monthly credits

## 🚀 Deployment Checklist

Before deploying to production:

- [ ] Update environment variables for production
- [ ] Configure production domain in Supabase auth settings
- [ ] Set up proper S3 bucket policies
- [ ] Enable SSL/TLS
- [ ] Set up monitoring and alerts
- [ ] Test all functionality in staging environment

## 🆘 Troubleshooting

### Common Issues

1. **Supabase connection fails**
   - Check project URL and API keys
   - Verify network connectivity
   - Check Supabase project status

2. **S3 upload fails**
   - Verify AWS credentials
   - Check bucket permissions
   - Ensure bucket exists in correct region

3. **Authentication issues**
   - Check NextAuth configuration
   - Verify redirect URLs
   - Check provider credentials

### Getting Help

- Supabase docs: https://supabase.com/docs
- AWS S3 docs: https://docs.aws.amazon.com/s3/
- PDF-Pro GitHub issues: [Your repo URL]

## 📈 Next Steps

After setup is complete:

1. Test all PDF operations
2. Monitor performance and costs
3. Set up analytics and reporting
4. Configure automated backups
5. Plan for scaling

---

**Need help?** Check the troubleshooting section or create an issue in the repository.
