import { Container } from "pixi.js";
export interface CircularProgressParam {
    startAngle: number;
    color: number;
    thickness: number;
    radius: number;
}
export declare const circularProgress: ({ startAngle, color, thickness, radius, }: CircularProgressParam) => ({ progress }: {
    progress: number;
}) => Container;
//# sourceMappingURL=circularProgress.d.ts.map