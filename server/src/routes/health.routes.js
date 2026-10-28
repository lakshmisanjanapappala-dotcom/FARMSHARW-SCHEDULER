import { Router } from 'express';
import { isLiveSupabase } from '../config/supabase.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'operational',
      platform: 'FarmSharw Scheduler',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      databaseMode: isLiveSupabase ? 'live_supabase' : 'local_development_memory',
      timezone: process.env.DEFAULT_TIMEZONE || 'Asia/Kolkata',
      features: {
        rentals: true,
        idleTimeExchange: true,
        pricingEngine: true,
        phoneOtpAuth: true,
        cashOnPickup: true,
        onlinePayments: true
      }
    }
  });
});

export default router;

