import { fusebox, sparky, pluginLink } from "fuse-box";
import { pluginTypeChecker } from "fuse-box-typechecker";

class Context {
  runServer = false;
  getConfig = () =>
    fusebox({
      target: "browser",
      entry: "src/index.ts",
      webIndex: {
        template: "src/index.html",
      },
      cache: true,
      devServer: {
        enabled: this.runServer,
        open: this.runServer,
      },
      plugins: [
        pluginTypeChecker({
          tsConfig: "./tsconfig",
        }),
        pluginLink(/\.mp3/, { useDefault: true }),
      ],
    });
}
const { task } = sparky<Context>(Context);

task("default", async (ctx) => {
  ctx.runServer = true;
  const fuse = ctx.getConfig();
  await fuse.runDev();
});

task("preview", async (ctx) => {
  ctx.runServer = true;
  const fuse = ctx.getConfig();
  await fuse.runProd({ uglify: false });
});

task("dist", async (ctx) => {
  ctx.runServer = false;
  const fuse = ctx.getConfig();
  await fuse.runProd({ uglify: false });
});
