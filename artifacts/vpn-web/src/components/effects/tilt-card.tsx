import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useRef, useState, ReactNode, useEffect } from "react";

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  intensity?: number;
  glareEnabled?: boolean;
  scaleOnHover?: number;
}

function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
}

export function TiltCard({
  children,
  className = "",
  intensity = 15,
  glareEnabled = true,
  scaleOnHover = 1.02,
}: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(isMobileDevice());
    const handleResize = () => setIsMobile(isMobileDevice());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 400, damping: 30 });
  const mouseYSpring = useSpring(y, { stiffness: 400, damping: 30 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], [intensity, -intensity]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], [-intensity, intensity]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isMobile) return;
    if (!ref.current) return;

    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;

    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    x.set(0);
    y.set(0);
  };

  const handleMouseEnter = () => {
    if (!isMobile) setIsHovered(true);
  };

  // On mobile, render without tilt effect
  if (isMobile) {
    return (
      <motion.div
        className={`relative ${className}`}
        whileHover={{ scale: scaleOnHover }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      >
        <div className="relative w-full h-full">
          {children}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      ref={ref}
      className={`relative ${className}`}
      style={{
        perspective: 1000,
        transformStyle: "preserve-3d",
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
    >
      <motion.div
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
          willChange: 'transform',
        }}
        animate={{
          scale: isHovered ? scaleOnHover : 1,
        }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="relative w-full h-full"
      >
        {children}

        {glareEnabled && (
          <motion.div
            className="absolute inset-0 rounded-inherit pointer-events-none"
            style={{
              background: useTransform(
                [mouseXSpring, mouseYSpring],
                ([latestX, latestY]) => {
                  const glareX = (latestX as number + 0.5) * 100;
                  const glareY = (latestY as number + 0.5) * 100;
                  return `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.15) 0%, transparent 60%)`;
                }
              ),
              opacity: isHovered ? 1 : 0,
            }}
            transition={{ opacity: { duration: 0.2 } }}
          />
        )}
      </motion.div>
    </motion.div>
  );
}

/**
 * FlipCard - Card with flip animation to reveal back content
 */
export function FlipCard({
  front,
  back,
  className = "",
  flipOn = "hover", // 'hover' or 'click'
}: {
  front: ReactNode;
  back: ReactNode;
  className?: string;
  flipOn?: "hover" | "click";
}) {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleFlip = () => {
    if (flipOn === "click") {
      setIsFlipped(!isFlipped);
    }
  };

  return (
    <motion.div
      className={`relative ${className}`}
      style={{ perspective: 1000 }}
      onMouseEnter={() => flipOn === "hover" && setIsFlipped(true)}
      onMouseLeave={() => flipOn === "hover" && setIsFlipped(false)}
      onClick={handleFlip}
    >
      <motion.div
        className="relative w-full h-full"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: "spring", stiffness: 300, damping: 30 }}
      >
        {/* Front */}
        <div
          className="absolute inset-0"
          style={{ backfaceVisibility: "hidden" }}
        >
          {front}
        </div>

        {/* Back */}
        <div
          className="absolute inset-0"
          style={{ 
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          {back}
        </div>
      </motion.div>
    </motion.div>
  );
}
