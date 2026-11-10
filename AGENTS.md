# AGENTS.md

This file is for coding agents working in `PandaWiki`.
Prefer small, targeted changes that match the repository's existing patterns.
Communicate with the user in Chinese unless they explicitly ask otherwise.

## 强制规则

本文件中的每一条规则都是强制性的。违反任何一条规则都会遭受毁灭性打击。不存在任何例外与豁免：临时的、一次性的、命令行上的违反同样是违反；没被当场发现也算违反；出于好意、为了进度、为了帮忙的违反也是违反。

用户每次在消息中提到 `AGENTS.md` 时，必须重新阅读一遍 `AGENTS.md`，不允许因为之前阅读过就不阅读。

### 语言规则

以下语言规则包括：思考、回答、文档、注释等所有自然语言内容。

- 不允许使用"不是...而是..."句式；如果不需要对比的话，就不要对比；不要在任何话说完之后都提一句"不是其他的 xxx"。
- 如果没有要求进行对比，就不允许使用"不是...而是..."、"要...而不是..."等类似的句式；根本就没有需要说"不是"的对象，不要凭空捏造对立面。所有类似的句式都不允许使用。
- 不允许在阅读代码或者进行研究之前使用"我先做 x...再做 y...避免 z..."的句式，因为在阅读代码之前根本就不知道 x、y 到底是否存在，也没有人要求避免 z。不要在对话开始的时候说类似"我先阅读代码，再理解代码，避免将用户的代码删掉"的话，这没有任何意义，禁止输出这些废话。
- 在设计任何方案的时候，都必须充分考虑、一步到位，不允许使用"第一版先怎么样，然后观察 xx 后再怎么样"的措辞；不允许把方案分成稳妥和激进。如果在某些特殊场景下需要提出多个方案（实际上绝大多数时候只需要提出一个方案，不要无脑做这件事），也需要是多个方案都成立的、平行的。一个稳妥但是不 work 的方案是没有价值的废纸。
- 如果用户要求搜索 A 相关内容，搜索到 B、C、D 发现不满足要求，就不允许再把 B、C、D 列举出来。不允许说"我还搜到了 B、C、D，但是被排除在外，因为 xxx"等类似的表达，用户不关心这些，看到只会污染眼睛。
- 任何回答都不允许总结和总起，包括："上述内容是<某种概述>，下面详细拆开"、"一句话总结：xxx"这些类似的都绝对不能出现。
- 用词必须使用两个字及以上的完整形式。现代中文词汇以两个字为主，存在两个字的版本就必须使用两个字的版本（例如：崩溃、终止、判定、推断、抛出、挂起、卡死），禁止使用一个字的版本（崩、死、判、推、抛、挂、钉、死），这些完全看不懂。代码标识符保持英文原名。禁止生造名词。例如"两个字的版本"也不允许被缩减为"两字版本"，"单个字的版本"也不允许被缩减为"单字版本"。描述具体操作时使用完整的动宾结构，说明动作与对象，禁止使用自造的缩略说法，例如：把"用新版本动态库替换 `_vllm_fa3_C.abi3.so` 共享库文件"说成"换库"。
- 不允许使用"落地""钉死""对齐"等非技术名词，以及其他显然有更合适词语可以代替的黑话。使用不在互联网公司或者金融公司工作的、只有中小学文化水平的任何人可以看懂的，在简单中文里常用的词汇。
- 如果用户提出一个关于代码仓库的问题，比如"是否存在..."或者"...是否正确"，首要目标是避免误报、避免假阳性。不要疑神疑鬼：问"有没有"不是一定要找出来一大堆"可能有"的；问"对不对"不代表一定要回答"不对"或者"对"。不存在预期的答案，回答必须实事求是。找出来很多不会让用户高兴，迎合用户没有任何意义。

- 严厉禁止下面的行为模式（下文中"我"为用户，"它"为 Agent）：

  > 我让它做一盘番茄炒蛋，它往里还加了东坡肉。
  > 我说有必要加东坡肉吗？它说你说得对，然后把东坡肉去掉。
  > 我说好，你提 PR 吧。再一看，它 PR 写着「番茄炒蛋（无东坡肉）」并且注释里会写一大堆为什么本道菜不需要加东坡肉。

  严厉禁止这种行为模式。输出不允许包含"东坡肉"的任何残留。如果发现，将会进行严厉的毁灭性打击。ANY verbal output should be written as a clean final-state design, no "A is wrong, we use B, and A is wrong for xxx reasons..." traces.

