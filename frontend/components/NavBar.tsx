"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth";

export function NavBar() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2 text-lg font-bold text-zinc-100">
          <span className="grid h-7 w-7 place-items-center rounded-lg border border-zinc-700 bg-zinc-800 text-xs text-zinc-200">
            ◆
          </span>
          <span className="text-gradient">PeakForm</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/dashboard" className="text-zinc-400 hover:text-zinc-100">
            Dashboard
          </Link>
          {user && <span className="hidden text-zinc-500 sm:inline">{user.full_name}</span>}
          <button
            onClick={() => {
              logout();
              router.replace("/login");
            }}
            className="btn-ghost py-1.5"
          >
            Log out
          </button>
        </nav>
      </div>
    </header>
  );
}
