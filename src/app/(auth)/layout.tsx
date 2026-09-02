/**
 * A route group, so these pages sit at /login rather than /(auth)/login and
 * get their own shell: no nav tabs, nothing to navigate to until you're in.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-7 py-16">
      {children}
    </div>
  );
}
