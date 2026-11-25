/**
 * Utilities for parsing, formatting, and generating sequential ecclesiastical resolution numbers (Votos)
 * Supports all standard formats used in church commissions:
 * - "Voto nº 01/2026" -> prefix="Voto nº ", num=1, pad=2, suffix="/2026"
 * - "2026-001" -> prefix="2026-", num=1, pad=3, suffix=""
 * - "Voto 05" -> prefix="Voto ", num=5, pad=2, suffix=""
 * - "1" -> prefix="", num=1, pad=1, suffix=""
 */

export interface ParsedResolution {
  prefix: string;
  num: number;
  pad: number;
  suffix: string;
}

export function parseResolutionNumber(str: string): ParsedResolution | null {
  if (!str) return null;
  const trimmed = str.trim();

  // Pattern 1: Suffix with year at end, e.g. "Voto nº 01/2026", "Voto 15/26", "01/2026"
  const slashYearMatch = trimmed.match(/^(.*?)(\d+)(\/\d{2,4})$/);
  if (slashYearMatch) {
    return {
      prefix: slashYearMatch[1],
      num: parseInt(slashYearMatch[2], 10),
      pad: slashYearMatch[2].length,
      suffix: slashYearMatch[3]
    };
  }

  // Pattern 2: Year prefix like "2026-001", "Voto nº 2026-05", "2026.01"
  const yearPrefixMatch = trimmed.match(/^(.*?\b(?:19|20)\d{2}[-._\s])(\d+)(.*)$/);
  if (yearPrefixMatch) {
    return {
      prefix: yearPrefixMatch[1],
      num: parseInt(yearPrefixMatch[2], 10),
      pad: yearPrefixMatch[2].length,
      suffix: yearPrefixMatch[3]
    };
  }

  // Pattern 3: General number in string
  const generalMatch = trimmed.match(/^(.*?)(\d+)(.*)$/);
  if (generalMatch) {
    return {
      prefix: generalMatch[1],
      num: parseInt(generalMatch[2], 10),
      pad: generalMatch[2].length,
      suffix: generalMatch[3]
    };
  }

  return null;
}

export function formatResolutionNumber(parsed: ParsedResolution, offset: number): string {
  const nextNum = parsed.num + offset;
  const numStr = String(nextNum).padStart(parsed.pad, '0');
  return `${parsed.prefix}${numStr}${parsed.suffix}`;
}

export function generateSequencePreview(startPattern: string, count: number): string[] {
  const parsed = parseResolutionNumber(startPattern) || {
    prefix: 'Voto nº ',
    num: 1,
    pad: 2,
    suffix: `/${new Date().getFullYear()}`
  };

  const results: string[] = [];
  for (let i = 0; i < count; i++) {
    results.push(formatResolutionNumber(parsed, i));
  }
  return results;
}
