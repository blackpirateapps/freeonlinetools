'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    { href: '/', label: 'Tools' },
    { href: '/csv-to-json', label: 'CSV↔JSON' },
    { href: '/yaml-to-json', label: 'YAML↔JSON' },
    { href: '/markdown-to-html', label: 'MD↔HTML' },
    { href: '/convert-image', label: 'Convert Img' },
    { href: '/merge-pdf', label: 'PDF' },
    { href: '/compress', label: 'Compress' },
    { href: '/crop', label: 'Crop' },
    { href: '/resize', label: 'Resize' },
  ];

  return (
    <header className="w-full border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="font-mono font-bold text-sm tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2 hover:opacity-80"
          >
            <span className="bg-neutral-900 text-white dark:bg-white dark:text-black px-1.5 py-0.5 text-xs font-semibold">
              FOT
            </span>
            <span>freeonlinetools</span>
          </Link>

          <nav className="hidden sm:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-xs font-medium px-3 py-1.5 transition-colors ${
                    isActive
                      ? 'bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 font-semibold'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-mono border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            100% Client-Side
          </div>
        </div>
      </div>
    </header>
  );
}
