import EmailProvider, { SendEmailInput } from './EmailProvider';

// Lets the forgot-password flow be exercised end to end before Brevo is wired up,
// or in local dev without spending real send quota.
export default class MockEmailProvider extends EmailProvider {
  async sendEmail({ to, subject, htmlContent }: SendEmailInput): Promise<unknown> {
    console.log('[MockEmailProvider] would send email:', { to, subject, htmlContent });
    return { simulated: true };
  }
}
