#!/bin/bash

# GitHub Pages 一键部署脚本
# 使用方法: ./deploy.sh your-github-username

if [ $# -eq 0 ]; then
    echo "请提供您的GitHub用户名"
    echo "使用方法: ./deploy.sh your-github-username"
    exit 1
fi

USERNAME=$1
REPO_NAME="literature-review-system"

echo "🚀 开始部署文学综述管理系统到GitHub Pages..."
echo "📁 仓库: https://github.com/$USERNAME/$REPO_NAME"

# 检查是否已经添加远程仓库
if git remote get-url origin >/dev/null 2>&1; then
    echo "✅ 远程仓库已配置"
else
    echo "➕ 添加远程仓库..."
    git remote add origin https://github.com/$USERNAME/$REPO_NAME.git
fi

# 确保在main分支
echo "🔄 切换到main分支..."
git branch -M main

# 推送到GitHub
echo "⬆️ 推送代码到GitHub..."
git push -u origin main

echo ""
echo "🎉 部署完成！"
echo ""
echo "📋 下一步操作："
echo "1. 访问 https://github.com/$USERNAME/$REPO_NAME"
echo "2. 点击 Settings → Pages" 
echo "3. Source选择: Deploy from a branch"
echo "4. Branch选择: main, Folder选择: / (root)"
echo "5. 点击Save"
echo ""
echo "🌐 几分钟后您的网站将在此地址可用:"
echo "   https://$USERNAME.github.io/$REPO_NAME"
echo ""
echo "✨ 包含功能:"
echo "   - 15篇研究论文PDF查看"
echo "   - 专业黑白主题设计"
echo "   - 论文搜索和筛选"
echo "   - 数据可视化图表"
echo "   - 响应式移动端支持"