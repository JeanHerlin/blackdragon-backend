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
  // papi.testMode defaults to true — real money going out by accident is worse than a
  // payment staying labeled "test" by mistake (see PapiPaymentProvider's isTestMode note:
  // mobile money moves real funds either way, only card payments are truly free to test).
  // papi.webhookSecret is optional: when set, papiWebhookController verifies
  // X-Papi-Signature on top of the per-transaction notificationToken check; Papi's docs
  // mention the header but not its exact algorithm, so this is opt-in until confirmed.
  papi: {
    apiKey: process.env.PAPI_API_KEY,
    testMode: process.env.PAPI_TEST_MODE !== 'false',
    webhookSecret: process.env.PAPI_WEBHOOK_SECRET,
  },
  g2bulk: { apiKey: process.env.G2BULK_API_KEY },

  // Not required at boot: the bot adapter checks these itself and refuses webhook calls
  // cleanly if missing, rather than crashing the whole server before setup is finished.
  messenger: {
    verifyToken: process.env.MESSENGER_VERIFY_TOKEN,
    pageAccessToken: process.env.MESSENGER_PAGE_ACCESS_TOKEN,
    appSecret: process.env.MESSENGER_APP_SECRET,
  },

  // Not required at boot: pushService checks these itself and skips sending (logs once)
  // rather than crashing the server if a dev environment hasn't generated a VAPID pair yet.
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    subject: process.env.VAPID_SUBJECT,
  },
};

export default env;
