import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(4, 'JWT_SECRET must be at least 4 characters'),
  PORT: z.string().default('5000'),
  CLIENT_URL: z.string().default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  RAZORPAY_KEY_ID: z.string().default('rzp_test_derma123'),
  RAZORPAY_KEY_SECRET: z.string().default('secret_derma_test456'),
  RAZORPAY_WEBHOOK_SECRET: z.string().default('webhook_secret_derma123'),
  // Android SMS Gateway
  SMS_GATEWAY_URL: z.string().default('http://10.127.233.155:8080'),
  SMS_GATEWAY_USERNAME: z.string().default(''),
  SMS_GATEWAY_PASSWORD: z.string().default(''),
  // WhatsApp via Baileys
  WHATSAPP_ENABLED: z.string().default('false'),
  // OTP: set to 'true' to always use 123456 for easy testing (overrides real OTP generation)
  HARDCODE_DEV_OTP: z.string().default('false'),
  // Image storage configuration
  LOCALSTORAGE_ENABLED: z.string().default('false'),
  // Cloudinary image storage
  CLOUDINARY_CLOUD_NAME: z.string().default(''),
  CLOUDINARY_API_KEY: z.string().default(''),
  CLOUDINARY_API_SECRET: z.string().default(''),
  CLOUDINARY_ENABLED: z.string().default('false'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
