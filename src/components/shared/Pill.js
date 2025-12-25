// src/components/shared/Pill.js
import React from "react";
import { cx } from "../../utils/cx";
import {
  PILL_BASE,
  PILL_GRAY,
  PILL_PURPLE,
  PILL_GRAY_STATIC,
  PILL_PURPLE_STATIC,
} from "../../utils/ui";

const VARIANT_MAP = {
  gray: PILL_GRAY,
  purple: PILL_PURPLE,
  grayStatic: PILL_GRAY_STATIC,
  purpleStatic: PILL_PURPLE_STATIC,
};

/**
 * Shared pill/tag/chip.
 * Use `as="button"` if you need clickability.
 */
export default function Pill({
  as: As = "span",
  variant = "gray",
  className,
  children,
  ...rest
}) {
  const variantClass = VARIANT_MAP[variant] ?? VARIANT_MAP.gray;

  return (
    <As className={cx(PILL_BASE, variantClass, className)} {...rest}>
      {children}
    </As>
  );
}
