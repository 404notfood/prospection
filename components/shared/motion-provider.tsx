"use client";
import { MotionConfig as Config } from "motion/react";
export function MotionConfig({ children }: { children: React.ReactNode }) {
  return <Config reducedMotion="user">{children}</Config>;
}
