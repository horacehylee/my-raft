import {
  Container,
  Graphics,
  Text,
  InteractionManager,
  InteractionEvent,
} from "pixi.js";
import { app } from "../app";
import { State } from "../store";
import { RenderComponent } from "../types";

const termColors = [0x66c2a5, 0xfc8d62, 0x8da0cb, 0xe78ac3, 0xa6d854, 0xffd92f];

export type RaftNode = RenderComponent & { id: number };

export interface RaftNodeParam {
  id: number;
}

export const raftNode = ({ id }: RaftNodeParam): RaftNode => {
  const ringThickness = 5;
  const baseRadius = 30;

  const container = new Container();
  const electionProgress = circularProgress({
    startAngle: -Math.PI / 2,
    color: 0xa4a4a4,
    thickness: ringThickness,
    radius: baseRadius + ringThickness / 2,
  });
  const electionProgressContainer = electionProgress({ progress: 0 });
  container.addChild(electionProgressContainer);

  const leaderRing = circularProgress({
    startAngle: 0,
    color: 0x434343,
    thickness: ringThickness,
    radius: baseRadius + ringThickness / 2,
  });
  const leaderRingContainer = leaderRing({ progress: 1 });
  container.addChild(leaderRingContainer);

  const base = new Graphics();
  container.addChild(base);

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

  function render(state: State) {
    const nodeState = state.nodeStates[id];
    if (nodeState.role !== "leader") {
      electionProgressContainer.visible = true;
      leaderRingContainer.visible = false;

      const electionElasped = nodeState.electionElasped;
      const electionTimeout = nodeState.randomizedElectionTimeout;
      electionProgress({ progress: -electionElasped / electionTimeout });
    } else {
      electionProgressContainer.visible = false;
      leaderRingContainer.visible = true;
    }

    const baseColor = termColors[nodeState.currentTerm % termColors.length];
    base.clear();
    base.beginFill(baseColor);
    base.drawCircle(0, 0, baseRadius);
    base.endFill();

    termText.text = nodeState.currentTerm.toString();
    termText.x = 0;
    termText.y = 0;
    return container;
  }
  render.id = id;
  return render;
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
