// src/components/shared/OwnerPasscodeModal.test.js

import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import OwnerPasscodeModal from "./OwnerPasscodeModal";

import {
  confirmOwnerPasscodeChange,
  requestOwnerPasscodeChange,
} from "../../utils/snapshots/snapshotsApi";


jest.mock(
  "../../utils/snapshots/snapshotsApi",
  () => ({
    confirmOwnerPasscodeChange: jest.fn(),
    requestOwnerPasscodeChange: jest.fn(),
  })
);


beforeEach(() => {
  requestOwnerPasscodeChange.mockReset();
  confirmOwnerPasscodeChange.mockReset();
});


test("renders the passcode entry form when open", () => {
  render(
    <OwnerPasscodeModal open onClose={() => {}} onSubmit={() => {}} error="" />
  );

  expect(screen.getByPlaceholderText("Passcode")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Unlock" })).toBeInTheDocument();
});


test("clicking Forgot password? switches to the reset form", () => {
  render(
    <OwnerPasscodeModal open onClose={() => {}} onSubmit={() => {}} error="" />
  );

  fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));

  expect(
    screen.getByRole("button", { name: "Send verification code" })
  ).toBeInTheDocument();
  expect(screen.queryByPlaceholderText("Passcode")).not.toBeInTheDocument();
});


test("sending a code reveals the confirm form", async () => {
  requestOwnerPasscodeChange.mockResolvedValue({ ok: true, expiresInSeconds: 600 });

  render(
    <OwnerPasscodeModal open onClose={() => {}} onSubmit={() => {}} error="" />
  );

  fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
  fireEvent.click(screen.getByRole("button", { name: "Send verification code" }));

  expect(await screen.findByLabelText("Verification code")).toBeInTheDocument();
  expect(requestOwnerPasscodeChange).toHaveBeenCalledTimes(1);
});


test("mismatched new passcodes never call the confirm API", async () => {
  requestOwnerPasscodeChange.mockResolvedValue({ ok: true });

  render(
    <OwnerPasscodeModal open onClose={() => {}} onSubmit={() => {}} error="" />
  );

  fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
  fireEvent.click(screen.getByRole("button", { name: "Send verification code" }));
  await screen.findByLabelText("Verification code");

  fireEvent.change(screen.getByLabelText("Verification code"), {
    target: { value: "123456" },
  });
  fireEvent.change(screen.getByLabelText("New passcode"), {
    target: { value: "a-strong-new-passcode" },
  });
  fireEvent.change(screen.getByLabelText("Confirm new passcode"), {
    target: { value: "a-different-passcode" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Change passcode" }));

  expect(await screen.findByText(/do not match/)).toBeInTheDocument();
  expect(confirmOwnerPasscodeChange).not.toHaveBeenCalled();
});


test("a successful reset returns to sign-in with a success notice", async () => {
  requestOwnerPasscodeChange.mockResolvedValue({ ok: true });
  confirmOwnerPasscodeChange.mockResolvedValue({ ok: true });

  render(
    <OwnerPasscodeModal open onClose={() => {}} onSubmit={() => {}} error="" />
  );

  fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
  fireEvent.click(screen.getByRole("button", { name: "Send verification code" }));
  await screen.findByLabelText("Verification code");

  fireEvent.change(screen.getByLabelText("Verification code"), {
    target: { value: "482913" },
  });
  fireEvent.change(screen.getByLabelText("New passcode"), {
    target: { value: "a-strong-new-passcode" },
  });
  fireEvent.change(screen.getByLabelText("Confirm new passcode"), {
    target: { value: "a-strong-new-passcode" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Change passcode" }));

  expect(await screen.findByPlaceholderText("Passcode")).toBeInTheDocument();
  expect(screen.getByText(/Sign in with your new passcode/)).toBeInTheDocument();
  expect(confirmOwnerPasscodeChange).toHaveBeenCalledWith({
    code: "482913",
    newPasscode: "a-strong-new-passcode",
  });
});


test("Back to sign in returns to the passcode form without calling the API", () => {
  render(
    <OwnerPasscodeModal open onClose={() => {}} onSubmit={() => {}} error="" />
  );

  fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
  fireEvent.click(screen.getByRole("button", { name: "Back to sign in" }));

  expect(screen.getByPlaceholderText("Passcode")).toBeInTheDocument();
  expect(requestOwnerPasscodeChange).not.toHaveBeenCalled();
});


test("submitting the passcode form still calls onSubmit with the trimmed value", () => {
  const onSubmit = jest.fn();

  render(
    <OwnerPasscodeModal open onClose={() => {}} onSubmit={onSubmit} error="" />
  );

  fireEvent.change(screen.getByPlaceholderText("Passcode"), {
    target: { value: "  my-passcode  " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Unlock" }));

  expect(onSubmit).toHaveBeenCalledWith("my-passcode");
});
