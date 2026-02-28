// #region --------------- 全局对象定义和存储 --------------- 

// 全局对象用于存储图片ID到base64数据的映射
// 这个对象可以在整个应用中使用
window.imageMap = {};

// 或者如果你想让它只在当前页面作用域内
const imageMap = window.imageMap; // 这样你可以通过imageMap访问

// #region --------------- 获取元素 --------------- 

// 获取DOM元素
const editor = document.getElementById('editor');
const preview = document.getElementById('preview');
const themeToggle = document.getElementById('themeToggle');

// 图片管理相关元素
const imageManageBtn = document.getElementById('imageManageBtn');
const imageManagerIDE = document.getElementById('imageManagerIDE');
const backToEditBtn = document.getElementById('backToEditBtn');
const importImageBtn = document.getElementById('importImageBtn');
const imageGrid = document.getElementById('imageGrid');

// 弹窗相关元素
const imageImportModal = document.getElementById('imageImportModal');
const imageImportForm = document.getElementById('imageImportForm');
const imageIdInput = document.getElementById('imageIdInput');
const imageFileInput = document.getElementById('imageFileInput');
const cancelImportBtn = document.getElementById('cancelImportBtn');

// 删除确认弹窗相关元素
const deleteConfirmModal = document.getElementById('deleteConfirmModal');
const deleteConfirmMessage = document.getElementById('deleteConfirmMessage');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

// 修改ID弹窗相关元素
const modifyIdModal = document.getElementById('modifyIdModal');
const modifyIdForm = document.getElementById('modifyIdForm');
const oldIdInput = document.getElementById('oldIdInput');
const newIdInput = document.getElementById('newIdInput');
const cancelModifyBtn = document.getElementById('cancelModifyBtn');

// #region --------------- 主题函数 --------------- 

// 初始化主题模式（凌晨 6 点前和晚上 18 点后 为暗色）
let isDarkMode = (() => {
    let h = new Date().getHours();
    return h <= 7 || h >= 18;
})();

// 主题切换函数
function toggleTheme(pd = true) {
    if (pd) isDarkMode = !isDarkMode;
    document.body.classList.toggle('dark-mode', isDarkMode);
    themeToggle.innerHTML = isDarkMode ? "🌙 暗色模式" : "☀️ 亮色模式";
}

toggleTheme(false);

// 初始化编辑器内容
editor.value =
    `# 实时Markdown编辑器

输入**Markdown**语法，右侧将实时预览效果！

## 特性
- 可离线编辑
- 独立于传统Markdown渲染的编辑器，支持混合html语法进行编辑
- 离线图片的管理和加载与简单的语法
- 实时渲染
- 支持标题、列表、链接、图片、代码块、引用块等
- 响应式布局
- 亮色/暗色主题切换
- 编辑模式和只预览模式
- 界面干净、整洁，合理圆角

## 代码示例
\`\`\`javascript
// 这是一段JavaScript代码
function greet() {
    console.log("Hello, Markdown!");
}
\`\`\`

## 自定义语法指导
### 离线图片加载
与**Markdown**原生的链接语法相似，采取形如 **<code>!\\[图片名](quote:图片ID)</code>** 的语法
这里需要“quote:”紧跟“图片ID”紧跟“)”，而且独占一行，否则就会被当成普通链接语法匹配
**图片ID**可在 **图片管理** 界面查看和配置，点击左上方 **图片管理** 按钮即可进入
根据界面提示导入图片并填写图片ID，接下来你就可以填入导入的图片ID来加载图片了！

## 理念
这是一个独立于传统Markdown渲染的编辑器，支持混合html语法进行编辑
主要用于提升撰写文章时的舒适感
因为原生Markdown不支持非路径参数的图片加载
就算能内联图片原数据也会导致文章主体臃肿
采取分离数据以及自定义语法`;

// #region --------------- Markdown转义器 --------------- 

