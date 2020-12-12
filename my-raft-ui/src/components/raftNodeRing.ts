import { Container } from "pixi.js";
import { State } from "../store";
import { RenderComponent, XY } from "../types";
import { aroundCircle, once } from "../utils";
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
}): RenderComponent<State> => {
  const container = new Container();
  const messageChannels: RenderComponent<State>[] = [];

  const setup = once((state: State) => {
    const points = aroundCircle({
      radius: radius,
      startAngle: startAngle,
      parts: raftNodes.length,
    });

    const nodePositions: Record<number, XY> = {};
    for (let i = 0; i < raftNodes.length; i++) {
      const displayObj = raftNodes[i](state);
      displayObj.x = points[i].x;
      displayObj.y = points[i].y;
      container.addChild(displayObj);
      nodePositions[raftNodes[i].id] = points[i];
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
