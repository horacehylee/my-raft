import { Container } from "pixi.js";
import { State } from "../store";
import { RenderComponent } from "../types";
import { once } from "../utils";

export const position = ({
  child,
  x,
  y,
}: {
  child: RenderComponent<any>;
  x: number;
  y: number;
}): RenderComponent<any> => {
  const container = new Container();
  const setup = once((param: any) => {
    container.addChild(child(param));
    container.x = x;
    container.y = y;
  });

  return (param) => {
    setup(param);
    child(param);
    return container;
  };
};
