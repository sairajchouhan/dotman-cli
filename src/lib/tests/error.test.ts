import { describe, expect, it } from "vitest";
import { CustomError } from "@/lib/error";

describe("CustomError", () => {
  describe("construction", () => {
    it("creates error with message only", () => {
      const error = new CustomError("Something went wrong");

      expect(error.message).toBe("Something went wrong");
      expect(error.name).toBe("CustomError");
      expect(error.suggestion).toBeUndefined();
      expect(error.cause).toBeUndefined();
    });

    it("creates error with message and suggestion", () => {
      const error = new CustomError("Something went wrong", {
        suggestion: "Try again later",
      });

      expect(error.message).toBe("Something went wrong");
      expect(error.suggestion).toBe("Try again later");
      expect(error.cause).toBeUndefined();
    });

    it("creates error with message and cause", () => {
      const cause = new Error("Original error");
      const error = new CustomError("Something went wrong", { cause });

      expect(error.message).toBe("Something went wrong");
      expect(error.cause).toBe(cause);
      expect(error.suggestion).toBeUndefined();
    });

    it("creates error with message, suggestion, and cause", () => {
      const cause = new Error("Original error");
      const error = new CustomError("Something went wrong", {
        suggestion: "Check the logs",
        cause,
      });

      expect(error.message).toBe("Something went wrong");
      expect(error.suggestion).toBe("Check the logs");
      expect(error.cause).toBe(cause);
    });
  });

  describe("inheritance", () => {
    it("is instance of Error", () => {
      const error = new CustomError("Test error");

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(CustomError);
    });

    it("has proper stack trace", () => {
      const error = new CustomError("Test error");

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain("CustomError");
    });
  });

  describe("edge cases", () => {
    it("handles empty message", () => {
      const error = new CustomError("");

      expect(error.message).toBe("");
    });

    it("handles empty suggestion", () => {
      const error = new CustomError("Error", { suggestion: "" });

      expect(error.suggestion).toBeUndefined();
    });

    it("handles undefined options", () => {
      const error = new CustomError("Error", undefined);

      expect(error.suggestion).toBeUndefined();
      expect(error.cause).toBeUndefined();
    });

    it("handles empty options object", () => {
      const error = new CustomError("Error", {});

      expect(error.suggestion).toBeUndefined();
      expect(error.cause).toBeUndefined();
    });
  });
});
