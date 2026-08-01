import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-[var(--primary)]">
            KioskTracker
          </h1>
          <p className="text-sm text-gray-400">Production Pipeline</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 shadow-lg">
          <LoginForm />
        </div>
        <p className="mt-4 text-center text-xs text-gray-500">
          Demo login: thabo.mahlangu@tymedigital.com · changeme123
        </p>
      </div>
    </div>
  );
}
