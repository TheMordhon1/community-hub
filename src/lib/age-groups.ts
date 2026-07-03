// Age group helpers for competition registrations.
// Cutoffs: Kids < 13, Teenager 13-17, Adult 18+

export type AgeGroup = "adult" | "teenager" | "kids";
export type AgeCategory = AgeGroup | "mixed";

export interface AgeBracket {
  min: number;
  max: number;
  label?: string;
}

export const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  adult: "Dewasa",
  teenager: "Remaja",
  kids: "Anak-anak",
};

export const AGE_CATEGORY_LABELS: Record<AgeCategory, string> = {
  ...AGE_GROUP_LABELS,
  mixed: "Semua Umur",
};

export const AGE_CATEGORY_OPTIONS: AgeCategory[] = ["mixed", "adult", "teenager", "kids"];

// Gender categories for competitions
export type GenderCategory = "mixed" | "male" | "female";
export type Gender = "male" | "female";

export const GENDER_CATEGORY_LABELS: Record<GenderCategory, string> = {
  mixed: "Campuran",
  male: "Laki-laki",
  female: "Perempuan",
};

export const GENDER_LABELS: Record<Gender, string> = {
  male: "Laki-laki",
  female: "Perempuan",
};

export const GENDER_CATEGORY_OPTIONS: GenderCategory[] = ["mixed", "male", "female"];

export function isGenderMatchingCategory(
  gender: Gender | null | undefined,
  category: GenderCategory
): boolean {
  if (category === "mixed") return true;
  if (!gender) return false;
  return gender === category;
}

export function getAgeGroup(age: number | null | undefined): AgeGroup | null {
  if (age == null || isNaN(age) || age < 0) return null;
  if (age < 13) return "kids";
  if (age < 18) return "teenager";
  return "adult";
}

/**
 * Auto-bucket a kid's age into a fair default bracket when admin
 * hasn't defined custom brackets. Used as fallback only.
 */
export function getKidsBracket(age: number): string {
  if (age < 0) return "Tidak valid";
  if (age < 4) {
    const lo = Math.floor(age * 2) / 2;
    const hi = lo + 0.5;
    return `${formatAge(lo)} - ${formatAge(hi)} thn`;
  }
  if (age < 7) {
    const lo = Math.floor(age);
    return `${lo} - ${lo + 1} thn`;
  }
  const lo = Math.floor((age - 7) / 2) * 2 + 7;
  return `${lo} - ${lo + 2} thn`;
}

function formatAge(n: number): string {
  return n % 1 === 0 ? `${n}` : n.toFixed(1);
}

export function formatBracket(b: AgeBracket): string {
  if (b.label && b.label.trim()) return b.label.trim();
  return `${formatAge(b.min)} - ${formatAge(b.max)} thn`;
}

/**
 * Find which admin-defined bracket an age falls into.
 * Inclusive lower bound, exclusive upper bound — except the last
 * bracket which is inclusive on both ends so edge ages (e.g. exactly 3)
 * still land in the final range.
 */
export function findBracket(
  age: number | null | undefined,
  brackets: AgeBracket[] | null | undefined
): AgeBracket | null {
  if (age == null || isNaN(age) || !brackets || brackets.length === 0) return null;
  const sorted = [...brackets].sort((a, b) => a.min - b.min);
  for (let i = 0; i < sorted.length; i++) {
    const b = sorted[i];
    const isLast = i === sorted.length - 1;
    if (age >= b.min && (isLast ? age <= b.max : age < b.max)) return b;
  }
  return null;
}

export function isAgeMatchingCategory(age: number | null, category: AgeCategory): boolean {
  if (category === "mixed") return true;
  if (age == null) return false;
  return getAgeGroup(age) === category;
}

export function isAgeInBracket(age: number, min?: number | null, max?: number | null): boolean {
  if (min == null && max == null) return true;
  if (min != null && age < min) return false;
  if (max != null && age > max) return false;
  return true;
}
