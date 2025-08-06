import { useCallback } from 'react';
import { motion } from 'framer-motion';
import Particles from 'react-tsparticles';
import { loadLinksPreset } from 'tsparticles-preset-links';
import { loadExternalGrabInteraction } from 'tsparticles-interaction-external-grab';
import { loadExternalPushInteraction } from 'tsparticles-interaction-external-push';
import { Typewriter } from 'react-simple-typewriter';

export default function Hero({ darkMode }) {
  const particleColor = darkMode ? '#b4b4b4ff' : '#24013bff';
  const linkColor = darkMode ? '#bcbcbcff' : '#1a0246ff';

  // Particle config
  const particlesInit = useCallback(async (engine) => {
  await loadLinksPreset(engine); // already loads links
  await loadExternalGrabInteraction(engine); // ✅ load grab interaction
  await loadExternalPushInteraction(engine); // ✅ required for push on click
  }, []);

  return (
    <section className="relative overflow-hidden py-12 text-white text-center transition-all">
      {/* Gradient Background + Glass + Glow */}
      <div className="absolute inset-0 z-0">
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
        className="relative z-10 px-4"
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
            transition={{ duration: 1.5, ease: "easeInOut" }}
          >
            👋
          </motion.span>
          I’m Tejas Raut
        </motion.h1>
      </motion.div>

      {/* <motion.div
        className="relative z-10 px-4"
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <motion.h1
          className="text-5xl font-bold font-epilogue bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-100 to-white dark:from-white dark:via-gray-200 dark:to-white drop-shadow-md"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.7 }}
        >
          👋 I’m Tejas Raut
        </motion.h1>
      </motion.div> */}

      {/* Particles */}
      <Particles
        id="tsparticles"
        init={particlesInit}
        options={{
          fullScreen: false,
          background: { color: 'transparent' },
          particles: {
            color: { value: particleColor },
            links: {
              enable: true,
              color: linkColor,
              opacity: darkMode ? 0.25 : 0.4,
              distance: 180,
              width: 1.2,
            },
            move: {
              enable: true,
              speed: 0.6,
              direction: 'none',
              random: true,
              straight: false,
              outModes: {
                default: 'bounce',
              },
            },
            size: {
              value: { min: 1.5, max: 2.8 },
              animation: {
                enable: true,
                speed: 1,
                minimumValue: 1,
                sync: false,
              },
            },
            number: {
              value: 65,
              density: {
                enable: true,
                area: 500,
              },
            },
            opacity: {
              value: { min: 0.3, max: 0.7 },
              animation: {
                enable: true,
                speed: 0.5,
                minimumValue: 0.3,
                sync: false,
              },
            },
            shape: {
              type: 'circle',
            },
          },
          interactivity: {
            events: {
              onHover: {
                enable: true,
                mode: 'grab',
              },
              onClick: {
                enable: true,
                mode: ['push', 'repulse'],
              },
            },
            modes: {
              grab: {
                distance: 200,
                links: {
                  opacity: 0.5,
                },
              },
              repulse: {
                distance: 150,
                duration: 1.5,
              },
              push: {
                quantity: 1,
              },
            },
          },
          detectRetina: true,
        }}
        className="absolute inset-0 z-0"
      />

      {/* <Particles
        id="tsparticles"
        init={particlesInit}
        options={{
          fullScreen: false, // Prevents it from taking over the entire screen
          background: { color: 'transparent' }, // Keeps your background visible
          particles: {
            color: { value: particleColor }, // Color of individual particles (dots)
            links: {
              enable: true,       // Enables the connecting lines between particles
              color: linkColor,   // Color of those lines
              opacity: darkMode ? 0.25 : 0.4,       // Transparency of the lines (0 = invisible, 1 = solid)
              distance: 180,      // Max distance between particles to draw a link
              width: 1.2,           // Thickness of the connecting line
            },
            move: {
              enable: true,       // Enables movement of particles
              speed: 1,           // Movement speed (higher = faster)
              direction: 'none',  // Direction of movement ('top', 'bottom', 'right', etc.)
              outModes: {
                default: 'bounce', // Behavior when particles hit edge ('bounce', 'out', etc.)
              },
            },
            size: {
              value: 2,           // Size of each particle (can also be an array or object for random sizes)
            },
            number: {
              value: 65,          // Total number of particles
              density: {
                enable: true,     // Enables responsive behavior to keep spacing consistent
                area: 500,        // Area size for density calculation (lower = more crowded)
              },
            },
            opacity: {
              value: 0.5,         // Opacity of individual particles
            },
            shape: {
              type: 'circle',     // Shape of the particles ('circle', 'square', 'edge', 'polygon', 'star', etc.)
            },
          },
          interactivity: {
            events: {
              onHover: {
                enable: true,
                mode: 'grab',     // Interaction on hover: 'grab', 'repulse', 'bubble'
              },
              onClick: {
                enable: true,    // Optional: click effects like adding/removing particles
                mode: ['push', 'repulse'],     // 'push' (add), 'remove', 'repulse', etc.
              },
            },
            modes: {
              grab: {
                distance: 200,    // Distance at which lines connect to mouse on hover
                links: {
                  opacity: 0.5,
                },
              },
              repulse: {
                distance: 100,
                duration: 2,
              },
              push: {
                quantity: 1,
              }
            },
          },
          detectRetina: true, // Adjusts for retina displays for smoother visuals
        }}
        className="absolute inset-0 z-0"
      /> */}

      {/* Text */}
      <motion.div
        className="relative z-10 px-4"
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >

        <p className="mt-4 text-lg text-purple-200 dark:text-gray-400 font-jakarta">
          <Typewriter
            words={[
              'Full-Stack Developer',
              'JavaScript | Python | AWS',
              'React | Node.js | BI Engineer',
            ]}
            loop
            cursor
            cursorStyle="_"
            typeSpeed={100}
            deleteSpeed={50}
            delaySpeed={2500}
          />
        </p>
      </motion.div>

      {/* Mouse parallax (optional animated blobs or layers can be added here later) */}
    </section>
  );
}
