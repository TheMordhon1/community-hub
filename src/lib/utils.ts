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

export const getValidDate = (date?: string, time?: string) => {
  if (!date) return null;
  // If date is already a full ISO string, just use it. 
  // Otherwise, append the time.
  const dateString = time ? `${date.split('T')[0]}T${time}` : date;
  const parsedDate = new Date(dateString);
  return isNaN(parsedDate.getTime()) ? null : parsedDate;
};