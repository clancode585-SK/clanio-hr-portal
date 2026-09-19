import React from "react";
import Image from "next/image";
import ClanioLogo from "@/components/login/ClanioLogo";
import FeatureCardList from "@/components/login/FeatureCard";
import CompanyLogos from "@/components/login/CompanyLogos";
import LoginForm from "@/components/login/LoginForm";

export default function LoginPage() {
  return (
    <main className="relative min-h-screen w-full flex items-center justify-center p-3 sm:p-5 lg:p-5 font-sans overflow-hidden bg-slate-100">
      {/* Background Image: login-banner.png for entire page */}
      <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
        <Image
          src="/images/login/login-banner.png"
          alt="Background Illustration"
          fill
          priority
          className="object-cover object-center"
        />
      </div>

      {/* Main Container Card matching design */}
      <div className="relative z-10 w-full max-w-[1440px] min-h-[660px] lg:min-h-[650px] bg-white/20 rounded-[36px] border border-white/60 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.12)] backdrop-blur-[2px] grid grid-cols-1 lg:grid-cols-12 overflow-hidden">

        {/* ---------------------------------------------------- */}
        {/* LEFT SECTION (58%)                                  */}
        {/* ---------------------------------------------------- */}
        <section className="lg:col-span-7 p-6 sm:p-8 lg:p-10 flex flex-col justify-between relative overflow-hidden">

          {/* Left Side Content (Logo, Headline, Features) */}
          <div className="relative z-10 space-y-5 max-w-sm sm:max-w-md">
            {/* Logo Component */}
            <ClanioLogo />

            {/* Headline */}
            <div className="pt-1">
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
                The Complete HR <br />
                Management System <br />
                <span className="text-clanio-gradient">
                  for Modern Teams
                </span>
              </h1>
              
            </div>

            {/* 4 Feature Cards */}
            <FeatureCardList />
          </div>

          {/* Bottom Trust Bar */}
          <div className="flex items-center justify-start z-10 pt-4">
            <CompanyLogos />
          </div>
        </section>

        {/* ---------------------------------------------------- */}
        {/* RIGHT SECTION (42%)                                 */}
        {/* ---------------------------------------------------- */}
        <section className="lg:col-span-5 rounded-l-3xl flex items-center justify-center relative z-10 bg-white/90 backdrop-blur-md">
          <LoginForm />
        </section>

      </div>
    </main>
  );
}
