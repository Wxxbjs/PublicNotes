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
const previewMode_Radios = document.querySelectorAll('input[name="previewMode"]');
const rendererMode_Radios = document.querySelectorAll('input[name="rendererMode"]');
const nonReleaseNotes_Radio = document.querySelector('input[name="nonReleaseNotes"]');
const offlineImageLoading_Radio = document.querySelector('input[name="offlineImageLoading"]');

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
const Article_base_size = "base_size";
const Article_configuration = "configuration";

//描述渲染器版本的对象
const RendererVersion = {
    PRIMITIVE: "PRIMITIVE",// 原始/传统渲染器，没有任何特殊语法，完全兼容主流md文件与渲染
    ADVANCED: "ADVANCED",// 进阶/全新渲染器，本人目前持续维护的版本，很多文档文章都基于这个编写和渲染
    CORRELATION_DIAGRAM: "CORRELATION_DIAGRAM"// 还处于幻想阶段的一种图性渲染器，基于进阶渲染器的设计哲学，但改变了知识间的关联方式，目前没有任何进展
};

// 渲染配置对象
const renderSettings = {
    isDistribution: false,  // 默认编辑版（显示注释）
    pdNonReleaseNotes: true,
    pdOfflineImageLoading: true,
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
    static serializable = [Article_markdown, Article_images, Article_format, Article_base_size, Article_configuration];

    constructor(props) {
        super(props);
        //字段自动补全
        if (!(Article_format in this)) this[Article_format] = RendererVersion.ADVANCED;
        if (!(Article_images in this)) this[Article_images] = {};
        if (!(Article_base_size in this)) this[Article_base_size] = { image: 14 };
        if (!(Article_configuration in this)) this[Article_configuration] = {};
    }

    // #region --------------- Markdown转义器 --------------- 

    // 将自定义Markdown的语法转换为可渲染html
    // markdown 文章主体，imgs图片元数据（图片ID映射图片元数据）
    CreateRenderableHTMLfromMarkdown(setting = {}) {

        if (!marked) return "";

        // 临时渲染配置解析
        const _isDistribution = setting?.isDistribution ?? false;
        const _pdNonReleaseNotes = setting?.pdNonReleaseNotes ?? true;
        const _pdOfflineImageLoading = setting?.pdOfflineImageLoading ?? true;
        const _RendererVersion = this[Article_format] ?? RendererVersion.ADVANCED;

        //数据读取与处理
        let markdown = this[Article_markdown] ?? "";
        const base_img_size = this[Article_base_size]?.image ?? 14;
        const imgs = this[Article_images] ?? {};

        // 进阶渲染器的独特设计
        if (_RendererVersion === RendererVersion.ADVANCED) {

            // 1. 引入自定义语法 [!note]文本[/!note]
            // 根据配置，自行选择注释去向
            if (_pdNonReleaseNotes) (function () {

                function replace(str, L, R, str2) {
                    return str.slice(0, L) + str2 + str.slice(R + 1);
                }

                const PrefixString = "[!note]";
                const SuffixString = "[/!note]";
                const stack = [];

                let i = 0;
                let newI = 0;
                while (i < markdown.length) {
                    if (markdown.slice(i, newI = i + PrefixString.length) === PrefixString && markdown[i - 1] !== "\\") {
                        stack.push({
                            startIdx: i,
                            textStartIdx: newI
                        });
                        i = newI;
                    }
                    else if (markdown.slice(i, newI = i + SuffixString.length) === SuffixString && markdown[i - 1] !== "\\" && stack.length) {
                        const { startIdx, textStartIdx } = stack[stack.length - 1];
                        stack.pop();
                        //区间索引，闭区间
                        //[ startIdx , textStartIdx , textEndIdx , endIdx ]
                        const textEndIdx = i - 1;
                        const endIdx = newI - 1;
                        //我觉得note标签应该可以独占一行，而不是影响换行文档流，不然写文档很难受。
                        //所以我最多在文本标签内部首尾都各自吞下一个换行
                        //为了视觉上看起来像把这一整块注释语法移除，那么要求换行符做特殊处理
                        //考虑到换行符是立即指令，所以将在后缀标签后面最多删除一个换行
                        /*
                        思考。
                        非发行版注释，当且仅当 单个标签 的 严格前一个文本和严格后一个文本 都为换行符号才删掉其中一个换行
                        发行版注释，当前仅当 前后标签以及包裹文本 这整个整体 的 严格前一个文本和严格后一个文本 只要为换行符号就删除
                        这个策略的排版就非常友好
                        注意，不能简化为一个简单的删除（不分开讨论发行版），因为前者最多有两个文本，后者最多有一个文本
                        一个原因是发行版注释全部剔除注释内容有硬性操作的语义，所以删整块理念就有略微区别
                        */
                        let replaceL = startIdx;
                        let replaceR = endIdx;
                        let sliceTextL = textStartIdx;
                        let sliceTextR = textEndIdx;
                        //注释内容最前面换行了，而且文本字符串最前面必须是换行（或者发行版），才能删除，且得是换行符
                        const pdL = markdown[replaceL - 1] === "\n", pdR = markdown[replaceR + 1] === "\n";
                        let delLpd = false, delRpd = false;
                        //发行版
                        if (_isDistribution) {
                            if (pdL && pdR) delLpd = true;
                            //注释内容最末尾换行了，而且在发行版（否则只能在后缀字符串末尾开始的第一个字符是换行符号的情况下），才能删除，且得是换行符
                            if (pdR && markdown[replaceR + 2] === "\n" && (!delLpd || delLpd && markdown[startIdx - 2] === "\n")) delRpd = true;
                        }
                        //非发行版
                        else {
                            if (pdL && markdown[textStartIdx] === "\n") delLpd = true;
                            if (pdR && markdown[textEndIdx] === "\n") delRpd = true;
                        }
                        if (delLpd) --replaceL;
                        //注释内容最末尾换行了，而且在发行版（否则只能在后缀字符串末尾开始的第一个字符是换行符号的情况下），才能删除，且得是换行符
                        if (delRpd) ++replaceR;
                        const text = _isDistribution ? "" : markdown.slice(sliceTextL, sliceTextR + 1);
                        markdown = replace(markdown, replaceL, replaceR, text);
                        i = newI - (replaceR - replaceL + 1) + text.length;
                    }
                    else ++i;
                }

                // markdown = markdown.replace(/[^\\]\[!note\](((?![^\\]\[!note\])[\s\S])*?)[^\\]\[\/!note\]/g, (_, a) => {
                //     if (_isDistribution) return "";
                //     a = a.slice(a[0] === "\n", a.length - (a[a.length - 1] === "\n"));
                //     return a;
                // });

                //将残留注释的破坏性转义字符串删掉
                markdown = markdown.replace(/\\\[!note\]/g, (_) => {
                    return _.slice(1);
                });
                markdown = markdown.replace(/\\\[\/!note\]/g, (_) => {
                    return _.slice(1);
                });

            })();

            // 2. 引入自定义语法 ![自定义图片名](quote:图片ID)
            // 匹配之后，获取两个参数，图片ID用imgs查找对应图片的元数据
            if (_pdOfflineImageLoading) (function () {
                markdown = markdown.replace(/!\[(.*?)\]\(quote:(.*?)\)/g, (match, arg, ID, hh = "") => {
                    let str1 = "";
                    let str2 = "";
                    const arr = arg.split("|");
                    let newName = arr?.[0] ?? "";
                    let newSize = arr?.[1] ?? "100%";
                    if (imgs[ID] && newSize) {
                        imgs[ID] = ImageItem.wrap(imgs[ID]);
                        const imgObj = imgs[ID];
                        //修正newSize
                        if (newSize.at(-1) === "%") newSize = newSize.slice(0, newSize.length - 1);
                        newSize = (+newSize || 100) / 100;
                        // 计算缩放后的宽度
                        // 修复：当字段缺无非计算百分比时，默认把 width 当成 10基准单位 进行缩放（宽高比当成了1:1）
                        // 待修复，因为图片的宽高是外部单位，必然需要定义单位的转换，应当定义
                        // 为避免出现之前将常量定义到编辑器给不同的渲染与编辑基准打架留下空子，此基准应当和内敛到文章，编辑器图片基准放到配置界面以供修改
                        // 这下可行，因为现在所有文章都默认存储着自己的率，默认以之前 14 单位做兼容填充
                        // 大概表达式：base-size * S * ( width / const-base-size )
                        // 其中 width 是图片宽度，是纯数字，const-base-size 也是纯数字，base-size是文本基准
                        // 物理意义：
                        // 将width的纯比例通过整篇文章下固定的 const-base-size 做比率转换，计算出这张图片在“逻辑单位”下有多少个“基准格”
                        // S 则是参数语法掺进来的临时缩放修正
                        // 而最终具有实际意义的 base-size 才是基准单位
                        const safeWidth = Object.prototype.hasOwnProperty.call(imgObj, "width") ? imgObj.width : 450;
                        const safeDiv = safeWidth / base_img_size;//基准格数量
                        const safeS = newSize * safeDiv;
                        return `${str1}<img src="${imgObj.getBlobUrl()}" alt="${newName}" style="--len: calc( var(--base-font-size) * ${safeS} ) ;--max-len: 100cqw ;height: auto; width: min( var(--len) , var(--max-len) ) ;margin: calc( min( ( 5 / 7 ) * var(--base-font-size) , var(--max-len) ) ) 0;">\n${str2}`;
                        // return `${str}<img src="${imgObj.data}" alt="${newName}" style="width: calc(var(--base-font-size) / var(--const-base-font-size) * ${newSize} / 100 * ${imgObj.width}px ); height: auto;">\n`;
                    }
                    return "";
                });
            })();
        }

        // const customRenderer = new marked.Renderer();
        // customRenderer.space = function (token) {
        //     const newlineCount = (token.raw.match(/\n/g) || []).length;
        //     return '<br>'.repeat(newlineCount);
        // };

        let html = null;

        if (_RendererVersion === RendererVersion.ADVANCED) {
            setExtensionsPD(emptyLinesExtension, true);
            html = marked.parse(markdown, {
                breaks: true, // 单个\n渲染为<br>，多行文本按换行显示
                // renderer: customRenderer,
            });
        }
        else if (_RendererVersion === RendererVersion.PRIMITIVE) {
            setExtensionsPD(emptyLinesExtension, false);
            html = marked.parse(markdown, {
                breaks: false,// 回归传统模式（单轮parse会覆盖全局的use）
                // extensions: []
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
                    if (lang && hljs.getLanguage(lang)) highlighted = hljs.highlight(codeText, { language: lang }).value;
                    else highlighted = hljs.highlightAuto(codeText).value;
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
    // [Article_format]: RendererVersion.ADVANCED,
    // [Article_images]: {},
    // [Article_configuration]: {}
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
- 提供配置管理

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
该语法是最高级语法，比任何标签、Markdown语法都优先（原理是直接操作字符串，不考虑其他语法）
如果你的确需要写成类似字面量形式，则建议用反斜杠转移其中的字符，破坏语法规则即可，类似 \`\\\\[!note]\` 
可能需要注意“截断”注释内容以后，会不会影响文档的渲染
此外，**注释的嵌套是支持的，一层对应的注释语法只会对应其一层的内容**，
未找到对应匹配的、残留的 \\[!note] 和 \\[/!note] 不会被认为是有效的注释语法，但是请使用转移字符破坏注释语法，而不是依赖残留
隐藏或显示取决于渲染器的配置，但根据功能的定位：
在正式发行时，需配置渲染器进行隐藏
在平时编辑时，不需要配置渲染器进行隐藏

特别的，
如果你需要使用类似 \\\\\\[!note] 或 \\\\\\[/!note] 的纯字符串在正常的文档流中，则需要写成 \`\\\\\\\\[!note]\` 或 \`\\\\\\\\[/!note]\` 的格式在文档数据中

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
这样编辑时不用特别区分文章的发行版本和编辑版本，读者也再不用陷入“笔记地狱”

## 技术栈 / 黑话 / 标准 / 理念 / 隐藏功能
以下的标准、理念一般只适用于 进阶渲染模式 
### 缩放 / 基准单位 -> 逻辑单位标准
基于文档内容同时缩放的理念，一般文本、图片、元素大小都应该和预览大小同比缩放（即使因为父元素给子元素限高，底层也应该有这种意识）
因此，早期采用 硬编码进内核的常量单位+基准单位 通过计算基准前后的缩放比值来解决图片缩放的问题，期间甚至还用 zoom 属性来强制缩放元素
但一个明显的问题是 内核的常量单位 一旦变动，就会导致图片的大小可能受到影响、失控
原因是因为我们以单位之间变化的比值来影响整体的缩放，而比值却与两个量有关
为解决这个问题，很自然的可以想到：
既然图片的长宽是外部单位，就必须定义逻辑单位算出纯数量的基准格数，才能与基准单位做乘法
而后图片、元素**应当只以基准单位成倍缩放较固定的系数**
这样即可以完美解决这个问题，也符合理念
硬编码进内核的 \`--const-base-font-size\` 现已经被弃用
文档布局采用 \`--base-font-size\` 为基准单位，同时也是文本默认的单位，带有大小缩放百分比的图片（参数语法）则将采用 \`weith: calc(var(--base-font-size) * \${百分比} * \${基准格数量} );\` 的算法计算图片大小
（注意：底层配置只能对width操作、height设为auto，根据理念、受限于技术，其实只有width才能做限制；但是做了转化，其实看起来和height一样）
同时加入非必要配置子段：逻辑单位配置对象，
为向下兼容，图片的逻辑单位将默认填充为 \`14\`（之前的硬编码的值）

当然，文档元数据的html的style也是可以访问 \`--base-font-size\` 的，也可以使用 \`1em\` 来写，效果和 \`var(--base-font-size)\`相同 ，因为内核将渲染元素配置了 \`font-size: var(--base-font-size);\`
可以写一些好玩的东西，比如居中元素：

<div class="centerElement" align="center" style="max-width:clamp(50em,75%,65em);">
    <strong>居中文本</strong>
</div>

<style>
.centerElement{
    background-color:#ddd;
}
.dark-mode .centerElement{
    background-color:#444;
}
</style>
\`\`\`
<div class="centerElement" align="center" style="max-width:clamp(50em,75%,65em);">
    <strong>居中文本</strong>
</div>

<style>
.centerElement{
    background-color:#ddd;
}
.dark-mode .centerElement{
    background-color:#444;
}
</style>
\`\`\`

### style样式表
虽然你可以通过写入style来反过来用文章元数据“定制”编辑器已有界面的元素样式
这甚至是某种天然的插件。
扯远了。
#### 亮色暗色主体适配
\`.dark-mode\` 类名在暗色模式下 boby 会具有该类名，而亮色模式下则没有该类名，无论是编辑器还是渲染器
可以为元素编写适配亮色暗色主题的样式表，
而文本、列表、代码等元素的颜色、背景色会默认提供配置主题配色
一般div、p、span元素的背景色、边框色需要手动配置
#### 通过CSS变量提供派生色（部分实装）
考虑到各种颜色混在一块，语义不清等问题，将考虑CSS变量派生颜色、为颜色命名以保证可读性、可维护性
也方便文档写style时取色
这样抽象的好处不仅仅是结构和着色分离，更是将颜色主体的问题一并解决了
原本要给每一个元素写 \`.dark-mode\` ，如果只做到把结构和着色分离，还是很容易导致颜色是离散的
而抽象成CSS变量，就只需要在着色CSS里配置元素采用什么配色，而只需要对CSS变量整体配置某体模式下的主体配色，即可实现主题互切，
这样就非常解耦了
不过目前只把完全相同颜色系统一使用同一CSS派生，但未考虑到实际的语义、意义，可能对自定义不是很友好，未来尝试解决

## 文章元数据与渲染 [ 标准 ]
对于离线图片（实则内联到文章数据）对象，除了必要的图片数据属性（data），还应当内联 height 和 width
不管未来的标准、渲染实现是否使用了height、width，文档写法应该严格提供 height 和 width ，避免内核改更时渲染子段缺失带来的问题

根据理念：
- 存储层（JSON 文件）：存纯数据（图片元数据Base64 + 元数据）。
- 数据模型层（Struct / ImageItem）：负责校验、清洗、序列化。
- 渲染层（CreateRenderableHTMLfromMarkdown）：纯函数，只消费数据、返回结果，一般不生产数据（极少能力可行的情况下才考虑干涉）。

简单的说：
你可以将文档导入到编辑器中，现在非必要字段缺失并不会报错，而是会考虑把文档标准化，此时再导出的文档就是符合标准的
而后就可以快快乐乐的把该文档原数据塞到纯渲染架构里，而不用担心渲染报错

以后将提供（或者抽象出）纯“洗数据”的架构，这样不仅仅有纯渲染层可以单独拿出来玩玩，还有文档标准化层可以拿出来给脚本玩玩
挺好玩的我觉得。

必要字段目前很少，而且可能还有很多需要定义的字段类型，一般来说：
- 可以从某一数据解读出来的属性（无论是同步还是异步），就不是必要字段（也称属性字段）
- 如果某一属性可以影响渲染、语法等效果层，且存在至少一种方案（或者默认方案），那也不是必要字段（也称配置字段）（但配置字段缺失、不明确可能导致一些麻烦但不致命的问题）
- 剩下的，如果并不是主要内容，而是需要手动引入、导读，通过在某些主内容中编写语法引用以实例化，但可能出现缺失的问题，那么也不是必要字段（也称资源字段）
- 否则就是必要字段（也称数据字段）

一般来说：
- 数据字段缺失需要显式提醒用户，“断舍离”会比较激进（如 \`markdown\` 字段）
- 配置字段缺失可以用 默认值/方案默认 暂时填充，一般不建议报错，但仍然需要规范、用默认值填充向下兼容（比如硬编码某个配置，且确实遇到了一些可能的问题，则可以考虑抽象成配置字段，\`base_size\` 字段就是这么来的）
- 资源字段可以将渲染默认填充内容，或者就防着不管，让游览器自己决定（比如 \`images\` 字段）
- 属性字段缺失可能导致渲染层理论上可以解读，但是无法以可容忍的代价给出本应该正确的结果，一般需要防御性编程，也不报错（比如图片对象的 \`width\` 和 \`height\` 字段）

## 其他
踩过坑以后，现在内核基本打算往结构css和着色css分离上靠，还预抽象颜色、用CSS变量派生来解决一些维护、开发上的问题`;

// 关键：更新预览的函数
let updatePreview = function () {
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

let previewDebounceTimer = null;
let previewFrameId = null;
let pendingRender = false;

editor.addEventListener('input', () => {
    updateMarkDownObjectBody();

    // 防抖依然保留（避免高频计算）
    clearTimeout(previewDebounceTimer);
    previewDebounceTimer = setTimeout(() => {
        pendingRender = true;
        if (!previewFrameId) {
            previewFrameId = requestAnimationFrame(() => {
                if (pendingRender) {
                    preview.innerHTML = MarkDownObjectBody.CreateRenderableHTMLfromMarkdown(renderSettings);
                    pendingRender = false;
                }
                previewFrameId = null;
            });
        }
    }, 100); // 更短的防抖 + rAF 保证不丢帧
});


// #endregion --------------- 针对性定制 --------------- 








// #region --------------- 依赖 --------------- 


const clamp = function (A = -Infinity, n, B = Infinity) { return Math.min(Math.max(Math.min(A, B), n), Math.max(A, B)) };


// #endregion --------------- 依赖 --------------- 





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

    const MAX_XD = 20;

    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const mouseX = e.clientX - containerRect.left;
    const percentage = clamp(MAX_XD, mouseX / containerWidth * 100, 100 - MAX_XD);

    leftIDE.style.right = `${100 - percentage}%`;
    rightIDE.style.left = `${percentage}%`;
    resizer.style.left = `${percentage}%`;
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
                <div style="font-size: calc(4em * 6 / 7); margin-bottom: 10px; opacity: 0.5;">📷</div>
                <div>暂无图片</div>
                <div style="font-size: calc(1em * 6 / 7); margin-top: 5px; opacity: 0.7;">点击任意空白处或"导入图片"按钮添加图片</div>
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
imageGrid.addEventListener('click', e => {
    const menuBtn = e.target.closest('.menu-btn');
    if (!menuBtn) return;
    e.stopPropagation();
    console.log(e);
    const imageItem = menuBtn.closest('.image-item');
    if (!imageItem) return;
    const imageId = imageItem.dataset.imageId;
    closeAllMenus();
    // 如果菜单已打开且是针对同一图片，则单纯关闭，否则就打开
    if (globalMenu.style.display !== "block" || currentHoverImageId !== imageId || isMenuOpen) showMenuForImage(imageId, menuBtn, imageItem);
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

    return item;
}

// 方式一：委托（推荐）
globalMenu.addEventListener("click", e => {
    const action = e.target.closest(".menu-item")?.dataset.action;
    if (!action || !currentHoverImageId) return;
    e.stopPropagation();
    if (action === "modify") showModifyIdModal(currentHoverImageId);
    else if (action === "delete") showDeleteConfirm(currentHoverImageId);
    closeAllMenus();
    // 点击后立即关闭
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

    //打开行为
    const open = function () {
        modal.classList.remove("hidden");
        if (onOpen) onOpen();
    };
    //关闭行为
    const close = function () {
        modal.classList.add("hidden");
        if (onClose) onClose();
    };

    //点击背景也关闭的选项，默认开启
    if (closeOnBg) {
        modal.addEventListener("mousedown", e => { isMouseDownOnBg = e.target === modal; });
        modal.addEventListener("mouseup", e => {
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

// 空白界面
imageManagerIDE.querySelector(".image-grid-container").addEventListener("click", e => {

    // if (Object.keys(MarkDownObjectBody[Article_images]).length === 0)
        if (!e.target.closest('.image-item') && !e.target.closest('.menu-btn') && !e.target.closest('.menu-dropdown'))
            // closeAllMenus();
            if (!isMenuOpen)
                imageImportModalCtrl.open();
});

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

// 清洗：处理图片映射对象,兼容旧版字符串格式（异步模块）
// obj是数据，oldObj是对比，若没则直接返回清晰后的数据，若有则返回{added,overwritten,value}对象，value则是清洗数据
async function readImages(obj, oldObj) {

    let isdiff = !!oldObj;
    let exists = false;
    let added = 0;
    let overwritten = 0;
    const rawImages = obj ?? {};
    const oldImages = oldObj;
    const newImageMap = {};
    const convertPromises = [];

    // 处理图片映射对象，兼容旧版字符串格式
    for (const [ID, value] of Object.entries(rawImages)) {
        const isValidImageString = typeof value === 'string' && value.startsWith('data:image');
        const isValidImageObject = value && typeof value === 'object' && typeof value.data === 'string' && value.data.startsWith('data:image');

        if (isdiff) {
            if (exists = oldImages[ID]) ++overwritten;
            else ++added;
        }

        if (isValidImageString) {
            // 旧版格式：base64字符串，需要异步获取宽高
            convertPromises.push(new Promise(resolve => {
                const img = new Image();
                img.onload = () => {
                    newImageMap[ID] = ImageItem.wrap({
                        data: value,
                        width: img.width,
                        height: img.height
                    });
                    resolve();
                };
                img.onerror = () => {
                    if (isdiff) {
                        if (exists = oldImages[ID]) --overwritten;
                        else --added;
                    }
                    console.warn(`图片ID "${ID}" 加载失败，将跳过该图片`);
                    resolve();
                };
                img.src = value;
            }));
        }
        // 新版格式：直接使用
        else if (isValidImageObject) newImageMap[ID] = ImageItem.wrap(value);
        else {
            if (isdiff) {
                if (exists = oldImages[ID]) --overwritten;
                else --added;
            }
            console.warn(`图片ID "${ID}" 格式无效，已跳过`);
        }
    }

    // 等待所有图片转换完成
    await Promise.all(convertPromises);

    if (isdiff) return { value: newImageMap, added, overwritten };
    else return newImageMap;
}

// 新增：导入图片JSON功能
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
                if (typeof importedData !== "object" || importedData === null) throw new Error("无效的JSON格式");

                const obj = await readImages(importedData, MarkDownObjectBody[Article_images]);
                MarkDownObjectBody[Article_images] = obj.value;

                renderImageGrid();
                updatePreview();

                let message = "导入完成！\n";
                if (obj.added) message += `新增图片: ${added}\n`;
                if (obj.overwritten) message += `覆盖图片: ${overwritten}`;
                alert(message);
            }
            catch (error) {
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
    // document.body.appendChild(a);
    a.click();

    // 清理
    // setTimeout(() => {
    // document.body.removeChild(a);
    URL.revokeObjectURL(url);
    // }, 0);
}


// 1. 导出文章功能
function exportArticle() {
    try {

        //获得最新的文章体
        updateMarkDownObjectBody();

        const fileName = FileNameInput.value;
        const isMdFile = /\.md$/i.test(fileName); // 不区分大小写判断 .md 后缀

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
        const isMdFile = /\.md$/i.test(fileName); // 不区分大小写判断 .md 后缀

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
                    if (typeof importedData !== "object" || importedData === null) throw new Error("无效的JSON格式");
                    if (!importedData[Article_markdown] || typeof importedData[Article_markdown] !== "string") throw new Error(`文章格式错误：缺少 ${Article_markdown} 字段或格式不正确`);

                    // 保存导入的数据，显示确认弹窗
                    importedArticleData = importedData;
                    importedArticleDataName = fileName;
                    showArticleImportConfirm();
                }
                catch (error) {
                    // 仅当 JSON 解析语法错误时，当作纯文本导入（兼容把各种文件后缀搞混的情况）
                    if (error instanceof SyntaxError) {
                        importedArticleData = {
                            [Article_markdown]: content,
                        };
                        importedArticleDataName = fileName;
                        showArticleImportConfirm();
                    }
                    else {
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
        importedArticleData[Article_images] = await readImages(importedArticleData[Article_images]);

        MarkDownObjectBody = Article.wrap(importedArticleData);

        editor.value = MarkDownObjectBody[Article_markdown];
        FileNameInput.value = importedArticleDataName;

        updatePreview();

        alert(`文章导入成功！\n内容长度：${importedArticleData[Article_markdown].length} 字符\n包含图片：${Object.keys(importedArticleData[Article_images]).length} 张`);
        hideArticleImportConfirm();
    }
    catch (error) {
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


// 解耦了。但是命名的有点不太好。
//
// 呸。
// 解耦了啥。耦合了。
// 现在完蛋了，搞出了单选没有搞出开关项。
// 这抽象是何意味。


//kvs是从选项映射到实际配置的数据的Map对象，可以只对kv组写一项，默认自映射，如果没有对应映射返回原式数据
class SingleChoiceRadiosNpmClass {
    constructor(obj, funcs = [], kvs = []) {
        funcs = Array.isArray(funcs) ? funcs : [funcs];
        this.object = obj;
        if (typeof funcs[0] === "function") this.set = function (value) { return funcs[0].call(this, this.input.get(value) ?? value) };
        if (typeof funcs[1] === "function") this.get = funcs[1], this.match = function (radio) { return (this.input.get(this.getRadioValue(radio)) ?? this.getRadioValue(radio)) === this.get(); };
        this.input = new Map(kvs.map(kv => kv.length == 1 ? [kv[0], kv[0]] : kv));
        this.type = this.object[0].type;
    }
    getRadioValue(radio) {
        return this.type === "checkbox" ? radio.checked : radio.value;
    }
}

const SingleChoiceRadiosNpmObjects = [
    //渲染模式
    new SingleChoiceRadiosNpmClass(
        rendererMode_Radios,
        [
            (value) => MarkDownObjectBody[Article_format] = value,
            () => MarkDownObjectBody[Article_format]
        ],
        [
            [RendererVersion.PRIMITIVE],
            [RendererVersion.ADVANCED],
            [RendererVersion.CORRELATION_DIAGRAM]
        ]
    ),
    //预览模式
    new SingleChoiceRadiosNpmClass(
        previewMode_Radios,
        [
            (value) => renderSettings.isDistribution = value,
            () => renderSettings.isDistribution,
        ],
        [
            ["edit", false],
            ["dist", true]
        ]
    ),
    //语法（疑似语法糖演示）
    //注释
    new SingleChoiceRadiosNpmClass(
        [nonReleaseNotes_Radio],
        (value) => renderSettings.pdNonReleaseNotes = value,
        // [[false],[true]]
    ),
    //离线图片
    new SingleChoiceRadiosNpmClass(
        [offlineImageLoading_Radio],
        (value) => renderSettings.pdOfflineImageLoading = value,
        // [[false],[true]]
    )
];

//显示配置弹窗
function showSettingsModal() {
    for (const SingleChoiceRadiosNpmObject of SingleChoiceRadiosNpmObjects) {
        const SingleChoiceRadiosObject = SingleChoiceRadiosNpmObject.object;
        SingleChoiceRadiosObject.forEach(radio => {
            if (SingleChoiceRadiosNpmObject.type !== "checkbox") radio.checked = SingleChoiceRadiosNpmObject.match(radio);
        });
    }
    settingsModalCtrl.open();
}

function hideSettingsModal() {
    settingsModalCtrl.close();
}

// 保存配置设置
function saveSettings() {
    for (const SingleChoiceRadiosNpmObject of SingleChoiceRadiosNpmObjects) {
        const SingleChoiceRadiosObject = SingleChoiceRadiosNpmObject.object;
        // 获取选中的值，默认值先填充为第一个
        let res = [...SingleChoiceRadiosNpmObject.input.keys()][0] ?? SingleChoiceRadiosNpmObject.getRadioValue(SingleChoiceRadiosObject[0]);
        SingleChoiceRadiosObject.forEach(radio => {
            if (radio.checked) res = SingleChoiceRadiosNpmObject.getRadioValue(radio);
        });
        // 更新配置对象
        SingleChoiceRadiosNpmObject.set(res);
    }

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