import http from "http";
import htmlparser2 from "htmlparser2";
import css from "css";
import main from "./main.mjs";
import network from "./network.mjs";
import render from "./render.mjs";
import gpu from "./gpu.mjs";
import fs from 'fs'
import {
  splitTiles,
  raster,
  compositeLayers,
  createLayerTree,
  updateLayoutTree,
  createLayout,
  recalculateSyle,
} from "./utils.mjs";

// <link />
const loadingLinks = {};
// <script />
const loadingScripts = {};

const host = "localhost";
const port = 80;

// 模拟出栈
Array.prototype.top = function () {
  return this[this.length - 1];
};

// ======================== 主进程 ==============
main.on("request", (options) => {
  console.log('request', '请求')
  network.emit("request", options)
});
main.on("prepareRender", (options) => {
  console.log('prepareRender', '预解析')
  render.emit("commitNavigation", options)
});
main.on("confirmNavigation", () => console.log("confirmNavigation", '确认导航'));
main.on("drawQuad", () => console.log("drawQuad", '绘制'));
main.on("DOMContentLoaded", () => console.log("DOMContentLoaded", 'DOM加载完成'));
main.on("Load", () => console.log("Load", '页面加载完成'));


// ======================== 网络进程 ======================
network.on("request", (options) => {
  let request = http.request(options, (response) => {
    main.emit("prepareRender", response);
  });
  request.end();
});


// ======================== 渲染进程 ======================
render.on("commitNavigation", (response) => {
  const headers = response.headers;
  const contentType = headers["content-type"];
  if (contentType.indexOf("text/html") !== -1) {
    // 渲染进程把HTML转变为DOM树形结构
    const document = {
      type: "document",
      attributes: {},
      children: [],
    };
    const cssRules = [];
    // token栈
    const tokenStack = [document];
    // html解析器
    const parser = new htmlparser2.Parser({
      onerror(error) {
        console.log('error', error)
      },
      onopentag(name, attributes = {}) {
        // 取栈顶元素作为父元素
        const parent = tokenStack.top();
        console.log('onopentag', name)
        // console.log('onopentag', { name, document })
        const element = {
          type: "element",
          tagName: name,
          children: [],
          attributes,
          parent,
        };
        // 把元素push进parent.children 构建树🌲
        parent.children.push(element);
        // 再把元素push进token栈
        tokenStack.push(element);
      },
      ontext(text) {
        // 匹配换行回车空格
        if (!/^[\r\n\s]*$/.test(text)) {
          const parent = tokenStack.top();
          const textNode = {
            type: "text",
            children: [],
            attributes: {},
            parent,
            text,
          };
          // 构建树🌲
          parent.children.push(textNode);
        }
      },
      /**
       * 在预解析阶段，HTML发现CSS和JS文件会并行下载，等全部下载后先把CSS生成CSSOM，然后再执行JS脚本
       * 然后再构建DOM树，重新计算样式，构建布局树，绘制页面
       * @param {*} tagname
       */
      onclosetag(tagName) {
        console.log('onclosetag:', tagName)
        // css转stylesheet
        switch (tagName) {
          case "style":
            const styleToken = tokenStack.top();
            const cssAST = css.parse(styleToken.children[0].text);
            cssRules.push(...cssAST.stylesheet.rules);
            break;
          case "link":
            const linkToken = tokenStack[tokenStack.length - 1];
            const href = linkToken.attributes.href;
            const options = { host, port, path: href };
            // 外链的css，发起网络请求，数据回来后push进stylesheet
            const promise = network.fetchResource(options).then(({ headers, body }) => {
              delete loadingLinks[href];
              // Accepts a CSS string and returns an AST object
              const cssAST = css.parse(body);
              // console.log('cssAST', JSON.stringify(cssAST, null, 4))
              cssRules.push(...cssAST.stylesheet.rules);
            });
            loadingLinks[href] = promise;
            break;
          case "script":
            const scriptToken = tokenStack[tokenStack.length - 1];
            const src = scriptToken.attributes.src;
            if (src) {
              const options = { host, port, path: src };
              const promise = network
                .fetchResource(options)
                .then(({ body }) => {
                  delete loadingScripts[src];
                  // script的执行，需要等之前所有的link、script加载完毕
                  return Promise.all([
                    ...Object.values(loadingLinks),
                    Object.values(loadingScripts),
                  ]).then(() => {
                    eval(body);
                  });
                });
              loadingScripts[src] = promise;
            } else {
              const script = scriptToken.children[0].text;
              const ts = Date.now() + "";
              // script的执行，需要等之前所有的link、script加载完毕
              const promise = Promise.all([
                ...Object.values(loadingLinks),
                ...Object.values(loadingScripts),
              ]).then(() => {
                delete loadingScripts[ts];
                eval(script);
              });
              loadingScripts[ts] = promise;
            }
            break;
          default:
            break;
        }
        tokenStack.pop();
      },
    }, {});
    // 开始接收响应体
    response.on("data", (buffer) => {
      // 渲染进程开始HTML解析和加载子资源
      // 网络进程加载了多少数据，HTML 解析器便解析多少数据。
      parser.write(buffer.toString());
    });
    response.on("end", () => {
      console.log('styleSheets', fs.writeFileSync('./styleSheets.json', JSON.stringify({ cssRules })))
      console.log('辅助数据：', JSON.stringify({ loadingLinks, loadingScripts }, null, 4))
      // 页面渲染，会受script的加载阻塞
      Promise.all(Object.values(loadingScripts)).then(() => {
        // html接收完毕后通知主进程确认导航
        main.emit("confirmNavigation");
        // 通过stylesheet计算出DOM节点的样式
        recalculateSyle(cssRules, document);
        //  根据DOM树创建布局树,就是复制DOM结构并过滤掉不显示的元素
        const html = document.children[0];
        const body = html.children[1];
        const layoutTree = createLayout(body);
        // 计算各个元素的布局信息
        updateLayoutTree(layoutTree);
        // 根据布局树生成分层树
        const layers = [layoutTree];
        createLayerTree(layoutTree, layers);
        // 根据分层树生成绘制步骤并复合图层
        const paintSteps = compositeLayers(layers);
        //把绘制步骤交给渲染进程中的合成线程进行合成
        //合成线程会把图层划分为图块tile
        const tiles = splitTiles(paintSteps);
        // 合成线程会把分好的图块发给栅格化线程池
        raster(tiles);
        // 触发DOMContentLoaded事件
        main.emit("DOMContentLoaded");
        // html解析完毕和加载子资源页面加载完成后会通知主进程页面加载完成
        main.emit("Load");
      });
    });
  }
});


// ======================== gpu进程 ======================
gpu.on("raster", (tile) => {
  // 位图久保存在了GPU内存中
  let bitMap = tile;
  gpu.bitMaps.push(bitMap);
});


// ======================== 开始 ======================
main.emit("request", { host, port, path: "/index.html" });
