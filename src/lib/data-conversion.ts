import { CsvToJsonOptions, JsonToCsvOptions } from './types';

/**
 * Auto-detects the most likely delimiter (, ; \t |) by inspecting the first few lines of CSV text,
 * ignoring delimiter characters inside quoted fields.
 */
export function detectDelimiter(text: string): ',' | ';' | '\t' | '|' {
  const sample = text.slice(0, 5000);
  const lines = sample.split(/\r?\n/).filter((l) => l.trim().length > 0).slice(0, 5);
  if (lines.length === 0) return ',';

  const candidates: (',' | ';' | '\t' | '|')[] = [',', ';', '\t', '|'];
  const counts: Record<string, number[]> = {
    ',': [],
    ';': [],
    '\t': [],
    '|': [],
  };

  for (const line of lines) {
    let inQuotes = false;
    const lineCounts = { ',': 0, ';': 0, '\t': 0, '|': 0 };

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (!inQuotes && (char === ',' || char === ';' || char === '\t' || char === '|')) {
        lineCounts[char]++;
      }
    }

    for (const cand of candidates) {
      counts[cand].push(lineCounts[cand]);
    }
  }

  // Find candidate that appears consistently (> 0) on every inspected line
  let bestCandidate: ',' | ';' | '\t' | '|' = ',';
  let bestScore = -1;

  for (const cand of candidates) {
    const list = counts[cand];
    const avg = list.reduce((a, b) => a + b, 0) / list.length;
    const isUniform = list.every((c) => c > 0 && c === list[0]);

    const score = isUniform ? avg * 100 : avg;
    if (score > bestScore && avg > 0) {
      bestScore = score;
      bestCandidate = cand;
    }
  }

  return bestCandidate;
}

/**
 * RFC 4180 compliant CSV parser.
 * Handles quoted cells with embedded delimiters, escaped quotes (""), and multiline values.
 */
export function parseCsvRaw(csvText: string, delimiter: string = ','): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;
  let i = 0;

  const len = csvText.length;

  while (i < len) {
    const char = csvText[i];
    const nextChar = i + 1 < len ? csvText[i + 1] : '';

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote: "" -> "
          currentCell += '"';
          i += 2;
          continue;
        } else {
          // End of quoted cell
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentCell += char;
        i++;
        continue;
      }
    }

    // Not inside quotes
    if (char === '"') {
      inQuotes = true;
      i++;
    } else if (char === delimiter) {
      currentRow.push(currentCell.trim());
      currentCell = '';
      i++;
    } else if (char === '\r') {
      if (nextChar === '\n') {
        i += 2;
      } else {
        i++;
      }
      currentRow.push(currentCell.trim());
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else if (char === '\n') {
      currentRow.push(currentCell.trim());
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
      i++;
    } else {
      currentCell += char;
      i++;
    }
  }

  // Push final cell and row
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    rows.push(currentRow);
  }

  // Strip empty trailing rows
  return rows.filter((r) => r.length > 0 && !(r.length === 1 && r[0] === ''));
}

/**
 * Parses raw string value into number, boolean, or null if type inference is enabled.
 */
function inferValue(val: string): unknown {
  if (val === '') return '';
  if (val.toLowerCase() === 'true') return true;
  if (val.toLowerCase() === 'false') return false;
  if (val.toLowerCase() === 'null') return null;

  // Numeric check: ignore strings with leading zero like "0123" unless it's "0" or "0.xyz"
  if (
    !isNaN(Number(val)) &&
    !isNaN(parseFloat(val)) &&
    (val === '0' || !val.startsWith('0') || val.startsWith('0.'))
  ) {
    return Number(val);
  }

  return val;
}

/**
 * Main CSV to JSON conversion function.
 */
