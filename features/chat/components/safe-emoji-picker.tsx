"use client";
import EmojiPickerLib, { Theme, EmojiClickData } from "emoji-picker-react";

export default function SafeEmojiPicker({ onEmojiClick }: { onEmojiClick: (data: EmojiClickData) => void }) {
  return (
    <EmojiPickerLib
      theme={Theme.DARK}
      width="100%"
      height={350}
      onEmojiClick={onEmojiClick}
      lazyLoadEmojis
    />
  );
}
