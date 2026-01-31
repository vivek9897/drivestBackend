# Backend CI/CD Setup Guide

## Prerequisites

1. **GCP Service Account**: Create a service account with the following roles:
   - Compute Instance Admin (v1)
   - Service Account User

2. **GitHub Secrets**: Add the service account key to GitHub repository secrets

3. **VM Setup**: Ensure your GCP VM has:
   - Node.js 20+ installed
   - npm installed
   - Git installed
   - PostgreSQL client (if needed for migrations)

## Setup Steps

### 1. Create GCP Service Account

```bash
# Create service account
gcloud iam service-accounts create github-actions-backend \
  --description="Service account for GitHub Actions backend deployment" \
  --display-name="GitHub Actions Backend"

# Grant necessary permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:github-actions-backend@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/compute.instanceAdmin.v1"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:github-actions-backend@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Generate and download key
gcloud iam service-accounts keys create ~/github-actions-backend-key.json \
  --iam-account=github-actions-backend@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

### 2. Add GitHub Secret

1. Go to your GitHub repository
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `GCP_SA_KEY`
5. Value: Copy the entire content of the downloaded JSON key file

### 3. VM Preparation

SSH into your GCP VM and ensure it has the required tools:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 (process manager)
sudo npm install -g pm2

# Install PostgreSQL client (if needed)
sudo apt install -y postgresql-client

# Clone your repository (if not already done)
git clone https://github.com/vivek9897/drivestBackend.git
cd drivestBackend
```

### 4. Environment Variables

Create a `.env` file on your VM with production values:

```bash
# Copy and edit environment file
cp .env.example .env
nano .env

# Make sure these are set correctly:
# DATABASE_URL=postgresql://username:password@host:port/database
# JWT_SECRET=your-production-jwt-secret
# NODE_ENV=production
```

### 5. Database Setup

Ensure your Cloud SQL PostgreSQL instance is running and accessible from the VM.

## How It Works

When you push changes to the `backend/` directory on the `main` branch:

1. **Build & Test**: The workflow builds and tests your backend
2. **Deploy**: Copies files to your GCP VM via SCP
3. **Update**: SSH into VM and:
   - Installs dependencies
   - Runs database migrations and seeding
   - Builds the application
   - Restarts the application using PM2

## Monitoring Deployment

Check the deployment status in GitHub Actions tab, or monitor your VM:

```bash
# Check PM2 status
pm2 status

# View application logs
pm2 logs routemaster-backend

# Check if app is running
curl http://localhost:3000/docs
```

## Troubleshooting

- **Permission Issues**: Ensure the service account has correct IAM roles
- **SSH Connection**: Verify the VM name and zone in the workflow match your setup
- **Database Connection**: Check DATABASE_URL and Cloud SQL connectivity
- **Port Conflicts**: Ensure port 3000 is available or update the configuration