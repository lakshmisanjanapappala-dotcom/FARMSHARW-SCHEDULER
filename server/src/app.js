import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { env } from './config/env.js';
import { standardRateLimiter } from './middleware/rate-limit.js';
import { errorHandler, AppError } from './middleware/error-handler.js';

// Route imports
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import equipmentRoutes from './routes/equipment.routes.js';
import bookingsRoutes from './routes/bookings.routes.js';
import exchangesRoutes from './routes/exchanges.routes.js';
import paymentsRoutes from './routes/payments.routes.js';
import messagesRoutes from './routes/messages.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import reviewsRoutes from './routes/reviews.routes.js';
import maintenanceRoutes from './routes/maintenance.routes.js';
import damageReportsRoutes from './routes/damage-reports.routes.js';
import disputesRoutes from './routes/disputes.routes.js';
import adminRoutes from './routes/admin.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.resolve(__dirname, '../../public');

export const app = express();

// Security Headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Allow local fonts, SVGs, and modular scripts
    crossOriginEmbedderPolicy: false
  })
);

// CORS
app.use(
  cors({
    origin: env.CLIENT_ORIGIN || true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  })
);

// Rate Limiting
app.use('/api/', standardRateLimiter);

// Request parsing with rawBody retention for webhooks
app.use(
  express.json({
    limit: '5mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  })
);
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Serve frontend static assets
app.use(express.static(publicPath));

// API Routes
app.use('/api', healthRoutes);
app.use('/api', authRoutes);
app.use('/api', equipmentRoutes);
app.use('/api', bookingsRoutes);
app.use('/api', exchangesRoutes);
app.use('/api', paymentsRoutes);
app.use('/api', messagesRoutes);
app.use('/api', notificationsRoutes);
app.use('/api', reviewsRoutes);
app.use('/api', maintenanceRoutes);
app.use('/api', damageReportsRoutes);
app.use('/api', disputesRoutes);
app.use('/api', adminRoutes);

// 404 for unhandled API routes
app.use('/api', (req, res, next) => {
  next(new AppError(`API endpoint not found: ${req.method} ${req.originalUrl}`, 404, 'ROUTE_NOT_FOUND'));
});

// Centralized Error Handling
app.use(errorHandler);
