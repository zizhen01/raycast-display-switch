import { runCommand, toggleDisplays } from "./lib/actions";

export default async function Command() {
  await runCommand(toggleDisplays);
}
