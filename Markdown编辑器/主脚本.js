// 引入
/// <reference path="类型库.js" />
/// <reference path="Markdown.js" />
//// @ts-check

"use strict";





// #region ----------------------------------------- 获取元素 ----------------------------------------- 

// 获取DOM元素
const editor = document.getElementById('editor');
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
const rendererRadios = document.querySelectorAll('input[name="rendererMode"]');

const articleImportConfirmModal = document.getElementById('articleImportConfirmModal');
const confirmOptions = document.getElementById('confirmOptions');
const cancelImportArticleBtn = document.getElementById('cancelImportArticleBtn');
const confirmImportArticleBtn = document.getElementById('confirmImportArticleBtn');

const globalMenu = document.getElementById('globalImageMenu');// 菜单

// 文章导入导出功能
const importArticleBtn = document.getElementById('importArticleBtn');
const exportArticleBtn = document.getElementById('exportArticleBtn');

//文件名功能
const FileNameInput = document.getElementById("FileNameInput");

// #endregion ----------------------------------------- 获取元素 ----------------------------------------- 







//         -------------------------------------------------------------------                     -------------------------------------------------------------------
//         -------------------------------------------------------------------                     -------------------------------------------------------------------
// #region -------------------------------------------------------------------  [ 轻量化渲染架构 ]  -------------------------------------------------------------------
//         -------------------------------------------------------------------                     -------------------------------------------------------------------
//         -------------------------------------------------------------------                     -------------------------------------------------------------------



// 主要是为了解耦，方便只塞入渲染架构，而非编辑架构



// #region --------------- 必要对象 --------------- 

const preview = document.getElementById('preview');
// const preview = document.querySelector('.preview');

// #endregion --------------- 必要对象 --------------- 




// #region --------------- 定义与获取 --------------- 

// 文章JSON属性常量，不能硬编码进脚本
const Article_markdown = "markdown";
const Article_images = "images";
const Article_format = "format";
const Article_configuration = "configuration";

//描述渲染器版本的对象
const RendererVersion = {
    PRIMITIVE: "PRIMITIVE",//原始/传统渲染器，没有任何特殊语法，完全兼容主流md文件与渲染
    ADVANCED: "ADVANCED",//进阶/全新渲染器，本人目前持续维护的版本，很多文档文章都基于这个编写和渲染
    CORRELATION_DIAGRAM: "CORRELATION_DIAGRAM"//还处于幻想阶段的一种图性渲染器，基于进阶渲染器的设计哲学，但改变了知识间的关联方式，目前没有任何进展
};

// 渲染配置对象
const renderSettings = {
    isDistribution: false,  // 默认编辑版（显示注释）
};

// #endregion --------------- 定义与获取 --------------- 






// #region ----------------------------------------- 构造修饰对象 ----------------------------------------- 


class ImageItem extends Struct {
    static required = ["data", "width"];
    static serializable = ["data", "width", "height"];

    constructor(props) {
        super(props);
        this._blobUrl = null;
        this._blob = null;
    }

    getBlobUrl() {
        if (!this._blobUrl) {
            // 生成 blob URL ，将 base64 data 转为 Blob
            const base64Data = this.data;
            const mime = base64Data.match(/data:(image\/\w+);/)?.[1] || 'image/png';
            const byteString = atob(base64Data.split(',')[1]);
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
            this._blob = new Blob([ab], { type: mime });
            this._blobUrl = URL.createObjectURL(this._blob);
        }
        return this._blobUrl;
    }
}

//文章类（虽然只有一个实例。）

class Article extends Struct {
    static required = [Article_markdown];
    static serializable = [Article_markdown, Article_images, Article_format, Article_configuration];

    constructor(props) {
        super(props);
        //非重要子段自动补全
        if (!this[Article_format]) this[Article_format] = RendererVersion.ADVANCED;
        if (!this[Article_images]) this[Article_images] = {};
        if (!this[Article_configuration]) this[Article_configuration] = {};
    }

    // #region --------------- Markdown转义器 --------------- 

