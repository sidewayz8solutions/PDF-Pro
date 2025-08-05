# 🚀 Supabase Setup Instructions for PDF-Pro

## Quick Setup Guide

### Step 1: Create Supabase Project
1. Go to [https://supabase.com](https://supabase.com)
2. Sign in or create an account
3. Click "New Project"
4. Fill in project details:
   - **Name**: PDF-Pro
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Choose closest to your users
5. Click "Create new project" and wait for setup to complete

### Step 2: Run the Database Setup
1. In your Supabase dashboard, go to **SQL Editor**
2. Open the file `supabase-complete-setup.sql` from your project
3. **Copy the entire contents** of the file
4. **Paste it into the SQL Editor**
5. Click **"Run"** to execute the setup
6. You should see: `PDF-Pro Supabase setup completed successfully! 🚀`

### Step 3: Get Your Credentials
1. Go to **Settings** → **API**
2. Copy these values to your `.env.local` file:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL="https://your-project-id.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."
SUPABASE_SERVICE_ROLE_KEY="eyJ..."
```

### Step 4: Configure Authentication (Optional)
1. Go to **Authentication** → **Settings**
2. Set **Site URL**: `http://localhost:3000` (for development)
3. Add **Redirect URLs**:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://yourdomain.com/api/auth/callback/google` (for production)

For Google OAuth:
1. Go to **Authentication** → **Providers**
2. Enable **Google**
3. Add your Google OAuth credentials

### Step 5: Verify Setup
1. Go to **Table Editor** in Supabase
2. You should see these tables:
   - ✅ users
   - ✅ subscriptions  
   - ✅ files
   - ✅ usage_records
   - ✅ api_keys
   - ✅ processing_queue
   - ✅ file_shares

## 📊 What Was Created

### Tables
- **users** - User profiles and statistics
- **subscriptions** - Plan management and billing
- **files** - File tracking and metadata
- **usage_records** - Detailed usage analytics
- **api_keys** - API key management
- **processing_queue** - Background job processing
- **file_shares** - File sharing functionality

### Security Features
- ✅ Row Level Security (RLS) enabled
- ✅ User data isolation
- ✅ Secure policies for all tables
- ✅ Automatic user registration

### Functions & Triggers
- ✅ Auto-create user profile on signup
- ✅ Auto-create free subscription
- ✅ Cleanup expired files
- ✅ User analytics
- ✅ Updated timestamp triggers

### Views
- ✅ user_stats - User statistics summary
- ✅ recent_activity - Recent user activity

## 🔧 Testing Your Setup

### Test Database Connection
```sql
-- Run this in SQL Editor to test
SELECT COUNT(*) FROM public.users;
```

### Test User Registration
1. Sign up a test user in your app
2. Check if user appears in `public.users` table
3. Check if subscription was created in `public.subscriptions`

## 🚨 Important Notes

### Security
- Never share your **Service Role Key** publicly
- Use **Anon Key** for client-side operations only
- Service Role Key bypasses RLS - use carefully

### Development vs Production
- Use different Supabase projects for dev/prod
- Update environment variables accordingly
- Test thoroughly before going live

### Backup
- Supabase automatically backs up your database
- You can also export data manually from the dashboard

## 🛠️ Next Steps

1. **Update your app** to use the new Supabase integration
2. **Test all PDF operations** to ensure they work
3. **Set up AWS S3** for file storage
4. **Configure Stripe** for payments (if using paid plans)
5. **Deploy to production** with production Supabase project

## 📚 Useful Supabase Features

### Real-time Subscriptions
```javascript
// Listen to file changes
supabase
  .channel('files')
  .on('postgres_changes', { 
    event: '*', 
    schema: 'public', 
    table: 'files' 
  }, (payload) => {
    console.log('File updated:', payload)
  })
  .subscribe()
```

### Direct Database Queries
```javascript
// Get user files
const { data, error } = await supabase
  .from('files')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
```

### Analytics
```sql
-- Get user analytics (run in SQL Editor)
SELECT * FROM get_user_analytics('user-uuid-here');
```

## 🆘 Troubleshooting

### Common Issues

**"relation does not exist" error**
- Make sure you ran the complete SQL setup
- Check if all tables were created in Table Editor

**RLS policy errors**
- Ensure user is authenticated
- Check if policies are correctly applied
- Verify user ID matches in policies

**Function not found**
- Ensure all functions were created
- Check function permissions
- Try recreating the function

### Getting Help
- Check Supabase docs: https://supabase.com/docs
- Join Supabase Discord: https://discord.supabase.com
- Check the logs in your Supabase dashboard

## ✅ Setup Complete!

Your Supabase database is now ready for PDF-Pro! 

Next: Set up AWS S3 for file storage and update your application code to use the new database structure.

---

**Need help?** Check the troubleshooting section above or create an issue in your repository.
