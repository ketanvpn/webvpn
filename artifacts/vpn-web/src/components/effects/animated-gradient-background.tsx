import { motion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * AnimatedGradientBackground - Smooth morphing gradient background
 * Creates an immersive, ever-changing gradient effect for hero sections
 */
export function AnimatedGradientBackground() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="absolute inset-0 overflow-hidden -z-10 pointer-events-none">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950" />

      {/* Animated morphing blobs */}
      <motion.div
        className="absolute -top-[40%] -left-[20%] w-[70%] h-[70%]"
        animate={{
          x: [0, 100, 50, 0],
          y: [0, 50, 100, 0],
          scale: [1, 1.1, 0.9, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <div className="w-full h-full rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 blur-[100px] opacity-60" />
      </motion.div>

      <motion.div
        className="absolute -bottom-[30%] -right-[20%] w-[60%] h-[60%]"
        animate={{
          x: [0, -80, -40, 0],
          y: [0, -60, -120, 0],
          scale: [1, 1.2, 0.8, 1],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
      >
        <div className="w-full h-full rounded-full bg-gradient-to-tl from-cyan-500/15 to-teal-500/10 blur-[120px] opacity-50" />
      </motion.div>

      <motion.div
        className="absolute top-[30%] right-[10%] w-[40%] h-[40%]"
        animate={{
          x: [0, -50, 30, 0],
          y: [0, 80, 40, 0],
          scale: [1, 0.9, 1.1, 1],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 5,
        }}
      >
        <div className="w-full h-full rounded-full bg-gradient-to-bl from-teal-500/10 to-emerald-500/15 blur-[80px] opacity-40" />
      </motion.div>

      {/* Additional floating accent orbs */}
      <motion.div
        className="absolute top-[10%] left-[60%] w-[25%] h-[25%]"
        animate={{
          x: [0, 40, -20, 0],
          y: [0, 60, 30, 0],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 8,
        }}
      >
        <div className="w-full h-full rounded-full bg-gradient-to-r from-emerald-400/10 to-cyan-400/5 blur-[60px] opacity-30" />
      </motion.div>

      <motion.div
        className="absolute bottom-[20%] left-[30%] w-[30%] h-[30%]"
        animate={{
          x: [0, -30, 40, 0],
          y: [0, -40, -20, 0],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 12,
        }}
      >
        <div className="w-full h-full rounded-full bg-gradient-to-t from-cyan-400/8 to-emerald-400/10 blur-[90px] opacity-25" />
      </motion.div>

      {/* Subtle grid overlay for depth */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />
    </div>
  );
}
