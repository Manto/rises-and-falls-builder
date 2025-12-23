"use client";

import { ClientOnly, IconButton, Skeleton } from "@chakra-ui/react";
import { ThemeProvider, useTheme } from "next-themes";
import type { ThemeProviderProps } from "next-themes";
import { forwardRef } from "react";
import { FiMoon, FiSun } from "react-icons/fi";

export function ColorModeProvider(props: ThemeProviderProps) {
  return (
    <ThemeProvider attribute="class" disableTransitionOnChange {...props} />
  );
}

export function useColorMode() {
  const { resolvedTheme, setTheme } = useTheme();
  const toggleColorMode = () => {
    setTheme(resolvedTheme === "light" ? "dark" : "light");
  };
  return {
    colorMode: resolvedTheme,
    setColorMode: setTheme,
    toggleColorMode,
  };
}

export function useColorModeValue<T>(light: T, dark: T) {
  const { colorMode } = useColorMode();
  return colorMode === "light" ? light : dark;
}

export function ColorModeIcon() {
  const { colorMode } = useColorMode();
  return colorMode === "light" ? <FiMoon /> : <FiSun />;
}

interface ColorModeButtonProps {
  size?: "xs" | "sm" | "md" | "lg";
}

export const ColorModeButton = forwardRef<HTMLButtonElement, ColorModeButtonProps>(
  function ColorModeButton({ size = "md" }, ref) {
    const { toggleColorMode } = useColorMode();
    return (
      <ClientOnly fallback={<Skeleton boxSize={size === "sm" ? "8" : "10"} rounded="md" />}>
        <IconButton
          ref={ref}
          onClick={toggleColorMode}
          variant="ghost"
          aria-label="Toggle color mode"
          size={size}
          color="fg.muted"
          _hover={{ color: "fg.DEFAULT", bg: "bg.muted" }}
        >
          <ColorModeIcon />
        </IconButton>
      </ClientOnly>
    );
  }
);

