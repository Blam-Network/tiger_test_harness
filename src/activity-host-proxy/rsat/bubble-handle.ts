export function packBubbleStateHandle(bubble: number, state = 0): number {
  return ((bubble & 0b0011_1111) << 3) | (state & 0b0000_0111);
}

export function unpackBubbleStateHandle(handle: number): {
  bubble: number;
  state: number;
} {
  return {
    bubble: (handle >>> 3) & 0b0011_1111,
    state: handle & 0b0000_0111,
  };
}
