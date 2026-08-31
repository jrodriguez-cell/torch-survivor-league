import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Torch — Fantasy Survivor League",
  description:
    "A fantasy Survivor league and weekly pick'em for you and your friends.",
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
