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
    let response: Response;
    try {
      response = await fetch(BREVO_ENDPOINT, {
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
    } catch (err: any) {
      console.error('[BrevoEmailProvider] network error:', err);
      throw new AppError("Impossible de contacter le service d'envoi d'email (Brevo). Vérifie la connexion réseau du serveur et réessaie.", 502);
    }

    if (!response.ok) {
      const rawBody = await response.text();
      // Full detail stays server-side only — callers get a clean, actionable message
      // instead of a raw HTTP status + JSON blob (see code-standards skill).
      console.error(`[BrevoEmailProvider] request failed (${response.status}):`, rawBody);

      if (response.status === 401) {
        throw new AppError('La clé API Brevo configurée est invalide ou a expiré. Vérifie BREVO_API_KEY côté serveur.', 502);
      }
      if (response.status === 429) {
        throw new AppError("Brevo a temporairement limité l'envoi (quota atteint). Réessaie dans quelques minutes.", 502);
      }

      let detail = '';
      try {
        const parsed = JSON.parse(rawBody);
        if (typeof parsed?.message === 'string') detail = parsed.message;
      } catch {
        // Non-JSON error body — the generic message below already covers this case.
      }

      throw new AppError(
        `L'envoi de l'email via Brevo a échoué${detail ? ` : ${detail}` : ''}. Vérifie la configuration Brevo (clé API, adresse d'expédition vérifiée) ou réessaie plus tard.`,
        502,
      );
    }

    return response.json();
  }
}
