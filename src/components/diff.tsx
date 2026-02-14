import { Box, render, Text } from "ink";
import type { DiffResult } from "@/lib/diff";
import { get_value_change_indicator, mask_secret_value } from "@/lib/utils";
import { render_success } from "./errors";

export function render_diff(diff_result: DiffResult, context: "push" | "pull" = "push") {
  if (diff_result.total_count === 0) {
    render_success({ message: "Everything up to date" });
    return;
  }

  const header_text = context === "push" ? "Changes to be pushed:" : "Changes to be pulled:";
  const tip_text =
    context === "push"
      ? "💡 Use --apply to push these changes to remote"
      : "💡 Use --apply to pull these changes to your env file";

  render(
    <Box flexDirection="column" paddingY={1}>
      <Box marginBottom={1}>
        <Text color="blue" bold>
          {header_text}
        </Text>
      </Box>

      {diff_result.changes.map((change) => (
        <Box key={`diff-changes-${change.key}`} marginLeft={2}>
          {change.type === "added" && (
            <>
              <Text color="green" bold>
                +{" "}
              </Text>
              <Text>
                {change.key}={mask_secret_value(change.new_value || "")}
              </Text>
              <Text color="green"> (added)</Text>
            </>
          )}
          {change.type === "modified" && (
            <>
              <Text color="yellow" bold>
                ~{" "}
              </Text>
              <Text>
                {change.key}={mask_secret_value(change.new_value || "")}
              </Text>
              <Text color="yellow"> {get_value_change_indicator(change.old_value || "", change.new_value || "")}</Text>
            </>
          )}
          {change.type === "deleted" && (
            <>
              <Text color="red" bold>
                -{" "}
              </Text>
              <Text>{change.key}</Text>
              <Text color="red"> (deleted)</Text>
            </>
          )}
        </Box>
      ))}

      <Box marginTop={1}>
        <Text color="cyan">
          {diff_result.total_count} changes total ({diff_result.added_count} added, {diff_result.modified_count}{" "}
          modified, {diff_result.deleted_count} deleted)
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text color="yellow">{tip_text}</Text>
      </Box>
    </Box>,
  );
}
