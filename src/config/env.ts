import 'dotenv/config';

const required = ['JWT_SECRET', 'BREVO_API_KEY', 'BREVO_SENDER_EMAIL', 'ENCRYPTION_KEY', 'DATABASE_URL'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

const env = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  apiPublicUrl: process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}/api`,

  jwtSecret: process.env.JWT_SECRET as string,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  encryptionKey: process.env.ENCRYPTION_KEY as string,

  // Controls which providers are wired in — see providers/*/index.ts factories.
  paymentProvider: process.env.PAYMENT_PROVIDER || 'mock',
  deliveryProvider: process.env.DELIVERY_PROVIDER || 'mock',

  // open_er_api needs no API key, so it's the safe default — no pending-credentials
  // reason to mock it like payment/delivery, but 'mock' stays available for offline dev.
  fxProvider: process.env.FX_PROVIDER || 'open_er_api',

  emailProvider: process.env.EMAIL_PROVIDER || 'brevo',
  brevo: {
    apiKey: process.env.BREVO_API_KEY as string,
    senderName: process.env.BREVO_SENDER_NAME || 'Black Dragon FF',
    senderEmail: process.env.BREVO_SENDER_EMAIL as string,
  },

  // Not required: only read when PAYMENT_PROVIDER=papi / DELIVERY_PROVIDER=g2bulk is set.
  papi: { apiKey: process.env.PAPI_API_KEY },
  g2bulk: { apiKey: process.env.G2BULK_API_KEY },

  // Not required at boot: the bot adapter checks these itself and refuses webhook calls
  // cleanly if missing, rather than crashing the whole server before setup is finished.
  messenger: {
    verifyToken: process.env.MESSENGER_VERIFY_TOKEN,
    pageAccessToken: process.env.MESSENGER_PAGE_ACCESS_TOKEN,
    appSecret: process.env.MESSENGER_APP_SECRET,
  },
};

export default env;
