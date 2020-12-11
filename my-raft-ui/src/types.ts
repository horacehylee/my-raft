import { State } from "./store";
import { DisplayObject } from "pixi.js";
import { Message } from "my-raft-core";

export type RenderComponent = (state: State) => DisplayObject;

export interface MessageWrapper {
  id: string;
  ticks: number;
  tickLeft: number;
  message: Message;
}

export interface XY {
  x: number;
  y: number;
}