// 将自定义Markdown的语法转换为可渲染html
// markdown 文章主体，imgs图片元数据（图片ID映射图片元数据）
function CreateRenderableHTMLfromMarkdown(JSONdata) {
    let markdown = JSONdata.markdown ?? "";
    const imgs = JSONdata.images ?? {};
    // 1. 给独立空行添加标记（避免被marked过滤）
    // "/\n([ \t]*\n)+/g" -> 匹配形如 \n + 若干空格和制表符或者空字符串 + \n 字符串，即空行
    markdown = markdown.replace(/\n([ \t]*\n)+/g, match => {
        // 统计空行数量，每个空行生成一个占位段落
        const lineCount = match.split('\n').filter(line => line.trim() === '').length - 2;
        return "\n" + Array(lineCount).fill('<br>').join('') + "\n" + "\n";
    });
    // 2. 引入自定义语法 ![自定义图片名](quote:图片ID)
    // 匹配之后，获取两个参数，图片ID用imgs查找对应图片的元数据
    markdown = markdown.replace(/^(.*?)!\[(.*?)\]\(quote:(.*?)\)$/gm, (match, str, name, ID) => {
        let newStr = str;
        let newName = name;
        let newSize = 1;
        name.replace(/^\s*(.*?)\s*\|\s*([^\s]+)\s*$/, (_, a, b) => {
            newName = a;
            newSize = b;
            return _;
        });
        return imgs[ID] && newSize ? `${str}<img src="${imgs[ID]}" alt="${newName}" style="zoom: calc(var(--base-font-size) / var(--const-base-font-size) * ${newSize});">\n` : "";
    });

    markdown = marked.parse(markdown, {
        breaks: true, // 单个\n渲染为<br>，多行文本按换行显示
    });
    return markdown;
}

// 更新预览函数
let updatePreview = () => {
    preview.innerHTML = CreateRenderableHTMLfromMarkdown(
        {
            "markdown": editor.value,
            "images": window.imageMap
        }
    );
}

// 初始化
updatePreview();

// 事件监听
editor.addEventListener('input', () => updatePreview());
themeToggle.addEventListener('click', () => toggleTheme());

// #region --------------- 字体大小修改 --------------- 

// 字体大小控制逻辑
const htmlRoot = document.documentElement;
const minFontSize = 12; // 最小字体（避免过小）
const maxFontSize = 24; // 最大字体（避免过大）
const fontSizeStep = 2; // 每次增减幅度（2px）

// 获取所有字体控制按钮（左右两侧按钮同步功能）
const fontIncreaseBtns = document.querySelectorAll('#fontIncrease, #fontIncrease2');
const fontDecreaseBtns = document.querySelectorAll('#fontDecrease, #fontDecrease2');

// 增大字体函数
function increaseFontSize() {
    let currentSize = parseInt(getComputedStyle(htmlRoot).getPropertyValue('--base-font-size'));
    if (currentSize < maxFontSize) {
        htmlRoot.style.setProperty('--base-font-size', `${currentSize + fontSizeStep}px`);
    }
}

// 减小字体函数
function decreaseFontSize() {
    let currentSize = parseInt(getComputedStyle(htmlRoot).getPropertyValue('--base-font-size'));
    if (currentSize > minFontSize) {
        htmlRoot.style.setProperty('--base-font-size', `${currentSize - fontSizeStep}px`);
    }
}

// 绑定按钮事件（左右两侧按钮点击都生效）
fontIncreaseBtns.forEach(btn => btn.addEventListener('click', increaseFontSize));
fontDecreaseBtns.forEach(btn => btn.addEventListener('click', decreaseFontSize));

// #region --------------- 分界线 --------------- 

// 分界线调整逻辑
const container = document.querySelector('.container');
const leftIDE = document.querySelector('.IDE-left');
const rightIDE = document.querySelector('.IDE-right');
const resizer = document.createElement('div');
resizer.className = 'resizer';
container.appendChild(resizer);

let isResizing = false;

resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
    if (isDarkMode) resizer.style.backgroundColor = "#555";
    else resizer.style.backgroundColor = "#ccc";
});