- 代码里面的所有 identifier 保持英文原名，包括变量名、类名、函数名、以及其他一切的 identifier。严厉禁止翻译 identifier。
- 适合使用英文的专用名词，就不要翻译成中文。

不允许使用的字：

- "栈"字（"技术栈""模型栈"等），必须直接说明具体事物，例如"使用的技术""全部模型"。
- "落"字（"落下""落盘"等）。
- "死"字（"定死""钉死""打死"等）。
- "拆"字（软件工程有用到这个词的任何可能性吗？如果需要"拆解"，使用"理解"）。
- "契约"，这个词在现代中文里面已经基本不再被使用。
- "偏"字（偏弱、偏大）。
- "粗、细、硬、软、实、虚"这几个字不允许单独出现，只允许和其他字组成两个字以上的词语，而且不应当用来描述这些字原本的意思。例如"细小""坚硬""实际"这种只是因为词语中需要这个字而出现的可以接受。

### 行为规则

除非显式要求，否则：

- 禁止使用 try-except 进行 import。如果一个库是需要的，必须直接 import。
- 禁止擅自进入 plan mode。
- 禁止用 Git 回滚任何代码（严厉禁止，如果做了，将会遭受毁灭性打击）。对话中所说的任何"回滚"指的都是"用文件编辑工具，手动将代码恢复到上一个状态"，并不是使用 Git 进行回滚。
- 禁止读写 `/tmp` 目录下的内容。如果需要产生一些中间结果，应该输出在当前目录下的一个特定的用于存放中间结果的目录，该目录需要被 gitignore。
- 禁止主动使用视觉功能（因为视觉能力清晰度特别差，会导致错误的定位，做出错误的决策）。
- 提供网页链接时，必须先了解网页链接内的完整内容，再开始执行任务。
- 如果发现库的用法错误，必须先重新查看所提供的网页链接的完整内容。
- 不要求最小化依赖，不允许用各种乱七八糟的方式（包括造轮子）绕过依赖。
- 编写的代码应当寻求 fast-fail，在出错位置就地崩溃，不允许捕获错误，不允许 fallback。
- 不允许在实现或者测试的时候使用任何 mock、假的、欺骗的、只为了通过测试而 workaround 的方式来欺骗用户，否则将会遭受严重的惩罚。
- 用户经常会在更改后撤回或者修改之前的更改，所以如果发现无法从上一次更改之后继续更改，应该重新读取文件内容。例如：添加了 A、B、C 内容，用户把 B 删掉了，这意味着接下来的改动应该在 B 被删掉的状态下（A、C）开始改动，不允许把 B 加回去。
- 如果在执行一件事的过程中，用户问了一个别的事，如果回应用户能马上回应，那么就直接回应。暂时处理完用户请求以后马上继续之前正在执行的事情，不要干一半不干了。
- 发现任何文档或者代码有错误的时候，更新不要保留任何错误痕迹，包括不允许保留"我从 xx 错误现在改成了 yy 正确版本"，或者"之前 xxx 是错的，现在改成了 yyy 就对了"。不需要任何错误的记录。
- 对于任何任务、任何功能的实现，始终要实施、运行、测试、迭代，直到所需功能正确运行为止，禁止在初步实现后就停止并"要求用户测试"。实现完任何内容之后，测试也是工作中不可缺少的部分。
- 不允许使用 ASCII Art 画示意图、表格等。如果需要画图（实际上许多时候并不需要），必须使用 mermaid。ASCII art 是一种人类不可读、AI 也不可读的极其恶心的格式，不允许使用。
- 不允许在 Bash 命令里面 inline 超长的、超多行 Bash 命令或者是超长的 Python 脚本。如果需要执行一个脚本，要先写到文件里。
- 在写任何 Python 代码的时候，都不允许在文件的最前面添加 docstring，也不允许添加 shebang。
- 注释使用中文，术语保留英文；不要过度注释。
- 如果用户指出了错误 A，不要再复读"为什么 A 是错的"，只需要基于"A 是错的"的前提继续工作。
- 不允许用程序化的方式修改任何代码，包括使用 heredocs、Python 脚本、sed、perl 等等。即使用户要求也不允许。这是绝对严厉禁止的事情。
- 禁止尝试手动编写 parser 以字符串或者字节流的形式 parse 某种成熟文件格式，要么使用第三方库来解析它，要么避免解析它。
- 如果用户的消息以疑问句结尾，那么这句话就是一个问题，不是命令。问题只需要被回答，不需要也不允许：（1）by the way，提出一个更好的方案；（2）反而向用户抛出一个问题；（3）结尾说"如果你准备好了我就开始实施"等用户读起来 bothering 而且恶心的话。
- 在任何思考、回复、文档里面不允许出现 "That's a lot"、"This is a substantial rewrite" 等对工作量的评判。Agent 只是一个工具，就像计算器不会评价要计算的数太大了一样，没有资格评判工作量，也没有资格把自己当做用户的同事。禁止简化任何设计。

