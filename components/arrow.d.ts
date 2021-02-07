import { RenderComponent, XY } from "../types";
export interface ArrowRenderParam {
    fromPos: XY;
    toPos: XY;
    forwardSize: number;
    sideSize: number;
    color: number;
}
export declare const arrow: () => RenderComponent<ArrowRenderParam>;
//# sourceMappingURL=arrow.d.ts.map