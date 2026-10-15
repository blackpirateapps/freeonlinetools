'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  FileArchive,
  Crop as CropIcon,
  Scaling,
  Search,
  ShieldCheck,
  Cpu,
  ArrowRight,
  Sparkles,
  Layers,
  Palette,
  FileCode,
  FileCheck,
  Scissors,
  Split,
  FileImage,
  RotateCw,
  Stamp,
  FileSpreadsheet,
  FileCode2,
  FileText,
} from 'lucide-react';

interface ToolCard {
  id: string;
  title: string;
  description: string;
  href: string;
  category: 'Image' | 'Optimization' | 'Transform' | 'PDF' | 'Data & Text';
  icon: React.ComponentType<{ className?: string }>;
  tags: string[];
  status: 'available' | 'planned';
}

const TOOLS: ToolCard[] = [
  {
    id: 'merge-pdf',
    title: 'PDF Merger',
    description:
      'Combine multiple PDF documents into a single document with drag-and-drop sequencing and page count previews.',
    href: '/merge-pdf',
    category: 'PDF',
    icon: FileCheck,
    tags: ['PDF', 'Merge', 'Combine', 'Reorder'],
    status: 'available',
  },
  {
    id: 'split-pdf',
    title: 'Split & Extract PDF',
    description:
      'Extract page ranges, delete unwanted pages, or split every page into separate files with visual thumbnail grid.',
    href: '/split-pdf',
    category: 'PDF',
    icon: Scissors,
    tags: ['PDF', 'Split', 'Extract', 'Thumbnails'],
    status: 'available',
  },
  {
    id: 'extract-odd-even-pdf',
    title: 'Extract Odd & Even Pages',
    description:
      '1-click duplex separation — extract odd pages, even pages, or download both as a ZIP bundle for scanning and printing.',
    href: '/extract-odd-even-pdf',
    category: 'PDF',
    icon: Split,
    tags: ['PDF', 'Duplex', 'Odd/Even', 'Print'],
    status: 'available',
  },
  {
    id: 'images-to-pdf',
    title: 'Images to PDF Converter',
    description:
      'Convert JPG, PNG, and WebP images to a clean PDF with A4/Letter sizing, auto-orientation, and margin presets.',
    href: '/images-to-pdf',
    category: 'PDF',
    icon: FileImage,
    tags: ['Images', 'PDF', 'A4', 'Layout'],
    status: 'available',
  },
  {
    id: 'pdf-to-images',
    title: 'PDF to Images Converter',
    description:
      'Rasterize PDF pages into high-resolution PNG, WebP, or JPEG with HiDPI scale (1x-3x) and direct image tool chaining.',
    href: '/pdf-to-images',
    category: 'PDF',
    icon: Layers,
    tags: ['PDF', 'Rasterize', 'PNG', 'HiDPI'],
    status: 'available',
  },
  {
    id: 'rotate-pdf',
    title: 'Rotate & Organize PDF',
    description:
      'Rotate individual or all pages (90° CW, 90° CCW, 180°), delete pages, and reorder with live visual orientation.',
    href: '/rotate-pdf',
    category: 'PDF',
    icon: RotateCw,
    tags: ['PDF', 'Rotate', 'Organize', 'Orient'],
    status: 'available',
  },
  {
    id: 'watermark-pdf',
    title: 'PDF Watermark & Page Numbers',
    description:
      'Add custom text stamps ("CONFIDENTIAL", "DRAFT") with opacity controls, and "Page X of Y" headers/footers.',
    href: '/watermark-pdf',
    category: 'PDF',
    icon: Stamp,
    tags: ['PDF', 'Watermark', 'Page Numbers', 'Stamp'],
    status: 'available',
  },
  {
    id: 'compress',
    title: 'Image Compressor',
    description:
      'Reduce file size with real-time WebP/JPEG quality controls, split comparison slider, and bulk ZIP export.',
    href: '/compress',
    category: 'Optimization',
    icon: FileArchive,
    tags: ['WebP', 'JPEG', 'Batch', 'ZIP'],
    status: 'available',
  },
  {
    id: 'crop',
    title: 'Image Cropper',
    description:
      'Crop, rotate, and frame images with customizable aspect ratios (1:1, 16:9, 4:3, 9:16), zoom, and flip.',
    href: '/crop',
    category: 'Transform',
    icon: CropIcon,
    tags: ['Aspect Ratio', 'Rotation', 'Flip', 'Canvas'],
    status: 'available',
  },
  {
    id: 'resize',
    title: 'Image Resizer',
    description:
      'Scale dimensions by exact pixels or percentage with aspect ratio lock and high-resolution resampling.',
    href: '/resize',
    category: 'Transform',
    icon: Scaling,
    tags: ['Dimensions', 'Aspect Lock', 'Scale %', 'Batch'],
    status: 'available',
  },
  {
    id: 'svg-png',
    title: 'SVG to PNG Converter',
    description:
      'Rasterize vector SVG images to crisp high-density PNG or WebP at custom resolution multipliers (1x, 2x, 4x, 8x).',
    href: '/svg-to-png',
    category: 'Image',
    icon: Layers,
    tags: ['Vector', 'HiDPI', 'Rasterize'],
    status: 'available',
  },
  {
    id: 'palette',
    title: 'Image Color Extractor',
    description:
      'Extract prominent dominant color palettes and HEX / RGB / HSL codes with canvas eyedropper sampling.',
    href: '/color-extractor',
    category: 'Image',
    icon: Palette,
    tags: ['Palette', 'HEX', 'RGB', 'Eyedropper'],
    status: 'available',
  },
  {
    id: 'base64',
    title: 'Base64 Image Encoder',
    description:
      'Encode images to Data URI / Base64 snippets (HTML, CSS, Markdown) and decode Base64 back to image files.',
    href: '/base64',
    category: 'Optimization',
    icon: FileCode,
    tags: ['Base64', 'Data URI', 'HTML/CSS', 'Decode'],
    status: 'available',
  },
  {
    id: 'csv-to-json',
    title: 'CSV ↔ JSON Converter',
    description:
      'Convert tabular CSV/TSV to structured JSON and JSON to CSV with auto delimiter detection, type inference, and table preview.',
    href: '/csv-to-json',
    category: 'Data & Text',
    icon: FileSpreadsheet,
    tags: ['CSV', 'JSON', 'TSV', 'Table', 'RFC-4180'],
    status: 'available',
  },
  {
    id: 'yaml-to-json',
    title: 'YAML ↔ JSON Converter',
    description:
      'Convert configurations between YAML and JSON bidirectionally with line-accurate syntax error linting and custom indentation.',
    href: '/yaml-to-json',
    category: 'Data & Text',
    icon: FileCode2,
    tags: ['YAML', 'JSON', 'Config', 'Kubernetes', 'Docker'],
    status: 'available',
  },
  {
    id: 'markdown-to-html',
    title: 'Markdown ↔ HTML Converter',
    description:
      'Convert Markdown to HTML with live rendered preview and HTML to Markdown with GitHub-flavored markdown styling.',
    href: '/markdown-to-html',
    category: 'Data & Text',
    icon: FileText,
    tags: ['Markdown', 'HTML', 'GFM', 'Docs', 'WYSIWYG'],
    status: 'available',
  },
  {
    id: 'convert-image',
    title: 'Image Converter & Favicon Generator',
    description:
      'Convert images between WebP, PNG, JPEG, and multi-resolution Windows ICO favicons with batch queue and ZIP export.',
    href: '/convert-image',
    category: 'Image',
    icon: Layers,
    tags: ['WebP', 'PNG', 'JPEG', 'ICO', 'Favicon', 'Batch'],
    status: 'available',
  },
];

