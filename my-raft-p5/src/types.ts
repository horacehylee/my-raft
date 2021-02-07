import { Message } from "my-raft-core";

export interface MessageWrapper {
  id: string;
  ticks: number;
  tickLeft: number;
  message: Message;
}

export interface MessageChannel {
  id: string;
  messages: MessageWrapper[];
  active: boolean;
}

export interface XY {
  x: number;
  y: number;
}
