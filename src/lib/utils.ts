import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}



export const formatEventTime = (time: string | null) => {
  if (!time) return null;
  // Format HH:mm:ss to HH:mm
  return time.substring(0, 5);
};