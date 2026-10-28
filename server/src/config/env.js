import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  APP_BASE_URL: z.string().url().default('http://localhost:3000'),
  CLIENT_ORIGIN: z.string().default('http://localhost:3000'),
  
  SUPABASE_URL: z.string().url().default('https://dummy-project.supabase.co'),
  SUPABASE_ANON_KEY: z.string().default('dummy-anon-key'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default('dummy-service-role-key'),
  
  PAYMENT_PROVIDER: z.enum(['mock', 'razorpay']).default('mock'),
  PAYMENT_PUBLIC_KEY: z.string().optional().default('mock_public_key'),
  PAYMENT_SECRET_KEY: z.string().optional().default('mock_secret_key'),
  PAYMENT_WEBHOOK_SECRET: z.string().optional().default('mock_webhook_secret'),
  
  MAP_PROVIDER: z.enum(['osm', 'google', 'mapbox']).default('osm'),
  MAP_PUBLIC_KEY: z.string().optional().default(''),
  
  DEFAULT_TIMEZONE: z.string().default('Asia/Kolkata'),
  DEFAULT_CURRENCY: z.string().default('INR'),
  PLATFORM_FEE_PERCENTAGE: z.coerce.number().default(5.0),
  GST_PERCENTAGE: z.coerce.number().default(18.0),
  AUTO_CANCEL_PENDING_HOURS: z.coerce.number().default(24),
  MINIMUM_RENTAL_HOURS: z.coerce.number().default(2),
  
  RATE_LIMIT_MAX: z.coerce.number().default(120),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;

