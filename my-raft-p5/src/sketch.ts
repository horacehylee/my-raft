import p5 from "p5";

export const sketch = (p: p5) => {
  p.preload = () => {};

  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight);
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
  };

  p.draw = () => {
    p.clear();
    if (p.mouseIsPressed) {
      p.fill(0, 0, 0);
    } else {
      p.fill(255, 0, 0);
    }
    p.ellipse(p.mouseX, p.mouseY, 80, 80);
  };
};
