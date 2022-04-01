import EventEmitter from "events";

class GPU extends EventEmitter {
  constructor() {
    super();
    this.bitMaps = [];
  }
}

const gpu = new GPU();

export default gpu;
