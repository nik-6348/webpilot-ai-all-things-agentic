"use client";

import React from "react";

export default function WebPilotLogo({
  size = "md",
  showText = true,
  collapsed = false,
}: {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  collapsed?: boolean;
}) {
  const iconSizes = {
    sm: "w-7 h-7",
    md: "w-9 h-9",
    lg: "w-11 h-11",
  };

  return (
    <div className="flex items-center gap-3 select-none">
      {/* 🔮 CUSTOM CRISP SVG EMBLEM LOGO */}
      <div className={`relative ${iconSizes[size]} shrink-0`}>
        <div className="w-full h-full rounded-xl bg-[#0b101d] border border-slate-700/70 p-1.5 flex items-center justify-center shadow-md overflow-hidden">
          <svg className="w-full h-full" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 4L25 9.5V22.5L16 28L7 22.5V9.5L16 4Z" stroke="url(#logo-stroke)" strokeWidth="2.2" strokeLinejoin="round"/>
            <path d="M16 10V22M10 13L22 19M10 19L22 13" stroke="url(#logo-inner)" strokeWidth="1.6" strokeLinecap="round"/>
            <circle cx="16" cy="16" r="3" fill="#38BDF8"/>
            <defs>
              <linearGradient id="logo-stroke" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
                <stop stopColor="#818CF8"/>
                <stop offset="0.5" stopColor="#38BDF8"/>
                <stop offset="1" stopColor="#34D399"/>
              </linearGradient>
              <linearGradient id="logo-inner" x1="10" y1="10" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                <stop stopColor="#6366F1"/>
                <stop offset="1" stopColor="#06B6D4"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      {/* BRAND TEXT */}
      {showText && !collapsed && (
        <div className="flex flex-col leading-none">
          <div className="text-lg font-black tracking-tight text-white flex items-center gap-1">
            WebPilot
            <span className="text-cyan-400 font-mono font-extrabold text-sm">
              .AI
            </span>
          </div>
          <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mt-0.5">
            Enterprise RPA
          </span>
        </div>
      )}
    </div>
  );
}
