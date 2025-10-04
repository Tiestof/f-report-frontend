/**
 * ============================================================
 * Archivo: src/hooks/useCatalogos.ts
 * Propósito:
 *  - Hooks con React Query para cargar y cachear catálogos.
 *
 * Notas:
 *  - Con "verbatimModuleSyntax" activo, los tipos deben
 *    importarse usando 'import type'.
 * ============================================================
 */

import { useQuery } from '@tanstack/react-query';
import {
  catalogosService,
} from '../services/catalogos.service';
import type {
  TecnicoItem,
  ClienteItem,
  CentroCostoItem,
  EstadoServicioItem,
} from '../services/catalogos.service';

/** Hook: Técnicos */
export function useTecnicos() {
  return useQuery<TecnicoItem[]>({
    queryKey: ['catalogo-tecnicos'],
    queryFn: catalogosService.getTecnicos,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

/** Hook: Clientes */
export function useClientes() {
  return useQuery<ClienteItem[]>({
    queryKey: ['catalogo-clientes'],
    queryFn: catalogosService.getClientes,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

/** Hook: Centros de costo */
export function useCentrosCosto() {
  return useQuery<CentroCostoItem[]>({
    queryKey: ['catalogo-centros-costo'],
    queryFn: catalogosService.getCentrosCosto,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

/** Hook: Estados de servicio */
export function useEstadosServicio() {
  return useQuery<EstadoServicioItem[]>({
    queryKey: ['catalogo-estados-servicio'],
    queryFn: catalogosService.getEstadosServicio,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}
