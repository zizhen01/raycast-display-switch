import { Action, ActionPanel, Color, Icon, Keyboard, List, showToast, Toast } from "@raycast/api";
import { showFailureToast, usePromise } from "@raycast/utils";
import { markIntendedMirror } from "./lib/actions";
import {
  DisplayInfo,
  describeMode,
  listDisplays,
  mirrorSource,
  resolutionLabel,
  setMainDisplay,
  setMirror,
  unmirror,
} from "./lib/display";

export default function Command() {
  const { data, isLoading, revalidate } = usePromise(listDisplays);
  const displays = data ?? [];
  const source = mirrorSource(displays);

  async function run(title: string, work: () => Promise<void>) {
    const toast = await showToast({ style: Toast.Style.Animated, title });
    try {
      await work();
      toast.style = Toast.Style.Success;
      toast.title = "Done";
      // Give WindowServer a moment to settle before re-reading state.
      setTimeout(revalidate, 800);
    } catch (error) {
      toast.hide();
      await showFailureToast(error, { title: "Display change failed" });
    }
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search displays…">
      {displays.map((d) => (
        <DisplayItem
          key={d.id}
          display={d}
          all={displays}
          source={source}
          onMirror={() =>
            source &&
            run(`Mirroring ${d.name} to ${source.name}…`, async () => {
              await setMirror(d.id, source.id);
              await markIntendedMirror(true);
            })
          }
          onUnmirror={() => run(`Extending ${d.name}…`, () => unmirror(d.id))}
          onMakeMain={() => run(`Making ${d.name} the main display…`, () => setMainDisplay(d.id))}
          onRefresh={revalidate}
        />
      ))}
      {!isLoading && displays.length === 0 && <List.EmptyView title="No displays found" />}
    </List>
  );
}

function DisplayItem(props: {
  display: DisplayInfo;
  all: DisplayInfo[];
  source?: DisplayInfo;
  onMirror: () => void;
  onUnmirror: () => void;
  onMakeMain: () => void;
  onRefresh: () => void;
}) {
  const { display: d, all, source } = props;
  const mode = describeMode(d, all);
  const isMirror = d.mirrorsDisplayId !== 0;
  const canMirror = !!source && source.id !== d.id && !isMirror;

  const accessories: List.Item.Accessory[] = [];
  if (d.isMain) accessories.push({ tag: { value: "Main", color: Color.Blue } });
  if (d.isBuiltin) accessories.push({ tag: "Built-in" });
  accessories.push({
    tag: { value: mode, color: isMirror ? Color.Orange : d.isMirroring ? Color.Yellow : Color.Green },
  });

  return (
    <List.Item
      icon={d.isBuiltin ? Icon.Mobile : Icon.Monitor}
      title={d.name}
      subtitle={resolutionLabel(d)}
      accessories={accessories}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            {canMirror && <Action title={`Mirror ${source.name}`} icon={Icon.Duplicate} onAction={props.onMirror} />}
            {d.isMirroring && (
              <Action title="Stop Mirroring (Extend)" icon={Icon.AppWindowSidebarRight} onAction={props.onUnmirror} />
            )}
            {!d.isMain && !isMirror && (
              <Action
                title="Set as Main Display"
                icon={Icon.Star}
                shortcut={{ modifiers: ["cmd"], key: "m" }}
                onAction={props.onMakeMain}
              />
            )}
          </ActionPanel.Section>
          <ActionPanel.Section>
            <Action
              title="Refresh"
              icon={Icon.ArrowClockwise}
              shortcut={Keyboard.Shortcut.Common.Refresh}
              onAction={props.onRefresh}
            />
            <Action.CopyToClipboard
              title="Copy Display Name"
              content={d.name}
              shortcut={{ modifiers: ["cmd"], key: "c" }}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}
