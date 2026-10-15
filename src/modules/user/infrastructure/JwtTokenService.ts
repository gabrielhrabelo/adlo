import { createSigner, createVerifier } from "fast-jwt";
import type { TokenService } from "../application/ports.ts";
import { InvalidTokenError } from "../domain/errors.ts";

export class JwtTokenService implements TokenService {
  private readonly signer
  private readonly verifier

  constructor(secret: string, expiresInMs = 8 * 60 * 60 * 1000) {
    if (secret.length < 32) {
      throw new Error('JWT_SECRET precisa ter pelo menos 32 caracteres')
    }
    this.signer = createSigner({ key: secret, algorithm: 'HS256', expiresIn: expiresInMs })
    this.verifier = createVerifier({ key: secret, algorithms: ['HS256'] })
  }

  sign(userId: string): string {
    return this.signer({ sub: userId })
  }

  verify(token: string): { userId: string } {
    try {
      const payload = this.verifier(token)

      if (typeof payload.sub !== 'string') throw new InvalidTokenError()

      return { userId: payload.sub }
    } catch {
      throw new InvalidTokenError()
    }
  }
}
