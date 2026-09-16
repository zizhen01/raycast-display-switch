import { extendDisplays, runCommand } from "./lib/actions";

export default async function Command() {
  await runCommand(extendDisplays);
}