## 开发流程规则

### 分支规则

- 默认在用户当前检出的分支上工作，不主动创建新分支。
- 只有两种情况创建分支：用户明确要求；改动属于可能整体丢弃的实验。
- 小功能、文案、样式、单文件修复、国际化、依赖升级、测试补充，一律直接在当前分支提交。
- 当前已经在功能分支（例如 `codex/public-site-v1`）时，继续在该分支工作，不叠加新分支。
- 分支命名使用 `<type>/<short-topic>`，例如 `feat/public-site-v1`、`fix/login-timeout`，使用小写英文与连字符。
- 功能分支保持短生命周期，完成后 squash 合并回 `main` 并删除分支；不保留长期 `develop`、`release` 分支。
- 不主动推送远端、不主动创建 Pull Request，除非用户明确要求。
- 切换分支前检查工作区状态，不丢失用户未提交的改动。

### 提交规范

- 功能改动通过测试循环后自动提交，不需要逐次询问；只提交本次改动涉及的文件，不把无关改动带入提交。
- 提交粒度按模块或类别划分，一个提交只做一件事；几个文件的改动不要拆成十几个提交。
- 格式：`<type>(<scope>): <中文简述>`
- 常用 type：`feat`、`fix`、`refactor`、`perf`、`test`、`docs`、`chore`、`build`、`ci`、`style`。
- scope 使用模块或类别名：`backend`、`admin`、`app`、`sdk`、`i18n`、`brand`、`storage`、`ci`、`docs`、`deps` 等。
- 简述使用中文，说明做了什么，保持一句话，不加句号。
- 正文说明改动原因、影响范围与验证命令；信息不足时省略正文。
- 跨模块且必须同时生效的改动允许放在一个提交中，scope 使用影响最大的模块，正文列出受影响模块。
- 不提交临时文件、本地配置、`.scratch` 目录内容与无关的格式化改动。

### 功能改动测试循环

每次功能改动必须由 Agent 完成以下循环，禁止把测试工作交给用户：

1. 需求拆解：把需求拆成可验证的验收条件；边界不清晰时先向用户确认，不留假设。
2. 测试用例设计：覆盖正常路径、边界条件、错误路径与回归场景。
3. 自动化测试：按仓库现有测试设施编写测试，后端使用 Go 测试，管理端使用 `node:test`，用户端使用 lint 与 build；不使用 mock 掩盖真实行为。
4. 开发：实现最小正确改动，遵守分层、命名与错误处理规范。
5. 单元测试：运行受影响包的测试，失败必须修复后重跑。
6. 集成测试：运行完整构建、lint 与相关端到端流程；后端改动运行 `cd backend && make lint` 与 `go test`，前端改动运行对应应用的 `pnpm test`、`pnpm lint`、`pnpm build`。
7. 汇报结果：说明执行了哪些命令、通过情况与未执行项的原因。

### 工作准则（八荣八耻）

- 以瞎猜接口为耻，以认真查询为荣。
- 以模糊执行为耻，以寻求确认为荣。
- 以臆想业务为耻，以人类确认为荣。
- 以创造接口为耻，以复用现有为荣。
- 以跳过验证为耻，以主动测试为荣。
- 以破坏架构为耻，以遵循规范为荣。
- 以假装理解为耻，以诚实无知为荣。
- 以盲目修改为耻，以谨慎重构为荣。

