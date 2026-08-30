# 前言
这些接口和解释、定义实际上远远不够。
而且很多语境都缺失了，~~又不是 动态积木V0扩展 源码的那些特定的上下文~~
某些词莫名其妙的。
根本不像核心调度解析，大哭。（）
就当是个人笔记吧嗯对。[!note]反正之前核心调度解析文章也只是我的个人手稿。[/!note]
建议去看我的 动态积木V0扩展 ，去看看注释啥的，调一调、拿到TurboWarp里玩一玩，或者对着看一看。
别硬读。

## Blockly接口
（这里的this默认是一个blockly内部的block实例）
[!note]
注意了，我讨厌混淆“输入积木”和“输入对象”
实际上这是我认为blockly最不好的设计之一
你一定要理解“组”和“基本元”的概念
而不是以输入为术语。
这很不好。
[/!note]输入是附着在 组 上的表现形式，而不是 组 对象本来的样子
因为 组 对象完全可以不代表任何一个输入，只是绑定若干“基元”的抽象组
所以不要看着 input 就理解成输入
我称为 组论（元组论，不过目前只称为组）
完整的 input 对象就称为一个组，旗下的 field 对象则是构成组的基元。
或者说字段。（废话）
field 实例有很多类型，感兴趣可以自己玩玩

### this.inputList[x]
存储每个组的信息

特点：Blockly认为积木是以组进行划分的，文本只是组的**前置**修饰（存储到this.inputList[x].fieldRow这个数组里）
特别的，比如形如 `a [A] b [B] c [C] …… y [Y] z`的积木在扩展配置时的 text
blockly是这样组织的：
```js
this.inputList=[
    { name : "A" , fieldRow : [ { name : undefined , text : "a" } ] },
    { name : "B" , fieldRow : [ { name : undefined , text : "b" } ] },
    { name : "C" , fieldRow : [ { name : undefined , text : "c" } ] },
    ……
    { name : "Y" , fieldRow : [ { name : undefined , text : "y" } ] },
    { name : "" , fieldRow : [ { name : undefined , text : "z" } ] },
];
```
没错
blockly对原生的组织策略是：文本塞到右边的输入框元素（ [] 的东西）里，组成一个组，如果没有右边的输入框元素，则以**空字符串**为名字创建一个组

### this.getInput(str);
获取组对象，依据 name 字段

### this.appendValueInput(str)
创建组对象并追加到积木构造数组中，依据 str 字段，变成对象的 name 字段
注意这是一个有 实例 输入对象 的组

### input.setCheck('Boolean');
没太懂，但是这应该是显示声明这个组为boolean（布尔）输入框，且不带任何积木、阴影积木

### input.insertFieldAt(0,str, null);
在组中插入文本，目前看起来不需要在乎0和null，因为一般也就一个输入对一个文本。

###  this.appendDummyInput(str)
一般这样用即可
```js
 this.appendDummyInput(str)
    .appendField(obj)
    .appendField(obj);
    ……
```
表示绑定obj们到一个str子段的组
组此时就是一个占位的东西，不具备实际作用，不是任何有效输入积木
纯为了分组而提供的抽象类

### this.moveInputBefore(str1,str2);
移动
当str2为无效值，str1组将移动到最后面
当str2为有效值，str1组将移动到参照组（str2）的前面

### this.removeInput(str)
删除组（组内所有元素都会爆炸）

### this.moveNumberedInputBefore(idx1,idx2)
将 idx1 的组插入到 idx2 的组的前面
注意这个接口是索引，不是组名
但是Blockly不提供查询组的索引的功能
所以得自己手搓，这是如下是一种写法：
```
function getInputIndex(block, name) {
    const idx = block.inputList.findIndex(input => input.name === name);
    if (idx === -1) throw new Error(`Input "${name}" not found`);
    return idx;
}
//调用
getInputIndex(block,str);
```

### input.removeField(undefined)
删除组下原生组织出来的文本
进价版本：input.removeField(str)
删除 name 字段为 str 的 Field 对象

### 注意
上文提到的“原生”、“原生组织”，就是扩展的标准写法时的组织策略（如配置积木时写text）
不适用于特别针对blockly内核的特别扩展行为。比如动态积木的自定义行为。

## VM一类

### blocks.moveBlock()
这是一个抽象的方法，例子：
```js
//似乎是安全剥离无参数积木。
const blocks = runtime._editingTarget.blocks;
const blockInInput = blocks.getBlock(input.block);
blockInInput.topLevel = true;
blockInInput.parent = null;
//移动接口？
//将一个积木从原本的积木塞到另一个积木上？
//目标填undefined就是无主？
//就是直接放到代码区？
//学到了。
blocks.moveBlock({
    id: blockInInput.id,
    oldParent: this.id,
    oldInput: 'ADD' + i,
    newParent: undefined,
    newInput: undefined,
    //newCoordinate: e.newCoordinate
});
```
其中，该代码就实现了安全剥离输入积木上的积木
其实原本的作用是将一个积木（id）在旧的积木上（old）移到另一个积木上（new）
只需要newParent为undefined就是直接剥离成无主积木（记得手动配置topLevel和parent ）
newCoordinate一般不需要填
（因为有主积木的坐标无效，随积木段的布局而定）
（也因为你不可能知道一个无主积木具体该在什么地方才合理。对你不可能知道。）