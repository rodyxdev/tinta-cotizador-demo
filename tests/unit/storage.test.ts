import "fake-indexeddb/auto";
import Dexie from "dexie";
import { seed } from "../../src/demo/seed";
import { describe, it, expect } from "vitest";
import { DemoDB, execute, initialize, reset } from "../../src/storage/store";
import { agreement, uid } from "../../src/domain/model";
describe("Transacciones IndexedDB", () => {
  it("migra reglas del prototipo sin borrar acuerdos ni cambios locales", async () => {
    const name = `test-${uid()}`,
      old = new Dexie(name);
    old.version(1).stores({ roots: "id", images: "id" });
    const state = seed();
    delete state.products[1].sizeTiers;
    state.customers[0].notes = "Conservar esta nota";
    await old.table("roots").put(state);
    old.close();
    const upgraded = new DemoDB(name);
    await initialize(upgraded);
    const after = (await upgraded.roots.get("main"))!;
    expect(after.products[1].sizeTiers).toHaveLength(3);
    expect(after.customers[0].notes).toBe("Conservar esta nota");
    expect(after.orders).toEqual(state.orders);
    await upgraded.delete();
  });
  it("persiste al reabrir y no reinicializa cambios", async () => {
    const name = `test-${uid()}`,
      db = new DemoDB(name);
    await initialize(db);
    const state = (await db.roots.get("main"))!;
    await execute(
      {
        type: "customer.save",
        customer: {
          id: "local",
          name: "Cliente nuevo",
          email: "nuevo@example.test",
          phone: "",
          notes: "",
        },
      },
      { role: "admin", name: "Admin" },
      undefined,
      db,
    );
    db.close();
    const reopened = new DemoDB(name);
    await initialize(reopened);
    expect((await reopened.roots.get("main"))!.customers.length).toBe(
      state.customers.length + 1,
    );
    await reopened.delete();
  });
  it("revierte todos los cambios si la imagen no se puede guardar", async () => {
    const db = new DemoDB(`test-${uid()}`);
    await initialize(db);
    const before = (await db.roots.get("main"))!,
      o = before.orders[4],
      line = agreement(o).lines[0];
    await expect(
      execute(
        {
          type: "design.add",
          orderId: o.id,
          lineId: line.id,
          image: {
            id: "x",
            name: "x.png",
            type: "image/png",
            bytes: 100,
            width: 100,
            height: 100,
          },
          comment: "",
        },
        { role: "admin", name: "Admin" },
        undefined,
        db,
      ),
    ).rejects.toThrow("imagen");
    expect(await db.roots.get("main")).toEqual(before);
    expect(await db.images.count()).toBe(0);
    await db.delete();
  });
  it("guarda archivo y versión juntos y los elimina al restablecer", async () => {
    const db = new DemoDB(`test-${uid()}`);
    await initialize(db);
    const before = (await db.roots.get("main"))!,
      o = before.orders[4],
      line = agreement(o).lines[0],
      blob = new Blob(["original-demo"], { type: "image/png" });
    await execute(
      {
        type: "design.add",
        orderId: o.id,
        lineId: line.id,
        image: {
          id: "x",
          name: "x.png",
          type: blob.type,
          bytes: blob.size,
          width: 100,
          height: 100,
        },
        comment: "",
      },
      { role: "admin", name: "Admin" },
      blob,
      db,
    );
    expect(await db.images.count()).toBe(1);
    expect((await db.roots.get("main"))!.orders[4].designs.length).toBe(2);
    await reset(db, new Date("2027-01-15T18:00:00Z"));
    expect(await db.images.count()).toBe(0);
    expect((await db.roots.get("main"))!.orders[4].designs.length).toBe(1);
    expect((await db.roots.get("main"))!.orders[0].due).toBe("2027-01-14");
    await db.delete();
  });
  it("serializa conversiones simultáneas evitando pedidos duplicados", async () => {
    const db = new DemoDB(`test-${uid()}`);
    await initialize(db);
    const s = (await db.roots.get("main"))!,
      q = s.quotes[1],
      actor = { role: "admin" as const, name: "Admin" };
    const results = await Promise.all([
      execute({ type: "order.convert", quoteId: q.id }, actor, undefined, db),
      execute({ type: "order.convert", quoteId: q.id }, actor, undefined, db),
    ]);
    expect(results[0]).toBe(results[1]);
    expect((await db.roots.get("main"))!.orders.length).toBe(s.orders.length);
    await db.delete();
  });
});
