
import main from "./main.mjs";
import gpu from "./gpu.mjs";

// 模拟把图层拆成图块的过程
export function splitTiles(paintSteps) {
    return paintSteps;
}

export function raster(tiles) {
    // 栅格化线程会把图片tile转化成位图
    tiles.forEach((tile) => rasterThread(tile));
    // 当所有的图块都光栅化之后，合成线程会发送绘制的命令给浏览器主进程
    main.emit("drawQuad");
}

export function rasterThread(tile) {
    // 而其实栅格化线程在工作的时候，会把栅格化的工作交给gpu进程来完成
    gpu.emit("raster", tile);
}

export function compositeLayers(layers) {
    // 合成线程会把分好的图块发给栅格化线程池，栅格化线程池会把图块tile转化为位图
    return layers.map((layout) => paint(layout));
}

export function paint(element, paintSteps = []) {
    const {
        background = "black",
        color = "black",
        top = 0,
        left = 0,
        width = 100,
        height = 0,
    } = element.layout;
    // 使用canvas模拟绘制的过程
    if (element.type === "text") {
        paintSteps.push(`ctx.font = '20px Impact;'`);
        paintSteps.push(`ctx.strokeStyle = '${color}';`);
        paintSteps.push(
            `ctx.strokeText("${element.text.replace(/(^\s+|\s+$)/g, "")}", ${left}, ${top + 20
            });`
        );
    } else {
        paintSteps.push(`ctx.fillStyle="${background}";`);
        paintSteps.push(
            `ctx.fillRect(${left},${top}, ${parseInt(width)}, ${parseInt(height)});`
        );
        element.children.forEach((child) => paint(child, paintSteps));
        return paintSteps;
    }
}


export function createLayerTree(element, layers) {
    element.children = element.children.filter((child) =>
        createNewLayer(child, layers)
    );
    element.children.forEach((child) => createLayerTree(child, layers));
    return layers;
}


export function createNewLayer(element, layers) {
    let created = true;
    const attributes = element.attributes;
    Object.entries(attributes).forEach(([key, value]) => {
        if (key === "style") {
            const attributes = value.split(";");
            attributes.forEach((attribute) => {
                const [property, value] = attribute.split(/:\s*/);
                if (property === "position" && value === "absolute") {
                    updateLayoutTree(element); // 对单独的层重新计算
                    layers.push(element);
                    created = false;
                }
            });
        }
    });
}

export function updateLayoutTree(element, top = 0, parentTop = 0) {
    const computedSyle = element.computedSyle;
    const { width, height, background, color } = computedSyle;
    element.layout = {
        top: top + parentTop,
        left: 0,
        width,
        height,
        background,
        color,
    };
    let childTop = 0;
    element.children.forEach((child) => {
        updateLayoutTree(child, childTop, element.layout.top);
        childTop += parseInt(child.computedSyle.height || 0);
    });
}

export function createLayout(element) {
    // 过滤
    element.children = element.children.filter(isShow);
    // 递归
    element.children.forEach((child) => createLayout(child));
    // 返回
    return element;
}

export function isShow(element) {
    let isShow = true;
    if (element.tagName === "head" || element.tagName === "script") {
        isShow = false;
    }
    const attributes = element.attributes;
    Object.entries(attributes).forEach(([key, value]) => {
        if (key === "style") {
            const attributes = value.split(";");
            attributes.forEach((attribute) => {
                const [property, value] = attribute.split(/:\s*/);
                if (property === "display" && value === "none") {
                    isShow = false;
                }
            });
        }
    });
    return isShow;
}

export function recalculateSyle(cssRules, element, parentComputedStyle = {}) {
    const attributes = element.attributes;
    element.computedSyle = {
        color: parentComputedStyle.color, // 继承
    };
    Object.entries(attributes).forEach(([key, value]) => {
        cssRules.forEach((rule) => {
            let selector = rule.selectors[0].replace(/\s+/g, "");
            if (
                (selector === "#" + value && key === "id") ||
                (selector === "." + value && key === "class")
            ) {
                rule.declarations.forEach(({ property, value }) => {
                    element.computedSyle[property] = value;
                });
            }
        });
        if (key === "style") {
            const attributes = value.split(";");
            attributes.forEach((attribute) => {
                const [property, value] = attribute.split(/:\s*/);
                element.computedSyle[property] = value;
            });
        }
    });
    // console.log('element', element);
    // 递归，实现css样式的继承
    element.children.forEach((child) =>
        recalculateSyle(cssRules, child, element.computedSyle)
    );
}