import { app } from "./app";
import { utils } from "pixi.js";
import { enableMapSet } from "immer";
enableMapSet();

let type = "WebGL";
if (!utils.isWebGLSupported()) {
  type = "canvas";
}
utils.sayHello(type);

document.body.appendChild(app.view);
