// Bit writer matching the class-18 wire (BE, MSB-first, one continuous
// bitstream, not byte-aligned between fields), so tests can build synthetic
// payloads without depending on the rsat codec.
export class BitBuilder {
  private bits: number[] = [];

  write(value: number | bigint, width: number): this {
    const v = typeof value === "bigint" ? value : BigInt(value >>> 0);
    for (let i = width - 1; i >= 0; i--) {
      this.bits.push(Number((v >> BigInt(i)) & 1n));
    }
    return this;
  }

  get bitLength(): number {
    return this.bits.length;
  }

  // Appends another builder's bits at the current (possibly non-byte-aligned)
  // position.
  append(other: BitBuilder): this {
    this.bits.push(...other.bits);
    return this;
  }

  toBuffer(): Buffer {
    const byteLength = Math.ceil(this.bits.length / 8);
    const out = Buffer.alloc(byteLength);
    for (let i = 0; i < this.bits.length; i++) {
      if (this.bits[i]) {
        out[i >> 3] |= 0x80 >> (i % 8);
      }
    }
    return out;
  }
}
