#!/usr/bin/env python3
# Docker Hub 镜像 tag 保留策略清理脚本
#
# 保留规则（业内常见做法，参考各大开源项目 release 车道）：
#   - latest 与滚动 tag（demo 等）永不删除
#   - 每个「大版本」只保留最近 10 个 tag
#   - 最多保留最近 20 个「大版本」；更早的大版本整体删除
#     （旧版本用户可自行从 GitHub 源码对应 tag 构建）
#   - sha-<hash> 开发 tag：只保留最近 20 个，其余删除
#
# 用法：
#   HUB_USERNAME=iskenkenya HUB_TOKEN=xxx python3 prune-hub-tags.py [IMAGE ...]
#   不传 IMAGE 时清理 IMAGE_PREFIX 下的全部四个镜像
#
# 删除走 Docker Hub v2 API（DELETE /v2/repositories/<name>/tags/<tag>），
# 需要 JWT（登录换 token），与 docker login 的凭证同源。

import json
import os
import re
import sys
import urllib.request
import urllib.error

HUB_URL = "https://hub.docker.com/v2/repositories"
KEEP_PER_MAJOR = 10
KEEP_MAJORS = 20
KEEP_SHA = 20
DEFAULT_IMAGES = [
    "kenfutwiki-api",
    "kenfutwiki-consumer",
    "kenfutwiki-app",
    "kenfutwiki-nginx",
]

# 不允许删除的滚动 tag
PROTECTED = {"latest", "demo", "main", "dev"}


def get_token(username: str, password: str) -> str:
    req = urllib.request.Request(
        "https://hub.docker.com/v2/users/login",
        data=json.dumps({"username": username, "password": password}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.load(resp)
    # 登录响应字段历史上有 jwt_token / token 两种形态，取存在的那个
    return data.get("token") or data["jwt_token"]


def list_tags(image: str) -> list:
    """分页拉取全部 tag（公开仓库匿名可读），返回 [{name, last_updated}]，按时间新→旧"""
    tags = []
    url = f"{HUB_URL}/{image}/tags/?page_size=100"
    while url:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.load(resp)
        for t in data.get("results", []):
            tags.append({"name": t["name"], "last_updated": t.get("last_updated", "")})
        url = data.get("next")
    tags.sort(key=lambda x: x["last_updated"], reverse=True)
    return tags


def delete_tag(token: str, image: str, tag: str) -> bool:
    req = urllib.request.Request(
        f"{HUB_URL}/{image}/tags/{tag}",
        headers={"Authorization": f"JWT {token}"},
        method="DELETE",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status in (200, 202, 204)
    except urllib.error.HTTPError as e:
        print(f"  ! 删除失败 {image}:{tag} -> HTTP {e.code}", file=sys.stderr)
        return False


# 语义化版本：vMAJOR.MINOR.PATCH(-后缀)
SEMVER = re.compile(r"^v?(\d+)\.(\d+)\.(\d+)(?:[-.].*)?$")


def classify(tags: list) -> tuple:
    """把 tag 分为 majors(按大版本分组) / shas / other 三组"""
    majors = {}  # major -> [tag]
    shas = []
    other = []
    for t in tags:
        name = t["name"]
        if name in PROTECTED:
            other.append(t)
            continue
        m = SEMVER.match(name)
        if m:
            majors.setdefault(int(m.group(1)), []).append(t)
        elif name.startswith("sha-"):
            shas.append(t)
        else:
            other.append(t)
    return majors, shas, other


def plan_deletions(tags: list) -> list:
    """返回应删除的 tag 名单"""
    majors, shas, other = classify(tags)
    to_delete = []
    # 大版本：保留最近 KEEP_MAJORS 个大版本，每个版本内保留最近 KEEP_PER_MAJOR 个
    sorted_major_ids = sorted(majors.keys(), reverse=True)
    for major_id in sorted_major_ids[KEEP_MAJORS:]:
        to_delete.extend(t["name"] for t in majors[major_id])
    for major_id in sorted_major_ids[:KEEP_MAJORS]:
        version_tags = majors[major_id][KEEP_PER_MAJOR:]
        to_delete.extend(t["name"] for t in version_tags)
    # sha 开发 tag：只留最近 KEEP_SHA 个
    to_delete.extend(t["name"] for t in shas[KEEP_SHA:])
    return to_delete


def main() -> None:
    username = os.environ.get("HUB_USERNAME")
    password = os.environ.get("HUB_TOKEN")
    if not username or not password:
        print("需要环境变量 HUB_USERNAME / HUB_TOKEN", file=sys.stderr)
        sys.exit(1)
    images = sys.argv[1:] or DEFAULT_IMAGES
    token = get_token(username, password)
    total_deleted = 0
    for image in images:
        tags = list_tags(image)
        deletions = plan_deletions(tags)
        keep = len(tags) - len(deletions)
        print(f"{image}: 共 {len(tags)} 个 tag，保留 {keep}，删除 {len(deletions)}")
        for name in deletions:
            if delete_tag(token, image, name):
                print(f"  - 删除 {name}")
                total_deleted += 1
    print(f"完成：共删除 {total_deleted} 个 tag")


if __name__ == "__main__":
    main()
