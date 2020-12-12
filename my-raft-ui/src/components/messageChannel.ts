import { Container, DisplayObject } from "pixi.js";
import { State } from "../store";
import { RenderComponent } from "../types";
import { XY } from "./../types";
import { message } from "./message";

export interface MessageChannelParam {
  from: number;
  fromPos: XY;
  to: number;
  toPos: XY;
}

export const messageChannel = ({
  from,
  fromPos,
  to,
  toPos,
}: MessageChannelParam): RenderComponent<State> => {
  const container = new Container();
  const messagesMap: Record<string, RenderComponent<State>> = {};
  const channelKey = `${from}-${to}`;

  return (state: State) => {
    const messageWrappers = state.messageChannels[channelKey];

    // remove non-existed messages
    const removedMessageIds = Object.keys(messagesMap).filter(
      (existingId) => !messageWrappers.find((m) => m.id === existingId)
    );
    for (const id of removedMessageIds) {
      const obj = messagesMap[id](state);
      obj.destroy();
      container.removeChild(obj);
    }

    // append and update messages
    for (const messageWrapper of messageWrappers) {
      let obj: DisplayObject;
      if (messagesMap[messageWrapper.id]) {
        obj = messagesMap[messageWrapper.id](state);
      } else {
        messagesMap[messageWrapper.id] = message({
          fromPos: fromPos,
          toPos: toPos,
          messageWrapper: messageWrapper,
        });
        obj = messagesMap[messageWrapper.id](state);
        container.addChild(obj);
      }

      const progress =
        (messageWrapper.ticks - messageWrapper.tickLeft) / messageWrapper.ticks;
      obj.x = fromPos.x + progress * (toPos.x - fromPos.x);
      obj.y = fromPos.y + progress * (toPos.y - fromPos.y);
    }
    return container;
  };
};