    // 将自定义Markdown的语法转换为可渲染html
    // markdown 文章主体，imgs图片元数据（图片ID映射图片元数据）
    CreateRenderableHTMLfromMarkdown(setting = {}) {

        if (!marked) return "";

        // 临时渲染配置解析
        const _isDistribution = setting?.isDistribution ?? false;
        const _RendererVersion = this[Article_format];

        //数据读取与处理
        let markdown = this[Article_markdown] ?? "";
        const imgs = this[Article_images] ?? {};


        // 进阶渲染器的独特设计
        if (_RendererVersion === RendererVersion.ADVANCED) {

            // 1. 引入自定义语法 [!note]文本[/!note]
            // 根据配置，自行选择注释去向
            markdown = markdown.replace(/[^\\]\[!note\](((?![^\\]\[!note\])[\s\S])*?)[^\\]\[\/!note\]/g, (_, a) => {
                if (_isDistribution) return "";
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
            markdown = markdown.replace(/^(.*?)!\[(.*?)\]\(quote:(.*?)\)(.*?)$/gm, (match, str1, arg, ID, str2) => {
                const arr = arg.split("|");
                let newName = arr?.[0] ?? "";
                let newSize = arr?.[1] ?? "100%";
                if (imgs[ID] && newSize) {
                    imgs[ID] = ImageItem.wrap(imgs[ID]);
                    const imgObj = imgs[ID];
                    //修正newSize
                    if (newSize.at(-1) === "%") newSize = newSize.slice(0, newSize.length - 1);
                    // 计算缩放后的宽度
                    return `${str1}<img src="${imgObj.getBlobUrl()}" alt="${newName}" style="width: calc(var(--base-font-size) / var(--const-base-font-size) * ${newSize} / 100 * ${imgObj.width}px ); height: auto;">\n${str2}`;
                    // return `${str}<img src="${imgObj.data}" alt="${newName}" style="width: calc(var(--base-font-size) / var(--const-base-font-size) * ${newSize} / 100 * ${imgObj.width}px ); height: auto;">\n`;
                }
                return "";
            });

        }

        const customRenderer = new marked.Renderer();
        customRenderer.space = function (token) {
            const newlineCount = (token.raw.match(/\n/g) || []).length;
            return '<br>'.repeat(newlineCount);
        };

        let html = null;

        if (_RendererVersion === RendererVersion.ADVANCED) {
            setExtensionsPD(emptyLinesExtension,true);
            html = marked.parse(markdown, {
                breaks: true,
                renderer: customRenderer
            });
            // html = marked.parse(markdown, {
            //     // renderer: customRenderer,
            //     breaks: true, // 单个\n渲染为<br>，多行文本按换行显示
            // });
        }
        else if (_RendererVersion === RendererVersion.PRIMITIVE) {
            setExtensionsPD(emptyLinesExtension,false);
            html = marked.parse(markdown, {
                breaks: false,// 回归传统模式（单轮parse会覆盖全局的use）
            });
        }

        // 4. 后处理：高亮所有代码块
        // 创建临时 DOM 容器
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        const codeBlocks = tempDiv.querySelectorAll('pre code');
        codeBlocks.forEach(block => {
            // 提取语言（marked 默认添加 language-xxx 类）
            let lang = '';
            const classMatch = block.className.match(/language-(\w+)/);
            if (classMatch) lang = classMatch[1];
            const codeText = block.textContent || '';
            if (codeText && window.hljs) {
                try {
                    let highlighted;
                    if (lang && hljs.getLanguage(lang)) {
                        highlighted = hljs.highlight(codeText, { language: lang }).value;
                    } else {
                        highlighted = hljs.highlightAuto(codeText).value;
                    }
                    block.innerHTML = highlighted;
                    block.classList.add('hljs');
                } catch (err) {
                    console.warn('代码高亮失败:', err);
                }
            }
        });

        return tempDiv.innerHTML;
        // return html;
    }

    // #endregion --------------- Markdown转义器 --------------- 

}

// 文章对象主体（权威对象）
let MarkDownObjectBody = Article.wrap({
    [Article_markdown]: "",
    [Article_format]: RendererVersion.ADVANCED,
    [Article_images]: {},
    [Article_configuration]: {}
});

// #endregion ----------------------------------------- 构造修饰对象 -----------------------------------------





// #region --------------- 核心渲染区域 --------------- 

//气死我了。臭marked单轮parse啥扩展也不生效，只能用use并且在扩展里硬编码。
//避雷marked库。气死我了。

//闭包管理扩展，唯一暴露关键字对象，以及定义自己的扩展

//扩展控制开关关键字
const ExtensionsPDkey = Symbol("ExtensionsPD");

function markedBindExtensions(marked, Extensions) {

    //存储管理对象，扩展名映射一个布尔值，表示是否启用
    if (!marked[ExtensionsPDkey]) marked[ExtensionsPDkey] = {};

    // 篡改扩展，强制写入一个是否启用的逻辑

    //扩展的必要模版，检测自己是否被开启
    Extensions.forEach(Extension => {
        if (Extension?.name) {
            marked[ExtensionsPDkey][Extension.name] = true;
            if (Extension?.tokenizer) {
                const _tokenizer = Extension.tokenizer;
                Extension.tokenizer = function (...args) {
                    //关键：if判断是否启用
                    if (marked[ExtensionsPDkey][Extension.name]) return _tokenizer.call(this, ...args);
                    return false;
                }
            }
        }
    })

    // 调用use
    marked.use({ extensions: Extensions });
}

//设置函数
function setExtensionsPD(obj, pd) {
    if (typeof obj === "string") marked[ExtensionsPDkey][obj] = pd;
    else if (obj?.name) marked[ExtensionsPDkey][obj.name] = pd;
}

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

//实例化
markedBindExtensions(marked, [emptyLinesExtension]);

// // 自定义渲染器，为代码块添加高亮
// const renderer = new marked.Renderer();
// renderer.code = function (code, language) {
//     // 检测语言是否有效
//     const validLang = (language && hljs.getLanguage(language)) ? language : 'plaintext';
//     // 高亮处理
//     const highlighted = hljs.highlight(code, { language: validLang }).value;
//     // 返回标准的 <pre><code> 结构，并保留语言类名
//     return `<pre><code class="hljs language-${validLang}">${highlighted}</code></pre>`;
// };

// marked.setOptions({ renderer: renderer })

// #endregion --------------- 核心渲染区域 --------------- 





// #region --------------------------------------- 核心渲染对象类 ---------------------------------------

// 初始化对象内容
MarkDownObjectBody[Article_markdown] =
    `# 实时Markdown编辑器

输入**Markdown**语法，右侧将实时预览效果！

## 特性
- 可离线编辑
- 更强大的Markdown编辑器，支持混合html语法进行编辑
- 离线图片的管理和加载，以及简单的语法
- 支持标题、列表、链接、图片、代码块、引用块等
- 实时渲染
- 响应式布局
- 亮色/暗色主题切换
- 只编辑模式和只预览模式
- 界面干净、整洁，合理圆角
- “所见即所得”的换行理念
- 引入文档的“注释”，解决文档的发行版本和编辑版本之间的矛盾
- 多种渲染器，兼容传统渲染模式的同时支持衍生的渲染模式

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
这里需要“quote:”紧跟“图片ID”紧跟“)”，而且独占一行，否则就会被当成普通链接语法进行处理
**图片ID**可在 **图片管理** 界面查看和配置，点击左上方 **图片管理** 按钮即可进入
根据界面提示导入图片并填写图片ID，接下来你就可以填入导入的图片ID来加载图片了！
特别的，在图片名一栏中写成了形如 \`字符串|字符串\` 的格式，则是**参数语法**
该语法允许传递一些特殊的参数影响最终渲染效果
目前的标准是：
以进行“|”分割，参数依次的含义：
**1.** 图片名
**2.** 缩放百分比（前缀必须是数字，但带不带百分号都可以，最后的单位总是自动转为百分比，比如100是原始大小，50%则是一半，目前推荐标准是带百分比，更清晰一点）
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
\`\`\`txt
文本1
\\[!note]隐藏的注释文本\\[/!note]
文本2
\`\`\`
如果保留注释，则编译后是：
\`\`\`txt
文本1
隐藏的注释文本
文本2
\`\`\`
当你写成：
\`\`\`txt
文本1
\\[!note]
隐藏的注释文本
\\[/!note]
文本2
\`\`\`
如果保留注释，则编译后还是：
\`\`\`txt
文本1
隐藏的注释文本
文本2
\`\`\`
因为我觉得 \\[!note] 可以稍微的独占一行，但是所在行不参与行数计算
这样子布局更合理，而不是写成如同html的诡异强内联形式。避免一些无脑吞行、暴力换行的不良编辑体验
不过note标签**最多吞下首尾各一行**，如果你写成：
\`\`\`txt
文本1
\\[!note]

隐藏的注释文本

\\[/!note]
文本2
\`\`\`
如果保留注释，则编译后是：
\`\`\`txt
文本1

隐藏的注释文本

文本2
\`\`\`
在我看来这样才是合理的布局方式

### 文档兼容相关的问题
导入时，如果是以.md结尾，则直接以纯文本导入到编辑器里（但渲染器仍然默认为当前配置，不会自动切换和更改）；
如果是以.json或者其他文件后缀结尾，则直接进行json解析，格式、必要字段不正确则无法导入；
特别的，在解析过程中只是因为文档解析错误导致报错（连json都不是的那种，则很可能是一个纯文本文档），而非解析后的字段错误（如过了json的解析，但markdown字段缺失这种错误），则以纯文本方式打开。

## 理念
这是一个可兼容也可独立于传统Markdown渲染的编辑器，支持混合html语法进行编辑
主要用于提升撰写文章时的舒适感

因为原生Markdown不支持非路径参数的图片加载
就算能内联图片原数据也会导致文章主体臃肿
因此采取分离数据以及自定义语法来映射ID与图片原数据，同时不可避免的推出独立的文档格式
但也不是坏事，至少可以在自己格式上解决更多的痛点
反正从某时刻开始已经不能完美兼容了，干脆不考虑一些无意义的兼容算了

考虑到实际的编辑需求
推出非发行版注释功能
在渲染器中，可以选择是否渲染注释中的内容
这样编辑时不用特别区分文章的发行版本和编辑版本，读者也再不用陷入“笔记地狱”`;

// 关键：更新预览的函数
let updatePreview = () => {
    preview.innerHTML = MarkDownObjectBody.CreateRenderableHTMLfromMarkdown(renderSettings);
}

// #endregion ----------------------------------------- 核心渲染对象类 ----------------------------------------- 





//            -------------------------------------------------------------------                     -------------------------------------------------------------------
//            -------------------------------------------------------------------                     -------------------------------------------------------------------
// #endregion -------------------------------------------------------------------  [ 轻量化渲染架构 ]  ------------------------------------------------------------------- 
//            -------------------------------------------------------------------                     -------------------------------------------------------------------
//            -------------------------------------------------------------------                     -------------------------------------------------------------------




// #region --------------- 针对性定制 --------------- 


//配置
editor.value = MarkDownObjectBody[Article_markdown]

//让文章内容与编辑内容强关联
function updateMarkDownObjectBody() {
    MarkDownObjectBody[Article_markdown] = editor.value;
}

(function () {
    //篡改函数，加入一个即使更新的功能
    const _updatePreview = updatePreview;
    updatePreview = function (upDateMarkDownObjectBodyPD = true) {
        if (upDateMarkDownObjectBodyPD) updateMarkDownObjectBody();
        _updatePreview.call(this, upDateMarkDownObjectBodyPD);
    }
})();

// 初始化 与 事件监听
updatePreview();
editor.addEventListener('input', () => updatePreview());


// #endregion --------------- 针对性定制 --------------- 






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

themeToggle.addEventListener('click', () => toggleTheme());

// #endregion --------------- 主题函数 ---------------




// #region --------------- 字体大小修改 --------------- 

// 字体大小控制逻辑
const htmlRoot = document.documentElement;
const minFontSize = 10; // 最小字体（避免过小）
const maxFontSize = 24; // 最大字体（避免过大）
const fontSizeStep = 2; // 每次增减幅度（2px）


document.querySelectorAll('#fontIncrease, #fontIncrease2').forEach(btn => btn.addEventListener('click', increaseFontSize));
document.querySelectorAll('#fontDecrease, #fontDecrease2').forEach(btn => btn.addEventListener('click', decreaseFontSize));

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


// #endregion --------------- 字体大小修改 --------------- 





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

// #endregion --------------- 分界线 --------------- 





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

// #endregion --------------- 只预览模式 --------------- 





// #region --------------- 只编辑模式 --------------- 

const editOnlyMode = document.getElementById('editOnlyMode');
let isEditOnly = false;

// 临时记录
let editOnlyMode_temp_r_l;
let editOnlyMode_temp_l_r;

// 篡改原函数，使得增加一个不渲染的功能
(function () {
    const _updatePreview = updatePreview;
    updatePreview = function (...arg) {
        if (!isEditOnly) _updatePreview.call(this, ...arg);
    }
})();

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

// #endregion --------------- 只编辑模式 --------------- 










// #region ------------------------------------------- 图盘管理 ------------------------------------------- 

let currentHoverImageId = null;   // 当前悬浮的图片ID
let isMenuOpen = false;          // 菜单是否打开
let lockedImageItem = null;      // 被锁定的图片项（菜单按钮保持显示的那个）


// 关闭所有打开的菜单
function closeAllMenus() {
    document.body.classList.remove('menu-is-open');
    globalMenu.style.display = 'none';
    currentHoverImageId = null;
    if (lockedImageItem) {
        lockedImageItem.classList.remove('menu-locked');
        lockedImageItem = null;
    }
    isMenuOpen = false;
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
    closeAllMenus();  // 新增：刷新网格前关闭菜单，避免状态错乱
    // 清空当前网格内容
    imageGrid.innerHTML = '';

    // 获取所有图片ID
    const imageIds = Object.keys(MarkDownObjectBody[Article_images]);

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
        const imageItem = createImageItem(imageId, MarkDownObjectBody[Article_images][imageId]);
        imageGrid.appendChild(imageItem);
    });
}

