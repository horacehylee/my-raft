// import p5 from "p5";
import p5 from "p5";
(window as any).p5 = p5;
import "p5/lib/addons/p5.sound";

import { sketch } from "./sketch";

new p5(sketch);
