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

// ===== ZCode 模型规则合并（Apache-2.0）=====
// 来源：ReferencesOpenProject/ZCode config/provider/zcode-builtin.json 的
// modelConfigRules.modelRules（正则 → contextWindow/maxOutput/图片输入），
// 比 cherry 快照更新（覆盖 GLM-5.x、DeepSeek V4、Kimi K2.7、Qwen3.7 等）。
// 用法：node scripts/gen-model-catalog.mjs [cherry目录] [zcode-builtin.json]
const zcodeSource =
  process.argv[3] ??
  '/Volumes/FanXiangMac/MyOpenSource/ReferencesOpenProject/ZCode/config/provider/zcode-builtin.json';

// 正则转目录 id：`. *NAME.*` 形式的规则取中间字面量，反转义后按本仓归一化
// 规则折叠数字段分隔符（glm-5.3 → glm-5-3），宽泛规则（`.*`、`.*k3.*`）跳过。
// `[.-]` 字符类展开为点/连字符两种拼写（折叠后同 id，去重即可）。
const foldDigits = id => id.toLowerCase().replace(/(\d)[._](\d)/g, '$1-$2');
const regexToIds = pattern => {
  const m = /^\.\*(.+)\.\*$/.exec(pattern);
  if (!m) return [];
  const literal = m[1].replaceAll('\\.', '.').replaceAll('\\', '');
  if (!/^[a-z0-9][a-z0-9._\[\]-]*$/i.test(literal)) return [];
  const base = literal.replace(/\[\.\-\]/g, '.');
  const variants = new Set([
    foldDigits(base),
    foldDigits(base.replaceAll('.', '-')),
  ]);
  return [...variants];
};

try {
  const zcode = JSON.parse(readFileSync(zcodeSource, 'utf8'));
  const rules = zcode?.config?.modelConfigRules?.modelRules ?? [];
  let merged = 0;
  for (const rule of rules) {
    const ids = regexToIds(rule?.modelMatch ?? '');
    const props = rule?.config?.properties ?? {};
    const mo = rule?.config?.optionSpecs?.maxOutputTokens?.max;
    const entry = {};
    if (typeof props.contextWindow === 'number') entry.cw = props.contextWindow;
    if (typeof mo === 'number') entry.mo = mo;
    if (props.inputFormat?.supportsImage) entry.img = true;
    if (Object.keys(entry).length === 0) continue;
    for (const id of ids) {
      // cherry 已收录且带上下文窗口的条目不覆盖（同源数据以 cherry 为准）
      if (out.models[id] && out.models[id].cw) continue;
      out.models[id] = { ...out.models[id], ...entry };
      merged++;
    }
  }

  // 供应商内置模型 id 多为 org/model 形式（如 deepseek-ai/DeepSeek-V4-Flash），
  // 剥离 org 前缀后若能命中目录行，则登记为别名，识别时直接复用元数据。
  const templateRules = zcode?.config?.providerConfigRules?.templateRules ?? [];
  for (const tpl of templateRules) {
    for (const apiId of tpl?.config?.builtinModelIds ?? []) {
      const stripped = String(apiId).split('/').pop()?.toLowerCase();
      if (!stripped || stripped === String(apiId).toLowerCase()) continue;
      if (out.models[stripped] && !out.aliases[String(apiId).toLowerCase()]) {
        out.aliases[String(apiId).toLowerCase()] = stripped;
      }
    }
  }
  console.log(`zcode rules merged: ${merged} entries from ${zcodeSource}`);
} catch (err) {
  // ZCode 参考仓库不存在时仅使用 cherry 数据（脚本保持可独立运行）
  console.warn(`zcode catalog skipped: ${err?.message ?? err}`);
}

const dest = resolve(import.meta.dirname, '../src/constant/model-catalog.json');
writeFileSync(dest, JSON.stringify(out));
console.log(
  `models: ${Object.keys(catalog).length}, aliases: ${Object.keys(aliases).length}, -> ${dest}`,
);
