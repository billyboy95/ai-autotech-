import Link from "next/link";

const actionClass = "inline-flex h-11 items-center rounded-md bg-[#2563EB] px-4 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A]";

export function PageLead({
  title,
  body,
  action,
  href,
}: {
  title: string;
  body: string;
  action: string;
  href: string;
}) {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">{title}</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate-700">{body}</p>
      <Link href={href} className={`mt-3 ${actionClass}`}>
        {action}
      </Link>
    </div>
  );
}
