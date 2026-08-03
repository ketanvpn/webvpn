import { motion } from "framer-motion";
import { ReactNode } from "react";
import { Loader2, Shield, Zap, Globe, Server } from "lucide-react";

/**
 * AnimatedLoader - Premium animated loading spinner
 */
export function AnimatedLoader({ 
  size = "md",
  className = "",
}: { 
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeMap = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      className={className}
    >
      <Loader2 className={`${sizeMap[size]} text-primary`} />
    </motion.div>
  );
}

/**
 * PulseLoader - Pulsing dots loader
 */
export function PulseLoader({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="h-2 w-2 rounded-full bg-primary"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.15,
          }}
        />
      ))}
    </div>
  );
}

/**
 * LoadingState - Full page loading state with animated icon
 */
export function LoadingState({
  icon: Icon = Shield,
  title = "Memuat...",
  subtitle,
  className = "",
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title?: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center min-h-[300px] ${className}`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative"
      >
        {/* Outer ring */}
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-primary/30"
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        />

        {/* Inner glow */}
        <motion.div
          className="absolute inset-2 rounded-full bg-primary/10"
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />

        {/* Icon */}
        <div className="relative p-6">
          <motion.div
            animate={{
              rotate: [0, 10, -10, 0],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Icon className="h-10 w-10 text-primary" />
          </motion.div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-6 text-center"
      >
        <p className="font-semibold text-foreground">{title}</p>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        )}
      </motion.div>
    </div>
  );
}

/**
 * SkeletonLoader - Animated skeleton for content loading
 */
export function SkeletonLoader({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <motion.div
          key={i}
          className="h-4 bg-white/5 rounded-lg overflow-hidden"
          style={{ width: `${100 - (i * 15)}%` }}
        >
          <motion.div
            className="h-full bg-gradient-to-r from-transparent via-white/10 to-transparent"
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          />
        </motion.div>
      ))}
    </div>
  );
}

/**
 * CardSkeleton - Skeleton loader for card components
 */
export function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-3xl glass-card p-5 ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <motion.div className="h-12 w-12 rounded-2xl bg-white/5 overflow-hidden">
            <motion.div
              className="h-full w-full bg-gradient-to-r from-transparent via-white/10 to-transparent"
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            />
          </motion.div>
          <div className="space-y-2">
            <motion.div className="h-4 w-24 bg-white/5 rounded" />
            <motion.div className="h-3 w-16 bg-white/5 rounded" />
          </div>
        </div>
        <motion.div className="h-6 w-16 bg-white/5 rounded-full" />
      </div>
      <div className="space-y-2">
        <motion.div className="h-3 w-full bg-white/5 rounded" />
        <motion.div className="h-3 w-3/4 bg-white/5 rounded" />
      </div>
    </div>
  );
}

/**
 * AnimatedIcon - Icon with hover animation
 */
export function AnimatedIcon({
  icon: Icon,
  size = 24,
  className = "",
  hoverScale = 1.2,
  color = "text-primary",
}: {
  icon: React.ComponentType<{ className?: string }>;
  size?: number;
  className?: string;
  hoverScale?: number;
  color?: string;
}) {
  return (
    <motion.div
      whileHover={{ scale: hoverScale, rotate: 5 }}
      whileTap={{ scale: 0.9 }}
      className={`inline-flex ${className}`}
    >
      <Icon className={color} />
    </motion.div>
  );
}