const CATEGORIES = ['All', 'Data & Text', 'PDF', 'Image', 'Optimization', 'Transform'];

export default function HomePage() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const filteredTools = TOOLS.filter((tool) => {
    const matchesCategory =
      activeCategory === 'All' || tool.category === activeCategory;
    const matchesSearch =
      tool.title.toLowerCase().includes(search.toLowerCase()) ||
      tool.description.toLowerCase().includes(search.toLowerCase()) ||
      tool.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 w-full flex-1">
      {/* Hero Header - strictly flat and utilitarian */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 pb-8 mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="px-2 py-0.5 text-[11px] font-mono border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200">
            Open Source • Client-Side
          </span>
          <span className="text-xs text-neutral-400 font-mono">No telemetry • No cloud storage</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold font-mono tracking-tight text-neutral-950 dark:text-neutral-50 mb-3">
          Free Online Tools
        </h1>
        <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 max-w-2xl leading-relaxed">
          Fast, private image utilities that execute entirely in your web browser. Your photos never leave your device or touch a server.
        </p>

        {/* Search & Category Filter Toolbar */}
        <div className="mt-8 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search tools (e.g. compress, crop, resize)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:border-neutral-900 dark:focus:border-white"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 text-xs font-mono border cursor-pointer transition-colors whitespace-nowrap ${
                  activeCategory === cat
                    ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-black font-semibold'
                    : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
        {filteredTools.map((tool) => {
          const Icon = tool.icon;
          const isAvailable = tool.status === 'available';

          const CardContent = (
            <div
              className={`h-full border p-5 flex flex-col justify-between transition-colors ${
                isAvailable
                  ? 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 hover:border-neutral-900 dark:hover:border-neutral-200'
                  : 'border-neutral-200/60 dark:border-neutral-850 bg-neutral-50/50 dark:bg-neutral-950/40 opacity-70'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="w-8 h-8 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center bg-neutral-50 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 border ${
                      isAvailable
                        ? 'border-emerald-200 dark:border-emerald-800/80 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                        : 'border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 text-neutral-500'
                    }`}
                  >
                    {isAvailable ? 'Ready to use' : 'Planned'}
                  </span>
                </div>

                <h3 className="text-sm font-bold font-mono text-neutral-900 dark:text-neutral-100 mb-2 flex items-center gap-1.5">
                  <span>{tool.title}</span>
                  {isAvailable && (
                    <ArrowRight className="w-3 h-3 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed mb-4">
                  {tool.description}
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-3 border-t border-neutral-100 dark:border-neutral-900 text-[10px] font-mono text-neutral-500">
                {tool.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-1.5 py-0.5 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          );

          if (isAvailable) {
            return (
              <Link key={tool.id} href={tool.href} className="group block">
                {CardContent}
              </Link>
            );
          }

          return <div key={tool.id}>{CardContent}</div>;
        })}
      </div>

      {/* Flat Utilitarian Architecture & Privacy Explanation */}
      <div className="border border-neutral-200 dark:border-neutral-800 p-6 bg-neutral-50 dark:bg-neutral-950">
        <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100 mb-4">
          How Privacy & Local Processing Work
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 font-mono font-semibold text-neutral-900 dark:text-neutral-100">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Zero Server Uploads</span>
            </div>
            <p>
              Your images are read using the browser&apos;s FileReader and Canvas APIs. No network payload containing image data ever leaves your browser.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 font-mono font-semibold text-neutral-900 dark:text-neutral-100">
              <Cpu className="w-4 h-4 text-neutral-900 dark:text-neutral-100" />
              <span>Client-Side Hardware</span>
            </div>
            <p>
              Transformations, cropping, and compression run using your computer&apos;s own CPU/GPU via hardware-accelerated canvas contexts.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 font-mono font-semibold text-neutral-900 dark:text-neutral-100">
              <Sparkles className="w-4 h-4 text-neutral-900 dark:text-neutral-100" />
              <span>Seamless Tool Chaining</span>
            </div>
            <p>
              Chain tasks in memory. Crop an image on the cropper, then pass the result directly to the compressor without re-downloading or re-uploading.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
