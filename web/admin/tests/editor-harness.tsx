import type {} from '../src/utils/getBasename';
/// <reference types="vite/client" />
import '@ctzhian/tiptap/dist/index.css';
import '../src/assets/styles/markdown.css';
import { configureStore } from '@reduxjs/toolkit';
import { ThemeProvider } from '@ctzhian/ui';
import {
  Editor,
  EditorMarkdown,
  useTiptap,
  type MarkdownEditorRef,
} from '@ctzhian/tiptap';
import {
  Alert,
  Box,
  Button,
  CssBaseline,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import axios from 'axios';
import { lazy, Suspense, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import store from '../src/store';
import config from '../src/store/slices/config';
import breadcrumb from '../src/store/slices/breadcrumb';
import { theme } from '../src/themes';

if (
  !import.meta.env.DEV ||
  !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
) {
  throw new Error('真实编辑器夹具仅允许在本地 Vite 开发服务器运行');
}

// Only the page-catalog transport is a fixture. Both editors and the complete
// EditorPageLink -> PagePicker flow are the production implementations.
// Import the adapter lazily so its generated Axios client uses this fixture adapter.
axios.defaults.adapter = async request => {
  if (request.url !== '/api/v1/node/list/group/nav')
    throw new Error(`夹具不允许调用业务接口：${request.url}`);
  return {
    status: 200,
    statusText: 'OK',
    headers: {},
    config: request,
    data: {
      success: true,
      data: [
        {
          nav_id: 'fixture',
          nav_name: '固定测试目录',
          list: [
            { id: 'fixture-intro', name: '示例入门文档', type: 2 },
            { id: 'fixture-guide', name: '示例使用教程', type: 2 },
          ],
        },
      ],
    },
  };
};
const originalFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  const raw = input instanceof Request ? input.url : String(input);
  const pathname = new URL(raw, location.origin).pathname;
  if (pathname === '/api/kenfut/v1/products')
    return Promise.resolve(
      Response.json({ success: true, data: { items: [] } }),
    );
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/share/') ||
    pathname.startsWith('/integration/')
  )
    return Promise.reject(new Error(`夹具不允许调用业务接口：${pathname}`));
  return originalFetch(input, init);
};
window.__BASENAME__ = '';
const initial = store.getState();
const fixtureStore = configureStore({
  reducer: { config, breadcrumb },
  preloadedState: {
    ...initial,
    config: { ...initial.config, kb_id: 'editor-fixture' },
  },
  middleware: defaults => defaults({ serializableCheck: false }),
});
const EditorPageLink = lazy(
  () => import('../src/features/kenfut/EditorPageLink'),
);

const initialHTML =
  '<p>前言 测试文字 结尾。</p><p><a href="/node/old" title="已有链接" type="icon">已有链接</a></p>';
const initialMarkdown = '前言 测试文字 结尾。\n\n[已有链接](/node/old)';

function RichFixture() {
  const [source, setSource] = useState(initialHTML);
  const editorRef = useTiptap({
    content: initialHTML,
    contentType: 'html',
    editable: true,
    immediatelyRender: true,
    exclude: ['invisibleCharacters', 'youtube', 'mention'],
    onUpdate: ({ editor }) => setSource(editor.getHTML()),
  });
  const editor = editorRef.editor;
  return (
    <Stack spacing={2}>
      <Alert severity='info'>
        先“选中示例文字”，再“链接到页面”并选择测试目录中的页面。也可在真实编辑区直接选择文字或光标；取消弹窗不得改变正文。
      </Alert>
      <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
        <Button
          onClick={() =>
            editor.chain().focus().setTextSelection({ from: 4, to: 8 }).run()
          }
        >
          选中示例文字
        </Button>
        <Button
          onClick={() => {
            let position: number | undefined;
            editor.state.doc.descendants((node, offset) => {
              if (position === undefined && node.type.name === 'inlineLink')
                position = offset;
            });
            if (position !== undefined)
              editor.chain().focus().setNodeSelection(position).run();
          }}
        >
          选中已有链接
        </Button>
        <EditorPageLink editor={editor} />
        <Button
          onClick={() => editor.chain().focus().keyboardShortcut('Mod-z').run()}
        >
          富文本撤销
        </Button>
        <Button
          onClick={() =>
            editor.chain().focus().keyboardShortcut('Mod-Shift-z').run()
          }
        >
          富文本重做
        </Button>
        <Button
          onClick={() => {
            editor.commands.setContent(initialHTML);
            setSource(editor.getHTML());
          }}
        >
          重置富文本
        </Button>
      </Stack>
      <Paper
        variant='outlined'
        sx={{ minHeight: 170, p: 2 }}
        aria-label='真实富文本编辑器'
      >
        <Editor editor={editor} />
      </Paper>
      <Typography fontWeight='bold'>当前富文本 HTML（验收读数）</Typography>
      <Box
        component='pre'
        data-testid='rich-source'
        sx={{
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          bgcolor: '#f2f4f7',
          p: 2,
        }}
      >
        {source}
      </Box>
    </Stack>
  );
}

