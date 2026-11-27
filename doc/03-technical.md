# 夜曲庄园 — 技术说明

## 1. 总览

| 项 | 值 |
| --- | --- |
| 运行时 | 浏览器原生 ES Modules + WebGL 2 |
| 3D | Three.js r160（本地 `lib/three.module.js`，无 CDN） |
| 依赖 | 运行时零第三方库；构建/生成工具仅需 Python 3 + Pillow / numpy |
| 音频 | Web Audio API，WAV 解码为 AudioBuffer |
| 存档 | `localStorage`（主存档 + SDK 事件缓冲） |
| 渲染尺寸 | 视口自适应，像素比上限 2 |
| 目标帧率 | 60 FPS；主循环对 `dt` 做 50ms 上限保护 |
| 离线 | 单文件版运行时无任何网络请求 |

代码规模约 8.9k 行（`src/` + `config/`），拆分为表现层、玩法层、UI 层、核心服务与 SDK。

---

## 2. 目录与职责

```
index.html                 页面骨架、SEO/OG、开屏、HUD、弹窗容器
styles.css                 全部界面样式、响应式与触屏布局
config/
  game.config.js           玩家/相机/能力/Boss/音频/星级/梦境配色与 par
  levels.js                16 关地图、常量、关卡查询
  locales.js               EN / ZH 文案（各 286 键）
  domains.config.js        域名白名单与跳转（兜底）
  ads.config.js            广告位与 provider 配置
src/
  main.js                  启动、SDK、资源、域名守卫、主循环
  core/
    i18n.js                读 URL 参数、应用 data-i18n、占位符
    domain-lock.js         SDK 缺失时的域名检查与跳转
    assets.js              图片/音频清单与加载、单文件资源替换
    audio.js               Web Audio 总线、SFX 池、BGM 交叉淡入
    ads.js                 广告门面：canShow / 奖励 / 插屏 / mock
    save.js                localStorage 存档、迁移、校验、里程碑
    input.js               键盘 + 虚拟摇杆
  art/
    scene.js               Renderer、相机、灯光、房间装载、跟随
    props.js               程序化房间、家具、机关、Boss 竞技场
    jelly.js               玩家、记忆、GLSL 果冻材质
    enemy.js               五类噩梦与织梦者的程序化模型/动画
    fx.js                  粒子、脉冲、闪光、镜头震动
    textures.js            Canvas 程序化纸纹/木纹/书脊/蛛网
  game/
    game.js                状态机、移动/碰撞、能力、关卡、Boss、结算
    swarm.js               守护星环绕与碎裂
  ui/
    ui.js                  开屏、菜单、HUD、弹窗、暂停、触屏
    share.js               分享面板、1080×1080 卡片、渠道
  sdk/
    gamesdk.js             共享 GameSDK（域名/广告/追踪/防护）
    sdk.config.js          SDK 配置（经典脚本，先于模块加载）
    sdk-styles.css         广告遮罩与授权卡样式
tools/                     启动、打包、音频生成、图片处理
lib/three.module.js        Three.js r160
dist/                      打包产物
```

---

## 3. 启动顺序

1. `index.html` 先以经典 `<script>` 加载 `src/sdk/sdk.config.js` 与 `src/sdk/gamesdk.js`，把 `window.SDK_CONFIG` / `window.GameSDK` 准备好。
2. 再以 `<script type="module" src="src/main.js">` 启动 ES 模块入口。
3. `main.js`：
   - 构建 `Stage`（Renderer / 相机 / 灯光 / 菜单场景）；
   - `GameSDK.init({ domain, ads })`，把游戏配置作为 overrides 传给 SDK；
   - 构建 `AudioManager`、`SaveStore`、`Ads`、`Game`、`UI`；
   - 并行加载 15 张图片与 19 个音频，更新开屏进度（图片 6%→68%，音频 70%→98%）；
   - 执行域名守卫：优先 `GameSDK.protect.guardDomain()`，SDK 缺失时使用 `DomainLock`；
   - 域名合法 → 显示「进入庄园」；不合法 → 显示锁定卡并 3 秒后跳转；
   - 注册 `window.LULLABY_MANOR` QA 接口与 `requestAnimationFrame` 主循环。
4. 首次点击「进入庄园」解锁 Web Audio（浏览器手势要求），进入菜单并播放 `bgm-menu`。

**看门狗：** 资源加载超过 45 秒会显示失败提示，避免无限白屏。

---

## 4. 主循环与状态机

```js
const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
game.update(dt, now / 1000);
stage.render();
requestAnimationFrame(frame);
```

- `dt` 上限 50ms，避免切后台回来时穿墙。
- `elapsed` 只在 `playing` 状态累加，因此暂停不计时、不计 par。
- 状态：`boot → loading → menu → bossintro → playing → won / lost / paused / health / ad → ending`。
- `ad` 状态由广告开始/结束回调切入切出；广告期间游戏更新暂停、音频静音。
- 健康提示在累计游玩 45 分钟后触发，之后每 45 分钟一次；暂停游戏并显示休息提示，可继续。

