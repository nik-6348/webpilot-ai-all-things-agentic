import "./globals.css";
import { ToastProvider } from "../components/Toast";
export const metadata = {
  title: "WebPilot AI",
  description: "Autonomous web operations that learn, compile and self-heal.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
