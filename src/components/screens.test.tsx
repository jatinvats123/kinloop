// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { expectNoAxeViolations } from "@/test/axe";
import { makeCircle, makeItem, makeMember } from "@/test/fixtures";
import { CreateCircleForm } from "./auth/create-circle-form";
import { SignInForm } from "./auth/sign-in-form";
import { AppointmentForm } from "./care/appointment-form";
import { ItemForm } from "./care/item-form";
import {
  AddMemberForm,
  EditMemberForm,
  ProfileForm,
  RegeneratePasscodeForm,
} from "./care/member-forms";
import { PageHeader, SavedNotice } from "./common/page-header";
import { FormMessage } from "./common/submit-button";
import { LiveTodayCard } from "./landing/live-today-card";
import { DemoPanel } from "./shell/demo-panel";
import { Logo } from "./shell/logo";
import { NavTabs } from "./shell/nav-tabs";
import { PublicFrame } from "./shell/public-frame";
import { ReadAloud, TextSizeControl } from "./today/comfort-controls";
import { SkipForm } from "./today/skip-form";
import { TakeSlotForm } from "./today/take-slot-form";

vi.mock("next/navigation", () => ({ usePathname: () => "/today" }));

const ok = vi.fn(async () => ({ ok: true as const }));
const voidAction = vi.fn(async () => undefined);

