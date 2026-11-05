// 从 cherry-studio provider-registry（MIT）生成精简模型元数据目录。
// 用法：node scripts/gen-model-catalog.mjs [cherry-studio provider-registry 目录]
// 默认路径指向本机 ReferencesOpenProject 中的 cherry-studio。
// 数据来源：https://github.com/CherryHQ/cherry-studio/tree/main/packages/provider-registry（MIT License）
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source =
  process.argv[2] ??
  '/Volumes/FanXiangMac/MyOpenSource/ReferencesOpenProject/cherry-studio/packages/provider-registry';

const models = JSON.parse(
  readFileSync(resolve(source, 'data/models.json'), 'utf8'),
).models;
const overrides = JSON.parse(
  readFileSync(resolve(source, 'data/provider-models.json'), 'utf8'),
).overrides;

// 精简模型表：id -> {n: 名称, cw: 上下文窗口, mo: 最大输出, img: 支持图片输入}
const catalog = {};
for (const m of models) {
  if (!m?.id) continue;
  const entry = {};
  if (m.name && m.name !== m.id) entry.n = m.name;
  if (typeof m.contextWindow === 'number') entry.cw = m.contextWindow;
  if (typeof m.maxOutputTokens === 'number') entry.mo = m.maxOutputTokens;
  const img =
    (Array.isArray(m.inputModalities) && m.inputModalities.includes('image')) ||
    (Array.isArray(m.capabilities) &&
      m.capabilities.includes('image-recognition'));
  if (img) entry.img = true;
  if (Object.keys(entry).length > 0) catalog[m.id.toLowerCase()] = entry;
}

// 别名表：apiModelId -> modelId（去重；同 id 多 provider 的取首个即可，元数据同源）
const aliases = {};
for (const o of overrides) {
  const apiId = o?.apiModelId;
  const modelId = o?.modelId;
  if (!apiId || !modelId || apiId === modelId) continue;
  const target = modelId.toLowerCase();
  if (catalog[target] && !(apiId.toLowerCase() in aliases)) {
    aliases[apiId.toLowerCase()] = target;
  }
}

const out = { models: catalog, aliases };

// 厂商分组：ownedBy → 该厂商的模型 id 列表（供"选供应商后预填模型下拉"用）
const byOwner = {};
for (const m of models) {
  if (!m?.id || !m?.ownedBy) continue;
  const owner = m.ownedBy.toLowerCase();
  (byOwner[owner] ??= []).push(m.id);
}
out.byOwner = byOwner;

// 本地补充：cherry 目录缺失但常见的模型（保守填写，仅确定的条目）
const EXTRAS = {
  'claude-3-5-sonnet': {
    n: 'Claude 3.5 Sonnet',
    cw: 200000,
    mo: 8192,
    img: true,
  },
  'claude-3-7-sonnet': {
    n: 'Claude 3.7 Sonnet',
    cw: 200000,
    mo: 64000,
    img: true,
  },
  'moonshot-v1-8k': { n: 'Moonshot v1 8K', cw: 8192 },
  'moonshot-v1-32k': { n: 'Moonshot v1 32K', cw: 32768 },
  'moonshot-v1-128k': { n: 'Moonshot v1 128K', cw: 131072 },
};
for (const [id, entry] of Object.entries(EXTRAS)) {
  if (!out.models[id]) out.models[id] = entry;
}
// 本地补充别名：指向目录中已有的等价行
const EXTRA_ALIASES = {
  'deepseek-reasoner': 'deepseek-r1',
  'claude-3-5-sonnet-latest': 'claude-3-5-sonnet',
  'claude-3-7-sonnet-latest': 'claude-3-7-sonnet',
};
for (const [from, to] of Object.entries(EXTRA_ALIASES)) {
  if (out.models[to] && !out.aliases[from]) out.aliases[from] = to;
}

const dest = resolve(import.meta.dirname, '../src/constant/model-catalog.json');
writeFileSync(dest, JSON.stringify(out));
console.log(
  `models: ${Object.keys(catalog).length}, aliases: ${Object.keys(aliases).length}, -> ${dest}`,
);
