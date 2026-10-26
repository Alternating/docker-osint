import "./globals.css";

export const metadata = {
  title: "Suron — OSINT Command",
  description: "Self-hosted OSINT platform",
  icons: { icon: "/favicon.svg" },
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
