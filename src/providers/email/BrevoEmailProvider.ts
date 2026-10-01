import EmailProvider, { SendEmailInput } from './EmailProvider';
import AppError from '../../utils/AppError';

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

interface BrevoConfig {
  apiKey: string;
  senderName: string;
  senderEmail: string;
}

export default class BrevoEmailProvider extends EmailProvider {
  private apiKey: string;
  private senderName: string;
  private senderEmail: string;

  constructor({ apiKey, senderName, senderEmail }: BrevoConfig) {
    super();
    this.apiKey = apiKey;
    this.senderName = senderName;
    this.senderEmail = senderEmail;
  }

  async sendEmail({ to, subject, htmlContent }: SendEmailInput): Promise<unknown> {
    const response = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'api-key': this.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: this.senderName, email: this.senderEmail },
        to: [{ email: to }],
        subject,
        htmlContent,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new AppError(`Brevo request failed (${response.status}): ${errorBody}`, 502);
    }

    return response.json();
  }
}
