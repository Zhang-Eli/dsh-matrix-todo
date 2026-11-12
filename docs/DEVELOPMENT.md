# dsh-matrix-todo 开发交接

> 给下一个开发 session 的「项目记忆」。发版或收工时更新；新 session 开场先读这份文档，
> 再读 `CHANGELOG.md` 与 `git log --oneline -10`。最后更新：2026-11-11（1.1.0 发布后）。

## 1. 当前状态

| 项目 | 值 |
| --- | --- |
| 仓库路径 | `D:\Documents\deepseek-harness\default-workspace\matrix-todo` |
| 远端 | https://github.com/Zhang-Eli/dsh-matrix-todo（`origin`，分支 `main`） |
| git HEAD | `4bd19e4` feat: first-run localized guide to-dos behind a one-shot seeded flag (1.1.0) |
| tag | `v1.0.0`、`v1.0.1`、`v1.1.0`（工作区干净） |
| npm | `dsh-matrix-todo@1.1.0`（latest），1.1.0 shasum `f906e2ee430cc18f2a1f496ac05611ba1901af0d` |
| GitHub Release | https://github.com/Zhang-Eli/dsh-matrix-todo/releases/tag/v1.1.0 |
| 本地安装 | profile `desktop` 的 `package.json:13` 用 `link:` 指向本目录；bundle patch row `id: matrix-todo` |
| 数据文件 | `%DSH_PROFILE_DIR%/data/dsh-matrix-todo/todos.json`（本机现 5 条、`seeded: true`、默认设置） |
| 校验基线 | 三个 JS 文件 `node --check` 通过；EN/ZH 字典各 87 键；CSS 花括号配平 0；store 冒烟 9 项通过（见第 3 节） |
| 门禁 | 1.1.0 时 0 error / 5 warn / 2 info，`safeToPublish: true` |
| 市场条目 | 已上架：PR #14253 已合并（`category: ui`，网站显示在 **UI Enhancements**）。分类应为 `tools`，修正 PR **#14477** 已开、待合并 |

## 2. 架构地图

| 文件 | 职责 |
| --- | --- |
| `index.js`（123 行） | Host 半。`export const inject = ['webServer']`；`PREFIX = '/matrix-todo/api/'`；`ACTIONS` = list/seed/create/update/toggle/remove/clearCompleted/reorder + 特判 `saveSettings`；`resultOf()` 统一返回 `{ todos, settings, seeded }`；同源护栏 `refusalOf()`（优先 `ctx.get('connection').requestRejection`，否则 loopback + host + `sec-fetch-site`/`origin` 校验）→ 非 GUI 请求 403；`apply()` 里 `store.load()` 后注册 prefix 路由，`ctx.effect` 清理时 `store.close()` |
| `lib/store.js`（511 行） | 唯一状态源。`createStore({ file })`：内存 `{ todos, settings, reordered, seeded, corrupt, sealed }` + 串行写队列；原子写（tmp + rename）；坏文件备份为 `todos.corrupt-<ts>.json`；`DEFAULT_SETTINGS` 与 `VERSION = 1`、`MAX_TODOS = 500`；`resolveDataFile()` 默认 `$DSH_PROFILE_DIR/data/dsh-matrix-todo/todos.json`；所有入参在写内存前 sanitize（title 1–200、dueDate `YYYY-MM-DD`、ratio 0.2–0.8 三位小数） |
| `client.js`（2108 行） | Client 半，单文件。模块工厂内常量：`NS='matrixTodo'`、`PANEL_ID='matrix-todo'`、`API_PREFIX='matrix-todo/api/'`、`ORDER=21`、`AUTHOR_URL/REPO_URL/ISSUES_URL`、`DEFAULT_SETTINGS`（需与 store 同步）、`EN`/`ZH` 字典（各 87 键）、`CSS` 数组。组件：`DatePickerPanel`(428)、`PanelIcon`(561)、`SettingsPanel`(708)、`TodoRow`(898)、`QuadrantCard`(1118)、`CompletedList`(1349)、`TodoPage`(1402)。挂载：`ctx.locale.register(NS,{en,zh})`、`sidebar.panellist`（label 为 thunk）、`main`（key=matrix-todo，inject `t/localeSource/setNavLabel`） |
| `locale/en.json`、`locale/zh.json` | **只含 `meta.title` / `meta.description`**（侧栏与插件页展示用）。真正的 UI 文案在 `client.js` 的 `EN`/`ZH` 里，两处不要混淆 |
| `cordis.patch.yml` | `insert: [{ id: matrix-todo, name: dsh-matrix-todo }]` |
| `package.json` | 包名/版本/元数据；`dsh.bundle.patch` 与 `dsh.client`（platform=web, immediately, inject locale+sidebar）决定安装行为 |

