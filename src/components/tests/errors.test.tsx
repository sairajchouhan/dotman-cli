import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mock_render = vi.fn(() => {});

vi.mock("ink", () => ({
  render: mock_render,
  Box: ({ children }: { children?: unknown }) => children,
  Text: ({ children }: { children?: unknown }) => children,
}));

const { render_error, render_info, render_success, render_warning } = await import("@/components/errors");

describe("error rendering functions", () => {
  let mock_exit: { mockRestore: () => void };

  beforeEach(() => {
    mock_render.mockClear();
    mock_exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as () => never);
  });

  afterEach(() => {
    mock_exit.mockRestore();
  });

  describe("render_error", () => {
    it("renders error message", () => {
      render_error({ message: "Something went wrong", exit: false });

      expect(mock_render).toHaveBeenCalled();
    });

    it("renders error with suggestion", () => {
      render_error({ message: "Failed", suggestion: "Try again", exit: false });

      expect(mock_render).toHaveBeenCalled();
    });

    it("exits process by default", () => {
      render_error({ message: "Fatal error" });

      expect(mock_exit).toHaveBeenCalledWith(1);
    });

    it("does not exit when exit is false", () => {
      render_error({ message: "Non-fatal error", exit: false });

      expect(mock_exit).not.toHaveBeenCalled();
    });

    it("exits when exit is explicitly true", () => {
      render_error({ message: "Error", exit: true });

      expect(mock_exit).toHaveBeenCalledWith(1);
    });
  });

  describe("render_success", () => {
    it("renders success message", () => {
      render_success({ message: "Operation completed" });

      expect(mock_render).toHaveBeenCalled();
    });

    it("does not exit process", () => {
      render_success({ message: "Success" });

      expect(mock_exit).not.toHaveBeenCalled();
    });
  });

  describe("render_warning", () => {
    it("renders warning message", () => {
      render_warning({ message: "This might be a problem" });

      expect(mock_render).toHaveBeenCalled();
    });

    it("does not exit process", () => {
      render_warning({ message: "Warning" });

      expect(mock_exit).not.toHaveBeenCalled();
    });
  });

  describe("render_info", () => {
    it("renders info message", () => {
      render_info({ message: "For your information" });

      expect(mock_render).toHaveBeenCalled();
    });

    it("does not exit process", () => {
      render_info({ message: "Info" });

      expect(mock_exit).not.toHaveBeenCalled();
    });
  });
});
