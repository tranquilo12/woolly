import "./globals.css";
import { GeistSans } from "geist/font/sans";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { Navbar } from "@/components/navbar";
import { Sidebar } from "@/components/sidebar";
import { Providers } from "@/components/providers";

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
        <Toaster position="top-center" richColors />
        <Providers>
          <div className="flex flex-col min-h-screen">
            <Navbar />
            <div className="flex-1 relative">
              <main className="w-full max-w-5xl mx-auto">
                {children}
              </main>
              <Sidebar />
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
