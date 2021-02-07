import { DisplayObject } from "pixi.js";
import { Message } from "my-raft-core";
export declare type RenderComponent<T> = (param: T) => DisplayObject;
export interface Renderer<T> {
    setup: () => void;
    draw: (param: T) => void;
}
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
//# sourceMappingURL=types.d.ts.map