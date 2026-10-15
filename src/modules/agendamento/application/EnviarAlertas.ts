import type { AlertaStore, Clock, Notificador } from "./ports.ts";

export interface ResultadoDoEnvio {
  enviados: number
  falhas: number
}

export interface Logger {
  info(obj: object, msg?: string): void
  error(obj: object, msg?: string): void
}

// RF14 - emitir alertas automáticos de prazos e audiências
export class EnviarAlertas {
  constructor(
    private readonly store: AlertaStore,
    private readonly notificador: Notificador,
    private readonly clock: Clock,
    private readonly logger: Logger,
    private readonly lote = 50,
  ) { }

  async execute(): Promise<ResultadoDoEnvio> {
    const agora = this.clock()
    const pendentes = await this.store.pendentes(agora, this.lote)
    const resultado: ResultadoDoEnvio = { enviados: 0, falhas: 0 }

    for (const alerta of pendentes) {
      // Reserva antes de enviar: se outra instância já reservou, pula
      if (!(await this.store.reservar(alerta.agendamentoId, agora))) continue

      try {
        await this.notificador.notificar(alerta)
        resultado.enviados++
      } catch (err) {
        resultado.falhas++
        this.logger.error({ err, agendamentoId: alerta.agendamentoId }, 'Falha ao enviar alerta de agendamento')
        await this.store.liberar(alerta.agendamentoId, agora)
      }
    }

    if (pendentes.length > 0) this.logger.info({ ...resultado }, 'Alertas de agendamento processados')

    return resultado
  }
}
