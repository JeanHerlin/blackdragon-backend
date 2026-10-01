import env from '../../config/env';
import BrevoEmailProvider from './BrevoEmailProvider';
import MockEmailProvider from './MockEmailProvider';

// Single place resolving which implementation is active, driven by config — no
// if(isMock) checks anywhere else in the codebase (see code-standards skill).
const emailProvider = env.emailProvider === 'mock' ? new MockEmailProvider() : new BrevoEmailProvider(env.brevo);

export default emailProvider;
