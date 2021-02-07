// import p5 from "p5";
import p5 from "p5";
(window as any).p5 = p5;
import "p5/lib/addons/p5.sound";

import { sketch } from "./sketch";

if ((window as any).loaded) {
  window.location.reload();
}
(window as any).loaded = true;

new p5(sketch);