document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const mouseX = e.clientX - containerRect.left;
    const percentage = (mouseX / containerWidth) * 100;

    // 限制最小宽度为20%
    if (percentage >= 20 && percentage <= 80) {
        leftIDE.style.right = `${100 - percentage}%`;
        rightIDE.style.left = `${percentage}%`;
        resizer.style.left = `${percentage}%`;
    }
});

document.addEventListener('mouseup', () => {
    resizer.style.backgroundColor = "";
    isResizing = false;
    document.body.style.cursor = '';
});

// #region --------------- 只预览模式 --------------- 

//元素对象
const previewOnlyToggle = document.getElementById('previewOnlyToggle');
let isPreviewOnly = false;

//临时记录
let previewOnlyToggle_temp_r_l;
let previewOnlyToggle_temp_l_r;

// 切换只预览模式函数
function togglePreviewOnly() {
    isPreviewOnly = !isPreviewOnly;

    if (isPreviewOnly) {
        // 进入只预览模式
        document.body.classList.add('NotDualEditAndRenderWindow');
        leftIDE.classList.add('hidden');
        resizer.classList.add('hidden');
        previewOnlyToggle.classList.add('active');
        previewOnlyToggle.textContent = '退出只预览';
        previewOnlyToggle_temp_l_r = leftIDE.style.right;
        previewOnlyToggle_temp_r_l = rightIDE.style.left;
        rightIDE.style.left = '0';
        leftIDE.style.right = '100%';
    } else {
        // 退出只预览模式
        document.body.classList.remove('NotDualEditAndRenderWindow');
        leftIDE.classList.remove('hidden');
        resizer.classList.remove('hidden');
        previewOnlyToggle.classList.remove('active');
        previewOnlyToggle.textContent = '只预览模式';
        // 恢复默认宽度
        leftIDE.style.right = previewOnlyToggle_temp_l_r;
        rightIDE.style.left = previewOnlyToggle_temp_r_l;
    }
}

// 绑定只预览模式按钮事件
previewOnlyToggle.addEventListener('click', togglePreviewOnly);

// #region --------------- 只编辑模式 --------------- 

const editOnlyMode = document.getElementById('editOnlyMode');
let isEditOnly = false;

// 临时记录
let editOnlyMode_temp_r_l;
let editOnlyMode_temp_l_r;

// 篡改原函数，使得增加一个不渲染的功能
const Ofunction = updatePreview;
updatePreview = function (...arg) {
    if (!isEditOnly) Ofunction.apply(this, ...arg);
}

// 切换只编辑模式函数
function editOnlyModeOnly() {
    isEditOnly = !isEditOnly;
    if (isEditOnly) {
        // 进入只编辑模式
        // 增加隐藏类名
        document.body.classList.add('NotDualEditAndRenderWindow');
        rightIDE.classList.add('hidden');
        resizer.classList.add('hidden');
        editOnlyMode.classList.add('active');
        editOnlyMode.textContent = '退出只编辑';
        editOnlyMode_temp_l_r = leftIDE.style.right;
        editOnlyMode_temp_r_l = rightIDE.style.left;
        rightIDE.style.left = '100%';
        leftIDE.style.right = '0';
    }
    else {
        // 退出只编辑模式
        // 移除隐藏类名
        document.body.classList.remove('NotDualEditAndRenderWindow');
        rightIDE.classList.remove('hidden');
        resizer.classList.remove('hidden');
        editOnlyMode.classList.remove('active');
        editOnlyMode.textContent = '只编辑模式';
        // 恢复默认宽度
        leftIDE.style.right = editOnlyMode_temp_l_r;
        rightIDE.style.left = editOnlyMode_temp_r_l;
    }
}

// 绑定只编辑模式按钮事件
editOnlyMode.addEventListener('click', editOnlyModeOnly);

// #region --------------- 图盘管理的主逻辑 --------------- 

// 图片管理功能逻辑

// 用于存储待操作的图片ID
let imageToDeleteId = null;
let imageToModifyId = null;

// 全局变量，用于追踪当前打开的菜单
let currentOpenMenu = null;

// 关闭所有打开的菜单
function closeAllMenus() {
    if (currentOpenMenu) {
        currentOpenMenu.classList.remove('show');
        currentOpenMenu = null;
    }
}

