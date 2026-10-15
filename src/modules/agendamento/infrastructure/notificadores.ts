import { createTransport, type Transporter } from "nodemailer";
import type { Logger } from "../application/EnviarAlertas.ts";
import type { AlertaDeAgendamento, Notificador } from "../application/ports.ts";

const ROTULOS_TIPO: Record<AlertaDeAgendamento['tipo'], string> = {
  PRAZO: 'Prazo',
  AUDIENCIA: 'Audiência',
  COMPROMISSO: 'Compromisso',
}

export interface ConfiguracaoSmtp {
  host: string
  port: number
  secure: boolean
  user?: string
  pass?: string
  from: string
}

// RF14 - alertas por e-mail ao responsável pelo agendamento
export class EmailNotificador implements Notificador {
  private readonly transporter: Transporter

  constructor(private readonly config: ConfiguracaoSmtp) {
    this.transporter = createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      ...(config.user && { auth: { user: config.user, pass: config.pass ?? '' } }),
    })
  }

  async notificar(alerta: AlertaDeAgendamento): Promise<void> {
    await this.transporter.sendMail({
      from: this.config.from,
      to: alerta.destinatario.email,
      subject: assunto(alerta),
      text: corpo(alerta),
    })
  }
}

// Usado quando o SMTP não está configurado: os alertas continuam visíveis
// na plataforma (GET /agendamentos/alertas) e ficam registrados no log
export class LogNotificador implements Notificador {
  constructor(private readonly logger: Logger) {

  }

  async notificar(alerta: AlertaDeAgendamento): Promise<void> {
    this.logger.info({
      agendamentoId: alerta.agendamentoId,
      destinatario: alerta.destinatario.id,
      dataHora: alerta.dataHora.toISOString(),
    }, assunto(alerta))
  }
}

export function assunto(alerta: AlertaDeAgendamento): string {
  return `[ADLO] ${ROTULOS_TIPO[alerta.tipo]}: ${alerta.titulo} em ${formatarDataHora(alerta.dataHora)}`
}

export function corpo(alerta: AlertaDeAgendamento): string {
  const linhas = [
    `Olá, ${alerta.destinatario.nome}.`,
    '',
    `Este é um lembrete automático do ADLO sobre o seguinte ${ROTULOS_TIPO[alerta.tipo].toLowerCase()}:`,
    '',
    `Título: ${alerta.titulo}`,
    `Data/hora: ${formatarDataHora(alerta.dataHora)}`,
    `Cliente: ${alerta.cliente.nome}`,
  ]

  if (alerta.processo) {
    linhas.push(`Processo: ${alerta.processo.numeroProcesso ?? 'sem número'} - ${alerta.processo.titulo}`)
  }
  if (alerta.tipo !== 'PRAZO') linhas.push(`Duração prevista: ${alerta.duracaoMinutos} minutos`)

  linhas.push('', 'Acesse o sistema para confirmar, concluir ou remarcar.')

  return linhas.join('\n')
}

function formatarDataHora(date: Date): string {
  return date.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
