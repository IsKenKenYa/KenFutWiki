import {
  expandMarkdownLink,
  markdownPageLink,
  type MarkdownSelection,
} from './markdownLink';
import type {} from '@ctzhian/tiptap/dist/extension/node/Link';
import type { MarkdownEditorRef, UseTiptapReturn } from '@ctzhian/tiptap';
import { Button } from '@mui/material';
import { useRef, useState, type RefObject } from 'react';
import PagePicker from './PagePicker';

type MarkdownLinkRef = MarkdownEditorRef & {
  captureSelection: () => MarkdownSelection | null;
  replaceSelection: (options: {
    selection: MarkdownSelection;
    text: string;
  }) => void;
};

export default function EditorPageLink({
  editor,
  markdownRef,
  markdownValue = '',
}: {
  editor: UseTiptapReturn['editor'];
  markdownRef?: RefObject<MarkdownEditorRef | null>;
  markdownValue?: string;
}) {
  const [open, setOpen] = useState(false);
  const markdownSelection = useRef<MarkdownSelection | null>(null);
  const richSelection = useRef<{
    from: number;
    to: number;
    text: string;
    editing: boolean;
  } | null>(null);
  return (
    <>
      <Button
        size='small'
        onMouseDown={event => event.preventDefault()}
        onClick={() => {
          if (markdownRef) {
            const selection = (
              markdownRef.current as MarkdownLinkRef | null
            )?.captureSelection();
            markdownSelection.current = selection
              ? expandMarkdownLink(selection, markdownValue)
              : null;
            if (!markdownSelection.current) return;
          } else {
            const { from, to } = editor.state.selection;
            const editing = editor.isActive('inlineLink');
            richSelection.current = {
              from,
              to,
              editing,
              text: editing
                ? String(editor.getAttributes('inlineLink').title || '')
                : editor.state.doc.textBetween(from, to, ' '),
            };
          }
          setOpen(true);
        }}
      >
        链接到页面
      </Button>
      <PagePicker
        open={open}
        onClose={() => setOpen(false)}
        onSelect={(target, page) => {
          const href =
            target.type === 'node' ? `/node/${target.node_id}` : page.url;
          if (markdownRef && markdownSelection.current) {
            const selection = markdownSelection.current;
            (markdownRef.current as MarkdownLinkRef | null)?.replaceSelection({
              selection,
              text: markdownPageLink(selection.text, page.title, href),
            });
          } else if (richSelection.current) {
            const saved = richSelection.current;
            const attributes = {
              href,
              title: saved.text || page.title,
              target: '_self',
              rel: 'noopener noreferrer',
              type: 'icon',
            };
            if (saved.editing)
              editor
                .chain()
                .focus()
                .setNodeSelection(saved.from)
                .updateAttributes('inlineLink', attributes)
                .run();
            else
              editor
                .chain()
                .focus()
                .setTextSelection({ from: saved.from, to: saved.to })
                .setInlineLink(attributes)
                .run();
          }
        }}
      />
    </>
  );
}
