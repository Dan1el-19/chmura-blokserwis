"use client";

import { useEffect } from 'react';

/**
 * Ustawia zmienną CSS --app-vh równą 1% aktualnej wysokości okna.
 * Dzięki temu klasa .min-h-app-screen może mieć stabilną wysokość
 * także na mobilnych przeglądarkach (problem 100vh / białego paska).
 */
export function use100vh() {
  useEffect(() => {
    const setVar = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--app-vh', `${vh}px`);
    };
    setVar();
    window.addEventListener('resize', setVar);
    window.addEventListener('orientationchange', setVar);
    return () => {
      window.removeEventListener('resize', setVar);
      window.removeEventListener('orientationchange', setVar);
    };
  }, []);
}
