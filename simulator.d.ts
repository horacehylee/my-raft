import { Node, NodeState } from "my-raft-core";
import { MessageChannel } from "./types";
export interface SimulatorOptions {
    numOfNodes: number;
    messageChannelTicks: number;
    nodeElectionTicks: number;
    nodeHeartbeatTicks: number;
}
export interface Simulator {
    tick: () => void;
    destroy: () => void;
    getState: () => State;
    getNodes: () => Node[];
    getNode: (id: number) => Node;
}
export interface State {
    nodeStates: Record<number, NodeState>;
    messageChannels: Record<string, MessageChannel>;
}
export declare function createSimulator(options: SimulatorOptions): Simulator;
//# sourceMappingURL=simulator.d.ts.map