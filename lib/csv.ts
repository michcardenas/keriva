// CSV utilities — works on both web and native (Android/iOS).
// Uses semicolon (;) as separator for Excel compatibility in Latin America.

import { Platform } from 'react-native';

const SEP = ';';

function escapeCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(SEP) || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateCSV(
  headers: string[],
  rows: Array<Record<string, any>>,
): string {
  const headerLine = headers.map(escapeCell).join(SEP);
  const dataLines = rows.map((row) =>
    headers.map((h) => escapeCell(row[h])).join(SEP),
  );
  return [headerLine, ...dataLines].join('\n');
}

/**
 * Save/share a CSV file. On web it triggers a browser download; on native it
 * writes to a temp file and opens the system share sheet so the user can save
 * it to Files, Google Drive, WhatsApp, etc.
 */
export async function downloadCSV(content: string, filename: string): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    // Native: write to cache dir and share
    const FileSystem = require('expo-file-system') as any;
    const Sharing = require('expo-sharing') as any;
    const fileUri = (FileSystem.cacheDirectory ?? '') + filename;
    await FileSystem.writeAsStringAsync(fileUri, '\uFEFF' + content, {
      encoding: (FileSystem.EncodingType ?? {}).UTF8 ?? 'utf8',
    });
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: `Exportar ${filename}`,
      UTI: 'public.comma-separated-values-text',
    });
  }
}

/**
 * Pick a CSV file from the device. Returns parsed rows or null if cancelled.
 * On web uses a file input; on native uses expo-document-picker + expo-file-system.
 */
export async function pickAndParseCSV(): Promise<Array<Record<string, string>> | null> {
  if (Platform.OS === 'web') {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.csv';
      input.onchange = async (e: any) => {
        const file = e.target?.files?.[0];
        if (!file) return resolve(null);
        const text = await file.text();
        const rows = parseCSV(text);
        resolve(rows.length > 0 ? rows : null);
      };
      // If user cancels the file dialog
      input.addEventListener('cancel', () => resolve(null));
      input.click();
    });
  } else {
    // Native: use document picker
    const DocumentPicker = require('expo-document-picker') as any;
    const FileSystem = require('expo-file-system') as any;
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'application/csv', '*/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return null;
    const text = await FileSystem.readAsStringAsync(result.assets[0].uri, {
      encoding: (FileSystem.EncodingType ?? {}).UTF8 ?? 'utf8',
    });
    const rows = parseCSV(text);
    return rows.length > 0 ? rows : null;
  }
}

export function parseCSV(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  // Auto-detect separator: semicolon or comma
  const firstLine = lines[0];
  const sep = firstLine.includes(';') ? ';' : ',';

  const headers = parseLine(lines[0], sep);
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i], sep);
    if (values.length === 0) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] ?? '').trim();
    });
    rows.push(row);
  }

  return rows;
}

function parseLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === sep) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}