数据落点：单文件 JSON，结构 `{ version, todos[], settings{}, reordered, seeded }`；数组顺序即象限内显示顺序。

## 3. 常用命令

```bash
cd /d/Documents/deepseek-harness/default-workspace/matrix-todo

# 语法 + JSON + 字典键数 + CSS 花括号
node --input-type=module --check < client.js && node --check index.js && node --check lib/store.js
node -e "for (const f of ['package.json','locale/en.json','locale/zh.json']) JSON.parse(require('fs').readFileSync(f,'utf8')); console.log('json ok')"
node -e "const s=require('fs').readFileSync('client.js','utf8');const c=(a,b)=>(s.slice(s.indexOf(a),s.indexOf(b)).match(/^ {6}'[^']+':/gm)||[]).length;console.log('EN',c('const EN =','const ZH ='),'ZH',c('const ZH =','const CSS ='))"
node -e "const s=require('fs').readFileSync('client.js','utf8');const a=s.indexOf('const CSS = ['),b=s.indexOf('].join',a);let d=0;for(const ch of s.slice(a,b)){if(ch==='{')d++;else if(ch==='}')d--}console.log('css balance',d)"
```

store 冒烟（临时目录，不碰真数据）：

```bash
node --input-type=module -e "
import {createStore} from './lib/store.js';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dir=mkdtempSync(join(tmpdir(),'mtd-')), file=join(dir,'todos.json');
const s=createStore({file}); await s.load();
const A=(await s.create({title:'A',important:true,urgent:true}))[0].id;
const B=(await s.create({title:'B',important:true,urgent:false}))[0].id;
await s.create({title:'C',dueDate:'2026-01-02'});
const D=(await s.create({title:'D'}))[0].id;
await s.reorder({id:D,beforeId:A});
console.log('order',s.list().map(t=>t.title).join(''));            // CBDA
await s.update({id:B,title:'B2'}); await s.toggle({id:B});
await s.saveSettings({frame:'grid',fontSize:15});
console.log('seed on non-empty added',(await s.seed({items:[{title:'x'}]})).added);
const s2=createStore({file}); await s2.load();
console.log('reload',s2.list().length,'seeded',s2.seeded(),'frame',s2.settings().frame);
const s3=createStore({file:join(dir,'fresh.json')}); await s3.load();
console.log('fresh seeded',s3.seeded());
rmSync(dir,{recursive:true,force:true}); console.log('SMOKE OK');
"
```

门禁（发版前）：

```bash
cd /d/Documents/deepseek-harness/default-workspace
node _gate_run.mjs "D:/Documents/deepseek-harness/default-workspace/matrix-todo" _gate_report_matrix.json
```

本地重载插件（改过 `index.js`/`lib/` 之后必须；只改 `client.js` 走 HMR 即可）：

```text
plugin_manager set_bundle target=dsh-matrix-todo enabled=false
plugin_manager set_bundle target=dsh-matrix-todo enabled=true
```

## 4. 发布流程（简版）

1. 改 `package.json` 版本 + 追加 `CHANGELOG.md` 条目。
2. 跑第 3 节全部校验 + 门禁（要 0 error；`client-double-load`/`tool-none-registered`/`unscoped-name` 是已知误报）。
3. `npm pack --dry-run` 记下 shasum（产物应为 11 个文件）。
4. `git add -A && git commit && git tag -a vX.Y.Z && git push origin main vX.Y.Z`。
5. `npm publish --access public`；首发/带 2FA 时 registry 可能先出现 `0.0.0-stage` 或延迟数十秒，轮询 `npm view dsh-matrix-todo version` 与 `dist.shasum` 一致即可。
6. `gh release create vX.Y.Z`（gh 在 `%LOCALAPPDATA%\Programs\gh\bin\gh.exe`）。
7. 回来更新本文件第 1 节与第 6 节。

完整版见技能 `dsh-plugin-publish`（含市场条目 schema 与 PR 要求）。

## 5. 关键设计与坑

