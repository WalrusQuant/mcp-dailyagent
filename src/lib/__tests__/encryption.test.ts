import { encrypt, decrypt, maskSecret } from "@/lib/encryption";

describe("encrypt / decrypt", () => {
  it("round-trips plaintext", () => {
    const plaintext = "super-secret-api-key-12345";
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("produces different ciphertexts for same input (random IV)", () => {
    const plaintext = "test-value";
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
  });

  it("round-trips empty string", () => {
    const encrypted = encrypt("");
    expect(decrypt(encrypted)).toBe("");
  });

  it("round-trips unicode", () => {
    const plaintext = "Hello World";
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("throws on tampered ciphertext", () => {
    const encrypted = encrypt("test");
    const parts = encrypted.split(":");
    // Tamper with the ciphertext
    parts[2] = Buffer.from("tampered").toString("base64");
    expect(() => decrypt(parts.join(":"))).toThrow();
  });

  it("throws on malformed input (wrong number of parts)", () => {
    expect(() => decrypt("only-one-part")).toThrow("Invalid encrypted value format");
  });

  it("throws on malformed input (too many parts)", () => {
    expect(() => decrypt("a:b:c:d")).toThrow("Invalid encrypted value format");
  });
});

describe("encrypt/decrypt with missing key", () => {
  const originalKey = process.env.ENCRYPTION_KEY;

  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalKey;
  });

  it("throws when ENCRYPTION_KEY is missing", () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt("test")).toThrow("ENCRYPTION_KEY environment variable is required");
  });

  it("throws when ENCRYPTION_KEY is wrong length", () => {
    process.env.ENCRYPTION_KEY = "short";
    expect(() => encrypt("test")).toThrow("ENCRYPTION_KEY must be a 64-character hex string");
  });
});

describe("maskSecret", () => {
  it("masks short string (<=4 chars)", () => {
    expect(maskSecret("abc")).toBe("••••");
    expect(maskSecret("abcd")).toBe("••••");
  });

  it("shows last 4 chars for longer strings", () => {
    expect(maskSecret("sk-1234567890")).toBe("••••7890");
  });

  it("masks 5-char string showing last 4", () => {
    expect(maskSecret("12345")).toBe("••••2345");
  });
});
