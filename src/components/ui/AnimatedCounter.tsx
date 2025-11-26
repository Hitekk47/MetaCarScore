"use client";

import { useEffect, useRef } from "react";
import { useInView, useMotionValue, useSpring } from "framer-motion";

interface AnimatedCounterProps {
  value: number;
  className?: string;
}

export default function AnimatedCounter({ value, className }: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, {
    damping: 30, // Freinage (plus c'est haut, moins ça rebondit)
    stiffness: 50, // Rigidité (vitesse)
    duration: 2000,
  });
  
  // Détecte si l'élément est visible dans le viewport
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  useEffect(() => {
    if (isInView) {
      motionValue.set(value);
    }
  }, [motionValue, value, isInView]);

  useEffect(() => {
    // Abonnement aux changements de la valeur "ressort"
    // On met à jour le DOM directement pour la perf (évite les re-renders React)
    return springValue.on("change", (latest) => {
      if (ref.current) {
        ref.current.textContent = Intl.NumberFormat("fr-FR").format(Math.floor(latest));
      }
    });
  }, [springValue]);

  return <span ref={ref} className={className}>0</span>;
}