import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useRef, useState, ReactNode } from "react";

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  intensity?: number; // How strong the tilt effect is (default: 15)
  glareEnabled?: boolean; // Enable glare effect on hover
  scaleOnHover?: number; // Scale factor on hover (default: 1.02)
}

/**
 * TiltCard - 3D tilt effect card with optional glare
 * Creates an interactive 3D perspective effect on hover
 */
export function TiltCard({
  children,
  className = "",
  intensity = 15,
  glareEnabled = true,
  scaleOnHover = 1.02,
}: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 400, damping: 30 });
  const mouseYSpring = useSpring(y, { stiffness: 400, damping: 30 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], [intensity, -intensity]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], [-intensity, intensity]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
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
    setIsHovered(true);
  };

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
        }}
        animate={{
          scale: isHovered ? scaleOnHover : 1,
        }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="relative w-full h-full"
      >
        {children}

        {/* Glare effect */}
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
