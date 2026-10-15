import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Email } from "../../../shared/domain/Email.ts";
import { InvalidEmailError, WeakPasswordError } from "./errors.ts";
import { Password } from "./Password.ts";
import { User } from "./User.ts";

describe('Email', () => {
  it('normaliza espaços e caixa', () => {
    assert.equal(Email.create('  Ana@Escritorio.COM ').value, 'ana@escritorio.com')
  })

  it('rejeita email inválido', () => {
    assert.throws(() => Email.create('ana@'), InvalidEmailError)
  })
})

describe('Password', () => {
  it('exige 8+ caracteres com letras e números', () => {
    assert.throws(() => Password.create('abcdefgh'), WeakPasswordError)
    assert.throws(() => Password.create('1234567'), WeakPasswordError)
    assert.equal(Password.create('senha123').value, 'senha123')
  })
})

describe('User', () => {
  const novo = () => User.create({ nome: ' Ana ', email: Email.create('ana@x.com'), senhaHash: 'h' })

  it('cria ativo, como ADVOGADO por padrão e emite UserRegistered', () => {
    const user = novo()

    assert.equal(user.nome, 'Ana')
    assert.equal(user.papel, 'ADVOGADO')
    assert.equal(user.ativo, true)
    assert.equal(user.version, 0)
    assert.deepEqual(user.pullEvents().map(e => e.name), ['user.user-registered'])
  })

  it('atualiza dados e altera senha emitindo eventos', () => {
    const user = novo()
    user.pullEvents()

    user.atualizar({ nome: 'Ana Maria', email: Email.create('maria@x.com') })
    user.alterarSenha('novo-hash')

    assert.equal(user.nome, 'Ana Maria')
    assert.equal(user.email, 'maria@x.com')
    assert.equal(user.senhaHash, 'novo-hash')
    assert.deepEqual(user.pullEvents().map(e => e.name), ['user.user-updated', 'user.password-changed'])
  })

  it('rejeita nome curto demais', () => {
    assert.throws(() => User.create({ nome: ' a ', email: Email.create('a@x.com'), senhaHash: 'h' }), { code: 'INVALID_NAME' })
  })
})