// 点击页面其他地方时关闭菜单
document.addEventListener('click', function (e) {
    // 如果点击的不是菜单按钮或菜单项，关闭所有菜单
    if (!e.target.closest('.menu-btn') && !e.target.closest('.menu-dropdown')) {
        closeAllMenus();
    }
});


// #region --------------- 1. 切换到图片管理界面 --------------- 

// 1. 切换到图片管理界面
function switchToImageManager() {
    // 隐藏主编辑器界面
    container.classList.add('hidden');
    resizer.classList.add('hidden');

    // 显示图片管理界面
    imageManagerIDE.classList.remove('hidden');

    // 渲染图片列表
    renderImageGrid();
}

// #region --------------- 2. 返回到编辑界面 --------------- 

// 2. 返回到编辑界面
function switchToEditor() {
    // 恢复主编辑器界面
    container.classList.remove('hidden');
    resizer.classList.remove('hidden');
    // 关闭所有打开的菜单
    closeAllMenus();

    // 隐藏图片管理界面
    imageManagerIDE.classList.add('hidden');

    // 更新预览，确保使用最新的图片数据
    updatePreview();
}

// #region --------------- 3. 渲染图片网格 --------------- 

// 3. 渲染图片网格
function renderImageGrid() {
    // 清空当前网格内容
    imageGrid.innerHTML = '';

    // 获取所有图片ID
    const imageIds = Object.keys(window.imageMap);

    // 如果没有图片，显示空状态
    if (imageIds.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `
                    <div style="text-align: center;">
                        <div style="font-size: 48px; margin-bottom: 10px; opacity: 0.5;">📷</div>
                        <div>暂无图片</div>
                        <div style="font-size: 12px; margin-top: 5px; opacity: 0.7;">点击任意空白处或"导入图片"按钮添加图片</div>
                    </div>
                `;
        imageGrid.appendChild(emptyState);
        return;
    }

    // 遍历所有图片，创建图片项目
    imageIds.forEach(imageId => {
        const imageItem = createImageItem(imageId, window.imageMap[imageId]);
        imageGrid.appendChild(imageItem);
    });
}
// #region --------------- 4. 创建单个图片项目 --------------- 

// 4. 创建单个图片项目
function createImageItem(imageId, imageData) {
    // 创建图片项目容器
    const item = document.createElement('div');
    item.className = 'image-item';
    item.dataset.imageId = imageId;

    // 创建图片预览容器
    const previewContainer = document.createElement('div');
    previewContainer.className = 'image-preview-container';

    // 创建图片元素
    const img = document.createElement('img');
    img.className = 'image-preview';
    img.src = imageData;
    img.alt = `图片: ${imageId}`;

    // 创建图片ID显示
    const idLabel = document.createElement('div');
    idLabel.className = 'image-id';
    idLabel.textContent = `ID: ${imageId}`;

    // 创建菜单按钮
    const menuBtn = document.createElement('button');
    menuBtn.className = 'menu-btn';
    menuBtn.innerHTML = '⋮'; // 三个点图标
    menuBtn.title = '更多操作';

    // 创建下拉菜单
    const menuDropdown = document.createElement('div');
    menuDropdown.className = 'menu-dropdown';

    // 创建修改选项
    const modifyItem = document.createElement('div');
    modifyItem.className = 'menu-item';
    modifyItem.innerHTML = '修改';

    // 创建删除选项
    const deleteItem = document.createElement('div');
    deleteItem.className = 'menu-item delete';
    deleteItem.innerHTML = '删除';

    // 添加菜单项到下拉菜单
    menuDropdown.appendChild(modifyItem);
    menuDropdown.appendChild(deleteItem);

    // 菜单按钮点击事件 - 切换菜单显示
    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();

        // 关闭其他打开的菜单
        if (currentOpenMenu && currentOpenMenu !== menuDropdown) {
            currentOpenMenu.classList.remove('show');
        }

        // 切换当前菜单
        menuDropdown.classList.toggle('show');
        currentOpenMenu = menuDropdown.classList.contains('show') ? menuDropdown : null;
    });

    // 修改选项点击事件
    modifyItem.addEventListener('click', (e) => {
        e.stopPropagation();
        showModifyIdModal(imageId);
        closeAllMenus();
    });

    // 删除选项点击事件
    deleteItem.addEventListener('click', (e) => {
        e.stopPropagation();
        showDeleteConfirm(imageId);
        closeAllMenus();
    });

    // 组装元素
    previewContainer.appendChild(img);
    item.appendChild(previewContainer);
    item.appendChild(idLabel);
    item.appendChild(menuBtn);
    item.appendChild(menuDropdown);

    // 阻止图片项目内部的点击事件冒泡到网格容器
    item.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    return item;
}

