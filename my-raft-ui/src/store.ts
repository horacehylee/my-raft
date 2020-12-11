import { Message, NodeState } from "my-raft-core";
import { MessageWrapper } from "./types";

export interface State {
  nodeStates: Record<number, NodeState>;
  messageChannels: Record<string, MessageWrapper[]>;
}

export const createStore = (init: () => State) => {
  let state: State = init();
  return {
    getState: (): State => {
      return state;
    },
    setState: (updater: (state: State) => State) => {
      state = updater(state);
    },
  };
};
