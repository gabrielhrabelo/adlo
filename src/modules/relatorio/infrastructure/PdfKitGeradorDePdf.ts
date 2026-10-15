import PDFDocument from "pdfkit";
import { formatarDataHora } from "../application/formatacao.ts";
import type { DocumentoDeRelatorio, GeradorDePdf } from "../application/ports.ts";

const MARGEM = 36
const PADDING = 4
const FONTE_TABELA = 8
const COR_CABECALHO = '#1f3a5f'
const COR_ZEBRA = '#f2f5f9'
const COR_TEXTO_SECUNDARIO = '#555555'

type PDF = InstanceType<typeof PDFDocument>

// RF15 - Gera os relatórios em PDF (A4, tabela com cabeçalho repetido a cada página)
export class PdfKitGeradorDePdf implements GeradorDePdf {
  gerar(documento: DocumentoDeRelatorio): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const pdf = new PDFDocument({
        size: 'A4',
        layout: documento.orientacao === 'paisagem' ? 'landscape' : 'portrait',
        margin: MARGEM,
        bufferPages: true,
        info: { Title: documento.titulo, Author: 'ADLO', Producer: 'ADLO - Advanced Data for Law Offices' },
      })
      const partes: Buffer[] = []

      pdf.on('data', (parte: Buffer) => partes.push(parte))
      pdf.on('end', () => resolve(Buffer.concat(partes)))
      pdf.on('error', reject)

      try {
        desenhar(pdf, documento)
        pdf.end()
      } catch (err) {
        reject(err)
      }
    })
  }
}

function desenhar(pdf: PDF, documento: DocumentoDeRelatorio): void {
  const esquerda = pdf.page.margins.left
  const largura = pdf.page.width - esquerda - pdf.page.margins.right
  const larguras = documento.colunas.map(c => c.largura * largura)
  const limiteInferior = () => pdf.page.height - pdf.page.margins.bottom - 16

  // ---------------------------------------------------------------- cabeçalho do relatório
  pdf.fillColor(COR_CABECALHO).font('Helvetica-Bold').fontSize(16).text('ADLO', esquerda, MARGEM)
  pdf.fillColor('#000000').fontSize(13).text(documento.titulo)
  pdf.fillColor(COR_TEXTO_SECUNDARIO).font('Helvetica').fontSize(8)
    .text(`Gerado em ${formatarDataHora(documento.geradoEm)}`)
  pdf.moveDown(0.6)

  pdf.fillColor('#000000').fontSize(9)
  for (const [rotulo, valor] of documento.filtros) {
    pdf.font('Helvetica-Bold').text(`${rotulo}: `, { continued: true }).font('Helvetica').text(valor)
  }
  pdf.moveDown(0.8)

  // ---------------------------------------------------------------- tabela
  const alturaDaLinha = (celulas: string[], fonte: string) => {
    pdf.font(fonte).fontSize(FONTE_TABELA)
    return Math.max(...celulas.map((texto, i) => pdf.heightOfString(texto || ' ', { width: larguras[i]! - 2 * PADDING }))) + 2 * PADDING
  }

  const desenharLinha = (celulas: string[], y: number, fonte: string, fundo: string | null, corDoTexto: string) => {
    const altura = alturaDaLinha(celulas, fonte)

    if (fundo) pdf.rect(esquerda, y, largura, altura).fill(fundo)

    let x = esquerda
    pdf.font(fonte).fontSize(FONTE_TABELA).fillColor(corDoTexto)
    celulas.forEach((texto, i) => {
      pdf.text(texto, x + PADDING, y + PADDING, {
        width: larguras[i]! - 2 * PADDING,
        align: documento.colunas[i]?.alinhamento ?? 'left',
        lineBreak: true,
      })
      x += larguras[i]!
    })

    return y + altura
  }

  const titulos = documento.colunas.map(c => c.titulo)
  const desenharCabecalhoDaTabela = (y: number) => desenharLinha(titulos, y, 'Helvetica-Bold', COR_CABECALHO, '#ffffff')

  let y = desenharCabecalhoDaTabela(pdf.y)

  if (documento.linhas.length === 0) {
    pdf.font('Helvetica-Oblique').fontSize(9).fillColor(COR_TEXTO_SECUNDARIO)
      .text('Nenhum registro encontrado para os filtros informados.', esquerda, y + 8)
    y = pdf.y
  }

  documento.linhas.forEach((linha, indice) => {
    if (y + alturaDaLinha(linha, 'Helvetica') > limiteInferior()) {
      pdf.addPage()
      y = desenharCabecalhoDaTabela(pdf.page.margins.top)
    }
    y = desenharLinha(linha, y, 'Helvetica', indice % 2 === 1 ? COR_ZEBRA : null, '#000000')
  })

  // ---------------------------------------------------------------- resumo
  if (y + 40 > limiteInferior()) {
    pdf.addPage()
    y = pdf.page.margins.top
  }
  pdf.font('Helvetica-Bold').fontSize(9).fillColor('#000000').text(documento.resumo, esquerda, y + 10)
  if (documento.observacao) {
    pdf.font('Helvetica-Oblique').fontSize(8).fillColor(COR_TEXTO_SECUNDARIO).text(documento.observacao)
  }

  // ---------------------------------------------------------------- rodapé com paginação
  const paginas = pdf.bufferedPageRange()
  for (let i = paginas.start; i < paginas.start + paginas.count; i++) {
    pdf.switchToPage(i)

    // Sem zerar a margem inferior, escrever no rodapé criaria uma página nova
    const margemInferior = pdf.page.margins.bottom
    pdf.page.margins.bottom = 0
    pdf.font('Helvetica').fontSize(7).fillColor(COR_TEXTO_SECUNDARIO).text(
      `${documento.titulo} - Página ${i - paginas.start + 1} de ${paginas.count}`,
      esquerda,
      pdf.page.height - margemInferior + 12,
      { width: largura, align: 'center', lineBreak: false },
    )
    pdf.page.margins.bottom = margemInferior
  }
}
