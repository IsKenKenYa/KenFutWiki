import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scanDirs = ['src/pages', 'src/features', 'src/components'];

// 允许保留中文的非 UI 场景：键为相对路径，值为允许出现的中文片段。
// 新增例外时必须写明原因，避免把未翻译的界面文案混进来。
const ALLOWLIST = {
  // Switch 的 content 是写入站点配置的 JSON 值，不是界面文案。
  'src/components/Switch/index.tsx': new Set(['"启用"', '"禁用"']),
  // 语言名称采用自称（self-naming），不随界面语言翻译。
  'src/pages/document/component/DocAddByCustomText.tsx': new Set(['中文']),
  'src/pages/document/editor/edit/AIGenerate.tsx': new Set(['中文']),
  // 后端返回的中文国家名，仅用于业务判断，不是界面文案。
  'src/pages/contribution/index.tsx': new Set(['中国']),
  'src/pages/conversation/index.tsx': new Set(['中国']),
  'src/pages/feedback/Comments.tsx': new Set(['中国']),
  'src/pages/feedback/Evaluate.tsx': new Set(['中国']),
  'src/pages/stat/Statistic/RTVisitor.tsx': new Set(['中国']),
  // 展示给用户的嵌入代码示例，注释属于代码内容而非界面文案。
  'src/pages/setting/component/CardRobot/WebComponent/index.tsx': new Set([
    '<!--// Head 标签引入样式 -->',
    '<!--// Body 标签引入挂件 -->',
  ]),
};

const UI_PROPERTY_NAMES = new Set([
  'label',
  'title',
  'text',
  'content',
  'placeholder',
  'helperText',
  'okText',
  'cancelText',
  'description',
  'desc',
  'message',
  'hint',
]);

const collectFiles = dir => {
  const files = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(file));
    } else if (/\.tsx$/.test(entry.name)) {
      files.push(file);
    }
  });
  return files;
};

const isUiLiteral = node => {
  const parent = node.parent;
  if (!parent) return false;
  if (ts.isJsxExpression(parent) || ts.isJsxAttribute(parent)) return true;
  if (
    ts.isPropertyAssignment(parent) &&
    UI_PROPERTY_NAMES.has(parent.name.getText())
  ) {
    return true;
  }
  if (ts.isCallExpression(parent)) {
    const callee = parent.expression.getText();
    return /^(message\.(success|error|warning|info)|alert|confirm)$/.test(
      callee,
    );
  }
  // 条件表达式 / 括号表达式 / 逻辑表达式最终仍用于 JSX 渲染
  let current = parent;
  while (
    current &&
    (ts.isConditionalExpression(current) ||
      ts.isParenthesizedExpression(current) ||
      ts.isBinaryExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isArrayLiteralExpression(current))
  ) {
    current = current.parent;
  }
  return Boolean(current && ts.isJsxExpression(current));
};

test('页面与组件不再残留硬编码中文界面文案', () => {
  const violations = [];

  scanDirs.forEach(dir => {
    collectFiles(path.join(root, dir)).forEach(file => {
      const relative = path.relative(root, file).split(path.sep).join('/');
      const source = fs.readFileSync(file, 'utf8');
      const sourceFile = ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      const allowed = ALLOWLIST[relative] || new Set();

      const report = (node, text) => {
        const trimmed = text.trim();
        if (!trimmed || !/[\u4e00-\u9fff]/.test(trimmed)) return;
        if ([...allowed].some(item => trimmed.includes(item))) return;
        const { line } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(),
        );
        violations.push(`${relative}:${line + 1} ${trimmed.slice(0, 80)}`);
      };

      const visit = node => {
        if (ts.isJsxText(node)) report(node, node.text);
        if (
          (ts.isStringLiteral(node) ||
            ts.isNoSubstitutionTemplateLiteral(node)) &&
          isUiLiteral(node)
        ) {
          report(node, node.text);
        }
        ts.forEachChild(node, visit);
      };

      visit(sourceFile);
    });
  });

  assert.deepEqual(violations, [], '存在未接入 i18n 的中文界面文案');
});
