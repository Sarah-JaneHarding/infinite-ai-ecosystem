// RFC 4180 CSV parser for the warehouse file connector (Stage 09 step 3).
//
// Limitation: multi-line quoted fields are not supported. School data exports are
// always flat rows; a newline inside a quoted value is treated as a record boundary.
// This is intentional — a row that spans lines cannot survive a mid-run resume, and
// resumability requires that row N always starts at the same byte.

export interface ParsedRow {
  readonly rowIndex: number;
  readonly sourceRef: string;
  readonly fields: Readonly<Record<string, string>>;
}

function parseFields(line: string): string[] {
  const fields: string[] = [];
  let i = 0;

  while (i <= line.length) {
    if (i === line.length) {
      // Handles trailing comma: last field is empty
      if (line.endsWith(',')) fields.push('');
      break;
    }

    if (line[i] === '"') {
      // Quoted field
      let value = '';
      i++;
      while (i < line.length) {
        if (line[i] === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            value += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          value += line[i];
          i++;
        }
      }
      fields.push(value);
      if (i < line.length && line[i] === ',') i++;
    } else {
      // Unquoted field — read to next comma or end
      const commaIndex = line.indexOf(',', i);
      if (commaIndex === -1) {
        fields.push(line.slice(i));
        break;
      }
      fields.push(line.slice(i, commaIndex));
      i = commaIndex + 1;
    }
  }

  return fields;
}

/**
 * Parses a CSV string into an array of `ParsedRow` objects. Row 0 (the header
 * line) is consumed and its values become the field names; data rows start at
 * `rowIndex` 1. `fileRef` is embedded in every `sourceRef` so the ID is stable
 * across runs on the same file (idempotency requirement for the connector).
 */
export function parseCsv(content: string, fileRef: string): readonly ParsedRow[] {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  // Drop trailing blank lines
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  if (lines.length === 0) return [];

  const headers = parseFields(lines[0] ?? '');
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const values = parseFields(line);
    const fields: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      if (header) fields[header] = values[j] ?? '';
    }

    rows.push({
      rowIndex: i,
      sourceRef: `${fileRef}#row-${i}`,
      fields,
    });
  }

  return rows;
}
