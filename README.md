> 引言：本文参考，极客时间【李兵】[浏览器工作原理与实践](https://time.geekbang.org/column/intro/100033601?tab=catalog)，意在总结，便于自己学习。



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

   ![image.png](https://static001.geekbang.org/resource/image/92/5d/92d73c75308e50d5c06ad44612bcb45d.png)

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

   ![image.png](https://static001.geekbang.org/resource/image/97/37/975fcbf7f83cc20d216f3d68a85d0f37.png)

## 4. Dom树的构建的？

利用栈思想：

![imgae.png](https://static001.geekbang.org/resource/image/8c/a5/8c7ba966cebb0050b81c0385ffb4f2a5.png)

## 5. JavaScript 是如何影响 DOM 生成的?

![imgae.png](https://static001.geekbang.org/resource/image/76/1f/7641c75a80133e747aa2faae8f4c8d1f.png)



### 6. 执行

```
 client：客户端执行： node --experimental-modules request.mjs
 server：模拟服务器： node index.js

```

### 7. 参考
- 极客时间【李兵】[浏览器工作原理与实践](https://time.geekbang.org/column/intro/100033601?tab=catalog)


