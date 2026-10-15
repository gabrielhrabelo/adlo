import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import type { PasswordHasher } from "../application/ports.ts";

const KEY_LENGTH = 64
const PARAMS = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }

// Formato: scrypt$N$r$p$salt$hash (salt e hash em base64)
export class ScryptPasswordHasher implements PasswordHasher {
  async hash(plain: string): Promise<string> {
    const salt = randomBytes(16)
    const key = await derive(plain, salt, PARAMS)

    return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64'), key.toString('base64')].join('$')
  }

  async compare(plain: string, hash: string): Promise<boolean> {
    const [algo, N, r, p, salt, key] = hash.split('$')

    if (algo !== 'scrypt' || !N || !r || !p || !salt || !key) return false

    const expected = Buffer.from(key, 'base64')
    const actual = await derive(plain, Buffer.from(salt, 'base64'), {
      N: Number(N), r: Number(r), p: Number(p), maxmem: PARAMS.maxmem
    })

    return actual.length === expected.length && timingSafeEqual(actual, expected)
  }
}

function derive(plain: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(plain.normalize('NFKC'), salt, KEY_LENGTH, options, (err, key) => err ? reject(err) : resolve(key))
  })
}
