import { Container, Graphics } from "pixi.js";
import Victor from "victor";
import { RenderComponent, XY } from "../types";
import { once } from "../utils";

export interface ArrowRenderParam {
  fromPos: XY;
  toPos: XY;
  forwardSize: number;
  sideSize: number;
  color: number;
}

export const arrow = (): RenderComponent<ArrowRenderParam> => {
  const container = new Container();
  const head = new Graphics();

  const setup = once(
    ({ fromPos, toPos, forwardSize, sideSize, color }: ArrowRenderParam) => {
      const from = new Victor(fromPos.x, fromPos.y);
      const to = new Victor(toPos.x, toPos.y);
      const dir = to.clone().subtract(from.clone()).normalize();
      const normal = new Victor(-dir.y, dir.x).normalize();

      const p1 = dir.clone().multiply(new Victor(forwardSize, forwardSize));
      const p2 = normal.clone().multiply(new Victor(sideSize, sideSize));
      const p3 = normal.clone().multiply(new Victor(-sideSize, -sideSize));

      head.clear();
      head
        .lineStyle(1, color)
        .beginFill(color)
        .moveTo(p1.x, p1.y)
        .lineTo(p2.x, p2.y)
        .lineTo(p3.x, p3.y)
        .lineTo(p1.x, p1.y)
        .endFill();
      container.addChild(head);
    }
  );

  return (param: ArrowRenderParam) => {
    setup(param);
    return container;
  };
};
