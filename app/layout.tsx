import "./globals.css";
import { GeistSans } from "geist/font/sans";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { Navbar } from "@/components/navbar";
import { Sidebar } from "@/components/sidebar";
import { Providers } from "@/components/providers";
import { AgentPanel } from "@/components/agent-panel/agent-panel";
import { SplitLayout } from "@/components/split-layout";

export const metadata = {
  title: "AI SDK Python Streaming Preview",
  description:
    "Use the Data Stream Protocol to stream chat completions from a Python endpoint (FastAPI) and display them using the useChat hook in your Next.js application.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head></head>
      <body className={cn(GeistSans.className, "antialiased dark")}>
        <Toaster
          position="bottom-left"
          theme="dark"
          closeButton
          className="toaster-override"
          toastOptions={{
            className: "toast-override",
            duration: 3000,
            style: {
              background: "hsl(var(--background))",
              color: "hsl(var(--foreground))",
              border: "1px solid hsl(var(--border))",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "1rem",
              margin: "1rem",
            },
          }}
        />
        <Providers>
          <div className="flex flex-col min-h-screen">
            <Navbar />
            <div className="flex-1">
              <SplitLayout
                sidebar={<Sidebar />}
                content={<main className="w-full h-full">{children}</main>}
                agentPanel={<AgentPanel />}
              />
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