// #region --------------- 5. 显示导入图片弹窗 --------------- 

// 5. 显示导入图片弹窗
function showImageImportModal() {
    // 重置表单
    imageImportForm.reset();
    imageImportModal.classList.remove('hidden');
}

// #region --------------- 6. 隐藏导入图片弹窗 --------------- 

// 6. 隐藏导入图片弹窗
function hideImageImportModal() {
    imageImportModal.classList.add('hidden');
}

// #region --------------- 7. 处理图片导入 --------------- 

// 7. 处理图片导入
function handleImageImport(event) {
    event.preventDefault();

    // 获取表单数据
    const imageId = imageIdInput.value.trim();
    const fileInput = imageFileInput.files[0];

    // 验证输入
    if (!imageId) {
        alert('请输入图片ID');
        return;
    }

    if (!fileInput) {
        alert('请选择图片文件');
        return;
    }

    // 检查ID是否已存在
    if (window.imageMap[imageId]) {
        alert('该ID已存在，请使用其他ID');
        return;
    }

    // 读取图片文件
    const reader = new FileReader();

    reader.onload = function (e) {
        // 获取base64数据
        const base64Data = e.target.result;

        // 存储到全局对象
        window.imageMap[imageId] = base64Data;

        // 隐藏弹窗
        hideImageImportModal();

        // 重新渲染图片网格
        renderImageGrid();

        // 更新预览
        updatePreview();

        // 显示成功消息
        alert('图片导入成功！');
    };

    reader.onerror = function () {
        alert('读取图片文件失败，请重试');
    };

    // 开始读取文件
    reader.readAsDataURL(fileInput);
}

// #region --------------- 8. 显示删除确认弹窗 --------------- 

// 8. 显示删除确认弹窗
function showDeleteConfirm(imageId) {
    imageToDeleteId = imageId;
    deleteConfirmMessage.textContent = `确定要删除图片 "${imageId}" 吗？删除后不可恢复。`;
    deleteConfirmModal.classList.remove('hidden');
}

// #region --------------- 9. 隐藏删除确认弹窗 --------------- 

// 9. 隐藏删除确认弹窗
function hideDeleteConfirm() {
    deleteConfirmModal.classList.add('hidden');
    imageToDeleteId = null;
}

// #region --------------- 10. 删除图片 --------------- 

// 10. 删除图片
function deleteImage() {
    if (!imageToDeleteId) return;

    // 从全局对象中删除
    delete window.imageMap[imageToDeleteId];

    // 隐藏弹窗
    hideDeleteConfirm();

    // 重新渲染图片网格
    renderImageGrid();

    // 更新预览
    updatePreview();

    // 显示成功消息
    alert('图片删除成功！');
}

// #region --------------- 11. 显示修改ID弹窗 --------------- 

// 11. 显示修改ID弹窗
function showModifyIdModal(imageId) {
    imageToModifyId = imageId;
    oldIdInput.value = imageId;
    newIdInput.value = '';
    modifyIdModal.classList.remove('hidden');
    newIdInput.focus();
}

// #region --------------- 12. 隐藏修改ID弹窗 --------------- 

// 12. 隐藏修改ID弹窗
function hideModifyIdModal() {
    modifyIdModal.classList.add('hidden');
    imageToModifyId = null;
}

// #region --------------- 13. 处理修改ID --------------- 

