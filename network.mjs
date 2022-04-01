import EventEmitter from "events";
import http from "http";

class Network extends EventEmitter {
  fetchResource(options) {
    return new Promise((resolve) => {
      let request = http.request(options, (response) => {
        const headers = response.headers;
        const buffers = [];
        response.on("data", (buffer) => {
          buffers.push(buffer);
        });
        response.on("end", () => {
          resolve({ headers, body: Buffer.concat(buffers).toString() });
        });
      });
      request.end();
    });
  }
}

const network = new Network();

export default network;
