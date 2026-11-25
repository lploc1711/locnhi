export interface InlineTextPart {
  text: string;
  style: 'plain' | 'bold' | 'italic';
}
export interface DocumentBlock {
  kind: 'heading' | 'paragraph' | 'quote' | 'table' | 'list' | 'checklist';
  text: string;
  headers: string[];
  rows: string[][];
  items: { text: string; checked: boolean }[];
}

export function inlineText(source: string): InlineTextPart[] {
  return source
    .split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
    .filter(Boolean)
    .map((text) => {
      if (text.startsWith('**') && text.endsWith('**'))
        return { text: text.slice(2, -2), style: 'bold' };
      if (text.startsWith('*') && text.endsWith('*'))
        return { text: text.slice(1, -1), style: 'italic' };
      return { text, style: 'plain' };
    });
}

// This reader supports the itinerary's headings, tables, lists and emphasis.
// Everything is rendered through Angular text interpolation, without raw HTML.
export function parsePlanDocument(source: string): DocumentBlock[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const result: DocumentBlock[] = [];
  const block = (kind: DocumentBlock['kind'], text = ''): DocumentBlock => ({
    kind,
    text,
    headers: [],
    rows: [],
    items: [],
  });
  const cells = (line: string) =>
    line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim());
  for (let i = 0; i < lines.length;) {
    const line = lines[i].trim();
    if (!line || /^# /.test(line)) {
      i++;
      continue;
    }
    if (/^#{2,6} /.test(line)) {
      result.push(block('heading', line.replace(/^#+ /, '')));
      i++;
      continue;
    }
    if (line.startsWith('|')) {
      const table = block('table');
      table.headers = cells(line);
      i++;
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const row = cells(lines[i++]);
        if (!row.every((cell) => /^:?-{3,}:?$/.test(cell))) table.rows.push(row);
      }
      result.push(table);
      continue;
    }
    if (line.startsWith('- ')) {
      const checklist = /^- \[[ xX]\]/.test(line),
        list = block(checklist ? 'checklist' : 'list');
      while (i < lines.length && lines[i].trim().startsWith('- ')) {
        const item = lines[i++].trim().slice(2);
        list.items.push({
          text: checklist ? item.replace(/^\[[ xX]\]\s*/, '') : item,
          checked: /^\[[xX]\]/.test(item),
        });
      }
      result.push(list);
      continue;
    }
    if (line.startsWith('>')) {
      const text = line.replace(/^>\s?/, '');
      if (text) result.push(block('quote', text));
      i++;
      continue;
    }
    const paragraph = block('paragraph', line);
    i++;
    while (i < lines.length && lines[i].trim() && !/^(#|\||>|- )/.test(lines[i].trim()))
      paragraph.text += '\n' + lines[i++].trim();
    result.push(paragraph);
  }
  return result;
}