---

## 5. 世界与碰撞

- 地图 11 × 8 格，`CELL = 1.7`；地图坐标转世界：
  - `x = (col - 5) * 1.7`
  - `z = (row - 3.5) * 1.7`
- 地图字符在 `Game._buildFromMap()` 中解析：家具生成碰撞圆，记忆/门/机关注册到各自列表。
- 玩家与敌人的碰撞体是圆；移动采用「期望位置 → 逐圆推出」：`_pushCircle(x, z, radius)` 将圆推出所有未失效碰撞体与房间边界。
- 敌人寻路为直线转向（无导航网格），依靠手工布局避免卡死；猎犬/哨兵冲刺被墙挡住时会进入恢复。
- 历史轨迹每帧记录，保留 6.5 秒；倒带取 4.2 秒前的采样并再次做碰撞推出，避免落进墙里。

---

## 6. 相机

- 透视相机，FOV 42；默认 `height = 15.5`、`back = 11.5`。
- 跟随玩家位置但乘 `follow = 4.5` 做平滑，并将偏移夹紧到 `±2.1 (x) / ±0.9 (z)`，保证房间构图稳定。
- 窄屏（宽高比 < 1）切换为 `height 17.4 / back 13.8`，夹紧放宽到 `±6.2 / ±1.5`，避免竖屏裁掉关卡。
- 菜单使用更远的 `18 / 14` 机位展示完整立体书。
- 镜头震动由 `stage.shake(amount)` 叠加，随时间衰减；不改变逻辑坐标。

---

## 7. 核心服务

### 7.1 i18n

- `?lang=zh`、`?locale=zh`、`?locale=zh-CN` 均识别为中文；默认英文。
- 解析顺序：URL 参数 → 默认 `en`；没有 localStorage 记忆，避免玩家被上一次语言困住。
- 文案通过 `data-i18n`、`data-i18n-title`、`data-i18n-placeholder` 应用到 DOM；动态文本使用 `i18n.t(key, params)`。
- 两语言各 286 键；构建/QA 时比对键集合与 `{placeholder}` 数量。

### 7.2 存档

- 键：`lullabyManor.save.v1`。
- 结构：`v, unlocked, stars{}, best{}, muted, name, introSeen, endingSeen, healthNags, plays, wins, lastLevel, bonusGuards`。
- 读取后做类型与范围归一化（星级 0–3、关卡 1–16、名字 16 字符等）。
- 救援里程碑：3/6/9/12/15 关首次通关分别救回 Ollie / Dad / Biscuit / Clara / June。
- 若共享 SDK 的 `shield` 可用，写入时附带校验，读取时 `verify()`；校验失败只记录，不破坏存档。
- `takeBonusGuards()` 在每关开始时消耗广告祝福，保证「下一关 +1 守护星」只生效一次。

### 7.3 音频

- 单 `AudioContext`，分 `master → sfxBus / musicBus`。
- BGM 双 source 交叉淡入 1.1 秒；暂停时 musicBus 降到 35%，静音时 master 归零。
- 音效可带随机音高（±3.5%）与立体声声像；高频音效使用 `playThrottled` 防止叠加爆音。
- 首次用户手势前只记录 `pendingMusic`，解锁后立即播放。

### 7.4 输入

- 键盘：WASD / 方向键移动，Shift 潜行，E 能力，P / Esc 暂停，M 静音。
- 触屏：左下摇杆（Pointer Events），右下能力按钮，TIPTOE 切换；输入集中在 `Input`，游戏逻辑不直接读 DOM。
- 焦点在输入框时忽略快捷键，避免昵称输入误触。

---

## 8. 域名授权

两层实现，规则一致：

1. **共享 SDK**（`window.GameSDK.protect.guardDomain`）——生产环境优先。
2. **本地兜底**（`src/core/domain-lock.js`）——SDK 缺失或被移除时仍生效。

规则：

- 允许：`localhost`、`127.0.0.1`、`::1`、`pipygames.com`、`www.pipygames.com`、`*.pipygames.com`。
- `file://` 允许（用于离线单文件版）。
- 其他域名：**先完整加载图片与音频**，再显示锁定卡，倒计时 3 秒，`location.replace("https://pipygames.com")`。
- iframe 内默认不允许；跨域 iframe 无法操作 top 时退回当前窗口跳转。
- 所有规则同时在 `config/domains.config.js` 与 `src/sdk/sdk.config.js` 中，改完需重新打包。

---

## 9. 广告架构

`src/core/ads.js` 是门面，SDK 存在时把 `canShow / showRewarded / showInterstitial` 交给 SDK 的 provider 适配器；SDK 缺失时用本地 mock。