// 使用事件委托处理所有图片菜单按钮的点击
imageGrid.addEventListener('click', (e) => {
    const menuBtn = e.target.closest('.menu-btn');
    if (!menuBtn) return;
    e.stopPropagation();
    const imageItem = menuBtn.closest('.image-item');
    if (!imageItem) return;
    const imageId = imageItem.dataset.imageId;
    closeAllMenus();
    // 如果菜单已打开且是针对同一图片，则单纯关闭，否则就打开
    if (globalMenu.style.display !== 'block' || currentHoverImageId !== imageId || isMenuOpen) showMenuForImage(imageId, menuBtn, imageItem);
});

// 显示菜单（在按钮附近）
function showMenuForImage(imageId, buttonElement, imageItem) {
    document.body.classList.add('menu-is-open');
    currentHoverImageId = imageId;
    // 清除之前的锁定
    if (lockedImageItem) {
        lockedImageItem.classList.remove('menu-locked');
    }
    lockedImageItem = imageItem;
    lockedImageItem.classList.add('menu-locked');
    isMenuOpen = true;

    // 先临时显示菜单以获取真实尺寸（但不闪烁）
    const wasHidden = globalMenu.style.display === 'none' || getComputedStyle(globalMenu).display === 'none';
    if (wasHidden) {
        globalMenu.style.display = 'block';
        globalMenu.style.visibility = 'hidden'; // 隐藏但占位
    }
    const menuWidth = globalMenu.offsetWidth;
    const menuHeight = globalMenu.offsetHeight;
    if (wasHidden) {
        globalMenu.style.display = 'none';
        globalMenu.style.visibility = '';
    }

    // 定位
    const rect = buttonElement.getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + 5;

    if (left + menuWidth > window.innerWidth) {
        left = rect.right - menuWidth;
    }
    if (left < 0) left = 5;
    if (top + menuHeight > window.innerHeight) {
        top = rect.top - menuHeight - 5;
    }
    if (top < 0) top = 5;

    globalMenu.style.left = `${left}px`;
    globalMenu.style.top = `${top}px`;
    globalMenu.style.display = 'block';
    globalMenu.style.visibility = ''; // 恢复可见
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

    // 创建菜单按钮（不再创建下拉菜单）
    const menuBtn = document.createElement('button');
    menuBtn.className = 'menu-btn';
    menuBtn.innerHTML = '⋮';
    menuBtn.title = '更多操作';

    // 组装元素
    previewContainer.appendChild(img);
    item.appendChild(previewContainer);
    item.appendChild(idLabel);
    item.appendChild(menuBtn);

    // 阻止图片项目内部的点击事件冒泡到网格容器
    // item.addEventListener('click', (e) => {
    //     e.stopPropagation();
    // });

    return item;
}

