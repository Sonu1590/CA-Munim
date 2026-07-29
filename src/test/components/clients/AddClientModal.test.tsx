import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { AddClientModal } from "@/components/clients/AddClientModal";

// jsdom doesn't implement scrollIntoView (used by handleSave to jump to the
// first invalid field, and by the existing section-jump nav) — stub it so
// calling it doesn't throw.
beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

// M30, ISSUES.md — AddClientModal previously validated only on submit, one
// field at a time (DOB then PAN), with nothing marking an invalid field
// visually. These tests cover the fixed behavior: all required-field
// errors surface together on submit, and each clears independently once
// its own field becomes valid.
describe("AddClientModal", () => {
  it("collects and shows every required-field error at once on submit, not just the first", () => {
    render(<AddClientModal open onOpenChange={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Save Client" }));

    expect(screen.getByText("Full Name is required.")).toBeInTheDocument();
    expect(screen.getByText("Client Type is required.")).toBeInTheDocument();
    expect(screen.getByText("Date of Birth / Incorporation is required.")).toBeInTheDocument();
    expect(screen.getByText("PAN Number is required.")).toBeInTheDocument();
    expect(screen.getByText("Phone is required.")).toBeInTheDocument();
  });

  it("clears one field's error as it becomes valid while the others remain", () => {
    render(<AddClientModal open onOpenChange={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Save Client" }));
    expect(screen.getByText("Full Name is required.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Full Name *"), { target: { value: "Ramesh Kumar" } });
    fireEvent.blur(screen.getByLabelText("Full Name *"));

    expect(screen.queryByText("Full Name is required.")).not.toBeInTheDocument();
    expect(screen.getByText("Phone is required.")).toBeInTheDocument();
  });

  it("marks an invalid field with a blur-triggered error before the user ever submits", () => {
    render(<AddClientModal open onOpenChange={() => {}} />);

    expect(screen.queryByText("Full Name is required.")).not.toBeInTheDocument();

    fireEvent.blur(screen.getByLabelText("Full Name *"));

    expect(screen.getByText("Full Name is required.")).toBeInTheDocument();
  });
});
