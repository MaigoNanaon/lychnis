# 🎵 Lychnis · 节奏游戏 H5 Demo

> 用你喜欢的歌，玩节奏游戏。一个嵌入"听歌 App"风格的节奏游戏 H5 原型。

## ✨ 功能特性

- **曲库页面**：展示歌曲列表，支持封面、难度、BPM 信息
- **播放页面**：类 Apple Music 风格，旋转唱片封面 + 播放/暂停/停止控制 + 游戏入口
- **节奏游戏**：
  - 横向圆角轨道，荧光竖条扫描线从左向右滑过
  - 两阶段流程：**演示引导**（先看一遍自动点亮）→ **玩家操作**（跟着节奏自己打）
  - 判定系统：Perfect / Great / Good / Miss
  - 实时显示分数、连击、准确率
  - 右上角帮助按钮 + 返回按钮
  - 🔄 **横屏游玩**：竖屏打开会自动提示「请把手机横过来」，横屏后轨道铺满宽屏体验更佳
- **分享页面**：
  - 自动计算评级（SS / S / A / B / C / D）
  - Canvas 生成精美分享图，可保存到相册
  - 再玩一次 / 返回曲库

## 📱 手机试玩

部署到 GitHub Pages 后，在手机浏览器打开即可试玩。

### 部署方法

1. Fork 或推送本仓库到 GitHub
2. 进入仓库 **Settings → Pages**
3. Source 选择 `Deploy from a branch`
4. Branch 选择 `main` / `(root)` 目录
5. 保存后等待几分钟，访问生成的链接即可

链接格式通常为：`https://<你的用户名>.github.io/<仓库名>/`

### 本地预览

```bash
cd lychnis
python3 -m http.server 8000
# 浏览器访问 http://localhost:8000
```

## 🎮 玩法说明

1. **选歌**：在曲库点击任意歌曲进入播放页
2. **听歌**：可以播放/暂停/停止，熟悉旋律
3. **开始挑战**：点击「开始节奏挑战」进入游戏
4. **演示引导**：先观看一遍音符飞行轨迹，了解节奏
5. **玩家操作**：音符到达左侧判定线（发光圆圈）时点击屏幕
6. **查看成绩**：完成后查看评级和详细统计
7. **分享比拼**：生成分享图，发给朋友挑战

## 📂 项目结构

```
lychnis/
├── index.html              # 主页面（4个 section 切换）
├── css/
│   └── styles.css          # 全部样式
├── js/
│   ├── songs.js            # 歌曲数据 & 谱面定义 ← 在这里添加歌曲
│   ├── audio.js            # 音频引擎封装
│   ├── game.js             # 节奏游戏引擎（Canvas 渲染 + 判定）
│   └── app.js              # 主应用逻辑（页面跳转 + 交互）
└── assets/
    ├── covers/             # 歌曲封面图片（可选）
    └── audio/              # 歌曲音频文件 ← 放这里
```

## 🎵 添加你的歌曲

### 1. 准备文件

将音频文件（mp3 / ogg）放入 `assets/audio/` 目录。

（可选）将封面图片放入 `assets/covers/` 目录。不提供封面时会用渐变色代替。

### 2. 编辑 `js/songs.js`

在 `SONGS` 数组中添加歌曲对象：

```javascript
{
  id: 'mysong',                    // 唯一 ID
  title: '我的歌',
  artist: '歌手名',
  cover: 'assets/covers/mysong.jpg', // null 则用渐变色
  audio: 'assets/audio/mysong.mp3',
  bpm: 120,                          // BPM
  duration: 35,                      // 总时长（秒）
  difficulty: '简单',                // 简单/中等/困难/专家
  color: ['#FF6B6B', '#FF8E8E'],     // 封面渐变色
  chart: [                           // 谱面：手动或用 genChart() 生成
    { time: 3000, type: 'tap' },
    { time: 3500, type: 'tap' },
    // ...
  ]
}
```

### 3. 编写谱面

#### 方式 A：自动生成（推荐快速测试）

```javascript
chart: genChart(
  120,          // BPM
  [             // 每小节拍位模式（按小节循环）
    [0, 2],     // 第1小节：1拍、3拍
    [0, 1, 2],  // 第2小节：1、2、3拍
  ],
  12,           // 总小节数
  3000          // 第一个音符前的空白（毫秒）
)
```

#### 方式 B：手动编写

```javascript
chart: [
  { time: 3000,  type: 'tap' },
  { time: 3500,  type: 'tap' },
  { time: 4000,  type: 'tap' },
  // time = 相对歌曲开始的毫秒数
]
```

> 💡 **提示**：打开浏览器控制台，播放歌曲时记录你希望出现音符的时间点（毫秒），然后填入 `chart` 数组即可。

## 🛠 技术栈

- 纯原生 HTML / CSS / JavaScript（无框架、无依赖）
- Canvas 2D 渲染游戏画面
- Web Audio API / HTML5 Audio 播放音频
- `performance.now()` + `requestAnimationFrame` 保证时间精度
- Canvas `toDataURL` 生成分享图

## 📐 判定窗口

| 判定 | 时间窗口 | 得分 |
|------|----------|------|
| Perfect | ±50ms | 100 + combo×2 |
| Great | ±100ms | 70 + combo×1 |
| Good | ±150ms | 40 |
| Miss | >150ms 或漏过 | 0 |

## 🔮 后续展望

- [ ] AI 智能识谱（自动从音频生成谱面）
- [ ] 接入真实音乐 App SDK
- [ ] 排行榜系统
- [ ] 多种音符类型（长按、滑动）
- [ ] 谱面难度分级
- [ ] PWA 离线缓存

## 📄 License

MIT