// 方式一：委托（推荐）
globalMenu.addEventListener('click', (e) => {
    const action = e.target.closest('.menu-item')?.dataset.action;
    if (!action || !currentHoverImageId) return;
    e.stopPropagation();
    if (action === 'modify') {
        showModifyIdModal(currentHoverImageId);
    } else if (action === 'delete') {
        showDeleteConfirm(currentHoverImageId);
    }
    closeAllMenus(); // 点击后立即关闭
});

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
    if (MarkDownObjectBody[Article_images][imageId]) {
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
            MarkDownObjectBody[Article_images][imageId] = ImageItem.wrap({
                data: base64Data,
                width: img.width,
                height: img.height
            });
            imageImportModalCtrl.close();
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


// #region --------------- 弹窗构造函数和使用 --------------- 

// 弹窗统一管理器
function createModal(config) {
    const { modal, onOpen, onClose, closeOnBg = true } = config;
    let isMouseDownOnBg = false;

    const open = () => {
        modal.classList.remove('hidden');
        if (onOpen) onOpen();
    };
    const close = () => {
        modal.classList.add('hidden');
        if (onClose) onClose();
    };

    if (closeOnBg) {
        modal.addEventListener('mousedown', (e) => { isMouseDownOnBg = e.target === modal; });
        modal.addEventListener('mouseup', (e) => {
            if (isMouseDownOnBg) close();
            isMouseDownOnBg = false;
        });
    }
    return { open, close };
}

// 图片导入弹窗
const imageImportModalCtrl = createModal({
    modal: imageImportModal,
    onOpen: () => imageImportForm.reset()
});

// 删除确认弹窗（带确认回调）
let pendingDeleteId = null;
const deleteConfirmCtrl = createModal({
    modal: deleteConfirmModal,
    onClose: () => { pendingDeleteId = null; }
});
function showDeleteConfirm(imageId) {
    pendingDeleteId = imageId;
    deleteConfirmMessage.textContent = `确定要删除图片 "${imageId}" 吗？删除后不可恢复。`;
    deleteConfirmCtrl.open();
}
function confirmDelete() {
    if (!pendingDeleteId) return;
    delete MarkDownObjectBody[Article_images][pendingDeleteId];
    renderImageGrid();
    updatePreview();
    alert('图片删除成功！');
    deleteConfirmCtrl.close();
}

// 修改ID弹窗
let pendingModifyId = null;
const modifyIdModalCtrl = createModal({
    modal: modifyIdModal,
    onClose: () => { pendingModifyId = null; modifyIdForm.reset(); }
});
function showModifyIdModal(imageId) {
    pendingModifyId = imageId;
    oldIdInput.value = imageId;
    newIdInput.value = '';
    modifyIdModalCtrl.open();
    newIdInput.focus();
}
function handleModifyIdSubmit(event) {
    event.preventDefault();
    const oldId = pendingModifyId;
    const newId = newIdInput.value.trim();
    if (!newId) return alert('请输入新ID');
    if (newId === oldId) return alert('新ID与原ID相同，无需修改');
    if (MarkDownObjectBody[Article_images][newId]) return alert('新ID已存在，请使用其他ID');
    MarkDownObjectBody[Article_images][newId] = MarkDownObjectBody[Article_images][oldId];
    delete MarkDownObjectBody[Article_images][oldId];
    renderImageGrid();
    updatePreview();
    alert(`图片ID已从 "${oldId}" 修改为 "${newId}"`);
    modifyIdModalCtrl.close();
}

// 配置弹窗
const settingsModalCtrl = createModal({ modal: settingsModal });

// 文章导入确认弹窗
let importedArticleData = null;
let importedArticleDataName = null;
let selectedImportOption = 'replace';
const articleImportConfirmCtrl = createModal({ modal: articleImportConfirmModal });

function showArticleImportConfirm() {
    confirmOptions.innerHTML = '';
    const options = [
        { id: 'replace', title: '替换当前内容', desc: '用导入的文章完全替换当前编辑器的内容（包括所有图片）', selected: true },
        { id: 'keep', title: '保留当前内容', desc: '不执行任何操作，保留当前编辑器的内容和图片', selected: false }
    ];
    options.forEach(option => {
        const optionDiv = document.createElement('div');
        optionDiv.className = `confirm-option ${option.selected ? 'selected' : ''}`;
        optionDiv.dataset.optionId = option.id;
        optionDiv.innerHTML = `<div class="option-title">${option.title}</div><div class="option-desc">${option.desc}</div>`;
        optionDiv.addEventListener('click', () => {
            document.querySelectorAll('.confirm-option').forEach(opt => opt.classList.remove('selected'));
            optionDiv.classList.add('selected');
            selectedImportOption = option.id;
        });
        confirmOptions.appendChild(optionDiv);
    });
    articleImportConfirmCtrl.open();  // 新增这一行
}

function hideArticleImportConfirm() {
    articleImportConfirmCtrl.close();
    importedArticleData = null;
    importedArticleDataName = null;
    selectedImportOption = 'replace';
}


// #endregion

// #region --------------- 14. 绑定事件监听器 --------------- 

// 滚动或窗口大小改变时关闭所有菜单，避免位置错乱
window.addEventListener('scroll', () => closeAllMenus(), true); // 捕获阶段，确保滚动时关闭
window.addEventListener('resize', () => closeAllMenus());

// 14. 绑定事件监听器

// 图片管理按钮点击事件
imageManageBtn.addEventListener('click', switchToImageManager);
backToEditBtn.addEventListener('click', switchToEditor);

// 导入图片弹窗
importImageBtn.addEventListener('click', () => imageImportModalCtrl.open());
cancelImportBtn.addEventListener('click', () => imageImportModalCtrl.close());
imageImportForm.addEventListener('submit', handleImageImport);

// 删除确认弹窗
cancelDeleteBtn.addEventListener('click', () => deleteConfirmCtrl.close());
confirmDeleteBtn.addEventListener('click', confirmDelete);

// 修改ID弹窗
cancelModifyBtn.addEventListener('click', () => modifyIdModalCtrl.close());
modifyIdForm.addEventListener('submit', handleModifyIdSubmit);

// #region --------------- 导出图片JSON功能 --------------- 




// #region --------------- 导出 --------------- 

// 新增：导出JSON功能
function exportImageJson() {

    //获得最新的文章体
    updateMarkDownObjectBody();

    // 检查是否有图片数据
    if (Object.keys(MarkDownObjectBody[Article_images]).length === 0) {
        alert('没有图片数据可以导出');
        return;
    }

    // 创建JSON字符串
    const jsonData = JSON.stringify(MarkDownObjectBody[Article_images], null, 2);

    getDateToURL(jsonData, `image-map-${new Date().toISOString().slice(0, 10)}.json`, "application/json");

    alert(`已导出 ${Object.keys(MarkDownObjectBody[Article_images]).length} 张图片的配置`);
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

                    const exists = MarkDownObjectBody[Article_images][key];
                    if (exists) overwritten++; else added++;

                    if (typeof value === 'string') {
                        // 旧版格式：异步获取宽高
                        convertPromises.push(new Promise((resolve) => {
                            const img = new Image();
                            img.onload = () => {
                                MarkDownObjectBody[Article_images][key] = ImageItem.wrap({
                                    data: value,
                                    width: img.width,
                                    height: img.height
                                });
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
                        MarkDownObjectBody[Article_images][key] = ImageItem.wrap(value);
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


// #endregion ------------------------------------------- 图盘管理 -------------------------------------------




// #region --------------- 导出文章JSON功能 --------------- 





// #region --------------- 1. 导出 --------------- 

/*
text/plain
text/markdown
application/json
*/

//下载函数
function getDateToURL(date, FileName, type = "text/plain") {
    // 创建Blob对象
    const blob = new Blob([date], { type });

    // 创建下载对象
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.display = "none";
    a.href = url;
    a.download = FileName;

    // 触发下载
    document.body.appendChild(a);
    a.click();

    // 清理
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}


// 1. 导出文章功能
function exportArticle() {
    try {

        //获得最新的文章体
        updateMarkDownObjectBody();


        const fileName = FileNameInput.value;
        const isMdFile = /\.md$/i.test(fileName); // 不区分大小写判断 .md 后

        if (isMdFile) {
            //简单警告一下。免得自己忘了。
            if (Object.keys(MarkDownObjectBody[Article_images]).length > 0) {
                const ok = confirm('当前文章包含离线图片，导出为 .md 会丢失图片数据。\n建议导出为 .json 保留完整数据。\n\n确定仍要导出为 .md 吗？');
                if (!ok) return;
            }
            // 导出纯文本...
            const markDownString = MarkDownObjectBody[Article_markdown];

            getDateToURL(markDownString, FileNameInput.value, "text/markdown");

        }
        else {
            // 转换为JSON字符串
            const jsonString = JSON.stringify(MarkDownObjectBody, null, 4);

            getDateToURL(jsonString, FileNameInput.value, "application/json");

            // (function(){
            //     const date = new Date();
            //     const dateString = date.toISOString().slice(0, 10);
            //     const timeString = date.toTimeString().slice(0, 8).replace(/:/g, '-');
            //     return `markdown-article-${dateString}_${timeString}.json`;
            // })()
        }


        alert(`文章导出成功！共包含 ${Object.keys(MarkDownObjectBody[Article_images]).length} 张图片`);

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
    input.accept = '.json,.md';

    input.onchange = function (e) {
        const file = e.target.files[0];
        if (!file) return;

        const fileName = file.name;
        const isMdFile = /\.md$/i.test(fileName); // 不区分大小写判断 .md 后

        const reader = new FileReader();

        reader.onload = function (e) {
            const content = e.target.result;
            //如果是md文件，则直接以纯文本方式导入
            if (isMdFile) {
                importedArticleData = {
                    [Article_markdown]: content,
                    [Article_images]: {}
                };
                importedArticleDataName = fileName;
                showArticleImportConfirm();
            }
            else {
                try {
                    const importedData = JSON.parse(content);
                    if (typeof importedData !== 'object' || importedData === null) throw new Error('无效的JSON格式');
                    if (!importedData[Article_markdown] || typeof importedData[Article_markdown] !== 'string') throw new Error(`文章格式错误：缺少 ${Article_markdown} 字段或格式不正确`);

                    // 保存导入的数据，显示确认弹窗
                    importedArticleData = importedData;
                    importedArticleDataName = fileName;
                    showArticleImportConfirm();
                } catch (error) {
                    // 仅当 JSON 解析语法错误时，当作纯文本导入（兼容把各种文件后缀搞混的情况）
                    if (error instanceof SyntaxError) {
                        importedArticleData = {
                            [Article_markdown]: content,
                        };
                        importedArticleDataName = fileName;
                        showArticleImportConfirm();
                    } else {
                        // 结构验证失败或其他错误，正常报错
                        console.error('解析文章文件失败:', error);
                        alert('导入失败：' + error.message);
                    }
                }
            }
        };

        reader.onerror = function () {
            alert('读取文件失败');
        };

        reader.readAsText(file);
    };

    input.click();
}

// #region --------------- 5. 执行导入操作 --------------- 

// 5. 执行导入操作
async function executeArticleImport() {
    if (!importedArticleData || selectedImportOption !== 'replace') {
        hideArticleImportConfirm();
        return;
    }

    try {
        // editor.value = importedArticleData[Article_markdown];

        // 处理图片映射对象，兼容旧版字符串格式
        const rawImages = importedArticleData[Article_images] || {};
        const newImageMap = {};
        const convertPromises = [];

        for (const [id, value] of Object.entries(rawImages)) {
            if (typeof value === 'string') {
                // 旧版格式：base64字符串，需要异步获取宽高
                convertPromises.push(new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => {
                        newImageMap[id] = ImageItem.wrap({
                            data: value,
                            width: img.width,
                            height: img.height
                        });
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
                newImageMap[id] = ImageItem.wrap(value);
            } else {
                console.warn(`图片ID "${id}" 格式无效，已跳过`);
            }
        }

        // 等待所有图片转换完成
        await Promise.all(convertPromises);
        importedArticleData[Article_images] = newImageMap;


        MarkDownObjectBody = Article.wrap(importedArticleData);


        editor.value = MarkDownObjectBody[Article_markdown];
        FileNameInput.value = importedArticleDataName;

        updatePreview();

        const imageCount = Object.keys(newImageMap).length;
        alert(`文章导入成功！\n内容长度：${importedArticleData[Article_markdown].length} 字符\n包含图片：${imageCount} 张`);
        hideArticleImportConfirm();
    } catch (error) {
        console.error('执行导入失败:', error);
        alert('导入失败：' + error.message);
    }
}


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

    // Ctrl+"=" | Ctrl+"-" 增减文本大小 (Windows/Linux)
    // Cmd+"=" | Cmd+"-" 增减文本大小 (Mac)
    //因为"+"是需要按shift才能触发的，如果硬要编码为"+"很反人类也蠢，所以就理解上理解成加号算了
    if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '-') && !e.shiftKey) {
        e.preventDefault();
        if (e.key === '=') increaseFontSize();
        else decreaseFontSize();
    }

    // Ctrl+Q 反转主体 (Windows/Linux)
    // Cmd+Q 反转主体 (Mac)
    if ((e.ctrlKey || e.metaKey) && e.key === 'q' && !e.shiftKey) {
        e.preventDefault();
        toggleTheme();
    }

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
    previewModeRadios.forEach(radio => {
        if (radio.value === 'edit' && renderSettings.isDistribution === false) radio.checked = true;
        else if (radio.value === 'dist' && renderSettings.isDistribution === true) radio.checked = true;
    });
    rendererRadios.forEach(radio => {
        if (radio.value === RendererVersion.PRIMITIVE && RendererVersion.PRIMITIVE === MarkDownObjectBody[Article_format]) radio.checked = true;
        else if (radio.value === RendererVersion.ADVANCED && RendererVersion.ADVANCED === MarkDownObjectBody[Article_format]) radio.checked = true;
        else if (radio.value === RendererVersion.CORRELATION_DIAGRAM && RendererVersion.CORRELATION_DIAGRAM === MarkDownObjectBody[Article_format]) radio.checked = true;
    });
    settingsModalCtrl.open();  // 原为 settingsModal.classList.remove('hidden')
}

function hideSettingsModal() {
    settingsModalCtrl.close();  // 原为 settingsModal.classList.add('hidden')
}

// 保存配置设置
function saveSettings() {
    // 获取选中的值
    let selectedMode = 'edit';
    let rendererMode = RendererVersion.ADVANCED;
    previewModeRadios.forEach(radio => {
        if (radio.checked) selectedMode = radio.value;

    });
    rendererRadios.forEach(radio => {
        if (radio.checked) rendererMode = radio.value;
    });

    // 更新配置对象
    renderSettings.isDistribution = (selectedMode === 'dist');
    MarkDownObjectBody[Article_format] = rendererMode;

    // 更新预览以应用新配置
    updatePreview();

    // 关闭弹窗
    hideSettingsModal();

    // 可选：提示用户
    console.log('预览模式已切换为：', renderSettings.isDistribution ? '发行版' : '编辑版');
    console.log('渲染模式已切换为：', MarkDownObjectBody[Article_format]);
}

// #region --------------- 0. 绑定事件监听器 --------------- 

settingBtn.addEventListener('click', showSettingsModal);
cancelSettingsBtn.addEventListener('click', () => settingsModalCtrl.close());
saveSettingsBtn.addEventListener('click', saveSettings);