type Selection = {
  start: { row: number; column: number };
  end: { row: number; column: number };
  text: string;
};
type SelectionRef = MarkdownEditorRef & {
  captureSelection: () => Selection | null;
};

function MarkdownFixture() {
  const [value, setValue] = useState(initialMarkdown);
  const [selection, setSelection] = useState('尚未读取');
  const markdownRef = useRef<MarkdownEditorRef>(null);
  const editorRef = useTiptap({
    content: initialMarkdown,
    contentType: 'markdown',
    editable: false,
    immediatelyRender: true,
    exclude: ['invisibleCharacters', 'youtube', 'mention'],
  });
  return (
    <Stack spacing={2}>
      <Alert severity='info'>
        点击真实 Markdown
        编辑区，用鼠标或键盘选择“测试文字”；点击“链接到页面”后插入。光标置于已有链接内可替换其目标。撤销／重做在编辑区使用
        Cmd/Ctrl+Z、Cmd/Ctrl+Shift+Z，走 Ace 原生历史。
      </Alert>
      <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
        <EditorPageLink
          editor={editorRef.editor}
          markdownRef={markdownRef}
          markdownValue={value}
        />
        <Button
          onMouseDown={event => event.preventDefault()}
          onClick={() =>
            setSelection(
              JSON.stringify(
                (
                  markdownRef.current as SelectionRef | null
                )?.captureSelection() || null,
              ),
            )
          }
        >
          读取真实光标选区
        </Button>
        <Button
          onClick={() => {
            setValue(initialMarkdown);
          }}
        >
          重置 Markdown
        </Button>
      </Stack>
      <Typography variant='caption'>
        公开 ref 的 captureSelection：{selection}
      </Typography>
      <Paper
        variant='outlined'
        sx={{ overflow: 'hidden' }}
        aria-label='真实 Markdown 编辑器'
      >
        <EditorMarkdown
          ref={markdownRef}
          editor={editorRef.editor}
          value={value}
          onAceChange={setValue}
          height={260}
          placeholder='真实 Ace Markdown 编辑区'
          defaultDisplayMode='edit'
        />
      </Paper>
      <Typography fontWeight='bold'>当前 Markdown（验收读数）</Typography>
      <Box
        component='pre'
        data-testid='markdown-source'
        sx={{ whiteSpace: 'pre-wrap', bgcolor: '#f2f4f7', p: 2 }}
      >
        {value}
      </Box>
    </Stack>
  );
}

function Harness() {
  const [mode, setMode] = useState('rich');
  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', p: 3 }}>
      <Typography variant='h5' sx={{ mb: 2 }}>
        KenFutWiki 本地真实编辑器验收
      </Typography>
      <Alert severity='warning'>
        仅本地测试夹具。编辑器、补丁和链接选择流程均为真实实现；页面目录是固定测试数据，不代表生产权限或业务接口验收。
      </Alert>
      <Tabs value={mode} onChange={(_, next) => setMode(next)} sx={{ my: 2 }}>
        <Tab value='rich' label='富文本模式' />
        <Tab value='markdown' label='Markdown 模式' />
      </Tabs>
      <Suspense fallback={<Typography>正在加载真实链接适配器…</Typography>}>
        {mode === 'rich' ? <RichFixture /> : <MarkdownFixture />}
      </Suspense>
    </Box>
  );
}

createRoot(document.getElementById('root')!).render(
  <Provider store={fixtureStore}>
    <ThemeProvider theme={theme} defaultMode='light' storageManager={null}>
      <CssBaseline />
      <Harness />
    </ThemeProvider>
  </Provider>,
);
