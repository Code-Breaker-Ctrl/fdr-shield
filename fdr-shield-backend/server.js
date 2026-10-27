require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');

const { connectDB } = require('./src/config/db');
const errorHandler = require('./src/middleware/errorHandler');
const { alertCronJob } = require('./src/jobs/alertCron');

const app = express();

// 1. Security & Core Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// 2. Global Rate Limiting (150 requests per 15 minutes per IP)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.',
  },
});
app.use('/api', apiLimiter);

// 3. Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'AICTE FDR Shield API',
    status: 'OPERATIONAL',
    timestamp: new Date().toISOString(),
  });
});

// 4. Mount All API Routes at /api
const routeBindings = [
  { prefix: '/api/auth', file: './src/routes/authRoutes.js' },
  { prefix: '/api/institutions', file: './src/routes/institutionRoutes.js' },
  { prefix: '/api/fdrs', file: './src/routes/fdrRoutes.js' },
  { prefix: '/api/documents', file: './src/routes/documentRoutes.js' },
  { prefix: '/api/release-requests', file: './src/routes/releaseRoutes.js' },
  { prefix: '/api/alerts', file: './src/routes/alertRoutes.js' },
  { prefix: '/api/notifications', file: './src/routes/notificationRoutes.js' },
  { prefix: '/api/dashboard', file: './src/routes/dashboardRoutes.js' },
  { prefix: '/api/audit', file: './src/routes/auditRoutes.js' },
];

routeBindings.forEach(({ prefix, file }) => {
  const fullPath = path.resolve(__dirname, file);
  if (fs.existsSync(fullPath)) {
    app.use(prefix, require(file));
    console.log(`[ROUTE] Mounted ${prefix} -> ${file}`);
  } else {
    app.use(prefix, (req, res) => {
      res.status(501).json({
        success: false,
        message: `Route module ${file} not initialized yet.`,
      });
    });
  }
});

// 5. 404 Catch-All Handler
app.use((req, res, next) => {
  const error = new Error(`Route not found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
});

// 6. Global Error Handler
app.use(errorHandler);

// 7. Start Server, Test Database Connection, and Initialize Cron
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  // Start the background cron job (Daily at 9:00 AM IST)
  alertCronJob.start();
  console.log('[CRON] AICTE FDR Maturity Alert cron scheduler initiated (0 9 * * *).');

  app.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(`🛡️  FDR Shield Backend running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`=================================================`);
  });
};

startServer();

module.exports = app;
