import { describe, expect, it } from "vitest";
import { formToObject } from "./validation";

describe("formToObject", () => {
  it("keeps the first value of plain fields and every non-empty value of array fields", () => {
    const fd = new FormData();
    fd.append("name", "Metformin");
    fd.append("name", "ignored");
    fd.append("times", "08:00");
    fd.append("times", "");
    fd.append("times", "20:00");
    expect(formToObject(fd, ["times", "daysOfWeek"])).toEqual({
      name: "Metformin",
      times: ["08:00", "20:00"],
      daysOfWeek: [],
    });
  });

  it("drops Next.js action fields and file values", () => {
    const fd = new FormData();
    fd.append("$ACTION_ID_abc", "x");
    fd.append("photo", new Blob(["x"]), "x.png");
    fd.append("note", "hi");
    expect(formToObject(fd)).toEqual({ photo: "", note: "hi" });
  });
});