export function convertCsvToJson(
  csvText: string,
  options: CsvToJsonOptions
): {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  headers: string[];
  jsonString: string;
  rowCount: number;
  columnCount: number;
} {
  const delim =
    options.delimiter === 'auto' ? detectDelimiter(csvText) : options.delimiter;
  const rawRows = parseCsvRaw(csvText, delim);

  if (rawRows.length === 0) {
    return { data: [], headers: [], jsonString: '[]', rowCount: 0, columnCount: 0 };
  }

  const indentSpace =
    options.indent === 'minified' ? 0 : options.indent === 4 ? 4 : 2;

  if (options.hasHeaders) {
    const rawHeaders = rawRows[0];
    // De-duplicate headers
    const headers: string[] = [];
    const counts: Record<string, number> = {};

    for (let i = 0; i < rawHeaders.length; i++) {
      let h = rawHeaders[i] || `column_${i + 1}`;
      if (counts[h]) {
        counts[h]++;
        h = `${h}_${counts[h]}`;
      } else {
        counts[h] = 1;
      }
      headers.push(h);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any>[] = [];
    for (let r = 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const obj: Record<string, any> = {};
      for (let c = 0; c < headers.length; c++) {
        const val = row[c] ?? '';
        obj[headers[c]] = options.inferTypes ? inferValue(val) : val;
      }
      data.push(obj);
    }

    const jsonString =
      indentSpace === 0
        ? JSON.stringify(data)
        : JSON.stringify(data, null, indentSpace);

    return {
      data,
      headers,
      jsonString,
      rowCount: data.length,
      columnCount: headers.length,
    };
  } else {
    // Array of arrays
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any[][] = rawRows.map((row) =>
      row.map((cell) => (options.inferTypes ? inferValue(cell) : cell))
    );
    const maxCols = Math.max(...data.map((r) => r.length), 0);
    const headers = Array.from({ length: maxCols }, (_, i) => `Col ${i + 1}`);

    const jsonString =
      indentSpace === 0
        ? JSON.stringify(data)
        : JSON.stringify(data, null, indentSpace);

    return {
      data,
      headers,
      jsonString,
      rowCount: data.length,
      columnCount: maxCols,
    };
  }
}

/**
 * Escapes a single CSV cell value according to RFC 4180.
 */
function escapeCsvCell(
  val: unknown,
  delimiter: string,
  forceQuotes: boolean
): string {
  if (val === null || val === undefined) return '';

  let str = '';
  if (typeof val === 'object') {
    str = JSON.stringify(val);
  } else {
    str = String(val);
  }

  const needsQuotes =
    forceQuotes ||
    str.includes(delimiter) ||
    str.includes('"') ||
    str.includes('\n') ||
    str.includes('\r');

  if (needsQuotes) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Main JSON to CSV conversion function.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function convertJsonToCsv(jsonInput: any, options: JsonToCsvOptions): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parsed: any;
  if (typeof jsonInput === 'string') {
    parsed = JSON.parse(jsonInput);
  } else {
    parsed = jsonInput;
  }

  const delim = options.delimiter || ',';
  const forceQuotes = options.wrapQuotes === 'all';

  if (!Array.isArray(parsed)) {
    if (typeof parsed === 'object' && parsed !== null) {
      // Single object: convert to key,value rows or header+values row
      const entries = Object.entries(parsed);
      const headers = ['key', 'value'].map((h) => escapeCsvCell(h, delim, forceQuotes)).join(delim);
      const rows = entries.map(
        ([k, v]) => `${escapeCsvCell(k, delim, forceQuotes)}${delim}${escapeCsvCell(v, delim, forceQuotes)}`
      );
      return [headers, ...rows].join('\n');
    }
    throw new Error('Input must be a JSON array of objects or an array of arrays.');
  }

  if (parsed.length === 0) {
    return '';
  }

  // Case 1: Array of Arrays
  if (Array.isArray(parsed[0])) {
    return parsed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((row: any[]) =>
        row.map((cell) => escapeCsvCell(cell, delim, forceQuotes)).join(delim)
      )
      .join('\n');
  }

  // Case 2: Array of Objects
  // Gather all unique keys across all objects to ensure comprehensive columns
  const keySet = new Set<string>();
  for (const item of parsed) {
    if (item && typeof item === 'object') {
      Object.keys(item).forEach((k) => keySet.add(k));
    }
  }
  const headers = Array.from(keySet);

  const headerRow = headers
    .map((h) => escapeCsvCell(h, delim, forceQuotes))
    .join(delim);

  const dataRows = parsed.map((item) => {
    if (!item || typeof item !== 'object') {
      return escapeCsvCell(item, delim, forceQuotes);
    }
    return headers
      .map((h) => escapeCsvCell(item[h], delim, forceQuotes))
      .join(delim);
  });

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Pure client-side HTML to Markdown parser using browser DOMParser.
 * Converts HTML elements (headings, bold, italic, code blocks, lists, links, tables) into clean GitHub-flavored markdown.
 */
export function convertHtmlToMarkdown(htmlString: string): string {
  if (typeof window === 'undefined') return htmlString;

  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');

  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const el = node as HTMLElement;
    const tagName = el.tagName.toLowerCase();
    const childrenText = Array.from(el.childNodes).map(walk).join('');

    switch (tagName) {
      case 'h1':
        return `\n\n# ${childrenText.trim()}\n\n`;
      case 'h2':
        return `\n\n## ${childrenText.trim()}\n\n`;
      case 'h3':
        return `\n\n### ${childrenText.trim()}\n\n`;
      case 'h4':
        return `\n\n#### ${childrenText.trim()}\n\n`;
      case 'h5':
        return `\n\n##### ${childrenText.trim()}\n\n`;
      case 'h6':
        return `\n\n###### ${childrenText.trim()}\n\n`;
      case 'p':
        return `\n\n${childrenText.trim()}\n\n`;
      case 'strong':
      case 'b':
        return `**${childrenText}**`;
      case 'em':
      case 'i':
        return `*${childrenText}*`;
      case 'del':
      case 's':
      case 'strike':
        return `~~${childrenText}~~`;
      case 'code':
        if (el.parentElement && el.parentElement.tagName.toLowerCase() === 'pre') {
          return childrenText;
        }
        return `\`${childrenText}\``;
      case 'pre': {
        const lang = el.querySelector('code')?.className.replace(/language-/, '') || '';
        return `\n\n\`\`\`${lang}\n${el.textContent?.trim() || ''}\n\`\`\`\n\n`;
      }
      case 'blockquote':
        return `\n\n> ${childrenText.trim().replace(/\n/g, '\n> ')}\n\n`;
      case 'a': {
        const href = el.getAttribute('href') || '';
        const title = el.getAttribute('title');
        const titleAttr = title ? ` "${title}"` : '';
        return `[${childrenText.trim()}](${href}${titleAttr})`;
      }
      case 'img': {
        const src = el.getAttribute('src') || '';
        const alt = el.getAttribute('alt') || '';
        return `![${alt}](${src})`;
      }
      case 'hr':
        return '\n\n---\n\n';
      case 'br':
        return '\n';
      case 'ul': {
        const items = Array.from(el.children)
          .filter((c) => c.tagName.toLowerCase() === 'li')
          .map((c) => `- ${Array.from(c.childNodes).map(walk).join('').trim()}`)
          .join('\n');
        return `\n\n${items}\n\n`;
      }
      case 'ol': {
        const items = Array.from(el.children)
          .filter((c) => c.tagName.toLowerCase() === 'li')
          .map((c, i) => `${i + 1}. ${Array.from(c.childNodes).map(walk).join('').trim()}`)
          .join('\n');
        return `\n\n${items}\n\n`;
      }
      case 'table': {
        const rows = Array.from(el.querySelectorAll('tr'));
        if (rows.length === 0) return '';

        const tableMd: string[] = [];
        let headerProcessed = false;

        rows.forEach((row, idx) => {
          const cells = Array.from(row.querySelectorAll('th, td')).map((cell) =>
            cell.textContent?.trim().replace(/\|/g, '\\|') || ''
          );

          if (cells.length > 0) {
            tableMd.push(`| ${cells.join(' | ')} |`);
            if (idx === 0 || (!headerProcessed && row.querySelector('th'))) {
              tableMd.push(`| ${cells.map(() => '---').join(' | ')} |`);
              headerProcessed = true;
            }
          }
        });

        return `\n\n${tableMd.join('\n')}\n\n`;
      }
      default:
        return childrenText;
    }
  }

  const rawMd = walk(doc.body);
  // Clean up excessive blank lines (more than 2 consecutive \n)
  return rawMd.replace(/\n{3,}/g, '\n\n').trim();
}
