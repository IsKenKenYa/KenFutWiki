# prune_hub_tags.py 的单元测试：保留策略逻辑
# 运行：python3 -I .github/scripts/test-prune_hub_tags.py
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from prune_hub_tags import plan_deletions, classify


def make_tags():
    tags = []
    # v2.1.x: 12 个（超 10）→ 删 2 个最旧的
    # 时间构造：v2.1.1 最新，编号越大越旧
    for i in range(1, 13):
        tags.append({"name": f"v2.1.{i}", "last_updated": f"2026-11-{(14 - i) % 28 + 1:02d}T00:00:00Z"})
    # v2.0.x: 5 个（未超）→ 全保
    for i in range(5, 0, -1):
        tags.append({"name": f"v2.0.{i}", "last_updated": f"2026-10-{(15 - i) % 28 + 1:02d}T00:00:00Z"})
    # v1.9.x: 25 个（major=1 在 KEEP_MAJORS=20 范围内）→ 全保
    for i in range(25, 0, -1):
        tags.append({"name": f"v1.9.{i}", "last_updated": f"2026-09-{(30 - i) % 28 + 1:02d}T00:00:00Z"})
    # 保护 tag
    tags.append({"name": "latest", "last_updated": "2026-11-01T00:00:00Z"})
    tags.append({"name": "demo", "last_updated": "2026-11-01T00:00:00Z"})
    # 带后缀的预发布版本也按语义化版本归类
    tags.append({"name": "v0.0.1-beta", "last_updated": "2026-08-01T00:00:00Z"})
    # sha 22 个 → 删 2 个最旧的
    for i in range(22):
        tags.append({"name": f"sha-{i:07d}", "last_updated": f"2026-08-{(i % 28) + 1:02d}T00:00:00Z"})
    return tags


def main():
    tags = make_tags()
    d = plan_deletions(tags)
    assert "latest" not in d and "demo" not in d, "保护 tag 被删！"
    # major 2 组内有 17 个 tag（v2.1 的 12 个 + v2.0 的 5 个），按时间取前 10：
    # v2.1 时间全部比 v2.0 新，v2.1 最新 10 个保留，v2.1.11/v2.1.12 与 v2.0 全部删除
    assert "v2.1.12" in d and "v2.1.11" in d, "v2.1 最旧两个应删除"
    assert sum(1 for x in d if x.startswith("v2.1.")) == 2, "v2.1 应恰好删除 2 个"
    assert sum(1 for x in d if x.startswith("v2.0.")) == 5, "同 major 内 v2.0 时间全旧，5 个全部删除"
    assert sum(1 for x in d if x.startswith("v1.9.")) == 15, "major 1 组内 25 个，保留前 10 删 15"
    assert sum(1 for x in d if x.startswith("sha-")) == 2, "sha 只保留最近 20"
    assert "v0.0.1-beta" not in d, "带后缀版本号应按版本归类保留"
    majors, shas, other = classify(tags)
    assert set(majors.keys()) == {2, 1, 0}, f"大版本分组错误: {majors.keys()}"
    print("单测全部通过")


if __name__ == "__main__":
    main()
