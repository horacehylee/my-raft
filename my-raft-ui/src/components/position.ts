import { Container } from "pixi.js";
import { State } from "../store";
import { RenderComponent } from "../types";
import { once } from "../utils";

export const position = ({
  child,
  x,
  y,
}: {
  child: RenderComponent;
  x: number;
  y: number;
}): RenderComponent => {
  const container = new Container();
  const setup = once((state: State) => {
    container.addChild(child(state));
    container.x = x;
    container.y = y;
  });

  return (state: State) => {
    setup(state);
    child(state);
    return container;
  };
};
