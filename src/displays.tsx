import { Action, ActionPanel, Color, Icon, Keyboard, List, showToast, Toast } from "@raycast/api";
import { showFailureToast, usePromise } from "@raycast/utils";
import { markIntendedMirror } from "./lib/actions";
import {
  DisplayInfo,
  describeMode,
  listDisplays,
  resolutionLabel,
  setMainDisplay,
  setMirror,
  unmirror,
} from "./lib/display";

export default function Command() {
  const { data, isLoading, revalidate } = usePromise(listDisplays);
  const displays = data ?? [];

  async function run(title: string, work: () => Promise<void>) {
    const toast = await showToast({ style: Toast.Style.Animated, title });
    try {
      await work();
      await toast.hide();
      // Give WindowServer a moment to settle before re-reading state.
      setTimeout(revalidate, 800);
    } catch (error) {
      await toast.hide();
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
          onMirror={(source) =>
            run(`Mirroring ${d.name} to ${source.name}…`, async () => {
              await setMirror(d.id, source.id);
              await markIntendedMirror(true);
            })
          }
          onUnmirror={() =>
            run(`Extending ${d.name}…`, async () => {
              await unmirror(d.id);
              await markIntendedMirror(false);
            })
          }
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
  onMirror: (source: DisplayInfo) => void;
  onUnmirror: () => void;
  onMakeMain: () => void;
  onRefresh: () => void;
}) {
  const { display: d, all } = props;
  const copiesAnother = d.mirrorsDisplayId !== 0;
  const isMirrorSource = d.isMirroring && !copiesAnother;

  // Displays this one could show a copy of. A display that other displays already copy is left
  // alone: detach it first rather than turning the set inside out in one step.
  const sources = isMirrorSource ? [] : all.filter((o) => o.id !== d.id && o.id !== d.mirrorsDisplayId);

  const accessories: List.Item.Accessory[] = [];
  if (d.isMain) accessories.push({ tag: { value: "Main", color: Color.Blue } });
  if (d.isBuiltin) accessories.push({ tag: "Built-in" });
  accessories.push({
    tag: {
      value: describeMode(d, all),
      color: copiesAnother ? Color.Orange : d.isMirroring ? Color.Yellow : Color.Green,
    },
  });

  return (
    <List.Item
      icon={d.isBuiltin ? Icon.Mobile : Icon.Monitor}
      title={d.name}
      subtitle={resolutionLabel(d)}
      accessories={accessories}
      actions={
        <ActionPanel>
          <ActionPanel.Section title={`${d.name} should`}>
            {sources.map((o) => (
              <Action key={o.id} title={`Mirror ${o.name}`} icon={Icon.Duplicate} onAction={() => props.onMirror(o)} />
            ))}
            {d.isMirroring && (
              <Action
                title={isMirrorSource ? "Stop Being Mirrored" : "Stop Mirroring"}
                icon={Icon.AppWindowSidebarRight}
                onAction={props.onUnmirror}
              />
            )}
            {!d.isMain && !copiesAnother && (
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
