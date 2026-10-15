'use client';

import React, { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import Dropzone from '@/components/Dropzone';
import { convertHtmlToMarkdown } from '@/lib/data-conversion';
import { formatBytes, downloadBlob } from '@/lib/image-processing';
import {
  Copy,
  Check,
  Download,
  Trash2,
  FileText,
  Code2,
  Eye,
  ArrowRightLeft,
  Sparkles,
} from 'lucide-react';

const SAMPLE_MARKDOWN = `# Project Documentation

Welcome to **FreeOnlineTools**, an open-source suite of *100% client-side* browser utilities.

## Core Features
- **Zero Server Uploads**: Privacy guaranteed through local browser processing.
- **Fast Performance**: Instant operations powered by hardware acceleration.
- **Tool Chaining**: Seamless handoff between editors.

### Quick Example Code
\`\`\`typescript
import { convertCsvToJson } from '@/lib/data-conversion';

const result = convertCsvToJson(rawCsv, {
  delimiter: 'auto',
  hasHeaders: true,
  inferTypes: true,
  indent: 2,
});
console.log(result.data);
\`\`\`

### Data Comparison Matrix

| Feature | Local Browser | Cloud Service |
| :--- | :--- | :--- |
| **Privacy** | 100% Private (0 bytes sent) | Data stored on server |
| **Latency** | Instantaneous | Network dependent |
| **Cost** | Free forever | Subscription / Paywall |

> "Simplicity is prerequisite for reliability." — Edsger W. Dijkstra

Visit our [Home Directory](/) to explore all available tools.
`;

const SAMPLE_HTML = `<h1>Project Documentation</h1>
<p>Welcome to <strong>FreeOnlineTools</strong>, an open-source suite of <em>100% client-side</em> browser utilities.</p>
<h2>Core Features</h2>
<ul>
  <li><strong>Zero Server Uploads</strong>: Privacy guaranteed.</li>
  <li><strong>Fast Performance</strong>: Instant canvas processing.</li>
</ul>
<blockquote>"Simplicity is prerequisite for reliability."</blockquote>`;

export default function MarkdownToHtmlPage() {
  const [mode, setMode] = useState<'md-to-html' | 'html-to-md'>('md-to-html');
  const [inputText, setInputText] = useState<string>('');
  const [outputText, setOutputText] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [copied, setCopied] = useState<boolean>(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      if (!inputText.trim()) {
        setOutputText('');
        return;
      }

      try {
        if (mode === 'md-to-html') {
          const parsed = await marked.parse(inputText, {
            gfm: true,
            breaks: true,
          });
          setOutputText(parsed);
        } else {
          const parsed = convertHtmlToMarkdown(inputText);
          setOutputText(parsed);
        }
      } catch (err) {
        console.error('Conversion error:', err);
      }
    }, 150);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [inputText, mode]);

  const handleFileUpload = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    const text = await file.text();
    setInputText(text);

    if (file.name.endsWith('.html') || file.name.endsWith('.htm')) {
      setMode('html-to-md');
    } else if (file.name.endsWith('.md') || file.name.endsWith('.markdown')) {
      setMode('md-to-html');
    }
  };

  const handleCopy = () => {
    if (!outputText) return;
    navigator.clipboard.writeText(outputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!outputText) return;
    const isHtml = mode === 'md-to-html';
    const blob = new Blob([outputText], {
      type: isHtml ? 'text/html' : 'text/markdown',
    });
    const filename = isHtml ? 'document.html' : 'document.md';
    downloadBlob(blob, filename);
  };

  const loadSample = () => {
    if (mode === 'md-to-html') {
      setInputText(SAMPLE_MARKDOWN);
    } else {
      setInputText(SAMPLE_HTML);
    }
  };

  const switchMode = (newMode: 'md-to-html' | 'html-to-md') => {
    setMode(newMode);
    setInputText(outputText || '');
    setOutputText('');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 w-full flex-1">
      {/* Header */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 pb-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 text-[11px] font-mono border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200">
                100% Client-Side • Document Utility
              </span>
              <span className="text-xs text-neutral-400 font-mono">
                GitHub-Flavored Markdown (GFM)
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-neutral-950 dark:text-neutral-50">
              Markdown ↔ HTML Converter
            </h1>
            <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              Convert Markdown to HTML with live rendered preview and HTML to Markdown with clean formatting.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="inline-flex border border-neutral-300 dark:border-neutral-700 p-0.5 bg-neutral-100 dark:bg-neutral-900 self-start sm:self-auto">
            <button
              onClick={() => switchMode('md-to-html')}
              className={`px-3 py-1.5 text-xs font-mono font-medium transition-colors cursor-pointer ${
                mode === 'md-to-html'
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-black font-semibold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Markdown → HTML
            </button>
            <button
              onClick={() => switchMode('html-to-md')}
              className={`px-3 py-1.5 text-xs font-mono font-medium transition-colors cursor-pointer ${
                mode === 'html-to-md'
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-black font-semibold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              HTML → Markdown
            </button>
          </div>
        </div>
      </div>

      {/* Control Toolbar */}
      <div className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 p-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={loadSample}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-neutral-500 text-neutral-700 dark:text-neutral-300 cursor-pointer"
          >
            <Sparkles className="w-3 h-3 text-neutral-500" />
            <span>Load Sample</span>
          </button>
          {inputText && (
            <button
              onClick={() => {
                setInputText('');
                setOutputText('');
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-red-400 text-red-600 dark:text-red-400 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}
        </div>

        <div className="text-xs font-mono text-neutral-500">
          Instant client-side rendering
        </div>
      </div>

      {/* Dropzone */}
      {!inputText && (
        <div className="mb-6">
          <Dropzone
            onFilesSelected={handleFileUpload}
            accept=".md,.markdown,.html,.htm,.txt"
            label="Drop Markdown or HTML document here"
            helperText="Supports .md, .markdown, .html, and plain text files"
            icon={FileText}
          />
        </div>
      )}

      {/* Split Editors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Input Column */}
        <div className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex flex-col h-[560px]">
          <div className="border-b border-neutral-200 dark:border-neutral-800 px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold text-neutral-900 dark:text-neutral-100">
                Input ({mode === 'md-to-html' ? 'Markdown' : 'HTML'})
              </span>
              {inputText && (
                <span className="text-[11px] font-mono text-neutral-400">
                  {formatBytes(new Blob([inputText]).size)} • {inputText.split('\n').length} lines
                </span>
              )}
            </div>
            <button
              onClick={() => switchMode(mode === 'md-to-html' ? 'html-to-md' : 'md-to-html')}
              title="Swap Direction"
              className="p-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 cursor-pointer"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
            </button>
          </div>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              mode === 'md-to-html'
                ? '# Type or paste Markdown here...\n\nUse **bold**, *italic*, [links](https://...), or `code` snippets.'
                : '<h1>Type or paste HTML here...</h1>\n\n<p>HTML elements will be automatically converted to Markdown.</p>'
            }
            className="flex-1 w-full p-4 font-mono text-xs bg-transparent text-neutral-900 dark:text-neutral-100 resize-none focus:outline-none leading-relaxed"
            spellCheck={false}
          />
        </div>

        {/* Output Column */}
        <div className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex flex-col h-[560px]">
          <div className="border-b border-neutral-200 dark:border-neutral-800 px-4 py-2 bg-neutral-50 dark:bg-neutral-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold text-neutral-900 dark:text-neutral-100">
                Output ({mode === 'md-to-html' ? 'HTML' : 'Markdown'})
              </span>
              {outputText && (
                <span className="text-[11px] font-mono text-neutral-400">
                  {formatBytes(new Blob([outputText]).size)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {mode === 'md-to-html' && (
                <div className="inline-flex border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-[11px] font-mono">
                  <button
                    onClick={() => setActiveTab('preview')}
                    className={`px-2 py-1 flex items-center gap-1 cursor-pointer ${
                      activeTab === 'preview'
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-black font-semibold'
                        : 'text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    <Eye className="w-3 h-3" />
                    <span>Preview</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('code')}
                    className={`px-2 py-1 flex items-center gap-1 cursor-pointer ${
                      activeTab === 'code'
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-black font-semibold'
                        : 'text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    <Code2 className="w-3 h-3" />
                    <span>HTML</span>
                  </button>
                </div>
              )}

              <button
                onClick={handleCopy}
                disabled={!outputText}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-neutral-500 disabled:opacity-40 text-neutral-800 dark:text-neutral-200 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>

              <button
                onClick={handleDownload}
                disabled={!outputText}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono bg-neutral-900 text-white dark:bg-white dark:text-black hover:opacity-90 disabled:opacity-40 cursor-pointer font-medium"
              >
                <Download className="w-3 h-3" />
                <span>Download</span>
              </button>
            </div>
          </div>

          {mode === 'md-to-html' && activeTab === 'preview' ? (
            <div
              className="flex-1 overflow-auto p-6 text-sm text-neutral-800 dark:text-neutral-200 prose prose-neutral dark:prose-invert max-w-none [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-3 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:mt-4 [&_h3]:mb-2 [&_p]:mb-3 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4 [&_li]:mb-1 [&_blockquote]:border-l-2 [&_blockquote]:border-neutral-300 [&_blockquote]:dark:border-neutral-700 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-4 [&_code]:font-mono [&_code]:text-xs [&_code]:bg-neutral-100 [&_code]:dark:bg-neutral-900 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:border [&_code]:border-neutral-200 [&_code]:dark:border-neutral-800 [&_pre]:bg-neutral-100 [&_pre]:dark:bg-neutral-900 [&_pre]:p-4 [&_pre]:border [&_pre]:border-neutral-200 [&_pre]:dark:border-neutral-800 [&_pre]:overflow-x-auto [&_pre]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:border [&_table]:border-neutral-200 [&_table]:dark:border-neutral-800 [&_table]:my-4 [&_th]:border [&_th]:border-neutral-200 [&_th]:dark:border-neutral-800 [&_th]:p-2 [&_th]:bg-neutral-100 [&_th]:dark:bg-neutral-900 [&_td]:border [&_td]:border-neutral-200 [&_td]:dark:border-neutral-800 [&_td]:p-2"
              dangerouslySetInnerHTML={{ __html: outputText }}
            />
          ) : (
            <textarea
              value={outputText}
              readOnly
              placeholder="Converted output will appear here automatically..."
              className="flex-1 w-full p-4 font-mono text-xs bg-neutral-50/50 dark:bg-neutral-900/30 text-neutral-900 dark:text-neutral-100 resize-none focus:outline-none leading-relaxed"
              spellCheck={false}
            />
          )}
        </div>
      </div>
    </div>
  );
}
