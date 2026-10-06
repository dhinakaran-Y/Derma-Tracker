import Razorpay from 'razorpay';
import { env } from './env';

/**
 * Razorpay client singleton.
 * Uses TEST keys when RAZORPAY_KEY_ID starts with 'rzp_test_'.
 * No real money is transferred in test mode.
 */
export const razorpay = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID,
  key_secret: env.RAZORPAY_KEY_SECRET,
});

export const isTestMode = env.RAZORPAY_KEY_ID.startsWith('rzp_test_');
