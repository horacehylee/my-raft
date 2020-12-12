import produce, { Draft } from "immer";
import { createNode, Message, NodeState, Node } from "my-raft-core";
import { Application, Container } from "pixi.js";
import { State, createStore } from "./store";
import { merge } from "rxjs";
import { MessageWrapper, RenderComponent } from "./types";
import { raftNode } from "./components/raftNode";
import { ticksPerS, tickRate } from "./constant";
import { raftNodeRing } from "./components/raftNodeRing";
import { position } from "./components/position";
import { v4 as uuidv4 } from "uuid";
import { backgroundColor } from "./theme";

export const app = new Application({
  width: 800,
  height: 600,
  antialias: true,
  backgroundColor: backgroundColor,
  resolution: 1,
});

const nodeIds = [1, 2, 3];
const nodeMap = nodeIds.reduce<Record<number, Node>>((map, id) => {
  map[id] = createNode({
    id: id,
    peers: nodeIds.filter((i) => i !== id),
    electionTick: 10 * ticksPerS,
    heartbeatTick: 5 * ticksPerS,
    logger: console,
  });
  return map;
}, {});
const nodes = Object.values(nodeMap);

export const store = createStore(() => {
  const nodeStates: Record<number, NodeState> = {};
  for (const node of nodes) {
    const nodeState = node.getState();
    nodeStates[nodeState.id] = nodeState;
  }
  const messageChannels: Record<string, MessageWrapper[]> = {};
  for (const node of nodes) {
    for (const otherNode of nodes) {
      if (node === otherNode) {
        continue;
      }
      const nodeId = node.getState().id;
      const otherNodeId = otherNode.getState().id;
      const key = `${nodeId}-${otherNodeId}`;
      messageChannels[key] = [];
    }
  }
  return {
    nodeStates: nodeStates,
    messageChannels: messageChannels,
  };
});

const messagesToBeSent: Message[] = [];
const messageSentObservables = nodes.map(
  (node) => node.getObservables().messageSent$
);
merge(...messageSentObservables).subscribe((message) => {
  console.log(`${message.from} sent message`, message);
  messagesToBeSent.push(message);
});

const renderComponents: RenderComponent<State>[] = [];

function setup() {
  renderComponents.push(
    position({
      x: 400,
      y: 300,
      child: raftNodeRing({
        raftNodes: nodes.map((node) => {
          const nodeState = node.getState();
          return raftNode({ id: nodeState.id });
        }),
        radius: 150,
        startAngle: -Math.PI / 2,
      }),
    })
  );

  const state = store.getState();
  const container = new Container();
  for (const component of renderComponents) {
    container.addChild(component(state));
  }
  app.stage.addChild(container);
}
setup();

function update(frames: number) {
  store.setState(
    produce((draft: Draft<State>) => {
      // process messages to be sent
      while (messagesToBeSent.length > 0) {
        const message = messagesToBeSent.shift()!;
        const channelKey = `${message.from}-${message.to}`;
        draft.messageChannels[channelKey].push({
          id: uuidv4(),
          tickLeft: 2 * ticksPerS,
          ticks: 2 * ticksPerS,
          message: message,
        });
      }

      // process messages
      for (const channelKey of Object.keys(draft.messageChannels)) {
        const wrappers = draft.messageChannels[channelKey];
        wrappers.forEach((w) => w.tickLeft--);

        const received = wrappers.filter((w) => w.tickLeft <= 0);
        const remaining = wrappers.filter((w) => w.tickLeft > 0);
        draft.messageChannels[channelKey] = remaining;

        for (const wrapper of received) {
          const message = wrapper.message;
          nodeMap[message.to].receive(message);
        }
      }

      // process node
      for (const node of nodes) {
        node.tick();

        const nodeState = node.getState();
        draft.nodeStates[nodeState.id] = nodeState;
      }
    })
  );
}

function render(state: State) {
  for (const component of renderComponents) {
    component(state);
  }
}

let tick = 0;
app.ticker.add((frames) => {
  tick += frames;
  if (tick >= tickRate) {
    update(frames);
    tick -= tickRate;
  }
  render(store.getState());
});