// 13. 处理修改ID
function handleModifyId(event) {
    event.preventDefault();

    const oldId = imageToModifyId;
    const newId = newIdInput.value.trim();

    // 验证输入
    if (!newId) {
        alert('请输入新ID');
        return;
    }

    if (newId === oldId) {
        alert('新ID与原ID相同，无需修改');
        return;
    }

    // 检查新ID是否已存在
    if (window.imageMap[newId]) {
        alert('新ID已存在，请使用其他ID');
        return;
    }

    // 获取原图片数据
    const imageData = window.imageMap[oldId];

    // 更新全局对象
    window.imageMap[newId] = imageData;
    delete window.imageMap[oldId];

    // 隐藏弹窗
    hideModifyIdModal();

    // 重新渲染图片网格
    renderImageGrid();

    // 更新预览
    updatePreview();

    // 显示成功消息
    alert(`图片ID已从 "${oldId}" 修改为 "${newId}"`);
}

// #region --------------- 14. 绑定事件监听器 --------------- 

// 14. 绑定事件监听器

// 图片管理按钮点击事件
imageManageBtn.addEventListener('click', switchToImageManager);

// 返回编辑按钮点击事件
backToEditBtn.addEventListener('click', switchToEditor);

// 导入图片按钮点击事件
importImageBtn.addEventListener('click', showImageImportModal);

// 取消导入按钮点击事件
cancelImportBtn.addEventListener('click', hideImageImportModal);

// 图片导入表单提交事件
imageImportForm.addEventListener('submit', handleImageImport);

// 取消删除按钮点击事件
cancelDeleteBtn.addEventListener('click', hideDeleteConfirm);

// 确认删除按钮点击事件
confirmDeleteBtn.addEventListener('click', deleteImage);

// 取消修改按钮点击事件
cancelModifyBtn.addEventListener('click', hideModifyIdModal);

// 修改ID表单提交事件
modifyIdForm.addEventListener('submit', handleModifyId);

// 在图片管理功能逻辑部分的顶部添加
let isMouseDownOnModalContent = false;

// #region --------------- 弹窗构造函数和使用 --------------- 

function UniversalBinding(element, func) {
    // 修改弹窗背景点击事件的逻辑
    // 如果鼠标按下的是弹窗内容区域（不是背景），则标记
    element.addEventListener('mousedown', (e) => isMouseDownOnModalContent = e.target === element);

    //松开鼠标的逻辑
    element.addEventListener('mouseup', (e) => {
        if (isMouseDownOnModalContent) func();
        isMouseDownOnModalContent = false;
    });
}

// 弹窗统一构造
UniversalBinding(imageImportModal, hideImageImportModal);
UniversalBinding(deleteConfirmModal, hideDeleteConfirm);
UniversalBinding(modifyIdModal, hideModifyIdModal);

// #region --------------- 导出图片JSON功能 --------------- 





// #region --------------- 导出 --------------- 

// 新增：导出JSON功能
function exportImageJson() {
    // 检查是否有图片数据
    if (Object.keys(window.imageMap).length === 0) {
        alert('没有图片数据可以导出');
        return;
    }

    // 创建JSON字符串
    const jsonData = JSON.stringify(window.imageMap, null, 2);

    // 创建Blob对象
    const blob = new Blob([jsonData], { type: 'application/json' });

    // 创建下载链接
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `image-map-${new Date().toISOString().slice(0, 10)}.json`;

    // 触发下载
    document.body.appendChild(a);
    a.click();

    // 清理
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);

    alert(`已导出 ${Object.keys(window.imageMap).length} 张图片的配置`);
}

// #region --------------- 导入 --------------- 

