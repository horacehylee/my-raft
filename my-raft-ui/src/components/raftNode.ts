import { NodeState } from "my-raft-core";
import {
  Container,
  Graphics,
  Text,
  InteractionEvent,
  DisplayObject,
} from "pixi.js";
import { State } from "../store";
import { electionRingColor, leaderRingColor, termColors } from "../theme";
import { RenderComponent } from "../types";
import { aroundCircle, once } from "../utils";

export type RaftNode = RenderComponent<State> & { id: number };

export interface RaftNodeParam {
  id: number;
}

export const raftNode = ({ id }: RaftNodeParam): RaftNode => {
  const ringThickness = 5;
  const baseRadius = 30;

  const container = new Container();
  const electionProgress = circularProgress({
    startAngle: -Math.PI / 2,
    color: electionRingColor,
    thickness: ringThickness,
    radius: baseRadius + ringThickness / 2,
  });
  let electionProgressContainer: Container;

  const leaderRing = circularProgress({
    startAngle: 0,
    color: leaderRingColor,
    thickness: ringThickness,
    radius: baseRadius + ringThickness / 2,
  });
  let leaderRingContainer: Container;

  const votesGrantedRing = votesContainer();

  const baseCircle = new Graphics();
  container.addChild(baseCircle);

  const termText = new Text("");
  termText.anchor.x = 0.5;
  termText.anchor.y = 0.5;
  termText.resolution = 2;
  container.addChild(termText);

  container.interactive = true;
  container.cursor = "pointer";
  container.on("click", (event: InteractionEvent) => {
    event.stopPropagation();
  });

  const setup = once((nodeState: NodeState) => {
    electionProgressContainer = electionProgress({ progress: 0 });
    container.addChild(electionProgressContainer);

    leaderRingContainer = leaderRing({ progress: 1 });
    container.addChild(leaderRingContainer);

    container.addChild(votesGrantedRing(nodeState));
  });

  function render(state: State) {
    const nodeState = state.nodeStates[id];
    setup(nodeState);

    if (nodeState.role !== "leader") {
      const electionElasped = nodeState.electionElasped;
      const electionTimeout = nodeState.randomizedElectionTimeout;
      electionProgress({ progress: -electionElasped / electionTimeout });

      electionProgressContainer.visible = true;
      leaderRingContainer.visible = false;
    } else {
      electionProgressContainer.visible = false;
      leaderRingContainer.visible = true;
    }

    const baseColor = termColors[nodeState.currentTerm % termColors.length];
    baseCircle.clear();
    baseCircle.beginFill(baseColor);
    baseCircle.drawCircle(0, 0, baseRadius);
    baseCircle.endFill();

    termText.text = nodeState.currentTerm.toString();
    termText.x = 0;
    termText.y = 0;

    votesGrantedRing(nodeState);
    return container;
  }
  render.id = id;
  return render;
};

const votesContainer = (): RenderComponent<NodeState> => {
  const pointCircleRadius = 20;
  const voteCircleRadius = 5;
  const outlineStroke = 1;

  const container = new Container();
  const outlineCircles: Record<number, DisplayObject> = {};
  const solidCircles: Record<number, DisplayObject> = {};

  const setup = once((nodeState: NodeState) => {
    const allNodeIds = nodeState.peers
      .concat(nodeState.id)
      .sort((a, b) => a - b);
    const points = aroundCircle({
      radius: pointCircleRadius,
      startAngle: -Math.PI / 2,
      parts: allNodeIds.length,
    });
    for (let i = 0; i < allNodeIds.length; i++) {
      const nodeId = allNodeIds[i];
      const point = points[i];

      const outlineCircle = new Graphics();
      outlineCircle
        .clear()
        .lineStyle(outlineStroke, leaderRingColor)
        .drawCircle(point.x, point.y, voteCircleRadius - outlineStroke / 2);
      outlineCircles[nodeId] = outlineCircle;
      container.addChild(outlineCircle);

      const solidCircle = new Graphics();
      solidCircle
        .clear()
        .beginFill(leaderRingColor)
        .drawCircle(point.x, point.y, voteCircleRadius)
        .endFill();
      solidCircles[nodeId] = solidCircle;
      container.addChild(solidCircle);
    }
  });

  const updateVote = (id: number, granted: boolean) => {
    outlineCircles[id].visible = !granted;
    solidCircles[id].visible = granted;
  };

  return (nodeState) => {
    setup(nodeState);

    if (nodeState.role !== "candidate") {
      container.visible = false;
      return container;
    }
    container.visible = true;
    updateVote(nodeState.id, true);
    for (const [key, granted] of Object.entries(nodeState.voteGranted)) {
      const nodeId = Number.parseInt(key);
      updateVote(nodeId, granted);
    }
    return container;
  };
};

interface CircularProgressParam {
  startAngle: number;
  color: number;
  thickness: number;
  radius: number;
}

const circularProgress = ({
  startAngle,
  color,
  thickness,
  radius,
}: CircularProgressParam) => {
  const container = new Container();
  const circleStroke = new Graphics();
  container.addChild(circleStroke);

  return ({ progress }: { progress: number }) => {
    circleStroke.clear();
    circleStroke.lineStyle(thickness, color);
    circleStroke.arc(
      0,
      0,
      radius,
      startAngle,
      startAngle + progress * Math.PI * 2
    );
    circleStroke.endFill();
    return container;
  };
};
