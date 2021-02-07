import { Container, Graphics } from "pixi.js";

export interface CircularProgressParam {
  startAngle: number;
  color: number;
  thickness: number;
  radius: number;
}

export const circularProgress = ({
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
