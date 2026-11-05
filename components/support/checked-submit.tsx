"use client";

import { useCallback, useState, type ReactNode } from "react";
import { HumanCheck, type CaptchaInfo } from "@/components/portal/auth-controls";

/** The human check plus the submit button of a form: the button stays off until the check is done. Must sit inside the <form>. */
export function CheckedSubmit({ captcha, label, className, extra }: { captcha: CaptchaInfo; label: string; className: string; extra?: ReactNode }) {
  const [ready, setReady] = useState(captcha.mode === "off");
  const onReady = useCallback((ok: boolean) => setReady(ok), []);
  return (
    <>
      <HumanCheck captcha={captcha} onReady={onReady} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={!ready} className={`${className} disabled:cursor-not-allowed disabled:opacity-50`}>{label}</button>
        {extra}
      </div>
    </>
  );
}
