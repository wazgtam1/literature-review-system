# GitHub Pages 部署指南

## 第一步：创建GitHub仓库
1. 访问 https://github.com 并登录
2. 点击右上角 "+" → "New repository" 
3. 仓库设置：
   - Repository name: `literature-review-system`
   - Description: `📚 Professional Literature Review Management System`
   - 选择 **Public**
   - **不要勾选任何初始化选项**
4. 点击 "Create repository"

## 第二步：上传代码到GitHub
在终端中运行以下命令（替换 `yourusername` 为您的GitHub用户名）：

```bash
cd "/Users/lichuanpeng/Desktop/literature-review-tools"

# 添加远程仓库
git remote add origin https://github.com/yourusername/literature-review-system.git

# 推送到GitHub
git branch -M main
git push -u origin main
```

## 第三步：启用GitHub Pages
1. 在GitHub仓库页面，点击 "Settings" 选项卡
2. 滚动到 "Pages" 部分
3. Source设置：
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/ (root)**
4. 点击 "Save"

## 第四步：访问您的网站
几分钟后，您的网站将在以下地址可用：
`https://yourusername.github.io/literature-review-system`

## 包含的功能
✅ 15篇研究论文，带有PDF查看器
✅ 专业的黑白主题设计  
✅ 论文筛选和搜索功能
✅ 数据可视化图表
✅ 响应式设计，支持移动端
✅ 完全静态部署，无需数据库

## 注意事项
- 首次加载可能较慢（PDF文件以base64格式存储）
- 所有数据都包含在静态文件中，无需额外配置
- 网站完全离线可用，适合学术研究使用