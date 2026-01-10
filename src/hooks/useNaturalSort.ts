export function useNaturalSort() {
  const naturalSort = (a: string, b: string): number => {
    const aParts = a.match(/[^\d]+|\d+/g) || []
    const bParts = b.match(/[^\d]+|\d+/g) || []

    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aPart = aParts[i] || ""
      const bPart = bParts[i] || ""

      // Compare numeric parts as numbers
      if (/^\d+$/.test(aPart) && /^\d+$/.test(bPart)) {
        const diff = Number.parseInt(aPart, 10) - Number.parseInt(bPart, 10)
        if (diff !== 0) return diff
      } else {
        // Compare string parts lexicographically
        const comparison = aPart.localeCompare(bPart)
        if (comparison !== 0) return comparison
      }
    }

    return 0
  }

  return { naturalSort }
}