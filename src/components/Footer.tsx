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
        <div className="flex flex-wrap items-center gap-3 font-mono">
          <Link href="/csv-to-json" className="hover:underline">CSV↔JSON</Link>
          <Link href="/yaml-to-json" className="hover:underline">YAML↔JSON</Link>
          <Link href="/markdown-to-html" className="hover:underline">MD↔HTML</Link>
          <Link href="/convert-image" className="hover:underline">Convert</Link>
          <Link href="/merge-pdf" className="hover:underline">Merge</Link>
          <Link href="/split-pdf" className="hover:underline">Split</Link>
          <Link href="/extract-odd-even-pdf" className="hover:underline">Odd/Even</Link>
          <Link href="/images-to-pdf" className="hover:underline">Img→PDF</Link>
          <Link href="/pdf-to-images" className="hover:underline">PDF→Img</Link>
          <Link href="/rotate-pdf" className="hover:underline">Rotate</Link>
          <Link href="/watermark-pdf" className="hover:underline">Watermark</Link>
          <Link href="/compress" className="hover:underline">Compress</Link>
          <Link href="/crop" className="hover:underline">Crop</Link>
          <Link href="/resize" className="hover:underline">Resize</Link>
        </div>
      </div>
    </footer>
  );
}
