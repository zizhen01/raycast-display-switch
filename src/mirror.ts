import { mirrorDisplays, runCommand } from "./lib/actions";

export default async function Command() {
  await runCommand(mirrorDisplays);
}
