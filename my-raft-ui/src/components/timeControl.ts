import { Container, Graphics, InteractionEvent } from "pixi.js";
import { timeControlKnobColor, timeControlTrackColor } from "../theme";
import { RenderComponent } from "../types";

export interface TimeControlRenderParam {}

export const timeControl = (): RenderComponent<TimeControlRenderParam> => {
  const knobSize = 12;
  const trackWidth = 200;
  const trackHeight = 12;

  let progress = 0;
  let knobDragging = false;
  let trackDowned = false;

  const container = new Container();

  const track = new Graphics();
  container.addChild(track);

  const knob = new Graphics();
  container.addChild(knob);

  const onDragEnd = () => {
    if (!knobDragging) {
      return;
    }
    knobDragging = false;
  };

  const updateProgress = (event: InteractionEvent) => {
    const pos = event.data.getLocalPosition(track);
    progress = Math.max(Math.min(pos.x, track.width), 0) / track.width;
  };

  track.interactive = true;
  track.on("mousedown", (event: InteractionEvent) => {
    trackDowned = true;
  });
  track.on("mouseup", (event: InteractionEvent) => {
    if (!trackDowned) {
      return;
    }
    trackDowned = false;
    updateProgress(event);
  });

  knob.interactive = true;
  knob.cursor = "pointer";
  knob.on("mousedown", (event: InteractionEvent) => {
    knobDragging = true;
    updateProgress(event);
  });
  knob.on("mousemove", (event: InteractionEvent) => {
    if (!knobDragging) {
      return;
    }
    updateProgress(event);
  });
  knob.on("mouseup", onDragEnd);

  container.interactive = true;
  container.on("mouseup", onDragEnd);
  container.on("mouseupoutside", onDragEnd);

  return ({}) => {
    knob
      .clear()
      .beginFill(timeControlKnobColor)
      .drawCircle(progress * trackWidth, 0, knobSize)
      .endFill();

    track
      .clear()
      .beginFill(timeControlTrackColor)
      .drawRect(0, -trackHeight / 2, trackWidth, trackHeight)
      .endFill();
    return container;
  };
};
