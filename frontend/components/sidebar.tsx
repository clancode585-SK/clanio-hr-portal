'use client'

import { useState } from 'react'
import { NAV_ICONS } from './nav-icons'
import { ChevronIcon } from './icons'
import type { NavGroup } from '@/lib/nav'

type SidebarProps = {
  groups: NavGroup[]
  activeId: string
  onSelect: (id: string) => void
}

export function Sidebar({ groups, activeId, onSelect }: SidebarProps) {
  const [openGroup, setOpenGroup] = useState<string | null>(() => findActiveGroup(groups, activeId))

  return (
    <nav className="flex w-64 shrink-0 flex-col gap-1 overflow-y-auto border-r border-line bg-surface px-3 py-4">
      {groups.map((group) => {
        const Icon = NAV_ICONS[group.icon]

        if (group.solo) {
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => onSelect(group.id)}
              className={rowClass(activeId === group.id)}
            >
              <Icon className="h-4.5 w-4.5 shrink-0" />
              <span className="truncate">{group.label}</span>
            </button>
          )
        }

        const isOpen = openGroup === group.id
        const hasActiveChild = group.items?.some((item) => item.id === activeId) ?? false

        return (
          <div key={group.id} className="flex flex-col">
            <button
              type="button"
              onClick={() => setOpenGroup(isOpen ? null : group.id)}
              className={rowClass(hasActiveChild && !isOpen)}
            >
              <Icon className="h-4.5 w-4.5 shrink-0" />
              <span className="flex-1 truncate text-left">{group.label}</span>
              <ChevronIcon className={`h-3.5 w-3.5 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
              <div className="ml-4 flex flex-col gap-0.5 border-l border-line py-1 pl-3">
                {group.items?.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect(item.id)}
                    className={`rounded-lg px-3 py-1.5 text-left text-sm font-medium transition ${
                      activeId === item.id
                        ? 'bg-brand-soft text-brand-strong'
                        : 'text-body hover:bg-surface-soft hover:text-heading'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}

function rowClass(active: boolean): string {
  return `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
    active ? 'bg-brand text-white' : 'text-body hover:bg-surface-soft hover:text-heading'
  }`
}

function findActiveGroup(groups: NavGroup[], activeId: string): string | null {
  const match = groups.find((group) => group.items?.some((item) => item.id === activeId))

  return match?.id ?? null
}
