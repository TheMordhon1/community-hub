export const REACTION_EMOJIS: Record<string, string> = {
  heart: "❤️",
  thumbs_up: "👍",
  laugh: "😂",
  wow: "😮",
  sad: "😢",
  fire: "🔥",
};

export const EXTENDED_REACTION_EMOJIS: Record<string, string> = {
  ...REACTION_EMOJIS,
  clap: "👏",
  party: "🎉",
  pray: "🙏",
  muscle: "💪",
  sparkles: "✨",
  rocket: "🚀",
  eyes: "👀",
  check: "✅",
  smile: "😊",
  thinking: "🤔",
  cool: "😎",
  shrug: "🤷",
  raised_hands: "🙌",
  party_popper: "🥳",
  star: "⭐",
  hundred: "💯",
  dua: "🤲🏻",
  fist: "✊🏻",
  write: "✍🏻",
};

export const ALL_REACTIONS: Record<string, string> = {
  ...EXTENDED_REACTION_EMOJIS,
};
