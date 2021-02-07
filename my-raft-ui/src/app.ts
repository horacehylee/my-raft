import * as PIXI from "pixi.js";
import { Application, Container } from "pixi.js";
import { RenderComponent } from "./types";
import { raftNode } from "./components/raftNode";
import { tickRate, fps } from "./constant";
import { raftNodeRing } from "./components/raftNodeRing";
import { position } from "./components/position";
import { backgroundColor } from "./theme";
import { timeControl } from "./components/timeControl";
import { createSimulator, State } from "./simulator";

PIXI.settings.PRECISION_FRAGMENT = PIXI.PRECISION.HIGH;
PIXI.settings.ROUND_PIXELS = true;
export const app = new Application({
  width: 800,
  height: 600,
  antialias: true,
  backgroundColor: backgroundColor,
  resolution: 1,
});
app.ticker.maxFPS = fps;

export const simulator = createSimulator({
  numOfNodes: 5,
  messageChannelTicks: 2 * fps,
  nodeElectionTicks: 10 * fps,
  nodeHeartbeatTicks: 5 * fps,
});

const renderComponents: RenderComponent<State>[] = [];

function setup() {
  renderComponents.push(
    position({
      x: 400,
      y: 300,
      child: raftNodeRing({
        raftNodes: simulator.getNodes().map((node) => {
          const nodeState = node.getState();
          return raftNode({ id: nodeState.id });
        }),
        radius: 150,
        startAngle: -Math.PI / 2,
      }),
    })
  );
  // renderComponents.push(
  //   position({
  //     x: 400,
  //     y: 500,
  //     child: timeControl(),
  //   })
  // );

  const state = simulator.getState();
  const container = new Container();
  for (const component of renderComponents) {
    container.addChild(component(state));
  }
  app.stage.addChild(container);
}
setup();

let tick = 0;
app.ticker.add((frames) => {
  tick += frames;
  if (tick >= tickRate) {
    simulator.tick();
    tick -= tickRate;
  }
  render(simulator.getState());
});

function render(state: State) {
  for (const component of renderComponents) {
    component(state);
  }
}
