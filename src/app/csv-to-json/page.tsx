'use client';

import React, { useState, useEffect, useRef } from 'react';
import Dropzone from '@/components/Dropzone';
import {
  convertCsvToJson,
  convertJsonToCsv,
  detectDelimiter,
} from '@/lib/data-conversion';
import { formatBytes, downloadBlob } from '@/lib/image-processing';
import {
  Copy,
  Check,
  Download,
  Trash2,
  Table as TableIcon,
  Code2,
  FileSpreadsheet,
  ArrowRightLeft,
  Sparkles,
} from 'lucide-react';

const SAMPLE_CSV = `id,name,role,department,salary,active
1,Sarah Connor,Security Lead,Engineering,125000,true
2,John Doe,Frontend Engineer,Engineering,98000,true
3,Elena Rostova,Product Manager,Product,115000,false
4,Marcus Vance,Data Scientist,Analytics,132000,true
5,Aaliyah Khan,UX Designer,Design,92000,true`;

const SAMPLE_JSON = `[
  {
    "id": 1,
    "name": "Sarah Connor",
    "role": "Security Lead",
    "department": "Engineering",
    "salary": 125000,
    "active": true
  },
  {
    "id": 2,
    "name": "John Doe",
    "role": "Frontend Engineer",
    "department": "Engineering",
    "salary": 98000,
    "active": true
  },
  {
    "id": 3,
    "name": "Elena Rostova",
    "role": "Product Manager",
    "department": "Product",
    "salary": 115000,
    "active": false
  }
]`;

