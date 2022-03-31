## 1 Chrome 的进程架构

- **浏览器主进程** : 主要负责界面显示、用户交互、子进程管理，同时提供存储等功能.
- **渲染进程** : 核心任务是将 HTML、CSS 和 JavaScript 转换为用户可以与之交互的网页，出于安全考虑，渲染进程都是运行在沙箱模式下.
- **网络进程** : 主要负责页面的网络资源加载.
- **GPU 进程** : GPU 的使用初衷是为了实现 3D CSS 的效果.

## 2. 加载 html

1. 主进程接收用户输入的 url
1. 主进程把该 url 转发给网络进程
1. 在网络进程中发起请求
1. 网络进程接收到响应头数据并转发给主进程
1. 主进程发送提交导航消息到渲染进程
1. 渲染进程开始从网络进程接收 HTML 数据
1. HTML 接收完毕后通知主进程确认导航
1. 渲染进程开始 HTML 解析和加载子资源
1. HTML 解析完毕和加载子资源页面加载完成后会通知主进程页面加载完成

   ![image.png](https://static001.geekbang.org/resource/image/92/5d/92d73c75308e50d5c06ad44612bcb45d.png){:height="50%" width="50%"}

## 3. 渲染流水线

1. 渲染进程把 HTML 转变为**DOM 树**形结构
1. 渲染进程把 CSS 文本转为浏览器中的**styleSheets**, 转换样式表中的属性值，使其标准化
1. 计算出 DOM 树中每个节点的具体样式

1. 根据 DOM 树创建**布局树**
1. 并计算各个元素的**布局信息**

1. 根据布局树生成**分层树** 1. [拥有层叠上下文属性的元素会被提升为单独的一层](https://developer.mozilla.org/zh-CN/docs/Web/CSS/CSS_Positioning/Understanding_z_index/The_stacking_context) 2. 需要剪裁（clip）的地方也会被创建为图层
1. 根据分层树生成**绘制步骤**(绘制指令)
1. 把绘制步骤交给渲染进程中的**合成线程**进行合成
1. 合成线程将图层分成**图块 tile**
1. 合成线程会把分好的图块发给**栅格化线程池**，栅格化线程会把图快转化为**位图**
   备注: 其实栅格化线程在工作的时候会把栅格化的工作交给**GPU 进程**来完成，最终生成的位图久保存在**GPU 内存**中
1. 当所有的图块都光栅化之后，合成线程会发送**绘制**图块的命令给浏览器主进程
1. 浏览器主进程然后会从 GPU 内存中取出位图**显示到页面**上

   ![image.png](https://static001.geekbang.org/resource/image/97/37/975fcbf7f83cc20d216f3d68a85d0f37.png){:height="50%" width="50%"}

## 4. js 是如何影响 Dom 树的构建的？

4.1 正常解析过程

```javascript
<html>
  <body>
    <div>1</div>
    <div>test</div>
  </body>
</html>
```

![imgae.png](https://static001.geekbang.org/resource/image/8c/a5/8c7ba966cebb0050b81c0385ffb4f2a5.png){:height="50%" width="50%"}

4.2 JavaScript 是如何影响 DOM 生成的?

```javascript
<html>
  <body>
    <div>1</div>
    <script>
      let div1 = document.getElementsByTagName('div')[0] div1.innerText =
      'time.geekbang'
    </script>
    // <script type="text/javascript" src="foo.js"></script>
    <div>test</div>
  </body>
</html>

备注：**JavaScript 文件的下载过程会阻塞 DOM 解析**, 执行影响会阻塞 DOM 解析。

async 和 defer 虽然都是异步的，不过还有一些差异，使用 async 标志的脚本文件一旦加载完成，会立即执行；而使用了 defer 标记的脚本文件，需要在 DOMContentLoaded 事件之前执行。defer标记的多个脚本需要按顺序执行 而aysnc标记的多个脚本是无序的
```

4.3 JavaScript 是如何影响 DOM 生成的?

```javascript
<html>
  <head>
    <style src="theme.css"></style>
  </head>
  <body>
    <div>1</div>
    <script>
      let div1 = document.getElementsByTagName('div')[0] div1.innerText =
      'time.geekbang' //需要DOM div1.style.color = 'red' //需要CSSOM
    </script>
    <div>test</div>
  </body>
</html>

 JavaScript 会阻塞 DOM 生成，而样式文件又会阻塞 JavaScript 的执行
```

## 5. css 如何影响到 DOM 构建的？

```javascript
<html>
<head>
    <link href="theme.css" rel="stylesheet">
</head>
<body>
    <div>geekbang com</div>
    <script src='foo.js'></script>
    <div>geekbang com</div>
</body>
</html>
```

![imgae.png](https://static001.geekbang.org/resource/image/76/1f/7641c75a80133e747aa2faae8f4c8d1f.png){:height="50%" width="50%"}

## 6. 为什么 css 动画比 js 高效？

```
.box {
  will-change: transform, opacity;
}
```

合成操作是在合成线程上完成的，这也就意味着在执行合成操作时，是不会影响到主线程执行的。这就是为什么经常主线程卡住了，但是 CSS 动画依然能执行的原因。

## 7. 经典问题

1.  减少重排重绘方法?
2.  如果下载 CSS 文件阻塞了，会阻塞 DOM 树的合成吗？会阻塞页面的显示吗？
3.  HTML 解析器是等整个 HTML 文档加载完成之后开始解析的，还是随着 HTML 文档边加载边解析的？

### 8. 安装 npm 包

```
 客户端执行： node --experimental-modules request.mjs

```

- **css** css 解析器
- **express** 起一个服务，用来访问 html
- **htmlparser2** html 解析器

### 9. 参考
- 极客时间【李兵】[浏览器工作原理与实践](https://time.geekbang.org/column/intro/100033601?tab=catalog)


