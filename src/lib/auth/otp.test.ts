import { test } from "node:test";
import assert from "node:assert/strict";
import { generateOtpCode, hashOtpCode, verifyOtpCode } from "./otp";

test("generateOtpCode : 6 chiffres, zéros de tête possibles", () => {
  for (let i = 0; i < 1000; i++) {
    const code = generateOtpCode();
    assert.match(code, /^\d{6}$/);
  }
});

test("hachage OTP : aller-retour valide", () => {
  const code = "042871";
  const hash = hashOtpCode(code);
  assert.ok(hash.includes(":"), "le haché contient sel:hash");
  assert.equal(verifyOtpCode(code, hash), true);
});

test("hachage OTP : code incorrect rejeté", () => {
  const hash = hashOtpCode("123456");
  assert.equal(verifyOtpCode("123457", hash), false);
});

test("hachage OTP : haché malformé rejeté sans lever d'exception", () => {
  assert.equal(verifyOtpCode("123456", "n-importe-quoi"), false);
  assert.equal(verifyOtpCode("123456", ""), false);
});

test("hachage OTP : deux hachés du même code diffèrent (sel aléatoire)", () => {
  assert.notEqual(hashOtpCode("111111"), hashOtpCode("111111"));
});
