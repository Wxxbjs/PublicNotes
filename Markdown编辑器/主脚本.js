// #region --------------- 全局对象定义和存储 --------------- 

// 自定义扩展：连续空行转 <br>
const emptyLinesExtension = {
    name: 'emptyLines',
    level: 'block',
    tokenizer(src) {
        // 匹配连续空行（一个或多个换行符，且该行只有空白）
        const rule = /^\n+/;
        const match = rule.exec(src);
        if (match) {
            const count = match[0].length;  // 连续换行符个数
            return {
                type: 'emptyLines',
                raw: match[0],
                count: count,
            };
        }
        return false;
    },
    renderer(token) {
        // 输出对应数量的 <br>
        return '<br>'.repeat(token.count - 1);
    },
};

// 注册扩展（只注册一次，可在页面加载时执行）
marked.use({ extensions: [emptyLinesExtension] });

// 图片映射对象：imageId -> { data: base64, width: number, height: number }
// 这个对象可以在整个应用中使用
window.imageMap = {};
// 或者如果你想让它只在当前页面作用域内
const imageMap = window.imageMap; // 这样你可以通过imageMap访问

// 渲染配置对象
let renderSettings = {
    isDistribution: false  // 默认编辑版（显示注释）
};

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

// 配置管理相关元素
const settingBtn = document.getElementById('settingBtn');
const settingsModal = document.getElementById('settingsModal');
const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const previewModeRadios = document.querySelectorAll('input[name="previewMode"]');

// #region --------------- 主题函数 --------------- 

