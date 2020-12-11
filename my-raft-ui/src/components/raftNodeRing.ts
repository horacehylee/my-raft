import { Container, Graphics } from "pixi.js";
import { State } from "../store";
import { RenderComponent } from "../types";
import { once } from "../utils";
import { messageChannel } from "./messageChannel";
import { RaftNode } from "./raftNode";

export const raftNodeRing = ({
  raftNodes,
  startAngle,
  radius,
}: {
  raftNodes: RaftNode[];
  startAngle: number;
  radius: number;
}): RenderComponent => {
  const container = new Container();
  const messageChannels: RenderComponent[] = [];

  const test = new Graphics();

  const setup = once((state: State) => {
    let angle = startAngle;
    const angleDiff = (2 * Math.PI) / raftNodes.length;
    const nodePositions: Record<number, { x: number; y: number }> = {};
    for (const raftNode of raftNodes) {
      const displayObj = raftNode(state);
      displayObj.x = radius * Math.cos(angle);
      displayObj.y = radius * Math.sin(angle);
      container.addChild(displayObj);
      angle += angleDiff;
      nodePositions[raftNode.id] = { x: displayObj.x, y: displayObj.y };
    }

    const nodeIds = Object.keys(nodePositions).map((s) => Number.parseInt(s));
    for (const nodeId of nodeIds) {
      for (const otherNodeId of nodeIds) {
        if (nodeId === otherNodeId) {
          continue;
        }
        messageChannels.push(
          messageChannel({
            from: nodeId,
            fromPos: {
              x: nodePositions[nodeId].x,
              y: nodePositions[nodeId].y,
            },
            to: otherNodeId,
            toPos: {
              x: nodePositions[otherNodeId].x,
              y: nodePositions[otherNodeId].y,
            },
          })
        );
      }
    }

    for (const channel of messageChannels) {
      container.addChild(channel(state));
    }
  });

  return (state) => {
    setup(state);
    for (const raftNode of raftNodes) {
      raftNode(state);
    }
    for (const channel of messageChannels) {
      channel(state);
    }
    return container;
  };
};
