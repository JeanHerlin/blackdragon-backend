import fs from 'fs';
import path from 'path';
import asyncHandler from '../utils/asyncHandler';

const LOG_FILE = path.join(__dirname, '..', '..', 'papi-webhook-capture.log');

// TEMPORARY — exists only to capture a real papi.mg payment notification so the final
// handler (parse + call orderService.confirmPayment) can be written against real data
// instead of guessed field names. Delete this file + its route once that's done.
export const capture = asyncHandler(async (req, res) => {
  const entry = {
    at: new Date().toISOString(),
    method: req.method,
    headers: req.headers,
    query: req.query,
    body: req.body,
  };

  console.log('[debugPapiWebhook] received a call:', JSON.stringify(entry, null, 2));
  fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');

  res.status(200).json({ received: true });
});
