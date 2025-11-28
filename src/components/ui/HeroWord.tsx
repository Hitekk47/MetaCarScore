"use client";

import { motion } from "framer-motion";

export default function HeroWord() {
  return (
    <span className="inline-block relative">
       {/* 
          J'utilise une balise span simple pour l'animation CSS du gradient 
          car Framer Motion gère mal les background-position en boucle infinie fluide.
       */}
       <motion.span
          // 1. ANIMATION D'ENTRÉE (Motion)
          initial={{ opacity: 0, filter: "blur(12px)", y: 50 }}
          animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
          transition={{ duration: 4, ease: [0.16, 1, 0.3, 1] }} // "Ease Out Expo" très doux
          
          // 2. STYLE DU GRADIENT
          className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-emerald-400 to-blue-500"
          
          // 3. ANIMATION DU GRADIENT (CSS pur via style en ligne pour la perf)
          style={{ 
            backgroundSize: "200% auto",
            animation: "slowFlow 4s ease-in-out infinite alternate" 
          }}
       >
          parfait.
       </motion.span>

       {/* Définition locale de l'animation CSS */}
       <style jsx>{`
         @keyframes slowFlow {
           0% { background-position: 0% 50%; }
           100% { background-position: 100% 50%; }
         }
       `}</style>
    </span>
  );
}