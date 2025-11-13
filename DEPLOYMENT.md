# Backend Deployment Guide for Vercel

## Changes Made

### 1. Refactored for Serverless Architecture
- Created `src/index.ts` - Main app export for Vercel
- Modified `src/server.ts` - Now only for local development
- The app is now compatible with Vercel's serverless functions

### 2. Created Configuration Files
- `vercel.json` - Vercel deployment configuration
- `.vercelignore` - Files to exclude from deployment

### 3. Updated CORS Configuration
- Added support for multiple origins
- Included production frontend URL: `https://planorma-rsvp-fe.vercel.app`

## Required Environment Variables in Vercel

Go to your Vercel project → Settings → Environment Variables and add:

### Required:
- `MONGODB_URI` - Your MongoDB connection string
- `JWT_SECRET` - Secret key for JWT tokens (use a strong random string)

### Optional:
- `FRONTEND_URL` - `https://planorma-rsvp-fe.vercel.app`
- `JWT_EXPIRES_IN` - Token expiration time (default: `7d`)
- `NODE_ENV` - Set to `production`

### For Email Functionality (Optional):
- `GMAIL_USER` - Your Gmail address
- `GMAIL_APP_PASSWORD` - Gmail App Password (not regular password)

## Deployment Steps

### 1. Commit and Push Changes
```bash
cd backend
git add .
git commit -m "feat: Configure backend for Vercel deployment"
git push
```

### 2. In Vercel Dashboard (Backend Project)

1. Go to your backend project settings
2. Add all environment variables listed above
3. Go to the Deployments tab
4. Click "Redeploy" or push your changes to trigger a new deployment

### 3. Verify Deployment

After deployment, test these endpoints:

```bash
# Health check
curl https://planorma-rsvp-be.vercel.app/health

# Root endpoint
curl https://planorma-rsvp-be.vercel.app/

# Test signup
curl -X POST https://planorma-rsvp-be.vercel.app/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123456"}'
```

## Frontend Environment Variables

Also update your frontend Vercel project with:

- `NEXT_PUBLIC_API_URL` = `https://planorma-rsvp-be.vercel.app/api`
- `NEXTAUTH_SECRET` = (generate with: `openssl rand -base64 32`)
- `NEXTAUTH_URL` = `https://planorma-rsvp-fe.vercel.app`

## Troubleshooting

### If you get 500 errors:
1. Check Vercel deployment logs for errors
2. Verify all environment variables are set correctly
3. Ensure MongoDB connection string is accessible from Vercel's servers

### If you still get CORS errors:
1. Make sure frontend URL is in the allowed origins list
2. Verify environment variables are set in Vercel
3. Check that both deployments are using the latest code

### Check Vercel Logs:
```bash
vercel logs <your-deployment-url>
```

## Local Development

Local development still works the same way:

```bash
npm run dev
```

The `src/server.ts` file is used for local development, while `src/index.ts` is used for Vercel deployment.

