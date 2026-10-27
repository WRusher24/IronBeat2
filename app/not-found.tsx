import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[80dvh] flex-col items-center justify-center text-center">
      <span className="label-xs">404</span>
      <h1 className="mt-2 font-display text-[28px] leading-tight text-ink">
        Nothing on this rack
      </h1>
      <p className="mt-2 max-w-[260px] text-[13px] leading-relaxed text-ink-muted">
        That page doesn&apos;t exist — or it belongs to another account&apos;s vault.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-full bg-ink px-5 py-2.5 text-[13px] font-semibold text-cream"
      >
        Back to the floor
      </Link>
    </div>
  );
}
