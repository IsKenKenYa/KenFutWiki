import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'src');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const zh = JSON.parse(read('src/locales/zh.json'));
const en = JSON.parse(read('src/locales/en.json'));

const flatten = (value, prefix = '', result = {}) => {
  Object.entries(value).forEach(([key, item]) => {
    const next = prefix ? `${prefix}.${key}` : key;
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      flatten(item, next, result);
    } else {
      result[next] = item;
    }
  });
  return result;
};

const flattenKeys = value => Object.keys(flatten(value));

const collectFiles = dir => {
  const files = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(file));
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(file);
    }
  });
  return files;
};

const placeholders = value => {
  const matched = [];
  const pattern = /\{\{\s*([\w.]+)\s*\}\}/g;
  let match;
  while ((match = pattern.exec(value))) matched.push(match[1]);
  return matched.sort();
};

const sourceFiles = collectFiles(srcDir).filter(
  file => !file.includes(`${path.sep}locales${path.sep}`),
);

// JSON.parse 会静默保留最后一个同名 key，这里额外扫描原始文本，
// 避免重复定义把前面完整的词条覆盖掉（例如 perm/version/doc.properties）。
const findDuplicateKeys = text => {
  let index = 0;
  const duplicates = [];
  const skipWhitespace = () => {
    while (/\s/.test(text[index] || '')) index += 1;
  };
  const readString = () => {
    index += 1;
    let value = '';
    while (index < text.length) {
      const char = text[index];
      if (char === '\\') {
        value += text.slice(index, index + 2);
        index += 2;
        continue;
      }
      if (char === '"') {
        index += 1;
        return value;
      }
      value += char;
      index += 1;
    }
    throw new Error('未闭合的 JSON 字符串');
  };
  const readValue = path => {
    skipWhitespace();
    const char = text[index];
    if (char === '{') {
      index += 1;
      const keys = new Set();
      skipWhitespace();
      if (text[index] === '}') {
        index += 1;
        return;
      }
      while (index < text.length) {
        skipWhitespace();
        const key = readString();
        if (keys.has(key)) duplicates.push([...path, key].join('.'));
        keys.add(key);
        skipWhitespace();
        index += 1; // :
        readValue([...path, key]);
        skipWhitespace();
        if (text[index] === ',') {
          index += 1;
          continue;
        }
        if (text[index] === '}') {
          index += 1;
          return;
        }
        throw new Error(`JSON 对象解析失败：${path.join('.')}`);
      }
      return;
    }
    if (char === '[') {
      index += 1;
      skipWhitespace();
      if (text[index] === ']') {
        index += 1;
        return;
      }
      while (index < text.length) {
        readValue(path);
        skipWhitespace();
        if (text[index] === ',') {
          index += 1;
          continue;
        }
        if (text[index] === ']') {
          index += 1;
          return;
        }
        throw new Error(`JSON 数组解析失败：${path.join('.')}`);
      }
      return;
    }
    while (index < text.length && !/[,}\]]/.test(text[index])) index += 1;
  };
  readValue([]);
  return duplicates;
};

test('locale 文件不存在重复 key', () => {
  assert.deepEqual(findDuplicateKeys(read('src/locales/zh.json')), []);
  assert.deepEqual(findDuplicateKeys(read('src/locales/en.json')), []);
});

test('中英文词条 key 完全一致', () => {
  const zhKeys = flattenKeys(zh);
  const enKeys = flattenKeys(en);
  assert.deepEqual(
    enKeys.filter(key => !zhKeys.includes(key)),
    [],
    '英文存在中文缺失的 key',
  );
  assert.deepEqual(
    zhKeys.filter(key => !enKeys.includes(key)),
    [],
    '中文存在英文缺失的 key',
  );
});

test('词条值为非空字符串', () => {
  [
    ['zh', zh],
    ['en', en],
  ].forEach(([locale, resources]) => {
    Object.entries(flatten(resources)).forEach(([key, value]) => {
      assert.equal(typeof value, 'string', `${locale}.${key} 必须是字符串`);
      assert.ok(String(value).trim(), `${locale}.${key} 不能为空`);
    });
  });
});

test('中英文插值占位符保持一致', () => {
  const zhFlat = flatten(zh);
  const enFlat = flatten(en);
  Object.keys(zhFlat).forEach(key => {
    assert.deepEqual(
      placeholders(String(enFlat[key])),
      placeholders(String(zhFlat[key])),
      `${key} 的插值占位符不一致`,
    );
  });
});

test('源码中引用的词条 key 都已定义', () => {
  const zhFlat = flatten(zh);
  const enFlat = flatten(en);
  const used = new Map();
  const namespaces = new Set(Object.keys(zh));

  sourceFiles.forEach(file => {
    const source = fs.readFileSync(file, 'utf8');
    const literalKey = /\bt\(\s*['"]([^'"]+)['"]/g;
    let match;
    while ((match = literalKey.exec(source))) {
      const key = match[1];
      if (!used.has(key)) used.set(key, file);
    }

    // 常量/枚举里保存的 i18n key（如 enum.pageStatus.processing）也要校验
    const namespaceKey = /['"]([a-zA-Z][\w]*(?:\.[\w-]+)+)['"]/g;
    while ((match = namespaceKey.exec(source))) {
      const [namespace] = match[1].split('.');
      if (namespaces.has(namespace) && !used.has(match[1])) {
        used.set(match[1], file);
      }
    }
  });

  const missing = [...used.entries()].filter(([key]) => !(key in zhFlat));
  assert.deepEqual(
    missing.map(([key, file]) => `${key} (${path.relative(root, file)})`),
    [],
    '源码引用了未定义的词条 key',
  );
  const missingEn = [...used.keys()].filter(key => !(key in enFlat));
  assert.deepEqual(missingEn, [], '源码引用的 key 缺少英文词条');
});

test('侧边栏导航 key 在中英文词条中都存在', () => {
  const source = read('src/components/Sidebar/index.tsx');
  const keys = [...source.matchAll(/label:\s*'([^']+)'/g)].map(
    match => match[1],
  );
  assert.ok(keys.length >= 8, '应至少解析出 8 个导航项');
  const zhFlat = flatten(zh);
  const enFlat = flatten(en);
  keys.forEach(key => {
    assert.ok(key in zhFlat, `导航 key ${key} 缺少中文词条`);
    assert.ok(key in enFlat, `导航 key ${key} 缺少英文词条`);
  });
});
