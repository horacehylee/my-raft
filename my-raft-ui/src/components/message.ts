import { Container, Graphics, InteractionEvent } from "pixi.js";
import { MessageWrapper, RenderComponent, XY } from "../types";
import { once } from "../utils";
import Victor from "victor";
import { arrow } from "./arrow";
import { getMessageColor } from "../theme";
import { State } from "../simulator";

const messageRadius = 10;
const messageStroke = 3;

export const message = ({
  messageWrapper,
  fromPos,
  toPos,
}: {
  fromPos: XY;
  toPos: XY;
  messageWrapper: MessageWrapper;
}): RenderComponent<State> => {
  const container = new Container();
  const circle = new Graphics();
  const outline = new Graphics();
  const positive = new Graphics();
  const negative = new Graphics();
  const color = getMessageColor(messageWrapper.message);
  const arrowhead = arrow();
  container.interactive = true;
  container.cursor = "pointer";
  container.on("click", (event: InteractionEvent) => {
    event.stopPropagation();
  });

  const setup = once((state: State) => {
    circle.clear();
    circle.beginFill(color);
    circle.drawCircle(0, 0, messageRadius);
    circle.endFill();
    container.addChild(circle);

    outline.clear();
    outline
      .lineStyle(messageStroke, color)
      .drawCircle(0, 0, messageRadius - messageStroke / 2);
    container.addChild(outline);

    const from = new Victor(fromPos.x, fromPos.y);
    const to = new Victor(toPos.x, toPos.y);
    const dir = to.clone().subtract(from.clone()).normalize();
    const normal = new Victor(-dir.y, dir.x).normalize();

    const head = arrowhead({
      color: color,
      forwardSize: 10,
      sideSize: 7,
      fromPos: fromPos,
      toPos: toPos,
    });
    const headPos = dir.clone().multiply(new Victor(12, 12));
    head.x = headPos.x;
    head.y = headPos.y;
    container.addChild(head);

    positive.clear();
    positive
      .lineStyle(messageStroke, color)
      .moveTo(dir.x * -messageRadius, dir.y * -messageRadius)
      .lineTo(dir.x * messageRadius, dir.y * messageRadius);
    container.addChild(positive);

    negative.clear();
    negative
      .lineStyle(messageStroke, color)
      .moveTo(normal.x * -messageRadius, normal.y * -messageRadius)
      .lineTo(normal.x * messageRadius, normal.y * messageRadius);
    container.addChild(negative);

    circle.visible =
      messageWrapper.message.type === "AppendEntriesRequest" ||
      messageWrapper.message.type === "RequestVoteRequest";
    outline.visible = !circle.visible;

    positive.visible =
      (messageWrapper.message.type === "AppendEntriesResponse" &&
        messageWrapper.message.success) ||
      (messageWrapper.message.type === "RequestVoteResponse" &&
        messageWrapper.message.voteGranted);
    negative.visible = outline.visible;
  });

  return (state: State) => {
    setup(state);
    return container;
  };
};
