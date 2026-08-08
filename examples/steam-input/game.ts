import path from "node:path";
import steamworks from "steam-bridge";
import { steamInputDefinition } from "./steam-input.generated";

const client = steamworks.init(Number(process.env.STEAM_APP_ID));
const session = client.input
  .createSession({
    definition: steamInputDefinition,
    controllers: "individual",
    manifestPath: process.env.STEAM_INPUT_MANIFEST
      ? path.resolve(process.env.STEAM_INPUT_MANIFEST)
      : null
  })
  .start();

session.activateActionSet("gameplay");

export function updateGame(): void {
  const controller = session.update().primaryController;
  if (!controller) return;
  if (controller.digital.jump.pressedThisFrame) console.log("jump");
  if (controller.digital.pause.pressedThisFrame) console.log("pause");
  if (controller.analog.move.active) {
    console.log("move", controller.analog.move.x, controller.analog.move.y);
  }
}

export function shutdownGame(): void {
  session.dispose();
  steamworks.shutdown();
}
