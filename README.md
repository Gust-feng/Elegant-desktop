<div align="center">

# 优雅的桌面 · 课表 × 天气

把一周的课程与当下的天气，优雅地带到你的桌面上。

轻量 · 本地数据 · 无后台 · 自动更新 · Wallpaper Engine 友好

</div>

## 预览

<p align="center">
  <img src="assets/preview.gif" alt="课表与天气看板预览" style="max-width: 960px; width: 100%; border-radius: 8px;" />
  <br/>
  <sub>若图片未显示，请将你的展示 GIF 放到 <code>assets/preview.gif</code>。</sub>
</p>

---

## 目录

- 你将获得
- 一分钟上手
- 配置项（含高德密钥与账号）
- 工作原理与交互
- 自动化（Windows 任务计划）
- 导出 CSV
- 常见问题（FAQ）
- 安全与隐私
- 致谢

---

## 你将获得

- 自动登录教务系统并拉取课表（含动态密钥与 Token 缓存）
- 本地保存为 `大二上课表/周次.json`，前端自动扫描并展示
- 实时课表跟随：正在上课/即将开始/明日课程一目了然
- 高德天气卡片：当前天气 + 近几天预报，支持手动刷新与展开
- 一键创建/移除任务计划，定时静默更新并记录日志
- 可选导出 CSV，便于导入表格或日历

> 适配环境：Windows；推荐搭配 Wallpaper Engine 使用。普通浏览器也可打开 `index.html`，若遇 `file://` 本地访问限制，请参考 FAQ。

---

## 一分钟上手

1) 安装依赖（首次）

```powershell
pip install requests pycryptodome
```

2) 填写账号密码（仅本机使用）

- 打开 `课表爬虫.py`，修改文件顶部：
  - `USER_NO = "你的学号"`
  - `PASSWORD = "你的密码"`

3) 首次拉取课表

```powershell
python 课表爬虫.py
```

完成后，`大二上课表/` 将出现如 `9.json、10.json…` 的每周数据。

4) 打开前端

- Wallpaper Engine：将整个文件夹导入壁纸编辑器，在引擎内选择该壁纸
- 浏览器：双击 `index.html`；若不显示数据，请见 FAQ 中“本地文件限制”（我还是强烈建议使用wallpaper，浏览器会受到跨域问题）

---

## 配置项（含高德密钥与账号）

### 天气（必配）

在 `index.html` 中替换以下两行：

```html
<script>
  const API_KEY = '高德web密钥';   // 填你的高德 Web服务 Key
  const CITY_CODE = '地理编码';    // 填目标城市 adcode（如 410100）
  // 接口: https://restapi.amap.com/v3/weather/weatherInfo
</script>
```

- 获取高德 Web服务 Key：登录高德开放平台 → 控制台 → Key 管理 → 创建应用（选择“Web服务”）
- 查询城市 adcode：在高德文档/工具或搜索引擎中检索“城市名 adcode”（例：郑州 410100）
- 刷新策略：实时天气每 30 分钟，预报每 3 小时；卡片点击可手动刷新，底部按钮可展开预报

> 提示：Key 不要公开到公共仓库；如需发布到公网，建议配置白名单/签名等安全策略。

### 账号（本机）

- 首次运行会：获取动态密钥 → AES 加密密码 → 登录 → 缓存 Token 至 `token_cache.json`
- Token 失效会自动重登并更新缓存

---

## 工作原理与交互

数据流：

1. Python 登录教务系统，调用 `student/curriculum` 接口
2. 将结果保存为 `大二上课表/周次.json`
3. 前端 `schedule.js` 自动扫描并加载最近可用的周次
4. 工作日（12:00、20:00）对比哈希检测“调课”，变化时自动刷新
5. `schedule-live.js` 实时标记：正在上课/即将开始/明日课程

交互一览：

- 双击右下触发区 → 打开/关闭课表面板
- 天气卡片：悬停显示；雨天保持常显；单击主卡片手动刷新；底部按钮展开/收起预报

更多性能与细节，请见 `性能优化说明.md`。

---

## 自动化（Windows 任务计划）

- 创建任务（管理员运行）：`setup_task_scheduler.bat`
  - 任务模板：`task_*.xml`
  - 周期：工作日 11:50 / 19:50；周末 19:50
- 删除任务：`remove_task_scheduler.bat`
- 静默运行：`run_silent.vbs` 调用 `auto_update_schedule.bat`

路径说明：`auto_update_schedule.bat` 现在会自动切换到脚本所在目录并相对运行，无需手动改盘符路径；如使用虚拟环境，请将其放在项目目录下的 `venv/`，日志默认写入 `logs\schedule_update_YYYY-MM.log`。

---

## 导出 CSV（可选）

- 脚本：`convert_schedule_to_csv.py`
- 用法：
  - 在脚本内修改 `default_json_path` 指向目标周次 JSON 并运行；或
  - 调用函数 `convert_schedule_to_csv(json_path, csv_path)`，将在同目录生成 `*_schedule.csv`

---

## 常见问题（FAQ）

<details>
<summary>浏览器打开 index.html 不显示课表/控制台提示本地文件受限</summary>

原因：部分浏览器禁止 `file://` 读取相对文件。解决：

- 在 Wallpaper Engine 内使用（推荐）；或
- 启动本地服务（例如 `python -m http.server 8000`）后通过 `http://localhost:8000/` 访问

</details>

<details>
<summary>天气卡片没有数据</summary>

- 确认 `index.html` 中已正确填写 `API_KEY`、`CITY_CODE`
- 确保网络可达 `https://restapi.amap.com`
- 关注高德配额与频率限制

</details>

<details>
<summary>课表没有更新/JSON 没生成</summary>

- 直接运行 `python 课表爬虫.py` 查看终端输出
- 如提示 Token 失效，脚本会自动重新登录并更新 `token_cache.json`
- 检查 `USER_NO`、`PASSWORD` 是否填写正确

</details>

<details>
<summary>任务计划未生效</summary>

- 以管理员身份运行 `setup_task_scheduler.bat`
- 核对 `auto_update_schedule.bat` 开头的目录路径
- 查看 `logs/` 下日志定位错误码

</details>

---

## 安全与隐私

- 学号与密码仅保存在你的本地机器，请勿上传到公共仓库
- 高德 Key 建议开启白名单/签名等限制
- 若需要分享项目，请先清理敏感信息（如 `token_cache.json`）

---

## 致谢

- 天气图标：Weather Icons
- 天气数据：高德开放平台
- 一言 API：hitokoto.cn

如需扩展（多校区/更多提醒/导出 ICS 等），欢迎在此基础上继续创作。祝使用愉快！

D