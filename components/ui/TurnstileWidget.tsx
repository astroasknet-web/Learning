"use client";

import React, { useState } from "react";
import { Turnstile } from "@marsidev/react-turnstile";

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onError?: (error: unknown) => void;
  className?: string;
  /**
   * "render" runs the challenge as soon as the widget mounts (fine for dedicated
   * form pages). "execute" defers the challenge until `.execute()` is called,
   * so the ~250KB Cloudflare challenge payload never loads until the user
   * actually submits — use this for widgets that mount on high-traffic pages.
   */
  execution?: "render" | "execute";
}

export interface TurnstileWidgetHandle {
  reset: () => void;
  execute: () => void;
}

export const TurnstileWidget = React.forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(
  ({ onVerify, onError, className = "", execution = "render" }, ref) => {
    const turnstileRef = React.useRef<any>(null);
    const [error, setError] = useState<string | null>(null);
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

    const handleError = (err: unknown) => {
      setError("Security verification failed. Please refresh and try again.");
      onError?.(err);
    };

    React.useImperativeHandle(ref, () => ({
      reset: () => turnstileRef.current?.reset(),
      execute: () => {
        if (turnstileRef.current?.execute) {
          turnstileRef.current.execute();
        } else {
          turnstileRef.current?.reset();
        }
      },
    }));

    if (!siteKey) {
      // Site key absent → render nothing. We don't log here either: the
      // Next.js dev overlay treats every console.warn as a red "Issue"
      // pill, and the missing key is a known dev-environment state.
      return null;
    }

    return (
      <div className={className}>
        <Turnstile
          ref={turnstileRef}
          siteKey={siteKey}
          onSuccess={(token) => {
            setError(null);
            onVerify(token);
          }}
          onError={handleError}
          onExpire={() => setError("Verification expired. Please try again.")}
          options={{ theme: "light", size: "invisible", execution }}
        />
        {error ? <p className="mt-2 text-xs text-red-500">{error}</p> : null}
      </div>
    );
  }
);

TurnstileWidget.displayName = "TurnstileWidget";