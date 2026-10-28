export type MarkdownSelection = {
  start: { row: number; column: number };
  end: { row: number; column: number };
  text: string;
};

const inlineLink = /\[((?:\\.|[^\]\\\n])*)\]\(((?:\\.|[^)\\\n])*)\)/g;

export function expandMarkdownLink(
  selection: MarkdownSelection,
  content: string,
): MarkdownSelection {
  if (selection.text || selection.start.row !== selection.end.row)
    return selection;
  const line = content.split('\n')[selection.start.row] || '';
  for (const match of line.matchAll(inlineLink)) {
    const start = match.index;
    const end = start + match[0].length;
    if (selection.start.column >= start && selection.start.column < end) {
      return {
        start: { row: selection.start.row, column: start },
        end: { row: selection.start.row, column: end },
        text: match[0],
      };
    }
  }
  return selection;
}

export function markdownPageLink(
  selected: string,
  title: string,
  href: string,
) {
  const existing = /^\[((?:\\.|[^\]\\])*)\]\(/.exec(selected)?.[1];
  const label =
    existing === undefined
      ? selected || title
      : existing.replace(/\\([\\[\]])/g, '$1');
  const escaped = label.replace(/[\\[\]]/g, '\\$&');
  const url = href
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\s/g, '%20');
  return `[${escaped}](${url})`;
}
