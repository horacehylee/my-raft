import produce, { Draft } from "immer";
import { createNode, Message, Node, NodeState } from "my-raft-core";
import { Observable } from "rxjs/internal/Observable";
import { merge } from "rxjs/internal/observable/merge";
import { MessageChannel } from "./types";
import { v4 as uuidv4 } from "uuid";

export interface SimulatorOptions {
  numOfNodes: number;
  messageChannelTicks: number;
  nodeElectionTicks: number;
  nodeHeartbeatTicks: number;
}

export interface Simulator {
  // TODO: jump to specific time

  tick: () => void;
  destroy: () => void;
  getState: () => State;
}

export interface State {
  nodeStates: Record<number, NodeState>;
  messageChannels: Record<string, MessageChannel>;
}

export function createSimulator(options: SimulatorOptions): Simulator {
  const { numOfNodes, messageChannelTicks } = options;

  const nodes = createNodes(numOfNodes, options);
  let state = createState(nodes);

  const messagesBuffer: Message[] = [];
  const messageSentSubscription = getObservableForNodes(
    nodes,
    (node) => node.getObservables().messageSent$
  ).subscribe((message) => {
    console.log(`${message.from} sent message`, message);
    messagesBuffer.push(message);
  });

  function destroy() {
    messageSentSubscription.unsubscribe();
  }

  const nodesMap = nodes.reduce<Record<number, Node>>((map, node) => {
    map[node.getState().id] = node;
    return map;
  }, {});

  function tick() {
    state = produce((draft: Draft<State>) => {
      // process messages to be sent
      while (messagesBuffer.length > 0) {
        const message = messagesBuffer.shift()!;
        const channelKey = `${message.from}-${message.to}`;
        draft.messageChannels[channelKey].messages.push({
          id: uuidv4(),
          tickLeft: messageChannelTicks,
          ticks: messageChannelTicks,
          message: message,
        });
      }

      // process messages
      for (const channelKey of Object.keys(draft.messageChannels)) {
        const wrappers = draft.messageChannels[channelKey].messages;
        wrappers.forEach((w) => w.tickLeft--);

        const received = wrappers.filter((w) => w.tickLeft <= 0);
        const remaining = wrappers.filter((w) => w.tickLeft > 0);
        draft.messageChannels[channelKey].messages = remaining;

        for (const wrapper of received) {
          const message = wrapper.message;
          nodesMap[message.to].receive(message);
        }
      }

      // process node
      for (const node of nodes) {
        node.tick();

        const nodeState = node.getState();
        draft.nodeStates[nodeState.id] = nodeState;
      }
    })(state);
  }

  function getState() {
    return state;
  }

  return {
    tick,
    destroy,
    getState,
  };
}

function createNodes(
  numOfNodes: number,
  { nodeElectionTicks, nodeHeartbeatTicks }: SimulatorOptions
): Node[] {
  const nodeIds = Array.from({ length: numOfNodes }, (_, i) => i + 1);
  return nodeIds.map((id) => {
    return createNode({
      id: id,
      peers: nodeIds.filter((i) => i !== id),
      electionTick: nodeElectionTicks,
      heartbeatTick: nodeHeartbeatTicks,
      logger: console,
    });
  });
}

function createState(nodes: Node[]): State {
  const nodeStates: Record<number, NodeState> = {};
  for (const node of nodes) {
    const nodeState = node.getState();
    nodeStates[nodeState.id] = nodeState;
  }
  const messageChannels: Record<string, MessageChannel> = {};
  for (const node of nodes) {
    for (const otherNode of nodes) {
      if (node === otherNode) {
        continue;
      }
      const nodeId = node.getState().id;
      const otherNodeId = otherNode.getState().id;
      const key = `${nodeId}-${otherNodeId}`;
      messageChannels[key] = {
        id: key,
        active: true,
        messages: [],
      };
    }
  }
  return {
    nodeStates: nodeStates,
    messageChannels: messageChannels,
  };
}

function getObservableForNodes<T>(
  nodes: Node[],
  getObservable: (node: Node) => Observable<T>
) {
  const observables = nodes.map((node) => getObservable(node));
  return merge(...observables);
}
