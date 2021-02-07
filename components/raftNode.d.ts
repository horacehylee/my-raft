import { RenderComponent } from "../types";
import { State } from "../simulator";
export declare type RaftNode = RenderComponent<State> & {
    id: number;
};
export interface RaftNodeParam {
    id: number;
}
export declare const raftNode: ({ id }: RaftNodeParam) => RaftNode;
//# sourceMappingURL=raftNode.d.ts.map