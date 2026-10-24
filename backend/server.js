require('dotenv').config();

const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const protectedRoutes = require('./routes/protected');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000'
}));

app.use(express.json({ limit: '10kb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});

app.use('/api/auth', authRoutes);
app.use('/api/protected', protectedRoutes);

const PORT = Number(process.env.PORT || 5000);

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
