import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="w-full border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 py-6 mt-auto text-xs text-neutral-500 dark:text-neutral-400">
      <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-neutral-700 dark:text-neutral-300 font-medium">FreeOnlineTools</span>
          <span>—</span>
          <span>All operations happen in your browser via HTML5 Canvas. Zero data leaves your computer.</span>
        </div>
        <div className="flex items-center gap-4 font-mono">
          <Link href="/compress" className="hover:underline">Compress</Link>
          <Link href="/crop" className="hover:underline">Crop</Link>
          <Link href="/resize" className="hover:underline">Resize</Link>
        </div>
      </div>
    </footer>
  );
}
