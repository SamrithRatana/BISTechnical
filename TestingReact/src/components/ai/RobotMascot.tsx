"use client";

/**
 * @file ai/RobotMascot.tsx
 * @description Full-body SVG Robot Character with arms & legs ("មានដៃមានជើង"), walking leg steps, waving hand ("Hi 👋"), glowing eyes, and antenna.
 */

import React from "react";

interface RobotMascotProps {
  isWaving?: boolean;
  isWalking?: boolean;
  /**
   * Drives the idle life — body bob, head tilt, eye blink, antenna pulse.
   *
   * These used to be unconditional, which mattered because this component has
   * a second caller: the head that peeks out of the launcher on hover. That
   * one shows a 36px crop of the head, yet the full body underneath was still
   * bobbing, blinking and stepping inside the clip — animation work whose
   * every frame was thrown away. Off by default now, so a caller has to ask.
   */
  isPoppedOut?: boolean;
  className?: string;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export default function RobotMascot({
  isWaving = false,
  isWalking = false,
  isPoppedOut = false,
  className = "",
  onClick,
  onMouseEnter,
  onMouseLeave,
}: RobotMascotProps) {
  // Every looping animation hangs off this one flag: the mascot is fully alive
  // during its six-second greeting and completely still at any other time.
  const anim = (className: string) => (isPoppedOut ? className : "");

  return (
    <div
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`relative cursor-pointer transition-transform duration-300 hover:scale-105 active:scale-95 ${className}`}
    >
      <svg
        width="72"
        height="92"
        viewBox="0 0 110 142"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-[0_8px_16px_rgba(124,58,237,0.3)]"
      >
        <defs>
          {/* Head & Body Metallic Gradients */}
          <linearGradient id="robot-body-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--av-accent-bright)" />
            <stop offset="50%" stopColor="var(--av-accent-base)" />
            <stop offset="100%" stopColor="var(--av-accent-hover)" />
          </linearGradient>

          <linearGradient id="robot-head-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--av-accent-bright)" />
            <stop offset="100%" stopColor="var(--av-accent-hover)" />
          </linearGradient>

          {/* Visor Glass Gradient */}
          <linearGradient id="visor-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0F172A" />
            <stop offset="100%" stopColor="#062018" />
          </linearGradient>

          {/* Glowing LED Blue/Cyan Gradient */}
          <linearGradient id="led-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--av-accent-bright)" />
            <stop offset="100%" stopColor="var(--av-accent-bright)" />
          </linearGradient>

          {/* Hand/Arm Gradient */}
          <linearGradient id="arm-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#B7DCC8" />
            <stop offset="100%" stopColor="var(--av-accent-base)" />
          </linearGradient>

          {/* Soft halo, drawn as a radial gradient rather than a filter.
              `feGaussianBlur` was the expensive way to get this: an SVG filter
              is re-evaluated whenever its subtree is transformed, and all six
              elements using it sat inside groups that animate — the blinking
              eyes, the stepping feet, the pulsing antenna. That is a real
              convolution per element per frame, on the CPU. A gradient is
              painted once and costs nothing to move. */}
          <radialGradient id="glow-halo">
            <stop offset="35%" stopColor="var(--av-accent-bright)" stopOpacity="0.9" />
            <stop offset="70%" stopColor="var(--av-accent-bright)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--av-accent-bright)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ── Group for gentle floating body bobbing ────────────────── */}
        <g className={anim("animate-robot-body-bob")} style={{ transformOrigin: "55px 70px" }}>
          {/* ── 1. ANTENNA ────────────────────────────────────────────── */}
          <g>
            {/* Antenna Pole */}
            <rect x="53" y="8" width="4" height="14" rx="2" fill="#B7DCC8" />
            {/* Glowing Antenna Tip */}
            <circle cx="55" cy="6" r="9" fill="url(#glow-halo)" />
            <circle cx="55" cy="6" r="6" fill="var(--av-accent-bright)" className={anim("animate-pulse")} />
            <circle cx="55" cy="6" r="3" fill="#FFFFFF" />
          </g>

          {/* ── 2. HEAD ───────────────────────────────────────────────── */}
          <g className={anim("animate-robot-head-tilt")}>
            {/* Head Outer Shell */}
            <rect
              x="25"
              y="20"
              width="60"
              height="44"
              rx="20"
              fill="url(#robot-head-grad)"
              stroke="#D6EBE0"
              strokeWidth="2"
            />

            {/* Left Ear/Headphone */}
            <rect x="18" y="32" width="7" height="20" rx="3.5" fill="var(--av-accent-base)" stroke="#B7DCC8" />
            {/* Right Ear/Headphone */}
            <rect x="85" y="32" width="7" height="20" rx="3.5" fill="var(--av-accent-base)" stroke="#B7DCC8" />

            {/* Glossy Visor Screen */}
            <rect
              x="31"
              y="26"
              width="48"
              height="30"
              rx="13"
              fill="url(#visor-grad)"
              stroke="var(--av-accent-bright)"
              strokeWidth="1.5"
            />

            {/* Visor Glare Reflection */}
            <path
              d="M 36 30 C 45 28, 65 28, 72 30 C 70 32, 45 32, 36 30 Z"
              fill="#FFFFFF"
              opacity="0.35"
            />

            {/* Visor Animated LED Eyes */}
            <g className={anim("animate-robot-eyes-blink")}>
              {/* Left Eye */}
              <circle cx="43" cy="40" r="5" fill="url(#led-grad)" />
              <circle cx="44.5" cy="38.5" r="1.8" fill="#FFFFFF" />

              {/* Right Eye */}
              <circle cx="67" cy="40" r="5" fill="url(#led-grad)" />
              <circle cx="68.5" cy="38.5" r="1.8" fill="#FFFFFF" />
            </g>

            {/* Cute LED Smile Mouth */}
            <path
              d="M 50 47 Q 55 51 60 47"
              stroke="var(--av-accent-bright)"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          </g>

          {/* ── 3. ROBOT BODY & CORE ─────────────────────────────────── */}
          <g>
            {/* Neck Joiner */}
            <rect x="47" y="62" width="16" height="6" rx="2" fill="var(--av-accent-hover)" />

            {/* Main Torso */}
            <rect
              x="28"
              y="66"
              width="54"
              height="40"
              rx="16"
              fill="url(#robot-body-grad)"
              stroke="#D6EBE0"
              strokeWidth="2"
            />

            {/* Chest Energy Core (Arc Reactor) */}
            <circle cx="55" cy="83" r="9" fill="#062018" stroke="var(--av-accent-bright)" strokeWidth="1.5" />
            <circle
              cx="55"
              cy="83"
              r="6"
              fill="var(--av-accent-bright)"
              className={anim("animate-pulse")}
              style={{ animationDuration: "3s" }}
            />
            <circle cx="55" cy="83" r="5" fill="var(--av-accent-bright)" />
            <circle cx="55" cy="83" r="2.5" fill="#FFFFFF" />
          </g>

          {/* ── 4. LEFT ARM (RESTING) ─────────────────────────────────── */}
          <g>
            <rect x="14" y="70" width="14" height="26" rx="7" fill="url(#arm-grad)" stroke="#D6EBE0" />
            <circle cx="21" cy="97" r="5" fill="var(--av-accent-hover)" stroke="#B7DCC8" />
          </g>

          {/* ── 5. RIGHT ARM (WAVING "HI 👋") ─────────────────────────── */}
          {/* Pivot point at shoulder (x=89, y=73) */}
          <g
            className={isWaving ? "animate-robot-hand-hi" : ""}
            style={{ transformOrigin: "89px 73px" }}
          >
            {/* Shoulder Joint */}
            <circle cx="89" cy="73" r="5" fill="var(--av-accent-hover)" stroke="#B7DCC8" />

            {/* Upper & Forearm raised up */}
            <rect
              x="84"
              y="46"
              width="13"
              height="28"
              rx="6.5"
              fill="url(#arm-grad)"
              stroke="#D6EBE0"
              transform="rotate(15 89 73)"
            />

            {/* Cute Waving Robot Hand/Claw */}
            <g transform="translate(84, 38) rotate(15)">
              <circle cx="6" cy="6" r="6.5" fill="var(--av-accent-bright)" stroke="#FFFFFF" />
              {/* Hand fingers raised waving */}
              <rect x="1" y="-3" width="3" height="6" rx="1.5" fill="#FFFFFF" />
              <rect x="7" y="-3" width="3" height="6" rx="1.5" fill="#FFFFFF" />
            </g>
          </g>

          {/* ── 6. ROBOT LEGS & FEET ("មានជើង ដើរ") ──────────────────── */}
          <g>
            {/* Left Thigh & Leg (With walking step keyframes) */}
            <g className={isWalking ? "animate-robot-leg-left" : ""}>
              <rect x="36" y="103" width="12" height="22" rx="6" fill="url(#arm-grad)" stroke="#D6EBE0" strokeWidth="1.5" />
              {/* Left Knee Joint */}
              <circle cx="42" cy="114" r="3.5" fill="var(--av-accent-hover)" />
              {/* Left Boot Foot */}
              <path d="M 33 122 C 33 119, 51 119, 51 122 L 53 128 C 53 130, 31 130, 31 128 Z" fill="url(#robot-head-grad)" stroke="#D6EBE0" strokeWidth="1" />
              <ellipse cx="42" cy="128" rx="8" ry="2" fill="var(--av-accent-bright)" opacity="0.8" />
            </g>

            {/* Right Thigh & Leg (With walking step keyframes) */}
            <g className={isWalking ? "animate-robot-leg-right" : ""}>
              <rect x="62" y="103" width="12" height="22" rx="6" fill="url(#arm-grad)" stroke="#D6EBE0" strokeWidth="1.5" />
              {/* Right Knee Joint */}
              <circle cx="68" cy="114" r="3.5" fill="var(--av-accent-hover)" />
              {/* Right Boot Foot */}
              <path d="M 59 122 C 59 119, 77 119, 77 122 L 79 128 C 79 130, 57 130, 57 128 Z" fill="url(#robot-head-grad)" stroke="#D6EBE0" strokeWidth="1" />
              <ellipse cx="68" cy="128" rx="8" ry="2" fill="var(--av-accent-bright)" opacity="0.8" />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
