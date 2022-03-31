
import htmlparser2 from "htmlparser2";

const parser = new htmlparser2.Parser({
    onreset() {
        console.info('reset');
    },
    onopentag(name, attribs) {
        console.info('opentag', name);
        console.info('attribs', attribs);
    },
    ontext(text) {
        console.info('text', text);
    },
    onclosetag(tagname) {
        console.info('closetag', tagname)
    },
    onopentagname(name) {
        console.info('opentagname', name)
    },
    onend() {
        console.info('onend');
    },
    oncomment(val) {
        console.info('comment', val);
    },
    oncommentend() {
        console.info('commentend');
    },
    oncdatastart() {
        console.info('oncdatastart');
    },
    oncdataend() {
        console.info('oncdataend');
    },
    onprocessinginstruction(name, data) {
        console.info('onprocessinginstruction', name);
        console.info('onprocessinginstruction', data);
    }
}, {
    recognizeCDATA: true
})

let html = "<?doctype/html><script type='text/javascript'>var name = 'react';</script><div id='htmlparse2' class='html'>abc</div><![CDATA[hello react.js]]>";
parser.parseComplete(html);