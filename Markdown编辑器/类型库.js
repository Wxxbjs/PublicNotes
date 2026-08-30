"use strict";

/*
 - 致力于解决js编码痛点
 - 核心问题：
   - 对象全靠字面量{}构造、分散的函数来实现功能，很容易漏掉关键字段、蕴含隐式运行时错误
   - 过分分散的逻辑到处都有副作用状态的可能，不熟悉项目的根本不知道哪些对象是干什么的，不利于后人阅读、理解、维护
   - JSON的解析和导入不纯，容易泄漏不应该导出的属性
 - 解决方式 & 编码风格：
   - 定义所引入该库的类，填入信息
   - 导入、加载、实例化某个对象时，class会像修饰符一样接住对象，返回一个进阶实例，此时可以调用进阶类的各种接口
   - 实际码风类似：
     - ImageObject = ImageClass.wrap({ src: "date", width: 400, height: 300 });
     - console.log(ImageObject.getBlobUrl());
 - 理念：
   - 基于该库的类都是起修饰作用，理论上你可以回归 字面量{}地狱、分散函数地狱、胡乱传this搞函数参数设计 的风格。
   - 基于上面这点，我不希望写什么 new ImageClass("date",400,300); 这种用构造函数的参数顺序来描述对象的“八股文”
   - 也有良好的性质，对于现有项目，无非写一个定义，在构造是加一个 MyClass.wrap({ ... }) 这种类似类型修饰的东西即可无缝进阶，及其轻量化
   - 到时候想在类里面集成什么方法就集成什么方法，想怎么在对象上附着什么属性就附着什么属性
   - 也不用死记构造函数的参数意义（因为只有一个参数，也只用来传递待修饰对象）
   - 让js写的像C++。（不是）
*/

// 基类：统一处理对象参数、必要字段校验、toJSON 控制，且不可避免的带有一个wrap函数进行修饰的路线控制
class Struct {
    // 子类必须覆盖这些静态属性（或实例属性）
    static required = [];     // 必须提供的字段名
    static serializable = []; // 需要被序列化的字段名（白名单）
    // 如果不提供，默认序列化所有“可枚举且非函数”的属性

    // 重要函数：显式使用 Class.wrap(Object) 的形式修饰对象，不推荐也不应该使用 new Class({ ... }) 来修饰对象
    static wrap(props) {
        if (props instanceof this) return props;
        return new this(props);
    }

    // 能进来的必须是过了wrap的，是允许new并且进行初始化的，不会有问题，所以才走构造函数
    // 所以完全可以从0开始构造对象，不要管什么覆盖不覆盖的。
    constructor(props) {
        // 校验必要字段
        const required = this.constructor.required || [];
        for (let key of required) if (!(key in props)) throw new Error(`Missing required field: ${key}`);
        // 赋值
        Object.assign(this, props);
        // 后续初始化钩子
        if (this.init) this.init();
    }

    toJSON() {
        const serializable = this.constructor.serializable;
        const obj = {};
        // 白名单模式
        if (serializable && serializable.length) for (const key of serializable) if (key in this) obj[key] = this[key];
        // 默认：忽略函数和原型链，只取自身可枚举属性
        else for (const key in this) if (this.hasOwnProperty(key) && typeof this[key] !== "function") obj[key] = this[key];
        return obj;
    }
}

//使用例

(function () {
    if (false) {
        class ImageItem extends Struct {
            static required = ["data", "width"];      // data 和 width 必须提供
            static serializable = ["data", "width", "height"]; // 序列化白名单

            constructor(props) {
                super(props);
                // 私有缓存，不放入序列化
                this._blobUrl = null;
            }

            getBlobUrl() {
                if (!this._blobUrl) {
                    // 生成 blob url 逻辑...
                }
                return this._blobUrl;
            }
        }

        // 实例化
        const img = ImageItem.wrap({
            data: 'base64...',
            width: 100,
            height: 200
        });

        console.log(JSON.stringify(img));
        // 输出 {"data":"base64...","width":100,"height":200}
        // _blobUrl 不会出现，因为不在白名单中
    }
})();