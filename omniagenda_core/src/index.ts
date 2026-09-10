/**
 * @omniagenda/core — punto de entrada publico del motor.
 *
 * FASE 0: este archivo esta a proposito casi vacio. La logica real
 * (traslape de intervalos, expansion de RRULE, calculo de disponibilidad,
 * evaluacion de conflicto duro/blando) se escribe en la FASE 1, dirigida
 * por pruebas y SIN ninguna dependencia de infraestructura.
 *
 * Ver:
 *   - PLAN_DESARROLLO.md §6 (arquitectura de 3 capas) y §8 (fases)
 *   - DOCUMENTO_VIVO_ARQUITECTURA.md §6 (por que el nucleo es puro)
 */

/** Version del contrato del nucleo. Sube cuando cambie una firma publica. */
export const OMNIAGENDA_CORE_VERSION = '0.0.0' as const;
