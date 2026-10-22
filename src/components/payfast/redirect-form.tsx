"use client";

import { useEffect, useRef } from "react";

export function PayfastRedirect({
  action,
  fields,
}: {
  action: string;
  fields: Record<string, string>;
}) {
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    form.current?.submit();
  }, []);
  return (
    <form ref={form} method="post" action={action}>
      {Object.entries(fields).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <button type="submit" className="mt-4 inline-flex h-11 items-center rounded-md bg-[#2563EB] px-4 text-sm font-semibold text-white">
        Continue to PayFast
      </button>
    </form>
  );
}
