import { OAuth2Client } from 'google-auth-library';
import { env, isGoogleAuthConfigured } from '../config/env';
import { AppError, ErrorCodes } from '../utils/app-error';

export interface GoogleIdentity {
  googleId: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

type GoogleVerifier = (idToken: string) => Promise<GoogleIdentity>;

let testVerifier: GoogleVerifier | undefined;
let googleClient: OAuth2Client | undefined;

export function setGoogleVerifierForTests(verifier: GoogleVerifier | undefined): void {
  testVerifier = verifier;
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  try {
    if (testVerifier) {
      return await testVerifier(idToken);
    }

    if (!isGoogleAuthConfigured()) {
      throw new AppError(
        503,
        ErrorCodes.GOOGLE_NOT_CONFIGURED,
        'Google sign-in is not configured. Set GOOGLE_CLIENT_ID.',
      );
    }

    googleClient ??= new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET || undefined);
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const googleId = payload?.sub;
    const email = payload?.email?.trim().toLowerCase();
    if (!googleId || !email || !payload?.email_verified) {
      throw new AppError(401, ErrorCodes.GOOGLE_AUTH_FAILED, 'Google sign-in could not be verified.');
    }

    return {
      googleId,
      email,
      name: payload.name?.trim() || email.split('@')[0] || 'Google user',
      emailVerified: true,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(401, ErrorCodes.GOOGLE_AUTH_FAILED, 'Google sign-in could not be verified.');
  }
}