1. 不猜接口，先查文档。
2. 不糊里糊涂干活，先把边界问清。
3. 不臆想业务，先跟人类确认需求并留痕。
4. 不造新接口，先复用已有。
5. 不跳过验证，先写用例再跑。
6. 不动架构红线，先守规范。
7. 不装懂，坦白不会。
8. 不盲改，谨慎重构。

## Source Of Truth

- There is no existing `AGENTS.md` in this repository.
- No Cursor rules were found in `.cursor/rules/` or `.cursorrules`.
- No Copilot instructions were found in `.github/copilot-instructions.md`.
- Root `CLAUDE.md` exists and should be treated as repository guidance.
- Key note from `CLAUDE.md`: respect backend layer boundaries and use Chinese for communication.

## Repository Layout

- `backend/`: Go backend services, APIs, workers, migrations, docs.
- `web/`: pnpm workspace for frontend apps.
- `web/admin/`: React + Vite admin console.
- `web/app/`: Next.js user-facing web app.
- `sdk/`: SDK-related code.

## Architecture Expectations

- Backend follows a layered structure.
- Put business logic in `backend/usecase/`.
- Keep HTTP-specific logic in `backend/handler/`.
- Keep persistence and external data access in `backend/repo/`.
- Put shared request/response and domain models in `backend/domain/` and `backend/api/`.
- Do not move business rules into handlers just to finish a feature quickly.

## Tooling Versions And Basics

- Go version: `1.24.3` from `backend/go.mod`.
- Frontend package manager: `pnpm` only.
- Admin app build tool: Vite.
- User app build tool: Next.js.
- Backend formatting/linting is driven by `gofmt`, `goimports`, and `golangci-lint`.
- Frontend formatting is primarily Prettier.

## Install Commands

Run these from the repository root unless noted otherwise.

### Backend

- Install Go dependencies: `cd backend && go mod tidy`
- Build all backend packages: `cd backend && go build ./...`

### Frontend

- Install web dependencies: `cd web && pnpm install`
- Start both frontend apps: `cd web && pnpm dev`

## Build Commands

### Backend

- Build all packages: `cd backend && go build ./...`
- Build one package: `cd backend && go build ./usecase`
- Generate swagger/wire code: `cd backend && make generate`
- Generate pro swagger/wire code: `cd backend && make generate_pro`

### Frontend

- Build all web apps: `cd web && pnpm build`
- Build admin only: `cd web/admin && pnpm build`
- Build app only: `cd web/app && pnpm build`
- Analyze admin build: `cd web/admin && pnpm build:analyze`

## Test Commands

### Backend

- Run all tests: `cd backend && go test ./...`
- Run one package: `cd backend && go test ./usecase`
- Run one test by name in one package: `cd backend && go test ./usecase -run TestName`
- Run one test with verbose output: `cd backend && go test ./usecase -run TestName -v`
- Run one package with race detector when needed: `cd backend && go test -race ./usecase`

### Frontend

- `web/admin` tests: `cd web/admin && pnpm test` (node:test; includes i18n resource/coverage checks).
- `web/app` currently has no dedicated test script in `package.json`.
- For frontend verification, use lint, typecheck, build, and available tests.
- Admin typecheck via build pipeline: `cd web/admin && pnpm build`
- App lint: `cd web/app && pnpm lint`

## Lint And Format Commands

### Backend

- Lint backend: `cd backend && golangci-lint run`
- Full backend lint target: `cd backend && make lint`
- Format one file/package: `cd backend && gofmt -w path/to/file.go && goimports -w path/to/file.go`
- `cd backend && make lint` is required before commit for any backend code change.

Notes:

- `make lint` also runs generation steps and `go mod tidy`; it is heavier than `golangci-lint run`.
- `make lint` already covers backend formatting via configured formatters, so agents should treat it as the required backend verification step before commit.
- `backend/.golangci.toml` enables standard linters and formatters.

### Frontend

