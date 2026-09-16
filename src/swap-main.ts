import { runCommand, swapMainDisplay } from "./lib/actions";

export default async function Command() {
  await runCommand(swapMainDisplay);
}