export default function CsvToJsonPage() {
  const [mode, setMode] = useState<'csv-to-json' | 'json-to-csv'>('csv-to-json');
  const [inputText, setInputText] = useState<string>('');
  const [outputText, setOutputText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // CSV to JSON settings
  const [delimiter, setDelimiter] = useState<'auto' | ',' | ';' | '\t' | '|'>('auto');
  const [hasHeaders, setHasHeaders] = useState<boolean>(true);
  const [inferTypes, setInferTypes] = useState<boolean>(true);
  const [indent, setIndent] = useState<2 | 4 | 'minified'>(2);

  // JSON to CSV settings
  const [jsonDelimiter, setJsonDelimiter] = useState<',' | ';' | '\t' | '|'>(',');
  const [wrapQuotes, setWrapQuotes] = useState<'auto' | 'all'>('auto');

  // Preview table data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [tableData, setTableData] = useState<{ headers: string[]; rows: any[] }>({
    headers: [],
    rows: [],
  });
  const [activeTab, setActiveTab] = useState<'editor' | 'table'>('editor');
  const [copied, setCopied] = useState<boolean>(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Conversion logic debounced to avoid React 19 synchronous setState gotchas
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (!inputText.trim()) {
        setOutputText('');
        setError(null);
        setTableData({ headers: [], rows: [] });
        return;
      }

      try {
        if (mode === 'csv-to-json') {
          const res = convertCsvToJson(inputText, {
            delimiter,
            hasHeaders,
            inferTypes,
            indent,
          });
          setOutputText(res.jsonString);
          setError(null);
          setTableData({
            headers: res.headers,
            rows: res.data.slice(0, 50), // Show first 50 rows in table preview
          });
        } else {
          const res = convertJsonToCsv(inputText, {
            delimiter: jsonDelimiter,
            wrapQuotes,
          });
          setOutputText(res);
          setError(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse input');
        setOutputText('');
      }
    }, 150);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [
    inputText,
    mode,
    delimiter,
    hasHeaders,
    inferTypes,
    indent,
    jsonDelimiter,
    wrapQuotes,
  ]);

  const handleFileUpload = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    const text = await file.text();
    setInputText(text);

    // Auto-detect direction from extension
    if (file.name.endsWith('.json')) {
      setMode('json-to-csv');
    } else if (file.name.endsWith('.csv') || file.name.endsWith('.tsv')) {
      setMode('csv-to-json');
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
    const isJson = mode === 'csv-to-json';
    const blob = new Blob([outputText], {
      type: isJson ? 'application/json' : 'text/csv',
    });
    const filename = isJson ? 'converted.json' : 'converted.csv';
    downloadBlob(blob, filename);
  };

  const loadSample = () => {
    if (mode === 'csv-to-json') {
      setInputText(SAMPLE_CSV);
    } else {
      setInputText(SAMPLE_JSON);
    }
  };

  const switchMode = (newMode: 'csv-to-json' | 'json-to-csv') => {
    setMode(newMode);
    setInputText(outputText || '');
    setOutputText('');
    setError(null);
  };

  const detectedDelim =
    mode === 'csv-to-json' && delimiter === 'auto' && inputText
      ? detectDelimiter(inputText)
      : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 w-full flex-1">
      {/* Header */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 pb-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 text-[11px] font-mono border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200">
                100% Client-Side • Data Utility
              </span>
              <span className="text-xs text-neutral-400 font-mono">
                RFC-4180 Compliant
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-neutral-950 dark:text-neutral-50">
              CSV ↔ JSON Converter
            </h1>
            <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              Convert tabular CSV/TSV data to JSON and JSON to CSV with delimiter detection, type parsing, and table preview.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="inline-flex border border-neutral-300 dark:border-neutral-700 p-0.5 bg-neutral-100 dark:bg-neutral-900 self-start sm:self-auto">
            <button
              onClick={() => switchMode('csv-to-json')}
              className={`px-3 py-1.5 text-xs font-mono font-medium transition-colors cursor-pointer ${
                mode === 'csv-to-json'
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-black font-semibold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              CSV → JSON
            </button>
            <button
              onClick={() => switchMode('json-to-csv')}
              className={`px-3 py-1.5 text-xs font-mono font-medium transition-colors cursor-pointer ${
                mode === 'json-to-csv'
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-black font-semibold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              JSON → CSV
            </button>
          </div>
        </div>
      </div>

      {/* Control & Configuration Toolbar */}
      <div className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
            {mode === 'csv-to-json' ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-neutral-500">Delimiter:</span>
                  <select
                    value={delimiter}
                    onChange={(e) =>
                      setDelimiter(
                        e.target.value as 'auto' | ',' | ';' | '\t' | '|'
                      )
                    }
                    className="border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-xs font-mono text-neutral-800 dark:text-neutral-200"
                  >
                    <option value="auto">
                      Auto-detect {detectedDelim ? `(${detectedDelim === '\t' ? 'TAB' : detectedDelim})` : ''}
                    </option>
                    <option value=",">Comma (,)</option>
                    <option value=";">Semicolon (;)</option>
                    <option value="&#9;">Tab (\t)</option>
                    <option value="|">Pipe (|)</option>
                  </select>
                </div>

                <label className="flex items-center gap-1.5 cursor-pointer text-neutral-700 dark:text-neutral-300">
                  <input
                    type="checkbox"
                    checked={hasHeaders}
                    onChange={(e) => setHasHeaders(e.target.checked)}
                    className="rounded-none border-neutral-300 dark:border-neutral-700 text-neutral-900"
                  />
                  <span>First row as headers</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer text-neutral-700 dark:text-neutral-300">
                  <input
                    type="checkbox"
                    checked={inferTypes}
                    onChange={(e) => setInferTypes(e.target.checked)}
                    className="rounded-none border-neutral-300 dark:border-neutral-700 text-neutral-900"
                  />
                  <span>Parse numbers & booleans</span>
                </label>

                <div className="flex items-center gap-2">
                  <span className="text-neutral-500">Indent:</span>
                  <select
                    value={indent}
                    onChange={(e) =>
                      setIndent(
                        e.target.value === 'minified'
                          ? 'minified'
                          : (Number(e.target.value) as 2 | 4)
                      )
                    }
                    className="border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-xs font-mono text-neutral-800 dark:text-neutral-200"
                  >
                    <option value="2">2 Spaces</option>
                    <option value="4">4 Spaces</option>
                    <option value="minified">Compact (Minified)</option>
                  </select>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-neutral-500">Output Delimiter:</span>
                  <select
                    value={jsonDelimiter}
                    onChange={(e) =>
                      setJsonDelimiter(
                        e.target.value as ',' | ';' | '\t' | '|'
                      )
                    }
                    className="border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-xs font-mono text-neutral-800 dark:text-neutral-200"
                  >
                    <option value=",">Comma (,)</option>
                    <option value=";">Semicolon (;)</option>
                    <option value="&#9;">Tab (\t)</option>
                    <option value="|">Pipe (|)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-neutral-500">Quotes:</span>
                  <select
                    value={wrapQuotes}
                    onChange={(e) =>
                      setWrapQuotes(e.target.value as 'auto' | 'all')
                    }
                    className="border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-xs font-mono text-neutral-800 dark:text-neutral-200"
                  >
                    <option value="auto">Only when required</option>
                    <option value="all">Wrap all fields</option>
                  </select>
                </div>
              </>
            )}
          </div>

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
                  setError(null);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-red-400 text-red-600 dark:text-red-400 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Dropzone for fast file loading */}
      {!inputText && (
        <div className="mb-6">
          <Dropzone
            onFilesSelected={handleFileUpload}
            accept=".csv,.tsv,.json,.txt"
            label="Drop CSV or JSON file here"
            helperText="Supports CSV, TSV, JSON, and raw text files up to 100MB"
            icon={FileSpreadsheet}
          />
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-3 border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs font-mono">
          <strong>Syntax Error:</strong> {error}
        </div>
      )}

      {/* Split Editors: Input & Output */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Input Column */}
        <div className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex flex-col h-[520px]">
          <div className="border-b border-neutral-200 dark:border-neutral-800 px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold text-neutral-900 dark:text-neutral-100">
                Input ({mode === 'csv-to-json' ? 'CSV' : 'JSON'})
              </span>
              {inputText && (
                <span className="text-[11px] font-mono text-neutral-400">
                  {formatBytes(new Blob([inputText]).size)} • {inputText.split('\n').length} lines
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => switchMode(mode === 'csv-to-json' ? 'json-to-csv' : 'csv-to-json')}
                title="Swap Direction"
                className="p-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              mode === 'csv-to-json'
                ? 'Paste CSV or TSV data here...\n\nExample:\nid,name,role\n1,Alice,Engineer\n2,Bob,Designer'
                : 'Paste JSON data here...\n\nExample:\n[\n  {"id": 1, "name": "Alice"},\n  {"id": 2, "name": "Bob"}\n]'
            }
            className="flex-1 w-full p-4 font-mono text-xs bg-transparent text-neutral-900 dark:text-neutral-100 resize-none focus:outline-none leading-relaxed"
            spellCheck={false}
          />
        </div>

        {/* Output Column */}
        <div className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex flex-col h-[520px]">
          <div className="border-b border-neutral-200 dark:border-neutral-800 px-4 py-2 bg-neutral-50 dark:bg-neutral-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold text-neutral-900 dark:text-neutral-100">
                Output ({mode === 'csv-to-json' ? 'JSON' : 'CSV'})
              </span>
              {outputText && (
                <span className="text-[11px] font-mono text-neutral-400">
                  {formatBytes(new Blob([outputText]).size)}
                </span>
              )}
            </div>

            {/* View Tab Toggle (Code vs Table preview) */}
            <div className="flex items-center gap-2">
              {mode === 'csv-to-json' && tableData.rows.length > 0 && (
                <div className="inline-flex border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-[11px] font-mono">
                  <button
                    onClick={() => setActiveTab('editor')}
                    className={`px-2 py-1 flex items-center gap-1 cursor-pointer ${
                      activeTab === 'editor'
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-black font-semibold'
                        : 'text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    <Code2 className="w-3 h-3" />
                    <span>Code</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('table')}
                    className={`px-2 py-1 flex items-center gap-1 cursor-pointer ${
                      activeTab === 'table'
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-black font-semibold'
                        : 'text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    <TableIcon className="w-3 h-3" />
                    <span>Table</span>
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

          {activeTab === 'editor' || mode === 'json-to-csv' ? (
            <textarea
              value={outputText}
              readOnly
              placeholder="Converted output will appear here automatically..."
              className="flex-1 w-full p-4 font-mono text-xs bg-neutral-50/50 dark:bg-neutral-900/30 text-neutral-900 dark:text-neutral-100 resize-none focus:outline-none leading-relaxed"
              spellCheck={false}
            />
          ) : (
            <div className="flex-1 overflow-auto p-2 bg-neutral-50/30 dark:bg-neutral-900/20">
              <table className="w-full text-left text-xs font-mono border-collapse border border-neutral-200 dark:border-neutral-800">
                <thead>
                  <tr className="bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
                    <th className="p-2 border-r border-neutral-200 dark:border-neutral-800 text-neutral-400 w-12 text-center">
                      #
                    </th>
                    {tableData.headers.map((h, i) => (
                      <th
                        key={i}
                        className="p-2 border-r border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 font-semibold whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableData.rows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className="border-b border-neutral-100 dark:border-neutral-900 hover:bg-neutral-100/60 dark:hover:bg-neutral-900/60"
                    >
                      <td className="p-2 border-r border-neutral-200 dark:border-neutral-800 text-neutral-400 text-center text-[10px]">
                        {rIdx + 1}
                      </td>
                      {tableData.headers.map((h, cIdx) => (
                        <td
                          key={cIdx}
                          className="p-2 border-r border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 truncate max-w-xs"
                        >
                          {row[h] !== undefined && row[h] !== null
                            ? String(row[h])
                            : ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {tableData.rows.length >= 50 && (
                <div className="text-center py-2 text-[11px] font-mono text-neutral-400">
                  Showing first 50 rows in table preview. Full dataset available in Code and Download.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
