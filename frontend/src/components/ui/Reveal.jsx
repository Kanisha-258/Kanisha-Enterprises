import { motion, useReducedMotion } from "framer-motion";

/**
 * Fades + lifts its children into view the first time they scroll on screen.
 *
 * <Reveal delay={0.1} y={24}>…</Reveal>
 *
 * Users who prefer reduced motion get the content immediately, with no
 * transform — never hidden waiting for an animation that won't play.
 */
export default function Reveal({
  children,
  delay = 0,
  y = 26,
  duration = 0.65,
  once = true,
  className = "",
  as = "div",
}) {
  const reduceMotion = useReducedMotion();
  const MotionTag = motion[as] ?? motion.div;

  if (reduceMotion) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount: 0.2, margin: "0px 0px -60px 0px" }}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </MotionTag>
  );
}

/**
 * Staggers direct children. Pair with <Reveal.Item> (or Reveal) inside it.
 */
export function RevealGroup({
  children,
  stagger = 0.08,
  delay = 0,
  className = "",
  as = "div",
}) {
  const reduceMotion = useReducedMotion();
  const MotionTag = motion[as] ?? motion.div;

  if (reduceMotion) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  return (
    <MotionTag
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.15 }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: stagger, delayChildren: delay } },
      }}
    >
      {children}
    </MotionTag>
  );
}

/** Child of RevealGroup — animates in at the position set by the parent. */
export function RevealItem({ children, className = "", as = "div", ...rest }) {
  const reduceMotion = useReducedMotion();
  const MotionTag = motion[as] ?? motion.div;

  if (reduceMotion) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  return (
    <MotionTag
      className={className}
      variants={{
        hidden: { opacity: 0, y: 22 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
        },
      }}
      {...rest}
    >
      {children}
    </MotionTag>
  );
}
