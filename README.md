# 文献综述管理系统

一个功能完整的文献综述管理系统，支持PDF上传、在线查看、数据管理和GitHub Pages部署。

## 🚀 主要功能

- **📄 PDF文件管理**: 上传、查看、搜索PDF文献
- **🔍 智能搜索**: 按标题、作者、摘要、关键词搜索
- **📊 数据可视化**: 时间线、领域分布、引用分析图表
- **💾 本地存储**: IndexedDB无限容量存储
- **🌐 GitHub部署**: 一键导出到GitHub Pages + jsDelivr CDN

## 📁 文件结构

```
literature-review-tools/
├── index.html                    # 主页面
├── style.css                     # 样式文件
├── app.js                        # 主应用逻辑
├── indexeddb-storage.js           # IndexedDB存储管理
├── static-exporter.js             # 静态数据导出器
├── static-loader.js               # 静态数据加载器
├── github-releases-uploader.js    # GitHub Releases上传器
└── data/                         # 示例数据文件夹
    ├── index.json                # 数据索引
    ├── papers.json               # 论文元数据
    ├── thumbnails.json           # 缩略图数据
    └── papers/                   # 单个论文数据文件
```

## 🔧 使用方法

### 方式1: 本地开发使用

1. **启动本地服务器**
   ```bash
   # 使用Python3
   python3 -m http.server 8000
   
   # 或使用Node.js (需要安装http-server)
   npx http-server -p 8000
   ```

2. **打开浏览器访问**
   ```
   http://localhost:8000
   ```

3. **开始使用**
   - 点击"Upload Paper"上传PDF文件
   - 系统自动解析PDF内容并生成缩略图
   - 支持手动编辑论文信息
   - 使用搜索和筛选功能查找文献

### 方式2: GitHub Pages部署

#### 步骤1: 本地准备数据
1. 在本地添加所有论文数据
2. 点击"🚀 Export Static"按钮
3. 会弹出GitHub配置对话框

#### 步骤2: 配置GitHub信息
输入以下信息：
- **Repository Owner**: 你的GitHub用户名
- **Repository Name**: 仓库名称
- **GitHub Token**: Personal Access Token (需要repo权限)

#### 步骤3: 自动部署
系统会自动：
1. 创建GitHub Release
2. 上传所有PDF文件到Release
3. 生成jsDelivr CDN链接
4. 导出更新的JSON数据文件

#### 步骤4: 更新仓库
1. 将导出的JSON文件上传到GitHub仓库
2. 在仓库设置中启用GitHub Pages
3. 选择main分支和根目录部署

#### 步骤5: 访问网站
几分钟后可通过以下地址访问：
```
https://你的用户名.github.io/仓库名称
```

## 🛠 技术特性

### 数据存储
- **IndexedDB**: 支持无限容量本地存储
- **PDF处理**: 自动转换为base64格式持久化
- **缩略图**: 自动生成PDF首页缩略图

### PDF查看器
- **内置查看器**: 基于PDF.js的全功能PDF阅读器
- **CDN支持**: 支持jsDelivr CDN链接查看
- **响应式**: 适配手机、平板、桌面端

### 部署支持
- **静态导出**: 所有数据转换为JSON格式
- **CDN集成**: PDF文件通过jsDelivr CDN分发
- **无服务器**: 纯前端方案，无需后端服务

## 📊 数据格式

### 论文数据结构
```json
{
  "id": "paper_xxx",
  "title": "论文标题",
  "authors": ["作者1", "作者2"],
  "year": 2024,
  "journal": "期刊名称",
  "researchArea": "研究领域",
  "methodology": "研究方法",
  "studyType": "研究类型",
  "abstract": "摘要",
  "keywords": ["关键词1", "关键词2"],
  "citations": 10,
  "doi": "10.xxxx/xxxx",
  "pdfUrl": "https://cdn.jsdelivr.net/gh/user/repo@tag/file.pdf"
}
```

## 🔐 安全说明

### GitHub Token权限
创建Personal Access Token时只需以下权限：
- `public_repo` - 用于公开仓库操作
- `contents:write` - 用于创建Release和上传文件

### 数据隐私
- 所有数据优先存储在本地IndexedDB
- 只有导出时才上传到GitHub
- 支持删除已上传的Release

## 🐛 常见问题

### Q: PDF文件无法查看？
A: 检查以下几点：
1. PDF文件是否损坏
2. 浏览器是否支持PDF.js
3. 如果是CDN链接，检查网络连接

### Q: 导出失败？
A: 可能原因：
1. GitHub Token权限不足
2. 网络连接问题
3. 仓库不存在或无权限

### Q: 部署后PDF无法加载？
A: GitHub Pages + jsDelivr需要几分钟生效时间，请耐心等待。

## 📈 版本历史

- **v1.0** - 基础文献管理功能
- **v2.0** - 添加PDF查看器和IndexedDB存储
- **v3.0** - 完整的GitHub Pages部署支持

## 📝 许可证

MIT License - 可自由使用和修改

## 🤝 贡献

欢迎提交Issue和Pull Request来改进系统！

---

**开始使用**: 直接打开 `index.html` 文件或启动本地服务器即可开始管理您的文献库！