# Newsletter Digest

AI-powered newsletter summaries from your Microsoft 365 inbox. Get bullet-point summaries of individual newsletters plus cross-newsletter theme analysis.

![Newsletter Digest](https://via.placeholder.com/800x400/102a43/f0f4f8?text=Newsletter+Digest)

## Features

- 🔐 **Microsoft 365 Integration** - Securely connects to your Outlook inbox
- 🤖 **AI Summaries** - GPT-4o-mini extracts key points from each newsletter
- 🎯 **Theme Detection** - Identifies common themes across multiple newsletters
- ⚙️ **Configurable Sources** - Add specific newsletter senders or use auto-detection
- 📅 **Flexible Time Range** - View last 3, 7, 14, or 30 days
- 🎨 **Beautiful UI** - Dark mode dashboard with glassmorphism design

## Quick Start

### Prerequisites

- Node.js 18+ 
- An Azure AD app registration (see setup below)
- OpenAI API key

### 1. Clone and Install

```bash
cd NewsletterSummarizer
npm install
```

### 2. Set Up Azure AD App Registration

This is required to access Microsoft 365 emails. Follow these steps:

#### A. Create App Registration

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **New registration**
4. Configure:
   - **Name**: `Newsletter Digest` (or your preferred name)
   - **Supported account types**: "Accounts in this organizational directory only" (for work accounts)
   - **Redirect URI**: Select "Web" and enter:
     - For local dev: `http://localhost:3000/api/auth/callback/azure-ad`
     - For production: `https://your-domain.vercel.app/api/auth/callback/azure-ad`
5. Click **Register**

#### B. Configure API Permissions

1. In your app registration, go to **API permissions**
2. Click **Add a permission** → **Microsoft Graph** → **Delegated permissions**
3. Add these permissions:
   - `Mail.Read` - Read user mail
   - `User.Read` - Sign in and read user profile
   - `offline_access` - Maintain access (for refresh tokens)
4. Click **Grant admin consent** (requires admin privileges)

#### C. Create Client Secret

1. Go to **Certificates & secrets** → **Client secrets**
2. Click **New client secret**
3. Add a description and expiry (recommend 24 months)
4. **Copy the secret value immediately** - you won't see it again!

#### D. Get Your IDs

From the **Overview** page, copy:
- **Application (client) ID**
- **Directory (tenant) ID**

### 3. Configure Environment Variables

Create a `.env.local` file in the project root:

```env
# Azure AD (from step 2)
AZURE_AD_CLIENT_ID=your-application-client-id
AZURE_AD_CLIENT_SECRET=your-client-secret-value
AZURE_AD_TENANT_ID=your-directory-tenant-id

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate-a-random-32-char-string

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key
```

**Generate NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

### 4. Run the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with your Microsoft 365 account!

## Deployment to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/newsletter-digest.git
git push -u origin main
```

### 2. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and import your repository
2. Add environment variables in Vercel dashboard:
   - `AZURE_AD_CLIENT_ID`
   - `AZURE_AD_CLIENT_SECRET`
   - `AZURE_AD_TENANT_ID`
   - `NEXTAUTH_URL` = `https://your-project.vercel.app`
   - `NEXTAUTH_SECRET`
   - `OPENAI_API_KEY`
3. Deploy!

### 3. Update Azure AD Redirect URI

After deployment, add your Vercel URL to Azure AD:
1. Go to your app registration → **Authentication**
2. Add redirect URI: `https://your-project.vercel.app/api/auth/callback/azure-ad`

## Sharing with Colleagues

For colleagues to use the app:

1. **Same Tenant (Recommended)**: If your Azure AD app is configured for "Accounts in this organizational directory only", colleagues can sign in immediately - just share the URL.

2. **Multi-Tenant**: To allow external users, update your app registration:
   - Go to **Authentication** → **Supported account types**
   - Change to "Accounts in any organizational directory"
   - Note: May require additional admin consent

## Configuration

### Newsletter Sources

In the **Settings** page, you can:

1. **Add specific senders** - Enter email addresses or domains (e.g., `morningbrew.com`)
2. **Enable auto-detection** - Automatically finds emails with newsletter patterns (unsubscribe links, etc.)
3. **Quick-add popular newsletters** - One-click to add common newsletters

### Scheduled Digests

The settings page includes options for Monday/Wednesday digest scheduling. To enable automated email digests:

1. Set up [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs) 
2. Create a `/api/cron/digest` endpoint that:
   - Fetches newsletters for each user
   - Generates summaries
   - Sends email via Microsoft Graph or a service like Resend

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/  # NextAuth.js handler
│   │   ├── newsletters/          # Fetch & summarize newsletters
│   │   └── settings/             # User preferences
│   ├── settings/                 # Settings page
│   └── page.tsx                  # Main dashboard
├── components/
│   └── Providers.tsx             # Session provider wrapper
├── lib/
│   ├── microsoft-graph.ts        # Graph API client
│   ├── openai-summarizer.ts      # GPT summarization
│   └── user-settings.ts          # Settings storage
└── types/
    └── next-auth.d.ts            # Type extensions
```

## Cost Considerations

- **OpenAI**: Using `gpt-4o-mini` (~$0.15 per 1M input tokens)
  - Typical newsletter: ~2000 tokens = ~$0.0003 per newsletter
  - 50 newsletters/week ≈ $0.06/month
- **Vercel**: Free tier handles small teams easily
- **Azure AD**: Free for your organization's users

## Troubleshooting

### "AADSTS50011: Reply URL does not match"
- Ensure redirect URI in Azure matches exactly: `http://localhost:3000/api/auth/callback/azure-ad`
- Check for trailing slashes

### "Insufficient privileges"
- Ensure `Mail.Read` permission has admin consent
- Check that user has an Exchange mailbox

### No newsletters found
- Try extending the time range
- Check Settings to add newsletter sources manually
- Verify auto-detect is enabled

## Future Enhancements

- [ ] Persistent database (PostgreSQL/Planetscale)
- [ ] Scheduled email digests via Vercel Cron
- [ ] Newsletter categorization and tagging
- [ ] Reading history and favorites
- [ ] Team sharing and collaborative digests
- [ ] Slack/Teams integration

## License

MIT

