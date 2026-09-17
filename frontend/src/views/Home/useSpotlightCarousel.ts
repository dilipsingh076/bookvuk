"use client";

/**
 * The spotlight's rotation.
 *
 * Three things stop it: one slide (nothing to rotate to), the pointer resting on
 * it (reading a cover should not move it out from under the cursor), and
 * `prefers-reduced-motion`, which is honoured by dropping the carousel entirely
 * rather than by rotating without a transition — a slide that swaps instantly is
 * more disorienting than one that slides.
 */

import { useEffect, useState } from "react";
import { SPOTLIGHT_AUTO_MS } from "./types";

export const useSpotlightCarousel = (slideCount: number) => {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (slideCount <= 1 || paused || reduceMotion) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % slideCount);
    }, SPOTLIGHT_AUTO_MS);
    return () => window.clearInterval(id);
  }, [slideCount, paused, reduceMotion]);

  return {
    index,
    show: setIndex,
    reduceMotion,
    pause: () => setPaused(true),
    resume: () => setPaused(false),
    /** A single slide, or a visitor who asked for no motion, gets a plain grid. */
    staticGrid: slideCount <= 1 || reduceMotion,
  };
};
