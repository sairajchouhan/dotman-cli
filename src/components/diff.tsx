import { Box, render, Text } from "ink";
import type { DiffResult } from "@/lib/diff";
import { get_value_change_indicator, mask_secret_value } from "@/lib/utils";
import { messages } from "@/messages";
import { render_success } from "./errors";

export function render_diff(diff_result: DiffResult, context: "push" | "pull" = "push") {
  if (diff_result.total_count === 0) {
    render_success({ message: messages.diff.up_to_date });
    return;
  }

  const header_text = context === "push" ? messages.diff.push_header : messages.diff.pull_header;
  const tip_text = context === "push" ? messages.diff.push_tip : messages.diff.pull_tip;

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
              <Text color="green"> {messages.diff.added_label}</Text>
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
              <Text color="red"> {messages.diff.deleted_label}</Text>
            </>
          )}
        </Box>
      ))}

      <Box marginTop={1}>
        <Text color="cyan">
          {messages.diff.summary(
            diff_result.total_count,
            diff_result.added_count,
            diff_result.modified_count,
            diff_result.deleted_count,
          )}
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text color="yellow">{tip_text}</Text>
      </Box>
    </Box>,
  );
}
