import { XY } from "./types";

export const once = <T>(func: (param: T) => void) => {
  let triggered = false;
  return (param: T) => {
    if (!triggered) {
      func(param);
      triggered = true;
    }
  };
};

export const aroundCircle = ({
  radius,
  startAngle,
  parts,
}: {
  radius: number;
  startAngle: number;
  parts: number;
}): XY[] => {
  let angle = startAngle;
  const angleDiff = (2 * Math.PI) / parts;
  const xys: XY[] = [];
  for (let i = 0; i < parts; i++) {
    xys.push({
      x: Math.round(radius * Math.cos(angle)),
      y: Math.round(radius * Math.sin(angle)),
    });
    angle += angleDiff;
  }
  return xys;
};
