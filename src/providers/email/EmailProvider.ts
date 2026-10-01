export interface SendEmailInput {
  to: string;
  subject: string;
  htmlContent: string;
}

// Any implementation (Brevo, mock, a future provider) must satisfy this shape so the
// service layer never depends on a concrete provider — see code-standards skill.
export default abstract class EmailProvider {
  abstract sendEmail(input: SendEmailInput): Promise<unknown>;
}
