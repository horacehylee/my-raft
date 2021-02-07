import p5 from "p5";
import { backgroundColor, fps } from "./config";
import { createSimulator } from "./simulator";

export function sketch(p: p5) {
  const simulator = createSimulator({
    numOfNodes: 3,
    messageChannelTicks: 2 * fps,
    nodeElectionTicks: 10 * fps,
    nodeHeartbeatTicks: 5 * fps,
  });

  p.preload = () => {};

  p.setup = () => {
    p.frameRate(fps);
    p.createCanvas(p.windowWidth, p.windowHeight);
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
  };

  p.draw = () => {
    p.clear();
    p.background(backgroundColor);

    const button = p.createButton("click me");
    button.position(19, 19);

    simulator.tick();

    const state = simulator.getState();
    raftNode(p, { x: 100, y: 100 });
  };
}

function raftNode(p: p5, { x, y }: { x: number; y: number }) {
  const c = p.color("white");
  p.fill(c);
  p.circle(x, y, 80);

  // let c2 = p.color("magenta");
  // p.fill(c2);
  // p.noStroke();
  // p.rect(20, 20, 60, 60);
}
