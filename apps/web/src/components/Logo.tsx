import Link from "next/link";
import { useId } from "react";

export function LogoMark({ size = 32 }: { size?: number }) {
  const id = useId();
  const a = `${id}-a`;
  const b = `${id}-b`;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id={a} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2563EB" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
        <linearGradient id={b} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4F46E5" />
          <stop offset="1" stopColor="#2563EB" />
        </linearGradient>
      </defs>
      <path d="M32 43H4l7-8h16l-8-8 7-7 16 14z" fill={`url(#${b})`} />
      <path d="M16 5h28l-7 8H21l8 8-7 7L6 14z" fill={`url(#${a})`} />
    </svg>
  );
}

export function Logo({
  href = "/",
  markSize = 34,
  fontSize = 22,
}: {
  href?: string;
  markSize?: number;
  fontSize?: number;
}) {
  return (
    <Link href={href} className="logo" style={{ fontSize }}>
      <LogoMark size={markSize} />
      <span>
        Stratos<span className="logo-accent">Opx</span>
      </span>
    </Link>
  );
}
