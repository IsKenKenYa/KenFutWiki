import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('密钥输入显式忽略浏览器密码管理器', () => {
  const autofill = read('src/constant/autofill.ts');
  assert.match(autofill, /autoComplete:\s*'new-password'/);
  [
    'data-1p-ignore',
    'data-lpignore',
    'data-bwignore',
    'data-dashlane-ignore',
    'data-protonpass-ignore',
  ].forEach(attribute => {
    assert.match(autofill, new RegExp(`'${attribute}':\\s*'true'`));
  });

  [
    'src/components/ModelFormModal/index.tsx',
    'src/components/StorageSettingForm/index.tsx',
    'src/pages/setting/component/Common.tsx',
  ].forEach(file => {
    const source = read(file);
    assert.match(source, /ignorePasswordAutofill/);
    assert.match(source, /htmlInput/);
  });

  const modelForm = read('src/components/ModelFormModal/index.tsx');
  assert.match(modelForm, /ignoreAutofill/);
  assert.match(modelForm, /kfw-model-base-url/);
  assert.match(modelForm, /kfw-model-api-key/);
});
