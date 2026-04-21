# WealthGrow — MongoDB Localhost Setup

## Prerequisites
- Node.js (v16+)
- MongoDB installed and running locally

## Setup

### 1. Install MongoDB (if not already installed)
- **Windows**: https://www.mongodb.com/try/download/community
- **macOS**: `brew install mongodb-community && brew services start mongodb-community`
- **Ubuntu**: `sudo apt install mongodb && sudo systemctl start mongodb`

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment (optional)
```bash
cp .env.example .env
# Edit .env if you want to change the port, DB name, or JWT secret
```

### 4. Start the server
```bash
# Development (auto-restart on changes)
npm run dev

# Production
npm start
```

### 5. Open the app
Visit: http://localhost:3000

---

## API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/auth/signup` | No | Register new user |
| POST | `/api/auth/login` | No | Login (email or partnerId) |
| GET | `/api/user/profile` | Yes | Get profile + investments |
| PUT | `/api/user/profile` | Yes | Upload profile image |
| POST | `/api/user/investment` | Yes | Add a new investment |

## Data Storage
All data is stored in **MongoDB** at `mongodb://localhost:27017/wealthgrow`.

Collections:
- `users` — contains user info and embedded investments array

No external services required — everything runs locally!
