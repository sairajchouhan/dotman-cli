import { Box, render, Text } from "ink";

interface ErrorProps {
  message: string;
  suggestion?: string;
  exit?: boolean;
}

interface SimpleMessageProps {
  message: string;
}

export function render_error({ message, suggestion, exit = true }: ErrorProps) {
  render(
    <Box flexDirection="column" paddingY={1}>
      <Box marginBottom={suggestion ? 1 : 0}>
        <Text color="red" bold>
          ×{" "}
        </Text>
        <Text>{message}</Text>
      </Box>

      {suggestion && (
        <Box marginLeft={2}>
          <Text color="yellow">💡 {suggestion}</Text>
        </Box>
      )}
    </Box>,
  );

  if (exit) {
    process.exit(1);
  }
}

export function render_success({ message }: SimpleMessageProps) {
  render(
    <Box>
      <Text color="green" bold>
        ✓{" "}
      </Text>
      <Text>{message}</Text>
    </Box>,
  );
}

export function render_warning({ message }: SimpleMessageProps) {
  render(
    <Box>
      <Text color="yellow" bold>
        ▲{" "}
      </Text>
      <Text>{message}</Text>
    </Box>,
  );
}

export function render_info({ message }: SimpleMessageProps) {
  render(
    <Box>
      <Text color="blue" bold>
        →{" "}
      </Text>
      <Text>{message}</Text>
    </Box>,
  );
}
