import { formatarCpfCnpj, formatarData, formatarTelefone, hojeNoEscritorio } from "./formatacao.ts";
import { comObservacao, LIMITE_DE_LINHAS, nomeDeArquivo, resumoDeTotal } from "./limites.ts";
import type { ArquivoDeRelatorio, FiltrosClientes, GeradorDePdf, RelatorioQueries } from "./ports.ts";

export class GerarRelatorioDeClientes {
  constructor(
    private readonly queries: RelatorioQueries,
    private readonly pdf: GeradorDePdf,
    private readonly agora: () => Date = () => new Date()
  ) { }

  async execute(filtros: FiltrosClientes): Promise<ArquivoDeRelatorio> {
    const agora = this.agora()
    const linhas = await this.queries.listarClientes(filtros, LIMITE_DE_LINHAS + 1)
    const responsavel = filtros.usuarioId ? await this.queries.nomeDoUsuario(filtros.usuarioId) : null

    const conteudo = await this.pdf.gerar({
      titulo: 'Relatório de Clientes',
      orientacao: 'paisagem',
      filtros: [
        ['Situação', filtros.ativo === undefined ? 'Todos' : filtros.ativo ? 'Ativos' : 'Inativos'],
        ['Área', filtros.area ?? 'Todas'],
        ['Responsável', filtros.usuarioId ? (responsavel ?? 'Usuário não encontrado') : 'Todos'],
      ],
      colunas: [
        { titulo: 'Nome', largura: 0.22 },
        { titulo: 'CPF/CNPJ', largura: 0.13 },
        { titulo: 'Telefone', largura: 0.11 },
        { titulo: 'Email', largura: 0.17 },
        { titulo: 'Cidade/UF', largura: 0.12 },
        { titulo: 'Responsável', largura: 0.11 },
        { titulo: 'Processos', largura: 0.06, alinhamento: 'right' },
        { titulo: 'Cadastro', largura: 0.08, alinhamento: 'center' },
      ],
      linhas: linhas.slice(0, LIMITE_DE_LINHAS).map(c => [
        c.ativo ? c.nome : `${c.nome} (inativo)`,
        formatarCpfCnpj(c.cpfCnpj),
        formatarTelefone(c.telefone),
        c.email ?? '-',
        c.cidade ? `${c.cidade}/${c.uf}` : '-',
        c.responsavel,
        String(c.totalProcessos),
        formatarData(c.criadoEm),
      ]),
      resumo: resumoDeTotal(linhas.length),
      ...comObservacao(linhas.length),
      geradoEm: agora,
    })

    return { nomeArquivo: nomeDeArquivo('clientes', hojeNoEscritorio(agora)), conteudo }
  }
}
