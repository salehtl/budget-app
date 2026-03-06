import { createRootRoute, Outlet } from "@tanstack/react-router";
import { DbProvider } from "../context/DbContext.tsx";
import { ToastProvider } from "../components/ui/Toast.tsx";
import { Sidebar, MobileNav } from "../components/layout/Sidebar.tsx";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <DbProvider>
      <ToastProvider>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6 max-w-5xl mx-auto w-full">
            <Outlet />
          </main>
          <MobileNav />
        </div>
      </ToastProvider>
    </DbProvider>
  );
}