// 新增：导入JSON功能
function importImageJson() {
    // 创建文件输入元素
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = function (e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = function (e) {
            try {
                const importedData = JSON.parse(e.target.result);

                // 验证数据格式
                if (typeof importedData !== 'object' || importedData === null) {
                    throw new Error('无效的JSON格式');
                }

                // 计算新增和覆盖的图片数量
                let added = 0;
                let overwritten = 0

                // 合并数据
                for (const [key, value] of Object.entries(importedData)) {
                    if (window.imageMap[key]) overwritten++;
                    else added++;
                    window.imageMap[key] = value;
                }

                // 重新渲染图片网格
                renderImageGrid();

                // 更新预览
                updatePreview();

                // 显示导入结果
                let message = '导入完成！\n';
                if (added > 0) message += `新增图片: ${added}\n`;
                if (overwritten > 0) message += `覆盖图片: ${overwritten}`;

                alert(message);

            } catch (error) {
                alert('导入失败: ' + error.message);
            }
        };

        reader.onerror = function () {
            alert('读取文件失败');
        };

        reader.readAsText(file);
    };

    input.click();
}

// 在事件监听部分添加这两个按钮的绑定
document.getElementById('exportJsonBtn').addEventListener('click', exportImageJson);
document.getElementById('importJsonBtn').addEventListener('click', importImageJson);

// #region --------------- 导出文章JSON功能 --------------- 






// #region --------------- 定义与获取 --------------- 

// 文章JSON属性常量，不能硬编码进脚本
const JSON_markdown = "markdown";
const JSON_images = "images";
const JSON_configuration = "configuration";

// 文章导入导出功能
const importArticleBtn = document.getElementById('importArticleBtn');
const exportArticleBtn = document.getElementById('exportArticleBtn');
const articleImportConfirmModal = document.getElementById('articleImportConfirmModal');
const confirmOptions = document.getElementById('confirmOptions');
const cancelImportArticleBtn = document.getElementById('cancelImportArticleBtn');
const confirmImportArticleBtn = document.getElementById('confirmImportArticleBtn');

let importedArticleData = null;
let selectedImportOption = 'replace';

// #region --------------- 1. 导出 --------------- 

// 1. 导出文章功能
function exportArticle() {
    try {
        // 准备导出数据
        const exportData = {
            [JSON_markdown]: editor.value,
            [JSON_images]: window.imageMap,
            [JSON_configuration]: {}
        };

        // 转换为JSON字符串
        const jsonString = JSON.stringify(exportData, null, 2);

        // 创建Blob对象
        const blob = new Blob([jsonString], { type: 'application/json' });

        // 创建下载链接
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        // 生成文件名（包含日期）
        const date = new Date();
        const dateString = date.toISOString().slice(0, 10);
        const timeString = date.toTimeString().slice(0, 8).replace(/:/g, '-');
        a.download = `markdown-article-${dateString}_${timeString}.json`;

        // 触发下载
        document.body.appendChild(a);
        a.click();

        // 清理
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);

        alert(`文章导出成功！共包含 ${Object.keys(window.imageMap).length} 张图片`);

    } catch (error) {
        console.error('导出文章失败:', error);
        alert('导出失败：' + error.message);
    }
}

// #region --------------- 2. 导入 --------------- 

// 2. 导入文章功能
function importArticle() {
    // 创建文件输入元素
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = function (e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = function (e) {
            try {
                // 解析JSON数据
                const importedData = JSON.parse(e.target.result);

                // 验证数据格式
                if (!importedData[JSON_markdown] || typeof importedData[JSON_markdown] !== 'string') {
                    throw new Error('文章格式错误：缺少text字段或格式不正确');
                }

                if (!importedData[JSON_images] || typeof importedData[JSON_images] !== 'object') {
                    throw new Error('文章格式错误：缺少imgs字段或格式不正确');
                }

                if (!importedData[JSON_configuration] || typeof importedData[JSON_configuration] !== 'object') {
                    throw new Error('文章格式错误：缺少JSON_configuration字段或格式不正确');
                }

                // 保存导入的数据
                importedArticleData = importedData;

                // 显示确认弹窗
                showArticleImportConfirm();

            } catch (error) {
                console.error('解析文章文件失败:', error);
                alert('导入失败：' + error.message);
            }
        };

        reader.onerror = function () {
            alert('读取文件失败');
        };

        reader.readAsText(file);
    };

    input.click();
}

// #region --------------- 3. 显示导入确认弹窗 --------------- 

