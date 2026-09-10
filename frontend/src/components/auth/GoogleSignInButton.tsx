import { useEffect, useRef, useState } from 'react';
import { Button } from '../ui/Button.tsx';
import type { GooglePromptNotification } from '../../types/google.d.ts';

const GIS_SRC = 'https://accounts.google.com/gsi/client';

let gisLoad: Promise<void> | undefined;

function googleClientId(): string {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? '';
}

function loadGoogleIdentity(): Promise<void> {
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }
  gisLoad ??= new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Unable to load Google Sign-In.')), {
        once: true,
      });
      return;
    }
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Unable to load Google Sign-In.'));
    document.head.appendChild(script);
  });
  return gisLoad;
}

interface GoogleSignInButtonProps {
  disabled?: boolean;
  onCredential: (idToken: string) => Promise<void>;
  onError: (message: string) => void;
}

export function GoogleSignInButton({ disabled, onCredential, onError }: GoogleSignInButtonProps) {
  const [busy, setBusy] = useState(false);
  const [showOfficialButton, setShowOfficialButton] = useState(false);
  const officialRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);
  const errorRef = useRef(onError);

  useEffect(() => {
    callbackRef.current = onCredential;
    errorRef.current = onError;
  }, [onCredential, onError]);

  const clientId = googleClientId();

  useEffect(() => {
    if (!showOfficialButton || !clientId || !officialRef.current) {
      return;
    }
    const width = Math.floor(officialRef.current.getBoundingClientRect().width);
    window.google?.accounts.id.renderButton(officialRef.current, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      width: width > 0 ? width : 320,
    });
  }, [showOfficialButton, clientId]);

  async function startGoogleSignIn() {
    if (busy || disabled) return;

    if (!clientId) {
      onError('Google sign-in is not configured. Set VITE_GOOGLE_CLIENT_ID and GOOGLE_CLIENT_ID.');
      return;
    }

    setBusy(true);
    try {
      await loadGoogleIdentity();
      const api = window.google?.accounts.id;
      if (!api) {
        throw new Error('Google Sign-In is unavailable in this browser.');
      }

      api.initialize({
        client_id: clientId,
        ux_mode: 'popup',
        auto_select: false,
        callback: (response) => {
          if (!response.credential) {
            errorRef.current('Google sign-in could not be completed.');
            setBusy(false);
            return;
          }
          void callbackRef
            .current(response.credential)
            .catch((reason: unknown) => {
              errorRef.current(
                reason instanceof Error ? reason.message : 'Google sign-in could not be completed.',
              );
            })
            .finally(() => setBusy(false));
        },
      });

      api.prompt((notification: GooglePromptNotification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          setShowOfficialButton(true);
          setBusy(false);
        }
        if (notification.isDismissedMoment()) {
          setBusy(false);
        }
      });
    } catch (reason: unknown) {
      onError(reason instanceof Error ? reason.message : 'Google sign-in is unavailable.');
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        loading={busy}
        disabled={disabled || busy}
        onClick={() => void startGoogleSignIn()}
      >
        Continue with Google
      </Button>
      {showOfficialButton ? (
        <div ref={officialRef} className="flex min-h-10 justify-center" />
      ) : null}
    </div>
  );
}