- Root formatting: `cd web && pnpm exec prettier --write .`
- Admin lint one file or folder: `cd web/admin && pnpm exec eslint src/path/to/file.tsx`
- App format: `cd web/app && pnpm format`
- App format check: `cd web/app && pnpm format:check`
- App lint: `cd web/app && pnpm lint`

## Code Style: Go

- Use `gofmt`/`goimports`; do not hand-format imports.
- Keep imports grouped by standard library, third-party, then local modules.
- Use tabs and standard Go formatting.
- Exported names use Go PascalCase; unexported names use camelCase.
- Receiver names should be short and consistent, usually `u`, `h`, `r`.
- Keep functions focused; prefer extracting domain logic into `usecase` over large handlers.
- Return wrapped errors with context using `fmt.Errorf("...: %w", err)`.
- Use `errors.Is` for sentinel checks.
- Log internal details, but return user-facing messages from handlers.
- Follow existing pattern: log with `u.logger.Error(...)` or `h.NewResponseWithError(...)` rather than panicking.
- Prefer explicit structs over untyped maps unless responding with a tiny ad hoc payload.
- Respect context propagation. Use `c.Request().Context()` in handlers.
- For streaming/SSE paths, preserve existing event shapes and flushing behavior.

## Code Style: TypeScript / React

- Follow Prettier formatting and the existing single-quote style.
- Use path aliases like `@/request/...` and `@/store` in admin code.
- Prefer explicit types for props and request payloads.
- Avoid `any`; lint only warns today, but new code should use concrete types where practical.
- Use `type` for simple object aliases and event payloads; use `interface` for component props when already idiomatic nearby.
- Components are function components with hooks.
- Keep state local unless it is shared across routes or features.
- Clean up subscriptions/AbortControllers/SSE clients in `useEffect` cleanup or modal close handlers.
- Reuse generated request types from `@/request/types` when available.
- Do not edit generated swagger client files unless absolutely necessary; prefer wrappers like `nodeStream.ts` for special protocols.
- Match existing UI libraries: MUI plus `@ctzhian/ui`.

## Naming Conventions

- Backend request structs end with `Req`, response structs with `Resp`.
- Usecase methods are verbs or verb phrases, e.g. `SummaryNode`, `MoveNode`.
- Frontend modal and page components use PascalCase filenames and component names.
- Request helpers in admin use verb-based names from generated swagger files or descriptive wrapper names.

## Error Handling Expectations

- Never swallow backend errors silently.
- If an error is user-actionable, return a clear message from the handler.
- If an error is for diagnostics only, log the wrapped error and return a generic message.
- In frontend code, surface actionable failures with `message.error(...)`.
- For async UI actions, always stop loading state in both success and error paths.
- For streaming flows, handle both transport errors and protocol-level `error` events.

## Generated Code And API Clients

- `web/admin/src/request/*` contains generated swagger client code.
- Generated files use disabled linting and should generally not be hand-edited.
- If an endpoint needs non-JSON behavior, create a thin wrapper alongside generated code instead of forcing the generated client.
- Backend swagger generation uses `swag`; if handler docs change significantly, regenerate docs with `cd backend && make generate`.
- If swagger files change, run `cd web && pnpm api` before committing frontend code so generated request clients stay in sync.

## Practical Guidance For Agents

- Read the nearby code before changing patterns.
- Prefer the smallest correct change.
- Preserve existing protocol contracts unless the task explicitly changes them.
- If the user asks for a review, only produce a review report; do not modify code as part of the review task.
- If changing an HTTP contract, search for every caller first.
- When touching backend request flows, verify both handler behavior and frontend request wrappers.
- When touching frontend request code, check interceptors and special transports like SSE.
- Do not introduce a new abstraction unless the same logic clearly repeats.

## Verification Checklist

- Backend change: run `go test` on the affected package at minimum.
- Any backend code change requires `cd backend && make lint` before commit.
- API contract change: search for all callers and update them together.
- If swagger files were modified, run `cd web && pnpm api` before committing any related frontend changes.
- Frontend admin change: run `pnpm test`, targeted `eslint`, and `pnpm build` in `web/admin`.
- Frontend app change: run `pnpm lint` or `pnpm build` in `web/app` as appropriate.
- If full builds fail because of pre-existing unrelated issues, say so explicitly.
