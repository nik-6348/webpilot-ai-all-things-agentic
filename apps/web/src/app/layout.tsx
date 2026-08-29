import "./globals.css";
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
      <body>{children}</body>
    </html>
  );
}
