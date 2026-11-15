// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoAxeViolations } from "@/test/axe";
import { Button, buttonClass } from "./button";
import { Card, CardHeader } from "./card";
import { ChoiceGroup, SelectField, TextArea, TextField } from "./field";

describe("form fields", () => {
  it("links label, hint and error to the control", async () => {
    const { container } = render(
      <form>
        <TextField label="Name" name="name" hint="As on the strip" error="Enter a name" required />
        <TextArea label="Notes" name="notes" hint="Optional" />
        <SelectField
          label="Kind"
          name="kind"
          options={[{ value: "medicine", label: "Medicine" }]}
          error="Pick one"
        />
        <ChoiceGroup
          legend="Days"
          name="days"
          type="checkbox"
          options={[{ value: "1", label: "Mon" }]}
          defaultValues={["1"]}
          hint="Pick days"
          error="At least one"
        />
      </form>,
    );
    const input = screen.getByLabelText(/Name/);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("As on the strip Enter a name");
    expect(screen.getByLabelText("Notes")).toHaveAccessibleDescription("Optional");
    expect(screen.getByLabelText("Mon")).toBeChecked();
    await expectNoAxeViolations(container);
  });
});

describe("buttons and cards", () => {
  it("renders pill buttons with a safe default type", async () => {
    const { container } = render(
      <Card>
        <CardHeader
          title="Medicines"
          action={
            <a href="/x" className={buttonClass("quiet")}>
              Add
            </a>
          }
        />
        <Button>Save</Button>
        <Button variant="attention" size="lg">
          Remove
        </Button>
      </Card>,
    );
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("type", "button");
    expect(buttonClass("primary", "lg")).toContain("min-h-14");
    await expectNoAxeViolations(container);
  });
});