- **不要加模块级「只加载一次」守卫**：`client.js` 整个工厂会在 HMR / 禁用再启用时用新 rev 重新执行，永久 guard 会让面板再也注册不上。门禁的 `client-double-load` 告警是误报，1.0.1 专门撤销过一次。
- **数组顺序即显示顺序**：`reordered === false` 时列表按 `createdAt` 倒序派生；首次 `reorder` 后置 `true` 并持久化。`reorder` 必须先校验 `beforeId` 再改数组（早期版本先 splice 后校验，抛错会丢行）；`beforeId === id` 视为原位 no-op。
- **侧栏名称不是响应式的**：`label` 是 thunk，改名后必须 `dispose` 再 `ctx.slots.register`（`mountSidebarRow` 里已封装），否则侧栏文字不变。
- **截止日期不用原生 `<input type="date">`**：需要「单击预览、双击确认并创建」，原生控件做不到，所以 `DatePickerPanel` 完全自绘（单击 `onPick`、双击 `onCommit`、外点/Esc 关闭、空间不足向上翻转）。
- **鼓励浮窗以面板为基准**：`.ez-toast` 是 `position:fixed` + `translate(-50%,-50%)`，`left/top` 由 `pageRef.getBoundingClientRect()` 的中心算出；不要改回 `left:50%`，那是窗口中心（对右侧面板偏左上）。
- **设置写盘要防抖 + 脏标记**：`settingsDirty` + 350ms 定时器，避免「保存设置的请求」和「同时返回的 todo 响应」互相覆盖。
- **两处 `DEFAULT_SETTINGS` 必须同步**：`lib/store.js:20` 与 `client.js:36`；改默认值（例如固化新视觉）时一起改，否则首次渲染与落盘值不一致。
- **不要直接改运行中的数据文件**：先 `set_bundle enabled=false` → 写 `todos.json` → `enabled=true`，`apply()` 里的 `store.load()` 会重读。HTTP 接口对非 GUI 请求返回 403（同源护栏，预期行为），不要试图绕过。
- **引导待办由 Client 生成文案**：Host 不知道 UI 语言；`list` 返回 `seeded`，Client 在 `seeded === false && todos.length === 0` 时调 `seed`。Host 侧 `seeded` 只写一次；旧数据文件（有行但无该字段）视为已引导，升级不会重复插入。
- **样式只用 `--dsw-alias-*` token**：极简风靠 token + `color-mix`，不要写死颜色；象限底色的 `tint: 'soft'` 就是从 token 混色。
- **市场分类只由市场条目的 `category` 决定**：站点标签在 awesome-dsh-plugin 的 `site/locales.mjs` 里映射（`ui → UI Enhancements`、`tools → Tools & Capabilities`、`dev`/`workflow`/`git` 等同理）。分类写错与 npm 版本无关，只能改上游仓库 `data/plugins/<owner>__<repo>.yml` 再开 PR；本地副本放在工作区根，别只改本地。
- **locale JSON 只有 meta**：新增 UI 文案加在 `client.js` 的 `EN`/`ZH`，并保持两边键集合一致（各 87 键现状）。
- **卫生**：`lib/` 内所有用户输入在改内存前 sanitize；写盘失败进入 `sealed` 状态，避免损坏文件被覆盖。

## 6. 已知限制与下一步候选

- [ ] **市场分类修正 PR #14477 待合并**：把 `data/plugins/Zhang-Eli__dsh-matrix-todo.yml` 的 `category: ui` 改成 `tools`（站点标签 `ui → UI Enhancements`、`tools → Tools & Capabilities`）。合并后网站自动更新，不需要发 npm 版本。本地副本在工作区根 `Zhang-Eli__dsh-matrix-todo.yml` 已同步为 `tools`。
- [ ] **没有提交到仓库的测试**：现有校验都是临时脚本（第 3 节可复制）。若要长期维护，建议把 store 冒烟固化成 `test/store.test.mjs` 用 `node --test` 跑。
- [ ] `seed` 的 Host 侧护栏只认 `seeded` 标志：若某天出现「文件有 todo 但 seeded 为 false」的中间态（例如外部手写数据），Client 因 `todos.length > 0` 不会触发，但直接调接口仍可追加。如需更强保证，可在 `store.seed()` 里也加 `state.todos.length > 0` 的短路。
- [ ] 待办上限 500 条（`MAX_TODOS`），超出返回 `invalid-input`；面板未做专门的「已达上限」提示，只在消息区显示错误。
- [ ] 数据无导入/导出与多 profile 合并能力；跨机器迁移靠手动拷贝 `todos.json`。

## 7. 新 session 开场清单

1. 读本文件 → `CHANGELOG.md` 最近两条 → `git log --oneline -10`。
2. 跑第 3 节的语法/字典/CSS/store 冒烟，确认数字与第 1 节一致；不一致以实际为准并更正本文件。
3. 确认线上状态：`npm view dsh-matrix-todo version`、`git status --porcelain`（应为空）。
4. 确认本地插件行状态：profile `package.json` 的 `link:` 指向本目录，面板 `main` 与侧栏 `sidebar.panellist` 均 active。
5. 问清本次任务属于「功能迭代 / 修 bug / 发版 / 市场运营」哪一类，再动手。
6. 收工时更新第 1、6 节，并把新踩的坑补进第 5 节。