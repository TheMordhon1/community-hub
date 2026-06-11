// Age group helpers for competition registrations.
// Cutoffs: Kids < 13, Teenager 13-17, Adult 18+

export type AgeGroup = "adult" | "teenager" | "kids";
export type AgeCategory = AgeGroup | "mixed";

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

export function getAgeGroup(age: number | null | undefined): AgeGroup | null {
  if (age == null || isNaN(age) || age < 0) return null;
  if (age < 13) return "kids";
  if (age < 18) return "teenager";
  return "adult";
}

/**
 * Auto-bucket a kid's age into a fair bracket.
 * Younger kids use finer (0.5y) brackets; older kids use wider ones.
 * Deterministic — pure function of age.
 */
export function getKidsBracket(age: number): string {
  if (age < 0) return "Tidak valid";
  if (age < 4) {
    // 0.5y bins for ages 0..4
    const lo = Math.floor(age * 2) / 2;
    const hi = lo + 0.5;
    return `${formatAge(lo)} - ${formatAge(hi)} thn`;
  }
  if (age < 7) {
    // 1y bins for ages 4..7
    const lo = Math.floor(age);
    return `${lo} - ${lo + 1} thn`;
  }
  // 2y bins for ages 7..13
  const lo = Math.floor((age - 7) / 2) * 2 + 7;
  return `${lo} - ${lo + 2} thn`;
}

function formatAge(n: number): string {
  return n % 1 === 0 ? `${n}` : n.toFixed(1);
}

export function isAgeMatchingCategory(age: number | null, category: AgeCategory): boolean {
  if (category === "mixed") return true;
  if (age == null) return false;
  return getAgeGroup(age) === category;
}
