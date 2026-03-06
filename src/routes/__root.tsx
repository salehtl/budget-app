import { createRootRoute, Outlet, useLocation } from "@tanstack/react-router";
import { DbProvider } from "../context/DbContext.tsx";
import { ToastProvider } from "../components/ui/Toast.tsx";
import { Sidebar, MobileNav } from "../components/layout/Sidebar.tsx";
import { AdminPanel } from "../components/AdminPanel.tsx";

export const Route = createRootRoute({
  component: RootLayout,
});

const FULL_WIDTH_ROUTES = ["/cashflow"];

function RootLayout() {
  const { pathname } = useLocation();
  const isFullWidth = FULL_WIDTH_ROUTES.some((r) => pathname.startsWith(r));

  return (
    <DbProvider>
      <ToastProvider>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className={`flex-1 min-w-0 p-4 md:p-6 pb-20 md:pb-6 ${isFullWidth ? "" : "max-w-5xl mx-auto"}`}>
            <Outlet />
          </main>
          <MobileNav />
          <AdminPanel />
        </div>
      </ToastProvider>
    </DbProvider>
  );
}
