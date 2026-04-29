"use client"
import { useEffect, useRef, useState } from "react"
import { MeshGradient, PulsingBorder } from "@paper-design/shaders-react"
import { motion } from "framer-motion"
import { Brain, Users, Mic, Briefcase, Trophy } from "lucide-react"

export default function ShaderShowcase() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    const handleMouseEnter = () => setIsActive(true)
    const handleMouseLeave = () => setIsActive(false)

    const container = containerRef.current
    if (container) {
      container.addEventListener("mouseenter", handleMouseEnter)
      container.addEventListener("mouseleave", handleMouseLeave)
    }

    return () => {
      if (container) {
        container.removeEventListener("mouseenter", handleMouseEnter)
        container.removeEventListener("mouseleave", handleMouseLeave)
      }
    }
  }, [])

  return (
    <div ref={containerRef} className="min-h-screen bg-white relative overflow-x-hidden">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <svg className="absolute inset-0 w-0 h-0">
        <defs>
          <filter id="glass-effect" x="-50%" y="-50%" width="200%" height="200%">
            <feTurbulence baseFrequency="0.005" numOctaves="1" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.3" />
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0.02
                      0 1 0 0 0.02
                      0 0 1 0 0.05
                      0 0 0 0.9 0"
              result="tint"
            />
          </filter>
          <filter id="gooey-filter" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
              result="gooey"
            />
            <feComposite in="SourceGraphic" in2="gooey" operator="atop" />
          </filter>
          <filter id="logo-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0284c7" />
            <stop offset="50%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#4338ca" />
          </linearGradient>
          <linearGradient id="hero-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="30%" stopColor="#0ea5e9" />
            <stop offset="70%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
          <filter id="text-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      <MeshGradient
        className="absolute inset-0 w-full h-full opacity-60"
        colors={["#ffffff", "#e0f2fe", "#bae6fd", "#7dd3fc", "#38bdf8"]}
        speed={0.15}
      />
      <MeshGradient
        className="absolute inset-0 w-full h-full opacity-40"
        colors={["#ffffff", "#f1f5f9", "#e2e8f0", "#e0f2fe"]}
        speed={0.1}
      />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <header className="flex items-center justify-between p-6 md:px-12 w-full max-w-7xl mx-auto">
        <motion.div
          className="flex items-center group cursor-pointer"
          whileHover={{ scale: 1.05 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
        >
          <span className="text-3xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-sky-600 via-indigo-600 to-cyan-500 drop-shadow-sm hover:scale-105 transition-all duration-300">
            Ace It Up
          </span>
        </motion.div>

        {/* Navigation */}
        <nav className="flex items-center space-x-2">
          <a
            href="/dashboard"
            className="text-slate-600 hover:text-slate-900 text-xs font-medium px-3 py-2 rounded-full hover:bg-slate-100 transition-all duration-200"
          >
            Dashboard
          </a>
          <a
            href="#features"
            className="text-slate-600 hover:text-slate-900 text-xs font-medium px-3 py-2 rounded-full hover:bg-slate-100 transition-all duration-200"
          >
            Features
          </a>
        </nav>

        {/* Login & Register Buttons */}
        <div className="flex items-center gap-4">
          <a href="/login" className="text-slate-600 hover:text-slate-900 text-sm font-semibold px-2 py-2 transition-colors duration-200">
            Sign In
          </a>
          <div id="gooey-btn" className="relative flex items-center group" style={{ filter: "url(#gooey-filter)" }}>
            <button className="absolute right-0 px-2.5 py-2 rounded-full bg-slate-900 text-white font-normal text-xs transition-all duration-300 hover:bg-slate-800 cursor-pointer h-9 flex items-center justify-center -translate-x-12 group-hover:-translate-x-24 z-0">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7V17" />
              </svg>
            </button>
            <a href="/register" className="px-7 py-2.5 rounded-full bg-slate-900 text-white font-semibold text-sm transition-all duration-300 hover:bg-slate-800 cursor-pointer h-9 flex items-center z-10 shadow-sm tracking-wide">
              Register
            </a>
          </div>
        </div>
        </header>

        <main className="flex-1 flex flex-col justify-center px-6 md:px-12 pt-16 pb-24 w-full max-w-7xl mx-auto">
          <div className="text-left max-w-2xl">


          <motion.h1
            className="text-6xl md:text-7xl lg:text-8xl font-bold text-slate-900 mb-6 leading-none tracking-tight"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <motion.span
              className="block font-light text-slate-800 text-4xl md:text-5xl lg:text-6xl mb-2 tracking-wider"
              style={{
                background: "linear-gradient(135deg, #0f172a 0%, #0284c7 30%, #4f46e5 70%, #0f172a 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                filter: "url(#text-glow)",
              }}
              animate={{
                backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
              }}
              transition={{
                duration: 8,
                repeat: Number.POSITIVE_INFINITY,
                ease: "linear",
              }}
            >
              Master Your
            </motion.span>
            <span className="block font-black text-slate-900 drop-shadow-xl">Dream</span>
            <span className="block font-light text-slate-600 italic">Career</span>
          </motion.h1>

          <motion.p
            className="text-lg font-medium text-slate-600 mb-8 leading-relaxed max-w-xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            Create stunning interview experiences with our advanced AI technology. Interactive aptitude tests, smooth
            group discussions, and beautiful feedback that responds to your every word.
          </motion.p>

          <motion.div
            className="flex items-center gap-6 flex-wrap"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.0 }}
          >
            <motion.a
              href="/dashboard"
              className="px-10 py-4 rounded-full bg-white/50 border-2 border-slate-200 text-slate-900 font-bold text-sm transition-all duration-300 hover:bg-slate-50 hover:border-slate-300 cursor-pointer backdrop-blur-md shadow-sm"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              View Dashboard
            </motion.a>
            <motion.a
              href="/register"
              className="px-10 py-4 rounded-full bg-gradient-to-r from-cyan-600 to-indigo-600 text-white font-bold text-sm transition-all duration-300 hover:from-cyan-500 hover:to-indigo-500 cursor-pointer shadow-lg hover:shadow-xl inline-block"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Get Started
            </motion.a>
          </motion.div>
          </div>

          <motion.div 
            id="features"
            className="mt-28 grid sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left w-full"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.2 }}
          >
            {[
              { icon: Brain, title: "Aptitude", desc: "Timed MCQ tests with instant scoring." },
              { icon: Users, title: "Group Discussion", desc: "Topics graded by AI feedback." },
              { icon: Mic, title: "Communication", desc: "Daily prompts to sharpen fluency." },
              { icon: Briefcase, title: "Interview", desc: "HR + technical mock Q&A." },
            ].map((f) => (
              <div key={f.title} className="rounded-3xl border border-slate-200/60 bg-white/60 backdrop-blur-xl p-6 hover:border-cyan-400/50 hover:-translate-y-1 transition-all duration-300 shadow-sm hover:shadow-lg">
                <div className="grid place-items-center w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-500 mb-4 shadow-sm text-white">
                  <f.icon className="w-6 h-6" />
                </div>
                <p className="font-bold text-slate-900 text-lg">{f.title}</p>
                <p className="text-sm text-slate-600 mt-2 font-medium">{f.desc}</p>
              </div>
            ))}
          </motion.div>

          <motion.div 
            className="mt-16 inline-flex items-center justify-center gap-2 text-sm font-semibold text-slate-500 w-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1.5 }}
          >
            <Trophy className="w-5 h-5 text-indigo-500" /> Built for students serious about placements.
          </motion.div>

        </main>
      </div>

      <div className="fixed bottom-8 right-8 z-30 hidden lg:block">
        <div className="relative w-20 h-20 flex items-center justify-center">
          {/* @ts-ignore - Some properties from the original template are not in the official types */}
          <PulsingBorder
            colors={["#0ea5e9", "#6366f1", "#a855f7", "#ec4899", "#f43f5e", "#f97316", "#ffffff"]}
            colorBack="#ffffff00"
            speed={1.5}
            roundness={1}
            thickness={0.1}
            softness={0.2}
            intensity={5}
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "50%",
            }}
          />

          {/* Rotating Text Around the Pulsing Border */}
          <motion.svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 100 100"
            animate={{ rotate: 360 }}
            transition={{
              duration: 20,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
            style={{ transform: "scale(1.6)" }}
          >
            <defs>
              <path id="circle" d="M 50, 50 m -38, 0 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0" />
            </defs>
            <text className="text-[10px] fill-slate-700 font-bold">
              <textPath href="#circle" startOffset="0%">
                Ace It Up • Placements • Interviews • Aptitude • 
              </textPath>
            </text>
          </motion.svg>
        </div>
      </div>
    </div>
  )
}
