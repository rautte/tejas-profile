// src/components/admin/Settings.test.js

import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import SettingsAdmin from "./Settings";

import {
  confirmOwnerPasscodeChange,
  requestOwnerPasscodeChange,
} from "../../utils/snapshots/snapshotsApi";


jest.mock(
  "../../utils/snapshots/snapshotsApi",
  () => ({
    confirmOwnerPasscodeChange:
      jest.fn(),

    requestOwnerPasscodeChange:
      jest.fn(),
  })
);


beforeEach(
  () => {
    requestOwnerPasscodeChange
      .mockReset();

    confirmOwnerPasscodeChange
      .mockReset();
  }
);


test(
  "sending a code reveals the confirm form",
  async () => {
    requestOwnerPasscodeChange
      .mockResolvedValue(
        {
          ok:
            true,

          expiresInSeconds:
            600,
        }
      );

    render(
      <SettingsAdmin />
    );

    fireEvent.click(
      screen.getByRole(
        "button",
        {
          name:
            "Send verification code",
        }
      )
    );

    expect(
      await screen.findByLabelText(
        "Verification code"
      )
    ).toBeInTheDocument();

    expect(
      requestOwnerPasscodeChange
    ).toHaveBeenCalledTimes(
      1
    );
  }
);


test(
  "a failed code request surfaces the error and stays on the initial step",
  async () => {
    requestOwnerPasscodeChange
      .mockRejectedValue(
        new Error(
          "A code was already sent recently. Please wait a minute before requesting another."
        )
      );

    render(
      <SettingsAdmin />
    );

    fireEvent.click(
      screen.getByRole(
        "button",
        {
          name:
            "Send verification code",
        }
      )
    );

    expect(
      await screen.findByText(
        /wait a minute/
      )
    ).toBeInTheDocument();

    expect(
      screen.queryByLabelText(
        "Verification code"
      )
    ).not.toBeInTheDocument();
  }
);


test(
  "confirming with mismatched new passcodes never calls the API",
  async () => {
    requestOwnerPasscodeChange
      .mockResolvedValue(
        {
          ok:
            true,
        }
      );

    render(
      <SettingsAdmin />
    );

    fireEvent.click(
      screen.getByRole(
        "button",
        {
          name:
            "Send verification code",
        }
      )
    );

    await screen.findByLabelText(
      "Verification code"
    );

    fireEvent.change(
      screen.getByLabelText(
        "Verification code"
      ),
      {
        target: {
          value:
            "123456",
        },
      }
    );

    fireEvent.change(
      screen.getByLabelText(
        "New passcode"
      ),
      {
        target: {
          value:
            "a-strong-new-passcode",
        },
      }
    );

    fireEvent.change(
      screen.getByLabelText(
        "Confirm new passcode"
      ),
      {
        target: {
          value:
            "a-different-passcode",
        },
      }
    );

    fireEvent.click(
      screen.getByRole(
        "button",
        {
          name:
            "Confirm change",
        }
      )
    );

    expect(
      await screen.findByText(
        /do not match/
      )
    ).toBeInTheDocument();

    expect(
      confirmOwnerPasscodeChange
    ).not.toHaveBeenCalled();
  }
);


test(
  "confirming with a matching, long-enough passcode calls the API and shows success",
  async () => {
    requestOwnerPasscodeChange
      .mockResolvedValue(
        {
          ok:
            true,
        }
      );

    confirmOwnerPasscodeChange
      .mockResolvedValue(
        {
          ok:
            true,
        }
      );

    render(
      <SettingsAdmin />
    );

    fireEvent.click(
      screen.getByRole(
        "button",
        {
          name:
            "Send verification code",
        }
      )
    );

    await screen.findByLabelText(
      "Verification code"
    );

    fireEvent.change(
      screen.getByLabelText(
        "Verification code"
      ),
      {
        target: {
          value:
            "482913",
        },
      }
    );

    fireEvent.change(
      screen.getByLabelText(
        "New passcode"
      ),
      {
        target: {
          value:
            "a-strong-new-passcode",
        },
      }
    );

    fireEvent.change(
      screen.getByLabelText(
        "Confirm new passcode"
      ),
      {
        target: {
          value:
            "a-strong-new-passcode",
        },
      }
    );

    fireEvent.click(
      screen.getByRole(
        "button",
        {
          name:
            "Confirm change",
        }
      )
    );

    expect(
      await screen.findByText(
        /has been changed/
      )
    ).toBeInTheDocument();

    expect(
      confirmOwnerPasscodeChange
    ).toHaveBeenCalledWith(
      {
        code:
          "482913",

        newPasscode:
          "a-strong-new-passcode",
      }
    );
  }
);


test(
  "rejects a new passcode shorter than 12 characters before calling the API",
  async () => {
    requestOwnerPasscodeChange
      .mockResolvedValue(
        {
          ok:
            true,
        }
      );

    render(
      <SettingsAdmin />
    );

    fireEvent.click(
      screen.getByRole(
        "button",
        {
          name:
            "Send verification code",
        }
      )
    );

    await screen.findByLabelText(
      "Verification code"
    );

    fireEvent.change(
      screen.getByLabelText(
        "Verification code"
      ),
      {
        target: {
          value:
            "482913",
        },
      }
    );

    fireEvent.change(
      screen.getByLabelText(
        "New passcode"
      ),
      {
        target: {
          value:
            "short",
        },
      }
    );

    fireEvent.change(
      screen.getByLabelText(
        "Confirm new passcode"
      ),
      {
        target: {
          value:
            "short",
        },
      }
    );

    fireEvent.click(
      screen.getByRole(
        "button",
        {
          name:
            "Confirm change",
        }
      )
    );

    expect(
      await screen.findByText(
        /at least 12 characters/
      )
    ).toBeInTheDocument();

    expect(
      confirmOwnerPasscodeChange
    ).not.toHaveBeenCalled();
  }
);


test(
  "a failed confirmation surfaces the error and keeps the form open for retry",
  async () => {
    requestOwnerPasscodeChange
      .mockResolvedValue(
        {
          ok:
            true,
        }
      );

    confirmOwnerPasscodeChange
      .mockRejectedValue(
        new Error(
          "Incorrect code"
        )
      );

    render(
      <SettingsAdmin />
    );

    fireEvent.click(
      screen.getByRole(
        "button",
        {
          name:
            "Send verification code",
        }
      )
    );

    await screen.findByLabelText(
      "Verification code"
    );

    fireEvent.change(
      screen.getByLabelText(
        "Verification code"
      ),
      {
        target: {
          value:
            "000000",
        },
      }
    );

    fireEvent.change(
      screen.getByLabelText(
        "New passcode"
      ),
      {
        target: {
          value:
            "a-strong-new-passcode",
        },
      }
    );

    fireEvent.change(
      screen.getByLabelText(
        "Confirm new passcode"
      ),
      {
        target: {
          value:
            "a-strong-new-passcode",
        },
      }
    );

    fireEvent.click(
      screen.getByRole(
        "button",
        {
          name:
            "Confirm change",
        }
      )
    );

    expect(
      await screen.findByText(
        "Incorrect code"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText(
        "Verification code"
      )
    ).toBeInTheDocument();
  }
);
