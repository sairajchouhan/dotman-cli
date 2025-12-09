import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DiffResult } from "@/lib/diff";

const mock_render = vi.fn(() => {});
const mock_render_success = vi.fn(() => {});

vi.mock("ink", () => ({
  render: mock_render,
  Box: ({ children }: { children?: unknown }) => children,
  Text: ({ children }: { children?: unknown }) => children,
}));

vi.mock("@/components/errors", () => ({
  render_success: mock_render_success,
}));

vi.mock("@/lib/utils", () => ({
  mask_secret_value: (value: string) => (value.length > 2 ? `${value[0]}***${value[value.length - 1]}` : "***"),
  get_value_change_indicator: (old_value: string, new_value: string) =>
    old_value.length === new_value.length ? "(modified)" : "(length changed)",
}));

const { render_diff } = await import("@/components/diff");

describe("render_diff", () => {
  beforeEach(() => {
    mock_render.mockClear();
    mock_render_success.mockClear();
  });

  describe("empty diff", () => {
    it("renders success when no changes", () => {
      const diff_result: DiffResult = {
        changes: [],
        added_count: 0,
        modified_count: 0,
        deleted_count: 0,
        total_count: 0,
      };

      render_diff(diff_result);

      expect(mock_render_success).toHaveBeenCalledWith({
        message: "Everything up to date",
      });
      expect(mock_render).not.toHaveBeenCalled();
    });
  });

  describe("with changes", () => {
    it("renders added change", () => {
      const diff_result: DiffResult = {
        changes: [{ type: "added", key: "API_KEY", new_value: "secret123" }],
        added_count: 1,
        modified_count: 0,
        deleted_count: 0,
        total_count: 1,
      };

      render_diff(diff_result);

      expect(mock_render).toHaveBeenCalled();
      expect(mock_render_success).not.toHaveBeenCalled();
    });

    it("renders modified change", () => {
      const diff_result: DiffResult = {
        changes: [{ type: "modified", key: "API_KEY", old_value: "old", new_value: "new" }],
        added_count: 0,
        modified_count: 1,
        deleted_count: 0,
        total_count: 1,
      };

      render_diff(diff_result);

      expect(mock_render).toHaveBeenCalled();
    });

    it("renders deleted change", () => {
      const diff_result: DiffResult = {
        changes: [{ type: "deleted", key: "OLD_KEY", old_value: "value" }],
        added_count: 0,
        modified_count: 0,
        deleted_count: 1,
        total_count: 1,
      };

      render_diff(diff_result);

      expect(mock_render).toHaveBeenCalled();
    });

    it("renders mixed changes", () => {
      const diff_result: DiffResult = {
        changes: [
          { type: "added", key: "NEW_KEY", new_value: "new" },
          { type: "modified", key: "CHANGED_KEY", old_value: "old", new_value: "changed" },
          { type: "deleted", key: "REMOVED_KEY", old_value: "gone" },
        ],
        added_count: 1,
        modified_count: 1,
        deleted_count: 1,
        total_count: 3,
      };

      render_diff(diff_result);

      expect(mock_render).toHaveBeenCalled();
    });
  });

  describe("context", () => {
    it("uses push context by default", () => {
      const diff_result: DiffResult = {
        changes: [{ type: "added", key: "KEY", new_value: "val" }],
        added_count: 1,
        modified_count: 0,
        deleted_count: 0,
        total_count: 1,
      };

      render_diff(diff_result);

      expect(mock_render).toHaveBeenCalled();
    });

    it("accepts pull context", () => {
      const diff_result: DiffResult = {
        changes: [{ type: "added", key: "KEY", new_value: "val" }],
        added_count: 1,
        modified_count: 0,
        deleted_count: 0,
        total_count: 1,
      };

      render_diff(diff_result, "pull");

      expect(mock_render).toHaveBeenCalled();
    });
  });
});
