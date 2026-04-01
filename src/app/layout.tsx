import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ExecOps - Ansible Management Dashboard",
  description: "Web interface for managing and executing Ansible playbooks locally with real-time output streaming. Built with Next.js 16, TypeScript, Tailwind CSS, and shadcn/ui.",
  keywords: ["ExecOps", "Ansible", "DevOps", "Automation", "Next.js", "TypeScript", "Tailwind CSS", "shadcn/ui", "Playbook"],
  authors: [{ name: "ExecOps Team" }],
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "ExecOps",
    description: "Ansible playbook management with real-time execution",
    url: "https://github.com/ExecOps/ExecOps",
    siteName: "ExecOps",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ExecOps",
    description: "Ansible playbook management with real-time execution",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
