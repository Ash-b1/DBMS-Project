require('dotenv').config();

const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const protectedRoutes = require('./routes/protected');
const adminRoutes = require('./routes/admin');
const adminAuthRoutes = require('./routes/adminAuth');
const doctorClinicalRoutes = require('./routes/doctorClinical');
const adminClinicalRoutes = require('./routes/adminClinical');
const vectorSearchRoutes = require('./routes/vectorSearch');
const analyticsRoutes = require('./routes/analytics');
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
app.use('/api/admin', adminRoutes);
app.use('/api/admin-auth', adminAuthRoutes);
app.use('/api/doctors', doctorClinicalRoutes);
app.use('/api/admin-clinical', adminClinicalRoutes);
app.use('/api/cases', vectorSearchRoutes);
app.use('/api/analytics', analyticsRoutes);
const PORT = Number(process.env.PORT || 5000);

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
