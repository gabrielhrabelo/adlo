export interface PasswordHasher {
  hash(plain: string): Promise<string>
  compare(plain: string, hash: string): Promise<boolean>
}

export interface TokenService {
  sign(userId: string): string
  verify(token: string): {userId: string}
}
