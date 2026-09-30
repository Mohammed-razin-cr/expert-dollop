"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BriefcaseBusiness,
  ChevronDown,
  LogOut,
  Mail,
  UserRound,
} from "lucide-react";

export function PreviewProfileMenu() {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const logoutRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        menuRef.current?.contains(document.activeElement)
      ) {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  useEffect(() => {
    if (open) logoutRef.current?.focus();
  }, [open]);

  const logout = () => {
    document.cookie = 'oms-demo-session=; Max-Age=0; Path=/; SameSite=Lax'
    router.replace('/login')
    router.refresh()
  };

  return (
    <div
      ref={menuRef}
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label="Saqib profile menu"
        aria-controls="preview-profile-menu"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="group flex min-h-11 items-center gap-2.5 rounded-md border border-transparent px-2 py-1.5 text-left transition hover:border-slate-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 text-sm font-semibold text-white shadow-[0_8px_18px_-10px_rgba(37,99,235,0.85)]">
          S
        </span>
        <span className="hidden min-w-0 leading-tight sm:block">
          <span className="block truncate text-sm font-semibold text-slate-900">
            Saqib
          </span>
          <span className="block truncate text-[11px] text-slate-500">
            Digital Marketing
          </span>
        </span>
        <ChevronDown
          className={`hidden h-4 w-4 text-slate-400 transition-transform sm:block ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="menu"
          id="preview-profile-menu"
          aria-label="Profile menu"
          className="absolute right-0 z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-md border border-white/90 bg-white/88 shadow-[0_22px_55px_-24px_rgba(15,23,42,0.55)] backdrop-blur-2xl"
        >
          <div className="border-b border-slate-100 px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 text-base font-semibold text-white">
                S
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  Saqib
                </p>
                <p className="truncate text-xs text-slate-500">
                  Digital Marketing Employee
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2 px-4 py-3 text-xs text-slate-600">
            <p className="flex items-center gap-2.5">
              <Mail className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="truncate">saqib@electrobtech.in</span>
            </p>
            <p className="flex items-center gap-2.5">
              <BriefcaseBusiness className="h-4 w-4 shrink-0 text-slate-400" />
              <span>Digital Marketing</span>
            </p>
            <p className="flex items-center gap-2.5">
              <UserRound className="h-4 w-4 shrink-0 text-slate-400" />
              <span>Local testing profile</span>
            </p>
          </div>

          <div className="border-t border-slate-100 p-2">
            <button
              ref={logoutRef}
              type="button"
              role="menuitem"
              onClick={logout}
              className="flex min-h-10 w-full items-center gap-2.5 rounded-md px-3 text-sm font-medium text-rose-700 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
