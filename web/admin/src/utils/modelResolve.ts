// 模型 id → 元数据解析。归一化逻辑移植自 cherry-studio provider-registry（MIT）：
// https://github.com/CherryHQ/cherry-studio/blob/main/packages/provider-registry/src/utils/normalize.ts
import catalog from '../constant/model-catalog.json' with { type: 'json' };

export interface ModelMeta {
  id: string;
  name?: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  supportsImage?: boolean;
}

type CatalogEntry = { n?: string; cw?: number; mo?: number; img?: boolean };

const AGGREGATOR_PREFIXES = [
  'aihubmix-',
  'aihub-',
  'ahm-',
  'azure-',
  'openai-',
  'siliconflow-',
  'deepinfra-',
  'groq-',
  'nvidia-',
  'dmxapi-',
  'perplexity-',
  'huoshan-',
  'together-',
  'fireworks-',
  'lepton-',
  'z-ai-',
];

const COLON_VARIANT_SUFFIXES = [
  ':free',
  ':nitro',
  ':extended',
  ':beta',
  ':preview',
  ':thinking',
  ':latest',
  ':cloud',
];

const HYPHEN_VARIANT_SUFFIXES = [
  '-free',
  '-search',
  '-online',
  '-think',
  '-reasoning',
  '-classic',
  '-nothink',
  '-no-think',
  '-thinking',
  '-nothinking',
  '-thinking',
];

const QUANTIZATION_SUFFIXES = [
  '-fp8',
  '-fp16',
  '-bf16',
  '-awq',
  '-int4',
  '-int8',
  '-gguf',
  '-gptq',
];

// 尾部发布日期戳（YYYY-MM-DD / YYYYMMDD / YYMMDD / MMDD），强制月份 01-12、日期 01-31，
// 不会误伤 glm-4-9b / qwen3-235b 这类尺寸名；@001 形式的 tag 也剥掉。
const DATE_SNAPSHOT_PATTERN =
  /-20\d{2}-(?:0[1-9]|1[0-2])-(?:[0-2]\d|3[01])$|-20\d{2}(?:0[1-9]|1[0-2])(?:[0-2]\d|3[01])$|-2\d(?:0[1-9]|1[0-2])(?:[0-2]\d|3[01])$|-(?:0[1-9]|1[0-2])(?:[0-2]\d|3[01])$|@00\d+$/;

const KNOWN = catalog.models as Record<string, CatalogEntry>;
const ALIASES = catalog.aliases as Record<string, string>;
const BY_OWNER =
  (catalog as { byOwner?: Record<string, string[]> }).byOwner ?? {};

// 本仓 provider 枚举 key → 模型目录的 ownedBy
const PROVIDER_OWNER: Record<string, string> = {
  ZhiPu: 'zhipu',
  DeepSeek: 'deepseek',
  HunYuan: 'tencent',
  TencentTI: 'tencent',
  BaiLian: 'alibaba',
  ModelScope: 'alibaba',
  Volcengine: 'bytedance',
  OpenAI: 'openai',
  Moonshot: 'moonshot',
  Gemini: 'google',
  BaiDuQianFan: 'baidu',
  Nvidia: 'nvidia',
  Mistral: 'mistral',
  StepFun: 'stepfun',
};

// 非文本生成类 id（图像/语音/视频），chat 场景预填时排除
const NON_CHAT_PATTERN =
  /embed|bge-|rerank|whisper|tts|dall-e|cogview|image|video|audio|flux|kling|sora|stable-diffusion|recraft|ve-|seedance/i;
const EMBEDDING_PATTERN = /embed|bge|e5-|gte/i;
const RERANK_PATTERN = /rerank|re-rank/i;

/**
 * 供应商预设模型列表（来自内置目录的厂商分组，按模型类型过滤）。
 * 无目录数据的供应商返回空数组，由用户拉取或手填。
 */
export function presetModelIds(providerKey: string, type: string): string[] {
  const owner = PROVIDER_OWNER[providerKey];
  const ids = owner ? (BY_OWNER[owner] ?? []) : [];
  if (ids.length === 0) return [];
  let filtered: string[];
  if (type === 'embedding') {
    filtered = ids.filter(id => EMBEDDING_PATTERN.test(id));
  } else if (type === 'rerank') {
    filtered = ids.filter(id => RERANK_PATTERN.test(id));
  } else {
    filtered = ids.filter(id => !NON_CHAT_PATTERN.test(id));
  }
  return filtered.slice(0, 50);
}

// 版本分隔符折叠：glm-4.6 / glm-4_6 → glm-4-6（仅折叠数字段之间的分隔符）
function foldVersionSeparators(id: string): string {
  return id.replace(/(\d)[._](\d)/g, '$1-$2');
}

function normalize(raw: string): string {
  let id = raw.trim().toLowerCase();
  for (const prefix of AGGREGATOR_PREFIXES) {
    if (id.startsWith(prefix)) {
      id = id.slice(prefix.length);
      break;
    }
  }
  // 不动点剥离：日期后缀可能遮蔽内层变体后缀（…-thinking-20250901），必须循环
  for (;;) {
    const next = foldVersionSeparators(
      id.replace(DATE_SNAPSHOT_PATTERN, '').replace(/(?:[-_v]\d+)?:\d+$/, ''), // Bedrock 风格 revision（…-v1:0）
    );
    const stripped = stripVariant(next);
    if (stripped === id) return id;
    id = stripped;
  }
}

function stripVariant(id: string): string {
  const colonIdx = id.lastIndexOf(':');
  if (colonIdx > 0) {
    const suffix = id.slice(colonIdx);
    if (COLON_VARIANT_SUFFIXES.includes(suffix)) {
      return id.slice(0, colonIdx);
    }
    // 本地 runner 的尺寸/量化 tag（qwen2.5:7b / gpt-oss:20b-q4）改为连字符拼回，
    // 让尺寸保持 id 的一部分（目录行是连字符拼写）
    const tag = suffix.slice(1);
    if (/^(?:\d+(?:[.x]\d+)*b|q\d|iq\d|fp16|bf16)/.test(tag)) {
      return id.slice(0, colonIdx) + '-' + tag;
    }
  }
  for (const suffix of [...HYPHEN_VARIANT_SUFFIXES, ...QUANTIZATION_SUFFIXES]) {
    if (id.endsWith(suffix)) {
      const stem = id.slice(0, -suffix.length);
      // 保留真实词（如 mistral-medium 这类档位名）：stem 不能只剩空段
      if (stem && !/[-:]$/.test(stem)) return stem;
    }
  }
  return id;
}

/**
 * 两段式解析：原样精确 → 别名表 → 归一化后再精确 → 归一化后查别名表。
 * 未收录返回 null（调用方提示手动填写，不猜测默认值）。
 */
export function resolveModelMeta(rawId: string): ModelMeta | null {
  const id = rawId?.trim().toLowerCase();
  if (!id) return null;

  const lookup = (key: string): ModelMeta | null => {
    const direct = KNOWN[key];
    if (direct) return toMeta(key, direct);
    const aliased = ALIASES[key];
    if (aliased && KNOWN[aliased]) return toMeta(aliased, KNOWN[aliased]);
    return null;
  };

  return lookup(id) ?? lookup(normalize(id));
}

function toMeta(id: string, entry: CatalogEntry): ModelMeta {
  return {
    id,
    name: entry.n,
    contextWindow: entry.cw,
    maxOutputTokens: entry.mo,
    supportsImage: entry.img,
  };
}