- 总开关：`enabled && provider !== "none"`。
- 使用次数、冷却、每 N 关/每 N 局由门面与 SDK 双重检查。
- 播放前 `onStart` → 游戏进入 `ad` 状态、暂停更新、静音；结束后 `onEnd` 恢复。
- Mock 使用 `simulateMs = 1400` 的遮罩，文案 `ADVERTISEMENT`。
- Provider 预留：Poki、CrazyGames、Custom（`LullabyAdAdapter`）。
- 默认 `enabled = false`，因此 `canShow()` 恒为 false，页面不会出现任何广告按钮。

---

## 10. 分享实现

- 卡片：Canvas 1080×1080，绘制渐变纸面、徽章、梦境数、星星、时间、昵称与站点；`toBlob` 后下载。
- Facebook / Reddit：使用官方 sharer URL，`window.open` 新窗口。
- Instagram / TikTok / YouTube：浏览器无法直接发帖，因此下载卡片并给出平台内发布提示（文案中已说明）。
- 复制邀请：`navigator.clipboard`，失败时退回 `textarea + execCommand`。
- 原生分享：`navigator.share`（支持文件时附带卡片）。
- 昵称写入存档（最多 16 字），可为空；卡片与文案使用「A dreamer」兜底。

---

## 11. 单文件构建

`tools/build_web.py` 的流程：

1. 从 `src/main.js` 出发递归解析相对 import，收集所有模块与 `lib/three.module.js`（当前构建 24 个模块）。
2. 去除 `export` / `import`，把每个模块包进自定义注册表，运行时用 `__req` 按路径取模块。
3. 读取 15 张图片与 19 个音频，图片转 WebP（质量 82），音频保持 WAV，全部转为 base64 data URI，写入 `window.__ASSETS__`。
4. 内联 `styles.css`、`sdk-styles.css`、两个经典 SDK 脚本与 favicon（emblem data URI）。
5. 校验关键标签（import map、favicon、模块入口等），缺一即失败退出。
6. 输出：
   - `dist/lullaby-manor.html`（约 12 MB，自包含）
   - `dist/web/index.html`（同一份构建）
   - `dist/lullaby-manor-web.zip`（`dist/web` 的压缩包，约 8.5 MB）
   - `dist/web/assets/images/` 仅保留社交预览图（可选）

构建不使用 bundler / npm，Python 标准库即可完成。由于资源是 data URI，单文件版可在 `file://` 下完整运行（含音频与存档）。

---

## 12. 性能与兼容

- **Draw call：** 房间家具合并为少量组；阴影只开一盏平行光；粒子/精灵使用共享纹理。
- **像素比：** 上限 2，避免高分屏 4K 渲染压力。
- **移动端：** 相机自动拉远；触屏布局隐藏键盘提示；按钮最小 44px。
- **降级：** WebGL 创建失败会显示开屏错误提示，不白屏；音频加载失败不阻塞游戏。
- **隐私：** 无外部请求、无分析脚本、无 cookie；SDK 事件默认只写本地 `lullabyManor.events.v1`，`endpoint` 为空。
- **兼容目标：** Chrome / Edge / Safari / Firefox 近两年版本；iOS Safari 需用户手势后才能播放音频。

### 已知限制

- 分享仅 Facebook / Reddit 能直接带链接打开；其余平台受浏览器限制，只能下载卡片后由玩家手动发布。
- 真实广告 provider 需在账号开通后填入 SDK 与 placement id；当前只验证了 mock 与关闭态。
- 无手柄支持；无云存档；无排行榜。
- 关卡寻路为直线转向，极端情况下敌人可能短暂贴墙，但不会穿墙。

---

## 13. QA 接口

生产页面同样暴露 `window.LULLABY_MANOR`，用于自动化与人工排查：

```js
LULLABY_MANOR.enter()        // 进入菜单
LULLABY_MANOR.start(7)       // 跳关
LULLABY_MANOR.collectAll()   // 收集本关记忆
LULLABY_MANOR.win()          // 直接结算
LULLABY_MANOR.lose()
LULLABY_MANOR.charge()       // Boss 充能
LULLABY_MANOR.phase(2)
LULLABY_MANOR.killBoss()
LULLABY_MANOR.summary()      // 当前局面快照
LULLABY_MANOR.assetsReport() // 资源加载统计
LULLABY_MANOR.domainCheck()  // 域名判定结果（不跳转）
```

该接口不改变正常玩法，仅用于测试与客服排障。

---

## 14. 复现与打包

```bash
python tools/start.py       # 本地服务器 127.0.0.1:8133（端口占用自动顺延）
python tools/build_web.py   # 生成 dist/ 单文件与 zip
python tools/gen_audio.py   # 重新合成 19 个音频
python tools/prep_images.py # 重新处理图片母版
```

Windows 双击 `一键启动.bat` / `一键转网页版.bat` 等价于上述前两条命令。源码版通过本地服务器运行（音频使用 fetch，`file://` 会被浏览器拦截）；单文件版 `dist/lullaby-manor.html` 可直接双击离线运行。
