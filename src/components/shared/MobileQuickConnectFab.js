import React from "react";
import { createPortal } from "react-dom";
import { cx } from "../../utils/cx";
import { FaLink } from "react-icons/fa";

export default function MobileQuickConnectFab({ children, label = "Connect" }) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {/* Mobile FAB only */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cx(
          "md:hidden fixed z-[65] right-4",
          "bottom-[calc(env(safe-area-inset-bottom)+78px)]", // floats above dock
          "rounded-full px-4 py-3",
          "bg-purple-700/80 dark:bg-purple-600/80 text-white",
          "shadow-lg shadow-purple-900/20",
          "border border-white/10",
          "transition hover:scale-[1.02] active:scale-[0.98]"
        )}
        aria-label={label}
        title={label}
      >
        <span className="flex items-center gap-2">
          <FaLink className="text-[10px]" />
          <span className="text-[10px] font-semibold">{label}</span>
        </span>
      </button>

      {/* Modal */}
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            onClick={() => setOpen(false)}
          >
            {/* Centered pill container only (no header/close UI) */}
            <div
              className={cx(
                "absolute left-1/2 -translate-x-1/2",
                "bottom-[calc(env(safe-area-inset-bottom)+88px)]",
                "w-auto max-w-[92vw]"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Ensure pill feels centered and doesn't stretch */}
              <div className="flex justify-center">
                <div className="w-fit">
                  {/*
                    Expecting `children` to be the pill (QuickConnectPill).
                    If the pill itself already has `flex items-center`, this will
                    keep it compact and centered.
                  */}
                  {children}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}


// import React from "react";
// import { createPortal } from "react-dom";
// import { cx } from "../../utils/cx";
// import { FaLink } from "react-icons/fa";

// export default function MobileQuickConnectFab({ children, label = "Connect" }) {
//   const [open, setOpen] = React.useState(false);

//   React.useEffect(() => {
//     const onKey = (e) => {
//       if (e.key === "Escape") setOpen(false);
//     };
//     window.addEventListener("keydown", onKey);
//     return () => window.removeEventListener("keydown", onKey);
//   }, []);

//   return (
//     <>
//       {/* Mobile FAB only */}
//       <button
//         type="button"
//         onClick={() => setOpen(true)}
//         className={cx(
//           "md:hidden fixed z-[65] right-4",
//           "bottom-[calc(env(safe-area-inset-bottom)+78px)]", // floats above dock
//           "rounded-full px-4 py-3",
//           "bg-purple-700 dark:bg-purple-600 text-white",
//           "shadow-lg shadow-purple-900/20",
//           "border border-white/10",
//           "transition hover:scale-[1.02] active:scale-[0.98]"
//         )}
//         aria-label={label}
//         title={label}
//       >
//         <span className="flex items-center gap-2">
//           <FaLink className="text-sm" />
//           <span className="text-sm font-semibold">{label}</span>
//         </span>
//       </button>

//       {/* Modal */}
//       {open &&
//         createPortal(
//           <div
//             className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm"
//             role="dialog"
//             aria-modal="true"
//             onClick={() => setOpen(false)}
//           >
//             <div
//               className={cx(
//                 "absolute left-1/2 -translate-x-1/2 w-[min(92vw,520px)]",
//                 "bottom-[calc(env(safe-area-inset-bottom)+88px)]",
//                 "rounded-2xl",
//                 "bg-white/90 dark:bg-[#0b0b12]/90",
//                 "border border-gray-200/70 dark:border-white/10",
//                 "shadow-2xl overflow-hidden"
//               )}
//               onClick={(e) => e.stopPropagation()}
//             >
//               <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200/70 dark:border-white/10">
//                 <div className="text-sm font-semibold text-gray-900 dark:text-white">
//                   Quick Connect
//                 </div>
//                 <button
//                   type="button"
//                   onClick={() => setOpen(false)}
//                   className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/10 text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-white/15 transition"
//                 >
//                   Close
//                 </button>
//               </div>

//               <div className="p-4">{children}</div>
//             </div>
//           </div>,
//           document.body
//         )}
//     </>
//   );
// }
