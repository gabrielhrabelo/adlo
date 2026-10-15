import type { EnviarAlertas, Logger } from "../application/EnviarAlertas.ts";

// Executa periodicamente a varredura de alertas (RF14), sem sobrepor execuções
export class AgendadorDeAlertas {
  private timer: NodeJS.Timeout | null = null
  private execucao: Promise<unknown> | null = null

  constructor(
    private readonly enviarAlertas: EnviarAlertas,
    private readonly logger: Logger,
    private readonly intervaloMs = 60_000,
  ) { }

  iniciar(): void {
    if (this.timer) return

    this.timer = setInterval(() => this.executar(), this.intervaloMs)
    this.timer.unref()
    this.executar()
  }

  async parar(): Promise<void> {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    await this.execucao
  }

  private executar(): void {
    if (this.execucao) return

    this.execucao = this.enviarAlertas.execute()
      .catch(err => this.logger.error({ err }, 'Falha na varredura de alertas de agendamento'))
      .finally(() => { this.execucao = null })
  }
}
