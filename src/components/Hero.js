// src/components/Hero.js

import { motion } from 'framer-motion';
import Particles from 'react-tsparticles';
import RotatingTitle from './RotatingTitle';
import { useCallback } from 'react';
import { loadLinksPreset } from 'tsparticles-preset-links';
import { loadExternalGrabInteraction } from 'tsparticles-interaction-external-grab';
import { loadExternalRepulseInteraction } from 'tsparticles-interaction-external-repulse';
import { loadParticlesCollisionsInteraction } from 'tsparticles-interaction-particles-collisions';
// import { loadExternalPushInteraction } from 'tsparticles-interaction-external-push';
// import { Typewriter } from 'react-simple-typewriter';


export default function Hero({ darkMode }) {
  const particleColor = darkMode ? '#b4b4b4e4' : '#24013bda';
  const linkColor = darkMode ? '#bcbcbce6' : '#1a0246c6';

  // Particle config
  const particlesInit = useCallback(async (engine) => {
  await loadLinksPreset(engine); // already loads links
  await loadExternalGrabInteraction(engine); // ✅ load grab interaction
  await loadExternalRepulseInteraction(engine); // ✅ click repulse
  await loadParticlesCollisionsInteraction(engine); // ← needed for contact bounce
  // await loadExternalPushInteraction(engine); // ✅ required for push on click
  }, []);

  return (
    <section className="relative overflow-hidden py-12 pb-[28px] text-white text-center transition-all">
      {/* Gradient Background + Glass + Glow */}
      {/* <div className="absolute inset-0 z-0">
       */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {/* Gradient base */}
        <div className="w-full h-full bg-gradient-to-br from-purple-800 via-purple-500 to-purple-900 dark:from-purple-900 dark:via-[#1e1e2f] dark:to-[#181826]" />
        {/* Glass overlay */}
        <div className="absolute inset-0 bg-white/10 dark:bg-white/5 backdrop-blur-2xl" />
        {/* Glow shimmer */}
        <div className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] animate-glow bg-gradient-radial from-purple-300/30 via-transparent to-transparent rounded-full opacity-60 blur-2xl mix-blend-lighten pointer-events-none" />
        
        {/* Haikei-style blurred blobs */}
        <div className="absolute w-72 h-72 bg-purple-400 opacity-20 rounded-full blur-[90px] top-20 left-10 animate-pulse" />
        <div className="absolute w-96 h-96 bg-indigo-500 opacity-20 rounded-full blur-[120px] bottom-10 right-20 animate-pulse delay-200" />
      </div>

      {/* Animated Content */}
      <motion.div
        // className="relative z-10 px-4"
        className="relative z-10 px-4 pointer-events-none"
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <motion.h1
          className="text-5xl font-bold font-epilogue bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-100 to-white dark:from-white dark:via-gray-200 dark:to-white drop-shadow-md flex items-center justify-center gap-3"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.7 }}
        >
          <motion.span
            className="inline-block origin-[70%_70%] bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-100 to-white dark:from-white dark:via-gray-200 dark:to-white"
            animate={{ rotate: [0, 25, -20, 25, -15, 15, 0] }}
            transition={{ duration: 2.5, ease: "easeInOut" }}
          >
            👋
          </motion.span>
          I’m Tejas Raut
        </motion.h1>
      </motion.div>

      {/* Particles (sized to the hero area, so clicks map correctly) */}
      <Particles
        id="tsparticles"
        init={particlesInit}
        /* ensure the wrapper fills the hero and actually receives pointer events */
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'auto' }}
        containerClassName="pointer-events-auto"
        /* make the canvas match the wrapper size */
        canvasClassName="w-full h-full pointer-events-auto"
        className="absolute inset-0 z-0"
        options={{
          // 👇 use object form so tsParticles doesn’t create a full-screen canvas behind the scenes
          fullScreen: { enable: false, zIndex: 0 },

          background: { color: 'transparent' },
          particles: {
            color: { value: particleColor },
            links: {
              enable: true,
              color: linkColor,
              opacity: darkMode ? 0.25 : 0.4,
              distance: 180,
              frequency: 0.40,
              width: darkMode ? 2 : 1.5,
            },
            move: {
              enable: true,
              speed: 0.6,
              direction: 'none',
              random: true,
              straight: false,
              outModes: {
                default: 'bounce',
                top: 'bounce',
                right: 'bounce',
                bottom: 'bounce',
                left: 'bounce',
              },
            },
            // Real contact bounce
            collisions: {
              enable: true,
              mode: 'bounce',
              // set overlap to false to react right at contact (feels "earlier")
              overlap: { enable: false },
            },
            size: {
              value: { min: 1.5, max: 2.8 },
              animation: { enable: true, speed: 1, minimumValue: 1, sync: false },
            },
            number: { value: 65, density: { enable: true, area: 500 } },
            opacity: {
              value: { min: 0.3, max: 0.7 },
              animation: { enable: true, speed: 0.5, minimumValue: 0.3, sync: false },
            },
            shape: { type: 'circle' },
          },
          interactivity: {
            // 👇 read pointer relative to the Particles PARENT (the hero section),
            // which fixes clicks spawning at corners.
            detectsOn: 'canvas',
            events: {
              onHover: { enable: true, mode: 'grab' },
              onClick: { enable: true, mode: 'repulse' },
            },
            modes: {
              grab: { distance: 150, links: { opacity: 0.5 } },
              repulse: { distance: 100, duration: 1.5 },
              push: { quantity: 1 },
            },
          },
          detectRetina: true,
        }}
      />

      {/* Text */}
      <motion.div
        // className="relative z-10 px-4"
        className="relative z-10 px-4 pointer-events-none"
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <RotatingTitle />
      </motion.div>

      {/* Mouse parallax (optional animated blobs or layers can be added here later) */}
    </section>
  );
}
