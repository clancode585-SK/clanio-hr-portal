import React from 'react'
import Image from 'next/image'

const page = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 bg-zinc-50 dark:bg-black">
      <div className="flex flex-col items-center gap-6">
        <Image
          src="/images/logo/Clanio.png"
          alt="Clanio Logo"
          width={300}
          height={100}
          priority
          className="object-contain"
        />
        <h1 className="text-xl font-medium text-zinc-800 dark:text-zinc-200">
          Welcome to clanio
        </h1>
      </div>
    </div>
  )
}

export default page

