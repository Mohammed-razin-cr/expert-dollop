'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import * as Icons from 'lucide-react'
import type { NavItem } from '@/lib/nav'
import { ROLE_LABELS, type Role } from '@/lib/rbac'

function Icon({ name, className }: { name: string; className?: string }) {
  const C = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name]
  return C ? <C className={className} /> : <Icons.Circle className={className} />
}

export function Sidebar({ items, role, roleLabel }: { items: NavItem[]; role: Role; roleLabel?: string }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const marketing = roleLabel === 'Digital Marketing'

  return (
    <>
    <aside className={`${marketing ? 'hidden md:flex' : 'flex'} h-screen w-64 flex-col border-r border-slate-200 bg-white`}>
      <div className="flex items-center gap-2.5 px-5 py-5">
        <img src="/electrobtech-logo.jpg" alt="Electrobtech" className="h-9 w-9 rounded-lg object-contain" />
        <div className="leading-tight">
          <p className="text-[15px] font-semibold text-slate-900">Electrobtech</p>
          <p className="text-xs text-slate-400">OMS · {roleLabel ?? ROLE_LABELS[role]}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {items.map((item) => {
          const [itemPath, query] = item.href.split('?')
          const expected = new URLSearchParams(query ?? '')
          const active = query
            ? pathname === itemPath && [...expected.entries()].every(([key, value]) => searchParams.get(key) === value)
            : itemPath === '/marketing'
              ? pathname === '/marketing' && !searchParams.get('category')
              : itemPath === '/admin/digital-marketing'
                ? pathname === itemPath && !searchParams.get('view')
                : itemPath === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(itemPath)
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className={[
                'flex items-center gap-3 rounded-lg py-2 text-sm transition-colors',
                item.child ? 'pl-8 pr-3' : 'px-3',
                active
                  ? 'bg-blue-50 font-medium text-blue-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
              ].join(' ')}
            >
              <Icon name={item.icon} className={`${item.child ? 'h-4 w-4' : 'h-[18px] w-[18px]'} shrink-0`} />
              <span className="truncate">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <form action="/auth/signout" method="post" className="border-t border-slate-200 p-3">
        <button
          type="submit"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        >
          <Icons.LogOut className="h-[18px] w-[18px]" />
          Logout
        </button>
      </form>
    </aside>
    {marketing && <nav aria-label="Marketing mobile navigation" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white md:hidden">
      {[
        { label: 'Dashboard', href: '/dashboard', icon: Icons.LayoutDashboard },
        { label: 'Work', href: '/marketing', icon: Icons.ListTodo },
        { label: 'Profile', href: '/profile', icon: Icons.User },
      ].map((item) => <Link key={item.href} href={item.href} className={`flex flex-1 flex-col items-center gap-1 py-2 text-xs ${pathname === item.href ? 'font-medium text-blue-700' : 'text-slate-500'}`}><item.icon className="h-5 w-5" />{item.label}</Link>)}
    </nav>}
    </>
  )
}
