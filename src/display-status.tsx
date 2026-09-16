import { Color, Icon, MenuBarExtra, launchCommand, LaunchType, showHUD } from "@raycast/api";
import { showFailureToast, usePromise } from "@raycast/utils";
import { autoExtendIfNeeded, extendDisplays, mirrorDisplays, swapMainDisplay } from "./lib/actions";
import { describeMode, isMirrored, listDisplays } from "./lib/display";

/** Read state, and on background refresh undo mirroring macOS turned on by itself (if the preference is on). */
async function loadState() {
  const displays = await listDisplays();
  const undone = await autoExtendIfNeeded(displays);
  return undone ? listDisplays() : displays;
}

export default function Command() {
  const { data, isLoading, revalidate } = usePromise(loadState);
  const displays = data ?? [];
  const mirrored = isMirrored(displays);
  const single = displays.length < 2;
  const main = displays.find((d) => d.isMain);

  const run = (op: () => Promise<string>) => async () => {
    try {
      await showHUD(await op());
    } catch (error) {
      await showFailureToast(error, { title: "Display change failed" });
    } finally {
      setTimeout(revalidate, 800);
    }
  };

  const state = single ? "Single display" : mirrored ? "Mirrored" : `Extended · ${main?.name ?? ""} is main`;

  return (
    <MenuBarExtra
      isLoading={isLoading}
      icon={{ source: mirrored ? "mirrored.svg" : "extended.svg", tintColor: Color.PrimaryText }}
      tooltip={state}
    >
      <MenuBarExtra.Section title={state}>
        <MenuBarExtra.Item
          title="Mirror Displays"
          icon={mirrored ? Icon.CheckCircle : Icon.Circle}
          onAction={single ? undefined : run(mirrorDisplays)}
        />
        <MenuBarExtra.Item
          title="Extend Displays"
          icon={!mirrored && !single ? Icon.CheckCircle : Icon.Circle}
          onAction={single ? undefined : run(extendDisplays)}
        />
        {!single && !mirrored && (
          <MenuBarExtra.Item title="Swap Main Display" icon={Icon.Switch} onAction={run(swapMainDisplay)} />
        )}
      </MenuBarExtra.Section>
      <MenuBarExtra.Section title="Displays">
        {displays.map((d) => (
          <MenuBarExtra.Item
            key={d.id}
            title={d.name}
            subtitle={`${describeMode(d, displays)}${d.isMain ? " · Main" : ""}`}
            icon={d.isBuiltin ? Icon.Mobile : Icon.Monitor}
            onAction={() => launchCommand({ name: "displays", type: LaunchType.UserInitiated })}
          />
        ))}
      </MenuBarExtra.Section>
      <MenuBarExtra.Section>
        <MenuBarExtra.Item title="Refresh" icon={Icon.ArrowClockwise} onAction={revalidate} />
      </MenuBarExtra.Section>
    </MenuBarExtra>
  );
}
