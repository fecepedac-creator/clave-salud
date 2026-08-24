import React, { useEffect, useMemo, useState } from "react";
import { Calendar, LayoutDashboard, Package, Plus, Save, Settings, Trash2, X } from "lucide-react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  isAgendaResource,
  mergeAgendaResources,
  type AgendaResource,
  type AgendaResourceType,
} from "../domain/agendaResource";
import type { Doctor } from "../types";
import { generateId } from "../utils";
import { useToast } from "./Toast";

interface ServiceAgendasManagerProps {
  centerId: string;
  doctors: Doctor[];
}

const emptyResource = (centerId: string): AgendaResource => ({
  id: "",
  centerId,
  entityType: "agenda_resource",
  resourceType: "service",
  displayName: "",
  description: "",
  agendaConfig: { slotDuration: 15, startTime: "08:00", endTime: "18:00" },
  visibleInBooking: true,
  active: true,
});

const RESOURCE_LABELS: Record<AgendaResourceType, string> = {
  service: "Servicio",
  room: "Sala",
  equipment: "Equipo",
};

const ServiceAgendasManager: React.FC<ServiceAgendasManagerProps> = ({ centerId, doctors }) => {
  const { showToast } = useToast();
  const [storedResources, setStoredResources] = useState<AgendaResource[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [currentResource, setCurrentResource] = useState<AgendaResource>(() =>
    emptyResource(centerId)
  );

  useEffect(() => {
    setCurrentResource(emptyResource(centerId));
    const resourcesRef = collection(db, "centers", centerId, "agendaResources");
    return onSnapshot(
      resourcesRef,
      (snapshot) => {
        const resources = snapshot.docs
          .map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() }))
          .filter(isAgendaResource);
        setStoredResources(resources);
      },
      () => showToast("No fue posible cargar los recursos de agenda.", "error")
    );
  }, [centerId, showToast]);

  const resources = useMemo(
    () => mergeAgendaResources(storedResources, doctors),
    [storedResources, doctors]
  );

  const startNew = () => {
    setCurrentResource(emptyResource(centerId));
    setIsEditing(true);
  };

  const handleSave = async () => {
    const displayName = currentResource.displayName.trim();
    const description = currentResource.description.trim();
    if (!displayName) {
      showToast("El nombre del recurso es requerido.", "warning");
      return;
    }
    if (
      !Number.isInteger(currentResource.agendaConfig.slotDuration) ||
      currentResource.agendaConfig.slotDuration < 5 ||
      currentResource.agendaConfig.slotDuration > 480
    ) {
      showToast("La duración debe estar entre 5 y 480 minutos.", "warning");
      return;
    }

    const id = currentResource.id || `resource_${generateId()}`;
    const alreadyStored = storedResources.some((resource) => resource.id === id);
    const resource: AgendaResource = {
      ...currentResource,
      id,
      centerId,
      entityType: "agenda_resource",
      displayName,
      description,
      active: true,
    };

    try {
      await setDoc(
        doc(db, "centers", centerId, "agendaResources", id),
        {
          ...resource,
          ...(!alreadyStored ? { createdAt: serverTimestamp() } : {}),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      showToast(
        currentResource.legacySourceId
          ? "Recurso convertido sin modificar el perfil legacy."
          : "Recurso de agenda guardado.",
        "success"
      );
      setIsEditing(false);
      setCurrentResource(emptyResource(centerId));
    } catch {
      showToast("No fue posible guardar el recurso.", "error");
    }
  };

  const handleDelete = async (resource: AgendaResource) => {
    if (!storedResources.some((stored) => stored.id === resource.id)) {
      showToast("Convierte primero este perfil legacy en un recurso de agenda.", "warning");
      return;
    }
    if (!window.confirm(`¿Eliminar el recurso de agenda “${resource.displayName}”?`)) return;

    try {
      await deleteDoc(doc(db, "centers", centerId, "agendaResources", resource.id));
      showToast("Recurso de agenda eliminado.", "success");
    } catch {
      showToast("No fue posible eliminar el recurso.", "error");
    }
  };

  return (
    <section className="mt-8 rounded-3xl border border-slate-700 bg-slate-800 p-5 sm:p-8">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h3 className="flex items-center gap-3 text-2xl font-bold text-white">
            <LayoutDashboard className="h-8 w-8 text-amber-400" /> Recursos de agenda
          </h3>
          <p className="mt-2 text-slate-400">
            Administra servicios, salas y equipos sin crear cuentas de usuario ni acceso clínico.
          </p>
        </div>
        {!isEditing && (
          <button
            type="button"
            onClick={startNew}
            className="flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 font-bold text-white shadow-lg shadow-amber-500/20 transition hover:bg-amber-700"
          >
            <Plus className="h-5 w-5" /> Crear recurso
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {resources.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/30 p-8 text-center text-slate-500">
              No hay recursos de agenda creados.
            </div>
          ) : (
            resources.map((resource) => {
              const isLegacyOnly =
                Boolean(resource.legacySourceId) &&
                !storedResources.some((stored) => stored.id === resource.id);
              return (
                <article
                  key={resource.id}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-700 bg-slate-900/50 p-5 transition hover:border-amber-500 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
                      {resource.resourceType === "service" ? (
                        <Calendar className="h-6 w-6 text-amber-400" />
                      ) : (
                        <Package className="h-6 w-6 text-amber-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="truncate text-lg font-bold text-white">
                        {resource.displayName}
                      </h4>
                      <p className="text-xs text-slate-400">
                        {RESOURCE_LABELS[resource.resourceType]} ·{" "}
                        {resource.agendaConfig.slotDuration} min por bloque
                      </p>
                      {isLegacyOnly && (
                        <p className="mt-1 text-xs font-semibold text-amber-400">
                          Perfil legacy: guardar para convertirlo de forma segura
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      aria-label={`Editar ${resource.displayName}`}
                      onClick={() => {
                        setCurrentResource(resource);
                        setIsEditing(true);
                      }}
                      className="rounded-lg bg-slate-800 p-2 text-white transition hover:bg-amber-600"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Eliminar ${resource.displayName}`}
                      onClick={() => void handleDelete(resource)}
                      className="rounded-lg bg-slate-800 p-2 text-white transition hover:bg-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>

        {isEditing && (
          <div className="h-fit rounded-2xl border border-amber-500/30 bg-slate-900/70 p-6">
            <div className="mb-6 flex items-center justify-between">
              <h4 className="flex items-center gap-2 text-lg font-bold text-white">
                {currentResource.id ? (
                  <Settings className="h-5 w-5" />
                ) : (
                  <Plus className="h-5 w-5" />
                )}
                {currentResource.id ? "Editar recurso" : "Nuevo recurso"}
              </h4>
              <button type="button" onClick={() => setIsEditing(false)} aria-label="Cerrar editor">
                <X className="h-5 w-5 text-slate-400 hover:text-white" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block text-xs font-bold uppercase text-slate-400">
                Tipo
                <select
                  value={currentResource.resourceType}
                  onChange={(event) =>
                    setCurrentResource({
                      ...currentResource,
                      resourceType: event.target.value as AgendaResourceType,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-white"
                >
                  <option value="service">Servicio</option>
                  <option value="room">Sala</option>
                  <option value="equipment">Equipo</option>
                </select>
              </label>

              <label className="block text-xs font-bold uppercase text-slate-400">
                Nombre
                <input
                  value={currentResource.displayName}
                  onChange={(event) =>
                    setCurrentResource({ ...currentResource, displayName: event.target.value })
                  }
                  placeholder="Ej: Ecógrafo 1"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 font-normal normal-case text-white"
                />
              </label>

              <label className="block text-xs font-bold uppercase text-slate-400">
                Descripción
                <input
                  value={currentResource.description}
                  onChange={(event) =>
                    setCurrentResource({ ...currentResource, description: event.target.value })
                  }
                  placeholder="Uso operativo del recurso"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 font-normal normal-case text-white"
                />
              </label>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <label className="text-xs font-bold uppercase text-slate-400">
                  Duración (min)
                  <input
                    type="number"
                    min={5}
                    max={480}
                    value={currentResource.agendaConfig.slotDuration}
                    onChange={(event) =>
                      setCurrentResource({
                        ...currentResource,
                        agendaConfig: {
                          ...currentResource.agendaConfig,
                          slotDuration: Number(event.target.value),
                        },
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-white"
                  />
                </label>
                <label className="flex items-end gap-2 pb-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={currentResource.visibleInBooking}
                    onChange={(event) =>
                      setCurrentResource({
                        ...currentResource,
                        visibleInBooking: event.target.checked,
                      })
                    }
                    className="h-4 w-4 accent-amber-500"
                  />
                  Visible en reservas
                </label>
                <label className="text-xs font-bold uppercase text-slate-400">
                  Inicio
                  <input
                    type="time"
                    value={currentResource.agendaConfig.startTime}
                    onChange={(event) =>
                      setCurrentResource({
                        ...currentResource,
                        agendaConfig: {
                          ...currentResource.agendaConfig,
                          startTime: event.target.value,
                        },
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-white"
                  />
                </label>
                <label className="text-xs font-bold uppercase text-slate-400">
                  Término
                  <input
                    type="time"
                    value={currentResource.agendaConfig.endTime}
                    onChange={(event) =>
                      setCurrentResource({
                        ...currentResource,
                        agendaConfig: {
                          ...currentResource.agendaConfig,
                          endTime: event.target.value,
                        },
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-white"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={() => void handleSave()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 py-3 font-bold text-white transition hover:bg-amber-700"
              >
                <Save className="h-4 w-4" /> Guardar recurso
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default ServiceAgendasManager;
