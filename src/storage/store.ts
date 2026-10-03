import Dexie, { type Table, liveQuery } from "dexie";
import { type Actor, type ImageRecord, type State, uid } from "../domain/model";
import { type Command, apply } from "../domain/commands";
import { seed } from "../demo/seed";
export class DemoDB extends Dexie {
  roots!: Table<State, string>;
  images!: Table<ImageRecord, string>;
  constructor(name = "tinta-demo-v1") {
    super(name);
    this.version(1).stores({ roots: "id", images: "id" });
    this.version(2)
      .stores({ roots: "id", images: "id" })
      .upgrade(async (tx) => {
        const state = await tx.table<State, string>("roots").get("main");
        if (!state) return;
        const labels = state.products.find((p) => p.id === "labels");
        if (labels && !labels.sizeTiers)
          labels.sizeTiers = [
            { maxMm2: 2500, factor: 1 },
            { maxMm2: 10000, factor: 2 },
            { maxMm2: Math.max(90000, labels.maxMm * labels.maxMm), factor: 4 },
          ];
        await tx.table("roots").put(state);
      });
  }
}
export const db = new DemoDB();
export async function initialize(database = db) {
  await database.transaction("rw", database.roots, async () => {
    if (!(await database.roots.get("main"))) await database.roots.put(seed());
  });
}
export function observe(next: (s: State) => void, error: (e: unknown) => void) {
  return liveQuery(() => db.roots.get("main")).subscribe({
    next: (s) => {
      if (s) next(s);
    },
    error,
  });
}
export async function execute(
  command: Command,
  actor: Actor,
  blob?: Blob,
  database = db,
) {
  return database.transaction(
    "rw",
    database.roots,
    database.images,
    async () => {
      const original = await database.roots.get("main");
      if (!original)
        throw new Error("La demo no está disponible. Recarga la página.");
      const state = structuredClone(original);
      const result = apply(state, command, actor);
      if (command.type === "design.add") {
        if (
          !blob ||
          blob.size !== command.image.bytes ||
          blob.type !== command.image.type
        )
          throw new Error(
            "La imagen no se pudo guardar. Selecciónala de nuevo.",
          );
        await database.images.put({ ...command.image, blob });
      }
      await database.roots.put(state);
      return result;
    },
  );
}
export async function reset(database = db, now = new Date()) {
  await database.transaction(
    "rw",
    database.roots,
    database.images,
    async () => {
      await database.images.clear();
      await database.roots.put(seed(now));
    },
  );
}
export async function inspectImage(file: File): Promise<ImageRecord> {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 5 * 1024 * 1024 ||
    !file.size
  )
    throw new Error("Usa PNG, JPEG o WebP de hasta 5 MiB.");
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const valid =
    file.type === "image/png"
      ? bytes[0] === 137 &&
        bytes[1] === 80 &&
        bytes[2] === 78 &&
        bytes[3] === 71
      : file.type === "image/jpeg"
        ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
          String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (!valid)
    throw new Error(
      "El contenido no corresponde al formato de imagen indicado.",
    );
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(
      "No se pudo leer la imagen. Usa un archivo PNG, JPEG o WebP válido.",
    );
  }
  const width = bitmap.width,
    height = bitmap.height;
  bitmap.close();
  if (width > 4096 || height > 4096)
    throw new Error("La imagen debe medir como máximo 4096 píxeles por lado.");
  return {
    id: uid(),
    name: file.name,
    type: file.type,
    bytes: file.size,
    width,
    height,
    blob: file,
  };
}
export const storageMessage = (e: unknown) => {
  const text = e instanceof Error ? e.message : String(e);
  return /quota/i.test(text)
    ? "No hay espacio suficiente en el navegador. El cambio no se guardó; tus datos anteriores se conservaron."
    : /indexeddb|securityerror|invalidstate/i.test(text)
      ? "El navegador no permite guardar la demo. Habilita el almacenamiento del sitio y vuelve a intentar."
      : text;
};
