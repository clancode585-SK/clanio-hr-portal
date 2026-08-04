import type { Metadata } from 'next'
import { BrandPanel } from '@/components/brand-panel'
import { LoginForm } from '@/components/login-form'
import { ThemeToggle } from '@/components/theme-toggle'
import { config } from '@/lib/config'

export const metadata: Metadata = {
  title: `Sign in — ${config.appName}`,
}

export default function LoginPage() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-canvas lg:h-dvh">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-[var(--glow-one)] blur-3xl" />
        <div className="absolute -bottom-48 -right-32 h-[32rem] w-[32rem] rounded-full bg-[var(--glow-two)] blur-3xl" />
      </div>

      <div className="absolute right-5 top-5 z-10 sm:right-8 sm:top-7">
        <ThemeToggle />
      </div>

      <div className="relative mx-auto flex h-full w-full max-w-6xl flex-col justify-center gap-10 px-5 pb-8 pt-20 sm:px-8 lg:flex-row lg:items-center lg:gap-14 lg:py-0">
        <BrandPanel />

        <div className="w-full shrink-0 lg:w-[24rem] xl:w-[26rem]">
          <LoginForm />
        </div>
      </div>
    </main>
  )
}
