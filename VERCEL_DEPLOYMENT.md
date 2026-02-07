# Vercel Deployment Guide
## Domain: inbound.duhanashrah.ai

This guide will help you deploy the Inbound Calling SaaS application to Vercel.

## 🚀 Quick Deployment

### Step 1: Connect to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click "Add New Project"
4. Import the repository: `FurqanAfridi/inbound-calling-saas`

### Step 2: Configure Project Settings

**Framework Preset:** Create React App  
**Root Directory:** `./` (leave as default)  
**Build Command:** `npm run build`  
**Output Directory:** `build`  
**Install Command:** `npm install`

### Step 3: Add Environment Variables

In Vercel project settings, add these environment variables:

#### Required:
```
REACT_APP_SUPABASE_URL=your_supabase_project_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

#### Recommended:
```
REACT_APP_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_key
REACT_APP_STRIPE_CHECKOUT_WEBHOOK_URL=https://your-backend.com/api/stripe/create-checkout-session
REACT_APP_STRIPE_PAYMENT_WEBHOOK_URL=https://your-backend.com/api/stripe/verify-payment
REACT_APP_BOT_CREATION_WEBHOOK_URL=https://your-backend.com/webhook/bot-creation
REACT_APP_PHONE_NUMBER_WEBHOOK_URL=https://your-backend.com/webhook/phone-number
REACT_APP_APP_URL=https://inbound.duhanashrah.ai
REACT_APP_APP_NAME=Inbound Calling SaaS
REACT_APP_SENDGRID_API_KEY=your_sendgrid_key
REACT_APP_ADMIN_EMAIL=no-reply@duhanashrah.ai
REACT_APP_SUPPORT_SENDER_EMAIL=support@duhanashrah.ai
```

### Step 4: Deploy

Click "Deploy" and Vercel will:
- Install dependencies
- Build the application
- Deploy to production

### Step 5: Configure Custom Domain

1. Go to Project Settings → Domains
2. Add custom domain: `inbound.duhanashrah.ai`
3. Follow DNS configuration instructions:
   - Add CNAME record pointing to Vercel
   - Or add A record with Vercel's IP addresses

**DNS Configuration:**
```
Type: CNAME
Name: inbound
Value: cname.vercel-dns.com
```

Or:
```
Type: A
Name: inbound
Value: 76.76.21.21 (Vercel's IP)
```

### Step 6: SSL Certificate

Vercel automatically provisions SSL certificates via Let's Encrypt. No manual configuration needed!

## 🔄 Automatic Deployments

Vercel automatically deploys:
- **Production:** Every push to `master` branch
- **Preview:** Every pull request gets a preview URL

## 📝 Environment Variables Management

### Adding Environment Variables:

1. Go to Project Settings → Environment Variables
2. Add each variable for:
   - **Production** (required)
   - **Preview** (optional, for testing)
   - **Development** (optional)

### Updating Environment Variables:

1. Update in Vercel dashboard
2. Redeploy the project (or wait for next deployment)

## 🔧 Build Configuration

The `vercel.json` file is already configured with:
- ✅ Correct build command
- ✅ Output directory
- ✅ SPA routing (all routes → index.html)
- ✅ Cache headers for static assets

## 🚨 Troubleshooting

### Build Fails

1. Check build logs in Vercel dashboard
2. Verify all environment variables are set
3. Check Node.js version (should be 18.x or higher)

### 404 Errors on Routes

- The `vercel.json` already includes rewrites for SPA routing
- If issues persist, check the rewrites configuration

### Environment Variables Not Working

- Ensure variables start with `REACT_APP_` prefix
- Redeploy after adding new variables
- Check variable names match exactly (case-sensitive)

## 📊 Monitoring

Vercel provides:
- Real-time deployment logs
- Analytics (if enabled)
- Function logs
- Performance metrics

## 🔄 Updating the Application

Simply push to GitHub:
```bash
git add .
git commit -m "Your changes"
git push origin master
```

Vercel will automatically:
1. Detect the push
2. Build the application
3. Deploy to production
4. Update the domain

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [React on Vercel](https://vercel.com/docs/frameworks/react)
- [Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

---

**Domain:** inbound.duhanashrah.ai  
**Repository:** https://github.com/FurqanAfridi/inbound-calling-saas.git
