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

export const getInitials = (name?: string) => {
  if (!name) return "?";
  
  // Remove anything inside parentheses, including the parentheses themselves
  const cleanName = name.replace(/\([^)]*\)/g, "");
  
  // Split by anything that is not a letter to get word-like chunks of letters
  const letterChunks = cleanName.split(/[^a-zA-Z]+/).filter(Boolean);
  
  if (letterChunks.length === 0) return "?";
  
  return letterChunks
    .slice(0, 2)
    .map((chunk) => chunk[0])
    .join("")
    .toUpperCase();
};

/**
 * Extracts storage path from public URL
 */
export const getStoragePath = (url: string, bucket: string): string | null => {
  try {
    const urlObj = new URL(url);
    const pattern = `/storage/v1/object/public/${bucket}/`;
    const parts = urlObj.pathname.split(pattern);
    return parts.length > 1 ? decodeURIComponent(parts[1]) : null;
  } catch (e) {
    return null;
  }
};