// 3. 显示导入确认弹窗
function showArticleImportConfirm() {
    // 清空选项
    confirmOptions.innerHTML = '';

    // 创建选项
    const options = [
        {
            id: 'replace',
            title: '替换当前内容',
            desc: '用导入的文章完全替换当前编辑器的内容（包括所有图片）',
            selected: true
        },
        {
            id: 'keep',
            title: '保留当前内容',
            desc: '不执行任何操作，保留当前编辑器的内容和图片',
            selected: false
        }
    ];

    // 生成选项HTML
    options.forEach(option => {
        const optionDiv = document.createElement('div');
        optionDiv.className = `confirm-option ${option.selected ? 'selected' : ''}`;
        optionDiv.dataset.optionId = option.id;

        optionDiv.innerHTML = `
                <div class="option-title">${option.title}</div>
                <div class="option-desc">${option.desc}</div>
            `;

        // 点击选择选项
        optionDiv.addEventListener('click', () => {
            // 移除所有选项的选中状态
            document.querySelectorAll('.confirm-option').forEach(opt => {
                opt.classList.remove('selected');
            });

            // 添加当前选项的选中状态
            optionDiv.classList.add('selected');
            selectedImportOption = option.id;
        });

        confirmOptions.appendChild(optionDiv);
    });

    // 显示弹窗
    articleImportConfirmModal.classList.remove('hidden');
}

// #region --------------- 4. 隐藏导入确认弹窗 --------------- 

// 4. 隐藏导入确认弹窗
function hideArticleImportConfirm() {
    articleImportConfirmModal.classList.add('hidden');
    importedArticleData = null;
    selectedImportOption = 'replace';
}

// #region --------------- 5. 执行导入操作 --------------- 

// 5. 执行导入操作
function executeArticleImport() {

    if (!importedArticleData || selectedImportOption !== 'replace') {
        hideArticleImportConfirm();
        return;
    }

    try {
        // 替换编辑器内容
        editor.value = importedArticleData[JSON_markdown];

        // 替换图片对象
        window.imageMap = importedArticleData[JSON_images];

        // 更新预览
        updatePreview();

        alert(`文章导入成功！\n内容长度：${importedArticleData[JSON_markdown].length} 字符\n包含图片：${Object.keys(importedArticleData[JSON_images]).length} 张`);

        // 隐藏弹窗
        hideArticleImportConfirm();
    } catch (error) {
        console.error('执行导入失败:', error);
        alert('导入失败：' + error.message);
    }
}

// #region --------------- 6. 事件绑定 --------------- 

UniversalBinding(articleImportConfirmModal, hideArticleImportConfirm);



// #region --------------- 7. 绑定事件监听器 --------------- 

// 7. 绑定事件监听器
importArticleBtn.addEventListener('click', importArticle);
exportArticleBtn.addEventListener('click', exportArticle);
cancelImportArticleBtn.addEventListener('click', hideArticleImportConfirm);
confirmImportArticleBtn.addEventListener('click', executeArticleImport);

// #region --------------- 8. 添加键盘快捷键支持 --------------- 

// 8. 添加键盘快捷键支持（可选）
document.addEventListener('keydown', (e) => {
    // Ctrl+E 导出文章 (Windows/Linux)
    // Cmd+E 导出文章 (Mac)
    if ((e.ctrlKey || e.metaKey) && e.key === 'e' && !e.shiftKey) {
        e.preventDefault();
        exportArticle();
    }

    // Ctrl+I 导入文章 (Windows/Linux)
    // Cmd+I 导入文章 (Mac)
    if ((e.ctrlKey || e.metaKey) && e.key === 'i' && !e.shiftKey) {
        e.preventDefault();
        importArticle();
    }

    // ESC键关闭弹窗
    if (e.key === 'Escape' && !articleImportConfirmModal.classList.contains('hidden')) {
        hideArticleImportConfirm();
    }

    // Enter键确认导入（当弹窗显示时）
    if (e.key === 'Enter' && !articleImportConfirmModal.classList.contains('hidden')) {
        e.preventDefault();
        executeArticleImport();
    }
});