// 初始化主题模式（凌晨 6 点前和晚上 18 点后 为暗色）
let isDarkMode = (() => {
    let h = new Date().getHours();
    return h <= 6 || h >= 18;
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
- 支持标题、列表、链接、图片、代码块、引用块等
- 实时渲染
- 响应式布局
- 亮色/暗色主题切换
- 只编辑模式和只预览模式
- 界面干净、整洁，合理圆角
- “所见即所得”的换行理念
- 引入文档的“注释”，解决文档的发行版本和编辑版本之间的矛盾

## 代码示例
\`\`\`javascript
// 这是一段JavaScript代码
function greet() {
    console.log("Hello, Markdown!");
}
\`\`\`

## 自定义语法指导
### 离线图片加载
与**Markdown**原生的链接语法相似，采取形如 **\`![图片名](quote:图片ID)\`** 的语法
这里需要“quote:”紧跟“图片ID”紧跟“)”，而且独占一行，否则就会被当成普通链接语法进行处理
**图片ID**可在 **图片管理** 界面查看和配置，点击左上方 **图片管理** 按钮即可进入
根据界面提示导入图片并填写图片ID，接下来你就可以填入导入的图片ID来加载图片了！
特别的，在图片名一栏中写成了形如 \`字符串|字符串\` 的格式，则是**参数语法**
该语法允许传递一些特殊的参数影响最终渲染效果
目前的标准是：
以进行“|”分割，参数依次的含义：
**1.** 图片名
**2.** 缩放百分比（但不带百分号，比如100是原始大小，50则是一半）
注意该语法目前仅限离线图片，传统链接语法没有提供参数语法

### 非发行版注释
语法形如 **\`\\[!note]文本[/!note]\`**
其中的“文本”部分就是待隐藏的内容
文本内容不局限于单行，是**支持多行的**
如果被隐藏，则内容不出现在文档的实际渲染中（原理是直接删除字符串）
如果是显示，则文本内容正常出现在文档流中，而 \`\\[!note]\` 等部分消失
该语法是最高级语法，比任何标签、Markdown语法都优先（原理是直接一个正则）
如果你的确需要写成类似字面量形式，则建议用反斜杠转移其中的字符，破坏语法规则即可
可能需要注意“截断”注释内容以后，会不会影响文档的渲染
此外，**注释的嵌套是不被允许的（一个有效的注释语法的文本内容中不得出现其他 \\[!note] 标签）**，
不推荐、也请不要在注释语法里写注释语法。
隐藏或显示取决于渲染器的配置，但根据功能的定位：
在正式发行时，需配置渲染器进行隐藏
在平时编辑时，不需要配置渲染器进行隐藏

特别的，
如果你需要使用类似 \\[!note] 或 \\[/!note] 的纯字符串在正常的文档流中，则需要写成 \`\\\\\\[!note]\` 或 \`\\\\\\[/!note]\` 的格式在文档数据中

但一些Markdown的标签可能会或者不会解析一定的转义字符，所以具体的转义字符用多少需要你们自己观察和权衡。
例如，在普通段落中，写 \`\\\\\\\\[!note]\` 才可得到 \`\\\\[!note]\`；而在代码块中，只需写成 <code>\\\`\\\\\\\\\\[!note]\\\`</code> 即可得到 \`\\\\[!note]\` 。具体情况请自行测试。
但本人可以保证，你先写成 \`\\\\[!note]\` 绝对是先被编译成 \`[!note]\` 替换到进原字符串的，即默认先转义注释语法，而后再去参与Markdown的其他编译的；

简单的说：
如果文本出现字符串“\\\\\\[!note]”（不包含引号），那么直接将“\\\\\\[!note]”替换成“\\[!note]”再参与正常的markdown处理。
我担心的是因为markdown原生关于转义与不转义本来就有争议，所以一些需要打印转义字符的场景需要权衡。
只不过注释语法完全是最高的语法，不在乎任何标签。就是硬核替换。
所谓的转义字符的数量问题，可以归结于这样：

如果你需要渲染出类似 \\\\\\\\\\\\……\\\\\\\\\\[!note] 的字符串
记需要渲染的转义的数量为n（即 \\[!note] 前面的转义字符的数量）
那么你需要写到文档元数据里的转义字符的数量则是这样计算：

- 如果上下文会转义转义字符，即两个转义字符“\\\\\\\\”才能得到一个转义字符“\\\\”，那么实际转义书写的转义字符数量则为： 2n+1
- 如果上下文不会转义转义字符，即一个转义字符“\\\\”就是对应一个转义字符“\\\\”，那么实际需要书写的转义字符数量则为： n+1

为什么要有一个硬要加的1。
因为“\\[!note]”本身就是注释语法，而只有前面加上“\\\\”，即写成“\\\\\\[!note]”才会让渲染器认为这是一个字符串，即渲染出来才会是一个字符串“[!note]”
这下总算理解了吧。

不要依赖 没有头标签的 \\[\\/!note] 或 无尾标签的 \\[!note] 来实现这类需求，这可能导致文档的布局混乱
另外，考虑到 \\[!note] 的布局，当你写成：
\`\`\`
文本1
\\[!note]
隐藏的注释文本
\\[/!note]
文本2
\`\`\`
如果保留注释，则编译后是：
\`\`\`
文本1
隐藏的注释文本
文本2
\`\`\`
因为我觉得 \\[!note] 可以稍微的独占一行，但是所在行不参与行数计算
这样子布局更合理，而不是写成如同html的诡异强内联形式。避免一些无脑吞行、暴力换行的不良编辑体验
不过note标签**最多吞下首尾各一行**，如果你写成：
\`\`\`
文本1
\\[!note]

隐藏的注释文本

\\[/!note]
文本2
\`\`\`
如果保留注释，则编译后是：
\`\`\`
文本1

隐藏的注释文本

文本2
\`\`\`
这样才是合理的布局方式

## 理念
这是一个独立于传统Markdown渲染的编辑器，支持混合html语法进行编辑
主要用于提升撰写文章时的舒适感

因为原生Markdown不支持非路径参数的图片加载
就算能内联图片原数据也会导致文章主体臃肿
因此采取分离数据以及自定义语法来映射ID与图片原数据

考虑到实际的编辑需求
推出非发行版注释功能
在渲染器中，可以选择是否渲染注释中的内容
这样编辑时不用特别区分文章的发行版本和编辑版本，读者也再不用陷入“笔记地狱”`;

// #region --------------- Markdown转义器 --------------- 

// 将自定义Markdown的语法转换为可渲染html
// markdown 文章主体，imgs图片元数据（图片ID映射图片元数据）
function CreateRenderableHTMLfromMarkdown(JSONdata, setting = {}) {
    // 临时渲染配置解析
    const isDistribution = setting?.isDistribution ?? false;

    let markdown = JSONdata.markdown ?? "";
    const imgs = JSONdata.images ?? {};

    // 1. 引入自定义语法 [!note]文本[/!note]
    // 根据配置，自行选择注释去向
    markdown = markdown.replace(/\\?\[!note\](((?!\[!note\])[\s\S])*?)\[\/!note\]/g, (_, a) => {
        //根据理念，转移字符的优先级比所有所谓语法的东西都要优先
        //因此就这样判断
        //至于为什么不写在正则里，是因为正则是看判定的，如果不匹配，那么这个伪注释语法就会匹配成更大的范围，导致未定义行为。
        //在我的设计看来，只要是能匹配成标签语法的，都初步认为是注释语法
        //特别考虑转义字符而已。
        // console.log({a:_},{},a);
        const pdL = _.startsWith("\\[!note]");
        const pdR = _.endsWith("\\[/!note]");
        // console.log(pdL,pdR);
        if (pdL || pdR) {
            if (pdL) _ = _.slice(1);
            if (pdR) {
                const index = _.length - 9;
                _ = _.slice(0, index) + _.slice(index + 1);
            }
            // console.log(_);
            return _;
        }
        if (isDistribution) return "";
        //我觉得note标签应该可以独占一行，而不是影响换行文档流，不然编码很难受。
        //所以我最多在文本标签内删除收尾一个换行
        a = a.slice(a[0] === "\n", a.length - (a[a.length - 1] === "\n"));
        return a;
    });

    //将残留注释的破坏性转义字符串删掉
    markdown = markdown.replace(/\\\[!note\]/g, (_) => {
        return _.slice(1);
    });
    markdown = markdown.replace(/\\\[\/!note\]/g, (_) => {
        return _.slice(1);
    });

    // 2. 引入自定义语法 ![自定义图片名](quote:图片ID)
    // 匹配之后，获取两个参数，图片ID用imgs查找对应图片的元数据
    markdown = markdown.replace(/^(.*?)!\[(.*?)\]\(quote:(.*?)\)$/gm, (match, str, name, ID) => {
        let newStr = str;
        let newName = name;
        let newSize = "100%";
        name.replace(/^\s*(.*?)\s*\|\s*([^\s]+)\s*$/, (_, a, b) => {
            newName = a;
            newSize = b;
            return _;
        });
        const imgObj = imgs[ID];
        if (imgObj && newSize) {
            if(newSize.at(-1)==="%")newSize=newSize.slice(0,newSize.length-1);
            // 计算缩放后的宽度：原始宽度 * (缩放百分比/100)
            return `${str}<img src="${imgObj.data}" alt="${newName}" style="width: calc(var(--base-font-size) / var(--const-base-font-size) * ${newSize} / 100 * ${imgObj.width}px ); height: auto;">\n`;
        }
        return "";
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
        },
        renderSettings
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
const minFontSize = 10; // 最小字体（避免过小）
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
    img.src = imageData.data;
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
        const base64Data = e.target.result;
        const img = new Image();
        img.onload = function () {
            // 存储图片对象
            window.imageMap[imageId] = {
                data: base64Data,
                width: img.width,
                height: img.height
            };
            hideImageImportModal();
            renderImageGrid();
            updatePreview();
            alert('图片导入成功！');
        };
        img.onerror = function () {
            alert('图片加载失败，请检查文件是否有效');
        };
        img.src = base64Data;
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
UniversalBinding(settingsModal, hideSettingsModal);

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

        reader.onload = async function (e) {
            try {
                const importedData = JSON.parse(e.target.result);
                if (typeof importedData !== 'object' || importedData === null) {
                    throw new Error('无效的JSON格式');
                }

                let added = 0;
                let overwritten = 0;
                const convertPromises = [];

                for (const [key, value] of Object.entries(importedData)) {
                    // --- 新增：校验图片数据有效性 ---
                    // 跳过明显不是图片数据的字段（如文章JSON中的markdown等）
                    const isValidImageString = typeof value === 'string' && value.startsWith('data:image');
                    const isValidImageObject = value && typeof value === 'object' && typeof value.data === 'string' && value.data.startsWith('data:image');

                    if (!isValidImageString && !isValidImageObject) {
                        console.warn(`跳过无效图片数据: "${key}"`);
                        continue;
                    }
                    // --------------------------------

                    const exists = !!window.imageMap[key];
                    if (exists) overwritten++; else added++;

                    if (typeof value === 'string') {
                        // 旧版格式：异步获取宽高
                        convertPromises.push(new Promise((resolve) => {
                            const img = new Image();
                            img.onload = () => {
                                window.imageMap[key] = {
                                    data: value,
                                    width: img.width,
                                    height: img.height
                                };
                                resolve();
                            };
                            img.onerror = () => {
                                console.warn(`图片ID "${key}" 加载失败，将跳过`);
                                if (!exists) added--;
                                else overwritten--;
                                resolve();
                            };
                            img.src = value;
                        }));
                    } else if (isValidImageObject) {
                        // 新版格式：直接存储
                        window.imageMap[key] = value;
                    } else {
                        // 不会进入此处，因为已提前过滤
                        if (!exists) added--;
                        else overwritten--;
                    }
                }

                await Promise.all(convertPromises);

                renderImageGrid();
                updatePreview();

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
                const importedData = JSON.parse(e.target.result);
                if (typeof importedData !== 'object' || importedData === null) {
                    throw new Error('无效的JSON格式');
                }

                // 验证文章JSON结构
                if (!importedData[JSON_markdown] || typeof importedData[JSON_markdown] !== 'string') {
                    throw new Error('文章格式错误：缺少 markdown 字段或格式不正确');
                }
                if (!importedData[JSON_images] || typeof importedData[JSON_images] !== 'object') {
                    throw new Error('文章格式错误：缺少 images 字段或格式不正确');
                }

                // 保存导入的数据，显示确认弹窗
                importedArticleData = importedData;
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
async function executeArticleImport() {
    if (!importedArticleData || selectedImportOption !== 'replace') {
        hideArticleImportConfirm();
        return;
    }

    try {
        editor.value = importedArticleData[JSON_markdown];

        // 处理图片映射对象，兼容旧版字符串格式
        const rawImages = importedArticleData[JSON_images] || {};
        const newImageMap = {};
        const convertPromises = [];

        for (const [id, value] of Object.entries(rawImages)) {
            if (typeof value === 'string') {
                // 旧版格式：base64字符串，需要异步获取宽高
                convertPromises.push(new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => {
                        newImageMap[id] = {
                            data: value,
                            width: img.width,
                            height: img.height
                        };
                        resolve();
                    };
                    img.onerror = () => {
                        console.warn(`图片ID "${id}" 加载失败，将跳过该图片`);
                        resolve(); // 跳过但不中断整体流程
                    };
                    img.src = value;
                }));
            } else if (value && typeof value === 'object' && value.data) {
                // 新版格式：直接使用
                newImageMap[id] = value;
            } else {
                console.warn(`图片ID "${id}" 格式无效，已跳过`);
            }
        }

        // 等待所有图片转换完成
        await Promise.all(convertPromises);

        window.imageMap = newImageMap;
        updatePreview();

        const imageCount = Object.keys(newImageMap).length;
        alert(`文章导入成功！\n内容长度：${importedArticleData[JSON_markdown].length} 字符\n包含图片：${imageCount} 张`);
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
confirmImportArticleBtn.addEventListener('click', () => {
    executeArticleImport().catch(err => {
        console.error('导入过程发生错误:', err);
        alert('导入失败：' + err.message);
    });
});

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
        executeArticleImport().catch(err => {
            console.error('导入失败:', err);
            alert('导入失败：' + err.message);
        });
    }
    
    // ESC键关闭配置弹窗
    if (e.key === 'Escape' && !settingsModal.classList.contains('hidden')) {
        hideSettingsModal();
    }
});

// #region --------------- 配置管理 --------------- 

// 显示配置弹窗
function showSettingsModal() {
    // 根据当前设置选中对应的单选按钮
    previewModeRadios.forEach(radio => {
        if (radio.value === 'edit' && !renderSettings.isDistribution) {
            radio.checked = true;
        } else if (radio.value === 'dist' && renderSettings.isDistribution) {
            radio.checked = true;
        }
    });
    settingsModal.classList.remove('hidden');
}

// 隐藏配置弹窗
function hideSettingsModal() {
    settingsModal.classList.add('hidden');
}

// 保存配置设置
function saveSettings() {
    // 获取选中的值
    let selectedMode = 'edit';
    previewModeRadios.forEach(radio => {
        if (radio.checked) {
            selectedMode = radio.value;
        }
    });

    // 更新配置对象
    renderSettings.isDistribution = (selectedMode === 'dist');

    // 更新预览以应用新配置
    updatePreview();

    // 关闭弹窗
    hideSettingsModal();

    // 可选：提示用户
    console.log('预览模式已切换为：', renderSettings.isDistribution ? '发行版' : '编辑版');
}

// #region --------------- 0. 绑定事件监听器 --------------- 


// 配置管理按钮点击事件
settingBtn.addEventListener('click', showSettingsModal);

// 取消按钮点击事件
cancelSettingsBtn.addEventListener('click', hideSettingsModal);

// 保存按钮点击事件
saveSettingsBtn.addEventListener('click', saveSettings);

// 点击弹窗背景关闭（使用已有的 UniversalBinding 函数）
UniversalBinding(settingsModal, hideSettingsModal);