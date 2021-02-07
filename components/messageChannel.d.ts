import { State } from "../simulator";
import { RenderComponent } from "../types";
import { XY } from "./../types";
export interface MessageChannelParam {
    from: number;
    fromPos: XY;
    to: number;
    toPos: XY;
}
export declare const messageChannel: ({ from, fromPos, to, toPos, }: MessageChannelParam) => RenderComponent<State>;
//# sourceMappingURL=messageChannel.d.ts.map