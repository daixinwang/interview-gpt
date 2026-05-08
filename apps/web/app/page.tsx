"use client";

import { JobInputForm } from "@/components/job-input-form";
import { useLang } from "@/components/app-shell";

export default function Home() {
  const { lang } = useLang();
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <JobInputForm lang={lang} />
      </div>
    </div>
  );
}
