const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'wealthgrow_secret_key_change_in_production';
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://chowdry:y5T70RpXyfrXrm8l@cluster0.q0u0h1n.mongodb.net/finance?retryWrites=true&w=majority';

// =========================
// MONGODB CONNECTION
// =========================
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB at', MONGO_URI))
  .catch(err => { console.error('❌ MongoDB connection error:', err.message); process.exit(1); });

// =========================
// SCHEMAS & MODELS
// =========================

const investmentSchema = new mongoose.Schema({
  type:       { type: String, required: true },
  amount:     { type: Number, required: true },
  percentage: { type: Number, required: true },
  tenure:     { type: Number, default: 1 },
  paymentId:  { type: String, default: null },
}, { timestamps: true });

const userSchema = new mongoose.Schema({
  name:                 { type: String, required: true },
  email:                { type: String, required: true, unique: true },
  password:             { type: String, required: true },
  partnerId:            { type: String, required: true, unique: true },
  totalNetWorth:        { type: Number, default: 0 },
  currentInvestment:    { type: Number, default: 0 },
  profileImageBase64:   { type: String, default: null },
  profileImageType:     { type: String, default: null },
  investments:          [investmentSchema],
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// =========================
// MIDDLEWARE
// =========================
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// =========================
// AUTH MIDDLEWARE
// =========================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer '))
    return res.status(401).json({ message: 'Token required' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ message: 'Invalid token' });
  }
};

// =========================
// MULTER (memory, 5MB) — multer v2 compatible
// =========================
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// =========================
// ROOT
// =========================
app.get('/api', (req, res) => res.json({ message: 'WealthGrow API is running 🚀' }));
app.get('/favicon.ico', (req, res) => res.status(204).end());

// =========================
// AUTH ROUTES
// =========================

// POST /api/auth/signup
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: 'All fields required' });

    if (!email.endsWith('@gmail.com'))
      return res.status(400).json({ message: 'Only Gmail allowed' });

    if (password.length < 6)
      return res.status(400).json({ message: 'Min 6 chars required' });

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ message: 'Email already exists' });

    const hashed = await bcrypt.hash(password, 10);
    const partnerId = 'WG' + Date.now().toString().slice(-6);

    const user = new User({ name, email, password: hashed, partnerId });
    await user.save();

    res.status(201).json({ message: 'Signup successful', partnerId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login  (email OR partnerId)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({
      $or: [{ email }, { partnerId: email }],
    });

    if (!user)
      return res.status(400).json({ message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        partnerId: user.partnerId,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// USER ROUTES
// =========================

// GET /api/user/profile
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user)
      return res.status(404).json({ message: 'User not found' });

    let profileImage = null;
    if (user.profileImageBase64 && user.profileImageType) {
      profileImage = `data:${user.profileImageType};base64,${user.profileImageBase64}`;
    }

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      partnerId: user.partnerId,
      totalNetWorth: user.totalNetWorth,
      currentInvestment: user.currentInvestment,
      profileImage,
      investments: user.investments.map(inv => ({
        id: inv._id,
        type: inv.type,
        amount: inv.amount,
        percentage: inv.percentage,
        tenure: inv.tenure,
        paymentId: inv.paymentId,
        date: inv.createdAt,
      })).reverse(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/user/profile — upload profile image
app.put('/api/user/profile', authenticateToken, (req, res, next) => {
  upload.single('profileImage')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'File upload error' });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ message: 'No image uploaded' });

    const base64 = req.file.buffer.toString('base64');

    await User.findByIdAndUpdate(req.user.userId, {
      profileImageBase64: base64,
      profileImageType: req.file.mimetype,
    });

    // Return the new image so client can update immediately
    const profileImage = `data:${req.file.mimetype};base64,${base64}`;
    res.json({ message: 'Profile image updated successfully', profileImage });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/user/investment — save a new investment
app.post('/api/user/investment', authenticateToken, async (req, res) => {
  try {
    const { type, amount, percentage, tenure, paymentId } = req.body;

    if (!type || !amount || !percentage)
      return res.status(400).json({ message: 'type, amount and percentage are required' });

    const years = tenure || 1;
    const maturity = amount * Math.pow(1 + percentage / 100, years);

    const updatedUser = await User.findByIdAndUpdate(req.user.userId, {
      $push: {
        investments: { type, amount, percentage, tenure: years, paymentId: paymentId || null },
      },
      $inc: {
        currentInvestment: amount,
        totalNetWorth: maturity,
      },
    }, { new: true });

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(201).json({ message: 'Investment saved successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// ERROR HANDLER
// =========================
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// =========================
// START SERVER
// =========================
app.listen(PORT, () => {
  console.log(`🚀 WealthGrow server running at http://localhost:${PORT}`);
  console.log(`📁 Serving static files from /public`);
});

module.exports = app;
