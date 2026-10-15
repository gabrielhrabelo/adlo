import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Email } from "../../../shared/domain/Email.ts";
import { Cliente } from "./Cliente.ts";
import { criarEndereco, criarTelefone } from "./Contato.ts";
import { CpfCnpj } from "./CpfCnpj.ts";
import { ClienteInvalidoError, CpfCnpjInvalidoError } from "./errors.ts";

describe('CpfCnpj', () => {
  it('aceita CPF e CNPJ válidos, guardando só dígitos', () => {
    assert.equal(CpfCnpj.create('529.982.247-25').value, '52998224725')
    assert.equal(CpfCnpj.create('529.982.247-25').tipo, 'CPF')
    assert.equal(CpfCnpj.create('11.222.333/0001-81').value, '11222333000181')
    assert.equal(CpfCnpj.create('11.222.333/0001-81').tipo, 'CNPJ')
  })

  it('rejeita dígito verificador errado, sequências repetidas e tamanhos inválidos', () => {
    for (const invalido of ['529.982.247-26', '111.111.111-11', '11.222.333/0001-82', '00000000000000', '123']) {
      assert.throws(() => CpfCnpj.create(invalido), CpfCnpjInvalidoError, invalido)
    }
  })
})

describe('Contato', () => {
  it('normaliza telefone e endereço', () => {
    assert.deepEqual(criarTelefone({ numero: '(62) 99999-1234' }), { tipo: 'CELULAR', numero: '62999991234' })
    assert.deepEqual(
      criarEndereco({ rua: ' Rua A ', cep: '74000-000', cidade: 'Goiânia', uf: 'go', complemento: '  ' }),
      { tipo: 'RESIDENCIAL', rua: 'Rua A', numero: null, complemento: null, bairro: null, cep: '74000000', cidade: 'Goiânia', uf: 'GO' }
    )
  })

  it('rejeita telefone, CEP e UF inválidos', () => {
    assert.throws(() => criarTelefone({ numero: '9999' }), ClienteInvalidoError)
    assert.throws(() => criarEndereco({ rua: 'R', cep: '123', cidade: 'X', uf: 'GO' }), ClienteInvalidoError)
    assert.throws(() => criarEndereco({ rua: 'R', cep: '74000000', cidade: 'X', uf: 'XX' }), ClienteInvalidoError)
  })
})

describe('Cliente', () => {
  const novo = () => Cliente.create({
    usuarioId: 'u1',
    nome: ' Maria ',
    cpfCnpj: CpfCnpj.create('52998224725'),
    email: Email.create('Maria@X.com'),
  })

  it('cria ativo e emite ClienteCadastrado', () => {
    const cliente = novo()

    assert.equal(cliente.nome, 'Maria')
    assert.equal(cliente.email, 'maria@x.com')
    assert.equal(cliente.ativo, true)
    assert.deepEqual(cliente.pullEvents().map(e => e.name), ['cliente.cadastrado'])
  })

  it('atualiza só os campos informados e permite limpar opcionais', () => {
    const cliente = novo()
    cliente.atualizar({ email: null, observacoes: '  INSS  ' })

    assert.equal(cliente.email, null)
    assert.equal(cliente.observacoes, 'INSS')
    assert.equal(cliente.cpfCnpj, '52998224725')
  })

  it('inativa e reativa sem eventos repetidos', () => {
    const cliente = novo()
    cliente.pullEvents()

    cliente.inativar()
    cliente.inativar()
    cliente.ativar()

    assert.equal(cliente.ativo, true)
    assert.deepEqual(cliente.pullEvents().map(e => e.name), ['cliente.inativado', 'cliente.reativado'])
  })

  it('rejeita nascimento no futuro', () => {
    assert.throws(() => novo().atualizar({ dataNascimento: new Date(Date.now() + 86_400_000) }), ClienteInvalidoError)
  })
})
