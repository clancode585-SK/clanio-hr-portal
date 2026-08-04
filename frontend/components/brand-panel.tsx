import { config } from '@/lib/config'
import { ChartIcon, ShieldIcon, UsersIcon } from './icons'

const FEATURES = [
  {
    title: 'All-in-One HR Solution',
    description: 'Employees, attendance, leave, tasks and payroll in one place.',
    Icon: UsersIcon,
    tone: 'text-brand bg-brand-soft',
  },
  {
    title: 'Secure & Compliant',
    description: 'Role based access with a full audit trail on every action.',
    Icon: ShieldIcon,
    tone: 'text-success bg-success-soft',
  },
  {
    title: 'Smart Analytics',
    description: 'Live dashboards that turn daily activity into decisions.',
    Icon: ChartIcon,
    tone: 'text-accent bg-brand-soft',
  },
]

export function BrandPanel() {
  return (
    <section className="flex w-full flex-col justify-center gap-7 lg:flex-1">
      <div>
        <p className="text-xl font-bold tracking-tight text-heading">
          {config.appName}
          <span className="text-brand">.</span>
        </p>
        <p className="text-xs font-semibold text-muted">{config.appTagline}</p>
      </div>

      <h1 className="text-3xl font-bold leading-[1.15] tracking-tight text-heading sm:text-4xl xl:text-[2.75rem]">
        The Complete HR Management System
        <span className="block bg-gradient-to-r from-brand to-accent bg-clip-text text-transparent">
          for Modern Teams
        </span>
      </h1>

      <ul className="space-y-3">
        {FEATURES.map(({ title, description, Icon, tone }) => (
          <li key={title} className="flex items-start gap-3">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone}`}>
              <Icon className="h-4.5 w-4.5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-heading">{title}</span>
              <span className="block text-xs text-muted">{description}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
