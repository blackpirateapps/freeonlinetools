'use client';

import React, { useState, useEffect, useRef } from 'react';
import { load, dump } from 'js-yaml';
import Dropzone from '@/components/Dropzone';
import { formatBytes, downloadBlob } from '@/lib/image-processing';
import {
  Copy,
  Check,
  Download,
  Trash2,
  FileCode2,
  ArrowRightLeft,
  Sparkles,
  AlertCircle,
} from 'lucide-react';

const SAMPLE_YAML = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-api
  labels:
    app: web-api
    tier: frontend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web-api
  template:
    metadata:
      labels:
        app: web-api
    spec:
      containers:
        - name: web
          image: nginx:1.25-alpine
          ports:
            - containerPort: 80
          resources:
            limits:
              cpu: "500m"
              memory: "256Mi"
            requests:
              cpu: "100m"
              memory: "64Mi"`;

const SAMPLE_JSON = `{
  "apiVersion": "apps/v1",
  "kind": "Deployment",
  "metadata": {
    "name": "web-api",
    "labels": {
      "app": "web-api",
      "tier": "frontend"
    }
  },
  "spec": {
    "replicas": 3,
    "selector": {
      "matchLabels": {
        "app": "web-api"
      }
    },
    "template": {
      "metadata": {
        "labels": {
          "app": "web-api"
        }
      },
      "spec": {
        "containers": [
          {
            "name": "web",
            "image": "nginx:1.25-alpine",
            "ports": [
              {
                "containerPort": 80
              }
            ]
          }
        ]
      }
    }
  }
}`;

export default function YamlToJsonPage() {
  const [mode, setMode] = useState<'yaml-to-json' | 'json-to-yaml'>('yaml-to-json');
  const [inputText, setInputText] = useState<string>('');
  const [outputText, setOutputText] = useState<string>('');
  const [error, setError] = useState<{ message: string; line?: number; column?: number } | null>(null);

  const [jsonIndent, setJsonIndent] = useState<2 | 4 | 'minified'>(2);
  const [yamlIndent, setYamlIndent] = useState<2 | 4>(2);
  const [copied, setCopied] = useState<boolean>(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Conversion logic debounced to avoid React 19 synchronous setState
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (!inputText.trim()) {
        setOutputText('');
        setError(null);
        return;
      }

      try {
        if (mode === 'yaml-to-json') {
          // Parse YAML
          const parsed = load(inputText);
          if (parsed === undefined) {
            setOutputText('');
            setError(null);
            return;
          }
          const indent = jsonIndent === 'minified' ? 0 : jsonIndent;
          const result =
            indent === 0
              ? JSON.stringify(parsed)
              : JSON.stringify(parsed, null, indent);
          setOutputText(result);
          setError(null);
        } else {
          // Parse JSON then dump to YAML
          const parsed = JSON.parse(inputText);
          const result = dump(parsed, {
            indent: yamlIndent,
            lineWidth: -1, // prevent unwanted auto line wrapping
            noRefs: true,
          });
          setOutputText(result);
          setError(null);
        }
      } catch (err: unknown) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyErr = err as any;
        setError({
          message: anyErr.message || 'Syntax error while parsing input',
          line: anyErr.mark?.line !== undefined ? anyErr.mark.line + 1 : undefined,
          column: anyErr.mark?.column !== undefined ? anyErr.mark.column + 1 : undefined,
        });
        setOutputText('');
      }
    }, 150);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [inputText, mode, jsonIndent, yamlIndent]);

  const handleFileUpload = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    const text = await file.text();
    setInputText(text);

    if (file.name.endsWith('.json')) {
      setMode('json-to-yaml');
    } else if (file.name.endsWith('.yaml') || file.name.endsWith('.yml')) {
      setMode('yaml-to-json');
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
    const isJson = mode === 'yaml-to-json';
    const blob = new Blob([outputText], {
      type: isJson ? 'application/json' : 'text/yaml',
    });
    const filename = isJson ? 'converted.json' : 'converted.yaml';
    downloadBlob(blob, filename);
  };

  const loadSample = () => {
    if (mode === 'yaml-to-json') {
      setInputText(SAMPLE_YAML);
    } else {
      setInputText(SAMPLE_JSON);
    }
  };

  const switchMode = (newMode: 'yaml-to-json' | 'json-to-yaml') => {
    setMode(newMode);
    setInputText(outputText || '');
    setOutputText('');
    setError(null);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 w-full flex-1">
      {/* Header */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 pb-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 text-[11px] font-mono border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200">
                100% Client-Side • DevOps Utility
              </span>
              <span className="text-xs text-neutral-400 font-mono">
                Line-accurate syntax linting
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-neutral-950 dark:text-neutral-50">
              YAML ↔ JSON Converter
            </h1>
            <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              Convert configurations between YAML and JSON bidirectionally with real-time error detection and indentation control.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="inline-flex border border-neutral-300 dark:border-neutral-700 p-0.5 bg-neutral-100 dark:bg-neutral-900 self-start sm:self-auto">
            <button
              onClick={() => switchMode('yaml-to-json')}
              className={`px-3 py-1.5 text-xs font-mono font-medium transition-colors cursor-pointer ${
                mode === 'yaml-to-json'
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-black font-semibold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              YAML → JSON
            </button>
            <button
              onClick={() => switchMode('json-to-yaml')}
              className={`px-3 py-1.5 text-xs font-mono font-medium transition-colors cursor-pointer ${
                mode === 'json-to-yaml'
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-black font-semibold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              JSON → YAML
            </button>
          </div>
        </div>
      </div>

      {/* Control & Formatting Toolbar */}
      <div className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
            {mode === 'yaml-to-json' ? (
              <div className="flex items-center gap-2">
                <span className="text-neutral-500">JSON Indent:</span>
                <select
                  value={jsonIndent}
                  onChange={(e) =>
                    setJsonIndent(
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
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-neutral-500">YAML Indent:</span>
                <select
                  value={yamlIndent}
                  onChange={(e) =>
                    setYamlIndent(Number(e.target.value) as 2 | 4)
                  }
                  className="border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-xs font-mono text-neutral-800 dark:text-neutral-200"
                >
                  <option value="2">2 Spaces</option>
                  <option value="4">4 Spaces</option>
                </select>
              </div>
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

      {/* Dropzone */}
      {!inputText && (
        <div className="mb-6">
          <Dropzone
            onFilesSelected={handleFileUpload}
            accept=".yaml,.yml,.json,.txt"
            label="Drop YAML or JSON configuration file here"
            helperText="Supports Kubernetes, Docker Compose, OpenAPI, and CI/CD config files"
            icon={FileCode2}
          />
        </div>
      )}

      {/* Syntax Error Banner */}
      {error && (
        <div className="mb-6 p-3.5 border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs font-mono flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold mb-1">
              Parsing Error {error.line ? `at Line ${error.line}${error.column ? `, Column ${error.column}` : ''}` : ''}
            </div>
            <div className="whitespace-pre-wrap">{error.message}</div>
          </div>
        </div>
      )}

      {/* Split Editors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Input Column */}
        <div className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex flex-col h-[520px]">
          <div className="border-b border-neutral-200 dark:border-neutral-800 px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold text-neutral-900 dark:text-neutral-100">
                Input ({mode === 'yaml-to-json' ? 'YAML' : 'JSON'})
              </span>
              {inputText && (
                <span className="text-[11px] font-mono text-neutral-400">
                  {formatBytes(new Blob([inputText]).size)} • {inputText.split('\n').length} lines
                </span>
              )}
            </div>
            <button
              onClick={() => switchMode(mode === 'yaml-to-json' ? 'json-to-yaml' : 'yaml-to-json')}
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
              mode === 'yaml-to-json'
                ? 'Paste YAML configuration here...\n\nExample:\nname: my-app\nversion: 1.0.0\nservices:\n  - web\n  - db'
                : 'Paste JSON configuration here...\n\nExample:\n{\n  "name": "my-app",\n  "version": "1.0.0"\n}'
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
                Output ({mode === 'yaml-to-json' ? 'JSON' : 'YAML'})
              </span>
              {outputText && (
                <span className="text-[11px] font-mono text-neutral-400">
                  {formatBytes(new Blob([outputText]).size)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
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

          <textarea
            value={outputText}
            readOnly
            placeholder="Converted output will appear here automatically..."
            className="flex-1 w-full p-4 font-mono text-xs bg-neutral-50/50 dark:bg-neutral-900/30 text-neutral-900 dark:text-neutral-100 resize-none focus:outline-none leading-relaxed"
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}