describe("public screens", () => {
  it("sign-in form labels both fields and has no axe violations", async () => {
    const { container } = render(
      <PublicFrame title="Sign in" intro="Use your code.">
        <SignInForm action={ok} />
      </PublicFrame>,
    );
    expect(screen.getByLabelText(/Circle code/)).toHaveAttribute("autocomplete", "off");
    expect(screen.getByLabelText(/Your passcode/)).toHaveAttribute("inputmode", "numeric");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Sign in");
    await expectNoAxeViolations(container);
  });

  it("create-circle form asks for the creator's name unless they are the elder", async () => {
    const { container } = render(
      <CreateCircleForm action={vi.fn(async () => ({ ok: true as const }))} />,
    );
    expect(screen.getByLabelText(/Your name/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("The elder"));
    expect(screen.queryByLabelText(/Your name/)).toBeNull();
    await expectNoAxeViolations(container);
  });

  it("landing Today card fills a petal when a slot is taken", () => {
    render(<LiveTodayCard />);
    expect(screen.getByText("1 of 4 taken today")).toBeInTheDocument();
    for (let i = 0; i < 3; i += 1)
      fireEvent.click(screen.getByRole("button", { name: "I've taken these" }));
    expect(screen.getByText("All done for today")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start the day again" }));
    expect(screen.getByText("0 of 4 taken today")).toBeInTheDocument();
  });
});

describe("care forms", () => {
  it("item form adapts to the kind and manages times", async () => {
    const { container } = render(<ItemForm action={ok} today="2026-11-14" />);
    expect(screen.getByLabelText(/Strength or dose/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Add another time/ }));
    expect(screen.getAllByLabelText(/^Time \d$/)).toHaveLength(2);
    fireEvent.change(screen.getByLabelText("Time 2"), { target: { value: "21:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Remove time 1" }));
    expect(screen.getByLabelText("Time 1")).toHaveValue("21:00");
    fireEvent.click(screen.getByLabelText(/Routine/));
    expect(screen.queryByLabelText(/Strength or dose/)).toBeNull();
    expect(screen.getByRole("button", { name: "Add routine" })).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("item form pre-fills an existing item", () => {
    render(<ItemForm action={ok} today="2026-11-14" item={makeItem({ endDate: "2026-12-01" })} />);
    expect(screen.getByLabelText(/Medicine name/)).toHaveValue("Metformin");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });

  it("appointment form is accessible in add and edit modes", async () => {
    const { container, rerender } = render(
      <AppointmentForm action={ok} defaults={{ date: "2026-11-15", time: "10:00" }} />,
    );
    expect(screen.getByRole("button", { name: "Add appointment" })).toBeInTheDocument();
    await expectNoAxeViolations(container);
    rerender(
      <AppointmentForm
        action={ok}
        defaults={{ id: "a", doctor: "Dr. Rao", date: "2026-11-15", time: "10:00" }}
      />,
    );
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });

  it("member and profile forms are accessible", async () => {
    const elder = makeMember();
    const ramesh = makeMember({
      id: "r",
      name: "Ramesh",
      role: "caretaker",
      access: "view",
      isOrganiser: false,
    });
    const { container } = render(
      <>
        <AddMemberForm action={vi.fn(async () => ({ ok: true as const }))} />
        <EditMemberForm action={ok} member={elder} managing={false} />
        <EditMemberForm action={ok} member={ramesh} managing={false} />
        <RegeneratePasscodeForm
          action={vi.fn(async () => ({ ok: true as const }))}
          memberId="r"
          label="New passcode"
        />
        <ProfileForm action={ok} profile={makeCircle().profile} />
      </>,
    );
    expect(screen.getByLabelText("Remind me about doses")).toBeChecked();
    expect(screen.getByLabelText(/Organiser/)).toBeInTheDocument();
    expect(screen.getByLabelText("Blood group")).toHaveValue("");
    await expectNoAxeViolations(container);
  });
});

describe("Today controls", () => {
  it("take form sends the slot, every item and routine readings", async () => {
    const { container } = render(
      <TakeSlotForm
        action={ok}
        slotAt="2026-11-14T02:30:00.000Z"
        primary
        label="I've taken these"
        readingLabel="Reading (optional)"
        items={[
          { id: "a", name: "Metformin", needsReading: false },
          { id: "b", name: "Check blood pressure", needsReading: true },
        ]}
      />,
    );
    expect(container.querySelectorAll('input[name="itemIds"]')).toHaveLength(2);
    expect(screen.getByLabelText("Check blood pressure: Reading (optional)")).toHaveAttribute(
      "name",
      "reading:b",
    );
    await expectNoAxeViolations(container);
  });

  it("skip form offers the fixed reasons inside a disclosure", async () => {
    const { container } = render(
      <SkipForm
        action={ok}
        slotAt="s"
        itemId="a"
        itemName="Metformin"
        title="Skip"
        question="Why are you skipping Metformin?"
        reasons={[
          { value: "felt-unwell", label: "Felt unwell" },
          { value: "other", label: "Other" },
        ]}
      />,
    );
    expect(screen.getByLabelText("Felt unwell")).toBeChecked();
    expect(
      screen.getByRole("group", { name: "Why are you skipping Metformin?" }),
    ).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("text size control marks the current size", async () => {
    const { container } = render(
      <TextSizeControl action={voidAction} current="large" label="Text size" />,
    );
    expect(screen.getByRole("button", { name: "Large text" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expectNoAxeViolations(container);
  });

  it("read aloud speaks the summary and can stop", () => {
    const speak = vi.fn();
    const cancel = vi.fn();
    Object.assign(window, { speechSynthesis: { speak, cancel } });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        constructor(public text: string) {}
      },
    );
    render(
      <ReadAloud text="Good morning" startLabel="Read today aloud" stopLabel="Stop reading" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Read today aloud" }));
    expect(speak).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Stop reading" }));
    expect(cancel).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("shell", () => {
  it("navigation marks the current page in both navs", async () => {
    const { container } = render(
      <NavTabs
        items={[
          { href: "/today", label: "Today", icon: "today" },
          { href: "/medicines", label: "Medicines", icon: "medicines" },
        ]}
      />,
    );
    const current = screen.getAllByRole("link", { current: "page" });
    expect(current).toHaveLength(2);
    expect(current[0]).toHaveTextContent("Today");
    await expectNoAxeViolations(container);
  });

  it("demo panel lists every role and the demo sign-in details", async () => {
    const elder = makeMember();
    const priya = makeMember({ id: "p", name: "Priya", role: "family" });
    const circle = makeCircle({
      isDemo: true,
      demoAccess: { code: "ACDE-FGHJ", "m-elder": "123456", p: "654321" },
    });
    const { container } = render(
      <DemoPanel
        circle={circle}
        members={[elder, priya]}
        current={elder}
        switchAction={voidAction}
      />,
    );
    expect(screen.getByRole("button", { name: /Kamla Devi/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("654321")).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("page header, notices, logo and messages render", () => {
    render(
      <>
        <PageHeader title="Visits" intro="Upcoming" action={<button type="button">Add</button>} />
        <SavedNotice show />
        <SavedNotice show={false} text="hidden" />
        <Logo tone="dark" />
        <FormMessage state={{ ok: false, error: "Nope" }} />
        <FormMessage state={undefined} />
      </>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Visits");
    expect(screen.getByText("Saved.")).toBeInTheDocument();
    expect(screen.queryByText("hidden")).toBeNull();
    expect(screen.getByText("Nope")).toBeInTheDocument();
  });
});
