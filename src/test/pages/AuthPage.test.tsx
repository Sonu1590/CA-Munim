import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthPage from "@/pages/AuthPage";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useLocation, useNavigate } from "react-router-dom";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("react-router-dom", () => ({
  useNavigate: vi.fn(),
  useLocation: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
      resetPasswordForEmail: vi.fn(),
    },
    from: vi.fn(),
  },
}));

const mockNavigate = vi.fn();
const mockUseNavigate = vi.mocked(useNavigate);
const mockUseLocation = vi.mocked(useLocation);
const mockSupabase = vi.mocked(supabase, true);
const mockToast = vi.mocked(toast, true);

type TableResponse = { data?: unknown; error?: unknown };

function setupTableMocks(responses: Record<string, TableResponse> = {}) {
  const builders: Record<string, any[]> = {};

  mockSupabase.from.mockImplementation((table: string) => {
    const response = responses[table] ?? { data: null, error: null };
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue(response),
      upsert: vi.fn().mockResolvedValue(response),
      update: vi.fn().mockReturnThis(),
    };

    builders[table] = builders[table] ?? [];
    builders[table].push(builder);
    return builder as never;
  });

  return builders;
}

function fillAuthForm(email = "User@Example.COM ", password = "strongpass123") {
  fireEvent.change(screen.getByLabelText("Email Address"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
}

function submitForm(container: HTMLElement) {
  const form = container.querySelector("form");
  expect(form).not.toBeNull();
  fireEvent.submit(form!);
}

function switchToSignup() {
  fireEvent.click(screen.getByRole("button", { name: "Create Account" }));
}

describe("AuthPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseNavigate.mockReturnValue(mockNavigate);
    mockUseLocation.mockReturnValue({
      state: { from: { pathname: "/clients" } },
    } as ReturnType<typeof useLocation>);
    setupTableMocks();
    mockSupabase.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null } as never);
    mockSupabase.auth.signUp.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    } as never);
    mockSupabase.auth.signInWithOAuth.mockResolvedValue({ data: {}, error: null } as never);
    mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null } as never);
  });

  it("renders the login form by default", () => {
    render(<AuthPage />);

    expect(screen.getByRole("heading", { name: "CA Munim" })).toBeInTheDocument();
    expect(screen.getByText("Your digital practice manager")).toBeInTheDocument();
    expect(screen.getByLabelText("Email Address")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.getByPlaceholderText("Your password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Forgot password?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
  });

  it("toggles password visibility and allows password paste", () => {
    render(<AuthPage />);

    const password = screen.getByLabelText("Password");
    const toggle = password.parentElement?.querySelector("button");
    expect(toggle).toBeTruthy();

    fireEvent.click(toggle!);
    expect(password).toHaveAttribute("type", "text");

    const pasteEvent = new Event("paste", { bubbles: true, cancelable: true });
    const prevented = !password.dispatchEvent(pasteEvent);
    expect(prevented).toBe(false);
  });

  it("signs in with normalized email and redirects to the requested page", async () => {
    const { container } = render(<AuthPage />);

    fillAuthForm();
    submitForm(container);

    await waitFor(() => {
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "strongpass123",
      });
    });
    expect(mockNavigate).toHaveBeenCalledWith("/clients", { replace: true });
  });

  it("maps invalid login credentials to a friendly toast", async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: null,
      error: { message: "Invalid login credentials" },
    } as never);
    const { container } = render(<AuthPage />);

    fillAuthForm("bad@example.com", "wrongpassword");
    submitForm(container);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        "Invalid credentials. If you just signed up, please verify your email and try again.",
      );
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("switches to signup mode, clears fields, and validates minimum password length", async () => {
    const { container } = render(<AuthPage />);

    fillAuthForm("user@example.com", "typed-password");
    switchToSignup();

    expect(screen.getByLabelText("Email Address")).toHaveValue("");
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(screen.getByPlaceholderText("Min. 8 characters")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Forgot password?" })).not.toBeInTheDocument();

    fillAuthForm("new@example.com", "short");
    submitForm(container);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Password must be at least 8 characters.");
    });
    expect(mockSupabase.auth.signUp).not.toHaveBeenCalled();
  });

  it("blocks signup when email already exists in firms", async () => {
    setupTableMocks({
      firms: { data: { id: "firm-1" }, error: null },
    });
    const { container } = render(<AuthPage />);

    switchToSignup();
    fillAuthForm("Existing@Example.com", "strongpass123");
    submitForm(container);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        "An account with this email already exists. Please sign in instead.",
      );
    });
    expect(mockSupabase.auth.signUp).not.toHaveBeenCalled();
  });

  it("blocks signup when email already exists in staff", async () => {
    setupTableMocks({
      firms: { data: null, error: null },
      staff: { data: { id: "staff-1" }, error: null },
    });
    const { container } = render(<AuthPage />);

    switchToSignup();
    fillAuthForm("staff@example.com", "strongpass123");
    submitForm(container);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        "An account with this email already exists. Please sign in instead.",
      );
    });
    expect(mockSupabase.auth.signUp).not.toHaveBeenCalled();
  });

  it("updates the trigger-created firm after successful signup with a user", async () => {
    const builders = setupTableMocks({
      firms: { data: null, error: null },
      staff: { data: null, error: null },
    });
    const { container } = render(<AuthPage />);

    switchToSignup();
    fillAuthForm("NewCA@Example.com", "strongpass123");
    submitForm(container);

    await waitFor(() => {
      expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
        email: "newca@example.com",
        password: "strongpass123",
        options: {
          data: {
            full_name: "newca",
            name: "newca",
            ca_name: "newca",
            firm_name: "",
            icai_number: null,
            practice_type: "solo",
          },
          emailRedirectTo: `${window.location.origin}/onboarding`,
        },
      });
    });

    await waitFor(() => {
      expect(builders.firms.at(-1)?.update).toHaveBeenCalledWith({ name: "newca" });
    });
    expect(builders.firms.at(-1)?.eq).toHaveBeenCalledWith("email", "newca@example.com");
    expect(builders.firms.at(-1)?.upsert).not.toHaveBeenCalled();
    expect(builders.staff).toHaveLength(1);
    expect(mockToast.success).toHaveBeenCalledWith("Account created! Complete your profile to get started.");
    expect(mockNavigate).toHaveBeenCalledWith("/onboarding", { replace: true });
  });

  it("shows confirmation info when signup returns no immediate user", async () => {
    mockSupabase.auth.signUp.mockResolvedValue({
      data: { user: null },
      error: null,
    } as never);
    const { container } = render(<AuthPage />);

    switchToSignup();
    fillAuthForm("confirm@example.com", "strongpass123");
    submitForm(container);

    const message = "Verification email sent. Please verify your email before signing in.";
    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith(
        "Verification email sent. Please check your inbox and verify before signing in.",
      );
    });
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("starts Google OAuth with the current origin", async () => {
    render(<AuthPage />);

    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    await waitFor(() => {
      expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
    });
  });

  it("handles forgot password validation, success, and error states", async () => {
    render(<AuthPage />);

    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect(mockToast.error).toHaveBeenCalledWith("Enter your email address first.");

    fireEvent.change(screen.getByLabelText("Email Address"), { target: { value: "reset@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));

    await waitFor(() => {
      expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith("reset@example.com", {
        redirectTo: `${window.location.origin}/reset-password`,
      });
    });
    expect(mockToast.success).toHaveBeenCalledWith("Password reset email sent. Check your inbox.");

    mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({
      data: null,
      error: { message: "Reset failed" },
    } as never);
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Reset failed");
    });
  });
});
