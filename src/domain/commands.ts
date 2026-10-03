import {
  type Actor,
  type Customer,
  type ImageRecord,
  type Product,
  type QuoteInput,
  type Settings,
  type Stage,
  type State,
  addDays,
  agreement,
  balance,
  blockers,
  currentVersion,
  draftVersion,
  effectiveStatus,
  latestDesign,
  paid,
  specKey,
  today,
  uid,
} from "./model";
import { assert, calculateQuote, integer, validateRules } from "./pricing";
export type Command =
  | { type: "customer.save"; customer: Customer }
  | { type: "product.save"; product: Product }
  | { type: "settings.save"; settings: Settings }
  | {
      type: "quote.save";
      quoteId?: string;
      draftId?: string;
      expectedUpdatedAt?: string;
      input: QuoteInput;
    }
  | { type: "quote.revise"; quoteId: string }
  | { type: "quote.issue"; quoteId: string; versionId: string }
  | {
      type: "quote.respond";
      quoteId: string;
      versionId: string;
      accept: boolean;
      comment: string;
    }
  | { type: "quote.cancel"; quoteId: string; reason: string }
  | { type: "order.convert"; quoteId: string }
  | {
      type: "order.update";
      orderId: string;
      due: string;
      responsible: string;
      notes: string;
    }
  | { type: "order.stage"; orderId: string; stage: Stage; reason?: string }
  | { type: "order.change"; orderId: string }
  | { type: "order.keepAgreement"; orderId: string; reason: string }
  | { type: "order.note"; orderId: string; text: string }
  | {
      type: "design.add";
      orderId: string;
      lineId: string;
      image: Omit<ImageRecord, "blob">;
      comment: string;
    }
  | {
      type: "design.respond";
      orderId: string;
      lineId: string;
      designId: string;
      approve: boolean;
      comment: string;
    }
  | {
      type: "payment.add";
      orderId: string;
      cents: number;
      method: string;
      reference: string;
    }
  | { type: "payment.reverse"; paymentId: string; reason: string };
export function apply(
  s: State,
  c: Command,
  actor: Actor,
  at = new Date().toISOString(),
): string | undefined {
  const day = today(new Date(at));
  let result: string | undefined;
  const admin = () =>
    assert(actor.role === "admin", "Esta acción corresponde al administrador.");
  const customer = (id: string) =>
    assert(
      actor.role === "client" && actor.customerId === id,
      "Selecciona el cliente de este ejemplo.",
    );
  const staff = () =>
    assert(
      actor.role === "admin" || actor.role === "production",
      "Esta acción corresponde al equipo de producción.",
    );
  const getQ = (id: string) => {
    const q = s.quotes.find((q) => q.id === id);
    assert(q, "La cotización ya no está disponible.");
    return q;
  };
  const getO = (id: string) => {
    const o = s.orders.find((o) => o.id === id);
    assert(o, "El pedido ya no está disponible.");
    return o;
  };
  const mutable = (stage: Stage) =>
    assert(
      !["finished", "delivered", "cancelled"].includes(stage),
      "Este pedido ya está cerrado para cambios.",
    );
  const event = (id: string, text: string, isPublic = false) =>
    s.events.push({
      id: uid(),
      entityId: id,
      at,
      actor: actor.name,
      text,
      public: isPublic,
    });
  switch (c.type) {
    case "customer.save": {
      admin();
      assert(
        c.customer.name.trim().length >= 2,
        "Escribe el nombre del cliente.",
      );
      assert(
        c.customer.name.length <= 120 && c.customer.notes.length <= 2000,
        "El texto es demasiado largo.",
      );
      assert(
        !c.customer.email ||
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.customer.email),
        "Revisa el correo ficticio.",
      );
      const normalized = (v: string) => v.trim().toLocaleLowerCase();
      assert(
        !s.customers.some(
          (x) =>
            x.id !== c.customer.id &&
            ((c.customer.email &&
              normalized(x.email) === normalized(c.customer.email)) ||
              (c.customer.phone &&
                x.phone.replace(/\D/g, "") ===
                  c.customer.phone.replace(/\D/g, ""))),
        ),
        "Ya existe un cliente con ese correo o teléfono.",
      );
      const i = s.customers.findIndex((x) => x.id === c.customer.id);
      const value = {
        ...c.customer,
        name: c.customer.name.trim(),
        email: c.customer.email.trim(),
        phone: c.customer.phone.trim(),
      };
      if (i < 0) s.customers.push(value);
      else s.customers[i] = value;
      event(value.id, i < 0 ? "Cliente creado." : "Cliente actualizado.");
      result = value.id;
      break;
    }
    case "product.save": {
      admin();
      const p = c.product;
      assert(
        p.name.length <= 120 &&
          p.code.length <= 30 &&
          p.description.length <= 500,
        "El texto del producto es demasiado largo.",
      );
      assert(
        new Set(p.materials.map((m) => m.id)).size === p.materials.length &&
          new Set(p.finishes.map((f) => f.id)).size === p.finishes.length,
        "Los materiales y acabados deben tener identificadores únicos.",
      );
      assert(p.name.trim() && p.code.trim(), "Completa nombre y código.");
      assert(
        !s.products.some(
          (x) => x.id !== p.id && x.code.toLowerCase() === p.code.toLowerCase(),
        ),
        "El código ya está en uso.",
      );
      integer(p.min, 1, 100000, "Cantidad mínima");
      integer(p.max, p.min, 100000, "Cantidad máxima");
      integer(p.setupCents, 0, 100000000, "Preparación");
      integer(p.minMm, 1, 5000, "Medida mínima");
      integer(p.maxMm, p.minMm, 5000, "Medida máxima");
      if (p.sizeTiers?.length) {
        assert(
          p.unit === "piece",
          "Los rangos de tamaño se aplican a productos por pieza.",
        );
        let last = 0;
        for (const tier of p.sizeTiers) {
          integer(tier.maxMm2, last + 1, 25000000, "Límite de rango en mm²");
          integer(tier.factor, 1, 100, "Factor de rango");
          last = tier.maxMm2;
        }
        assert(
          last >= p.maxMm * p.maxMm,
          "Los rangos deben cubrir la medida máxima del producto.",
        );
      }
      assert(
        p.materials.length && p.finishes.length,
        "Incluye materiales y acabados.",
      );
      for (const m of p.materials) {
        assert(m.name.trim(), "Nombra todos los materiales.");
        integer(m.cents, 0, 100000000, "Costo de material");
      }
      for (const f of p.finishes) {
        assert(
          f.name.trim() && ["lot", "piece", "area"].includes(f.basis),
          "Revisa el acabado y su unidad.",
        );
        integer(f.cents, 0, 100000000, "Costo de acabado");
        assert(
          f.materials.length &&
            f.materials.every((id) => p.materials.some((m) => m.id === id)),
          "El acabado requiere materiales compatibles.",
        );
      }
      assert(
        p.materials.every((m) =>
          p.finishes.some((f) => f.materials.includes(m.id)),
        ),
        "Cada material necesita al menos un acabado válido.",
      );
      const i = s.products.findIndex((x) => x.id === p.id);
      if (i < 0) s.products.push(structuredClone(p));
      else s.products[i] = structuredClone(p);
      event(
        p.id,
        p.archived ? "Producto archivado." : "Producto y reglas guardados.",
      );
      break;
    }
    case "settings.save":
      admin();
      validateRules(c.settings);
      assert(
        c.settings.business.trim() &&
          c.settings.staff.length &&
          c.settings.staff.every((x) => x.trim()),
        "Completa negocio y personal.",
      );
      s.settings = structuredClone(c.settings);
      event("settings", "Configuración actualizada para futuras propuestas.");
      break;
    case "quote.save": {
      admin();
      assert(
        s.customers.some((x) => x.id === c.input.customerId),
        "El cliente ya no existe.",
      );
      assert(
        c.input.validUntil >= day,
        "La vigencia debe ser hoy o posterior.",
      );
      const calculated = calculateQuote(c.input, s.products, s.settings);
      if (c.quoteId) {
        const q = getQ(c.quoteId);
        assert(
          !c.expectedUpdatedAt || q.updatedAt === c.expectedUpdatedAt,
          "La cotización cambió en otra pestaña. Vuelve a abrirla.",
        );
        const d = draftVersion(q);
        assert(
          d && d.id === c.draftId,
          "El borrador cambió; vuelve a abrir la cotización.",
        );
        assert(
          !q.orderChangeId || getO(q.orderChangeId).stage !== "printing",
          "Detén la producción antes de cambiar la propuesta.",
        );
        assert(
          !q.orderChangeId || c.input.customerId === q.customerId,
          "Un cambio de pedido conserva su cliente.",
        );
        assert(
          !q.versions.some((v) => v.emittedAt) ||
            c.input.customerId === q.customerId,
          "Una cotización emitida conserva su cliente. Crea otra cotización para otro cliente.",
        );
        Object.assign(d, calculated);
        q.customerId = c.input.customerId;
        q.updatedAt = `${at}:${uid()}`;
        event(q.id, `Borrador v${d.number} guardado.`);
        result = q.id;
      } else {
        const id = uid(),
          versionId = uid();
        const q = {
          id,
          folio: `COT-${String(++s.counters.quote).padStart(4, "0")}`,
          customerId: c.input.customerId,
          currentId: versionId,
          versions: [
            {
              ...calculated,
              id: versionId,
              number: 1,
              status: "draft" as const,
              createdAt: at,
            },
          ],
          updatedAt: at,
        };
        s.quotes.push(q);
        event(id, "Cotización creada.");
        result = id;
      }
      break;
    }
    case "quote.revise": {
      admin();
      const q = getQ(c.quoteId);
      const v = currentVersion(q);
      assert(
        v.status !== "accepted",
        "Crea una propuesta de cambio desde el pedido aceptado.",
      );
      assert(!draftVersion(q), "Ya existe un borrador de revisión.");
      const d = {
        ...calculateQuote(
          { ...v, validUntil: addDays(day, 7) },
          s.products,
          s.settings,
        ),
        id: uid(),
        number: q.versions.length + 1,
        status: "draft" as const,
        createdAt: at,
        emittedAt: undefined,
        response: undefined,
        validUntil: addDays(day, 7),
      };
      q.versions.push(d);
      q.updatedAt = `${at}:${uid()}`;
      event(q.id, `Borrador de revisión v${d.number} creado.`);
      result = q.id;
      break;
    }
    case "quote.issue": {
      admin();
      const q = getQ(c.quoteId),
        d = draftVersion(q);
      assert(d && d.id === c.versionId, "Ese borrador ya no está disponible.");
      assert(d.validUntil >= day, "Actualiza la vigencia antes de emitir.");
      if (q.orderChangeId) mutable(getO(q.orderChangeId).stage);
      const v = currentVersion(q);
      assert(
        v.status !== "accepted",
        "El acuerdo aceptado no se puede sustituir.",
      );
      if (v.id !== d.id) v.status = "superseded";
      d.status = "sent";
      d.emittedAt = at;
      const customerRecord = s.customers.find((c) => c.id === q.customerId)!;
      d.customerSnapshot = {
        name: customerRecord.name,
        email: customerRecord.email,
        phone: customerRecord.phone,
      };
      d.businessSnapshot = {
        name: s.settings.business,
        email: s.settings.email,
        phone: s.settings.phone,
      };
      q.currentId = d.id;
      q.updatedAt = `${at}:${uid()}`;
      event(q.id, `Cotización v${d.number} emitida. Envío simulado.`, true);
      break;
    }
    case "quote.respond": {
      const q = getQ(c.quoteId);
      customer(q.customerId);
      const v = currentVersion(q);
      assert(
        v.id === c.versionId && effectiveStatus(v, day) === "sent",
        "Solo puedes responder a la versión vigente y válida.",
      );
      if (c.accept && q.orderChangeId) {
        const o = getO(q.orderChangeId);
        mutable(o.stage);
        assert(o.stage !== "printing", "La producción debe estar detenida.");
        assert(
          v.totalCents >= paid(s, o.id),
          "El nuevo total es menor al pago registrado. El administrador debe corregir los movimientos primero.",
        );
      }
      v.status = c.accept ? "accepted" : "rejected";
      v.response = { at, comment: c.comment.slice(0, 2000), actor: actor.name };
      if (c.accept)
        for (const other of q.versions)
          if (other.status === "draft") other.status = "cancelled";
      q.updatedAt = `${at}:${uid()}`;
      event(
        q.id,
        `Cliente ${c.accept ? "aceptó" : "rechazó"} la versión ${v.number}. ${c.comment}`,
        true,
      );
      if (q.orderChangeId && c.accept) {
        const o = getO(q.orderChangeId);
        o.agreements.push({ quoteId: q.id, version: structuredClone(v), at });
        o.openChangeId = undefined;
        event(
          o.id,
          `Nuevo acuerdo aceptado: ${q.folio} v${v.number}. Se validarán diseños y anticipo.`,
          true,
        );
      }
      break;
    }
    case "quote.cancel": {
      admin();
      const q = getQ(c.quoteId);
      assert(c.reason.trim(), "Indica el motivo.");
      assert(
        currentVersion(q).status !== "accepted",
        "Cancela la ejecución desde el pedido, conservando el acuerdo.",
      );
      for (const v of q.versions)
        if (["sent", "draft"].includes(v.status)) v.status = "cancelled";
      q.updatedAt = `${at}:${uid()}`;
      event(q.id, `Cotización cancelada: ${c.reason}`, true);
      break;
    }
    case "order.convert": {
      admin();
      const q = getQ(c.quoteId);
      assert(!q.orderChangeId, "Esta propuesta modifica un pedido existente.");
      const existing = s.orders.find((o) => o.sourceQuoteId === q.id);
      if (existing) return existing.id;
      const v = currentVersion(q);
      assert(v.status === "accepted", "Primero debe aceptar el cliente.");
      const id = uid();
      s.orders.push({
        id,
        folio: `PED-${String(++s.counters.order).padStart(4, "0")}`,
        customerId: q.customerId,
        sourceQuoteId: q.id,
        agreements: [{ quoteId: q.id, version: structuredClone(v), at }],
        due: addDays(day, v.leadDays),
        responsible: s.settings.staff[0],
        stage: "pending",
        notes: "",
        designs: [],
        createdAt: at,
      });
      event(id, "Pedido creado desde el acuerdo aceptado.", true);
      result = id;
      break;
    }
    case "order.update": {
      admin();
      const o = getO(c.orderId);
      mutable(o.stage);
      assert(
        /^\d{4}-\d{2}-\d{2}$/.test(c.due) &&
          !Number.isNaN(Date.parse(c.due)) &&
          new Date(c.due).toISOString().slice(0, 10) === c.due,
        "Revisa la fecha comprometida.",
      );
      assert(
        s.settings.staff.includes(c.responsible),
        "Selecciona un responsable activo.",
      );
      assert(c.notes.length <= 2000, "La nota es demasiado larga.");
      const changed = o.due !== c.due;
      o.due = c.due;
      o.responsible = c.responsible;
      o.notes = c.notes;
      event(o.id, "Responsable y datos operativos actualizados.");
      if (changed)
        event(o.id, `Fecha comprometida actualizada: ${c.due}.`, true);
      break;
    }
    case "order.stage": {
      staff();
      const o = getO(c.orderId),
        next = c.stage;
      const from = o.stage;
      if (next === "printing") {
        assert(
          ["pending", "stopped"].includes(from),
          "Solo puedes iniciar o reanudar un pedido pendiente/detenido.",
        );
        const reasons = blockers(s, o);
        assert(!reasons.length, reasons.join(" "));
      } else if (next === "stopped") {
        assert(
          from === "printing",
          "Solo puedes detener un trabajo en producción.",
        );
        assert(c.reason?.trim(), "Indica el motivo de detención.");
      } else if (next === "finished")
        assert(
          from === "printing",
          "Solo puedes terminar un trabajo en producción.",
        );
      else if (next === "delivered") {
        admin();
        assert(from === "finished", "Primero termina el trabajo.");
        assert(balance(s, o) === 0, "Liquida el saldo antes de entregar.");
      } else if (next === "cancelled") {
        admin();
        assert(
          !["delivered", "cancelled"].includes(from),
          "Este pedido ya está cerrado.",
        );
        assert(c.reason?.trim(), "Indica el motivo de cancelación.");
        if (o.openChangeId) {
          const q = getQ(o.openChangeId);
          for (const v of q.versions)
            if (["sent", "draft"].includes(v.status)) v.status = "cancelled";
          o.openChangeId = undefined;
        }
      } else throw new Error("La transición no está permitida.");
      o.stage = next;
      event(
        o.id,
        `Estado: ${next === "printing" ? "En producción" : next === "finished" ? "Terminado" : next === "delivered" ? "Entregado" : next === "stopped" ? "Detenido" : "Cancelado"}.${c.reason ? ` Motivo: ${c.reason}` : ""}`,
        true,
      );
      break;
    }
    case "order.change": {
      admin();
      const o = getO(c.orderId);
      mutable(o.stage);
      assert(
        o.stage !== "printing",
        "Detén la producción antes de proponer cambios.",
      );
      assert(!o.openChangeId, "Ya existe una propuesta de cambio pendiente.");
      const v = agreement(o),
        id = uid(),
        versionId = uid();
      const d = {
        ...calculateQuote(
          { ...v, validUntil: addDays(day, 7) },
          s.products,
          s.settings,
        ),
        id: versionId,
        number: 1,
        status: "draft" as const,
        createdAt: at,
        emittedAt: undefined,
        response: undefined,
        validUntil: addDays(day, 7),
      };
      s.quotes.push({
        id,
        folio: `COT-${String(++s.counters.quote).padStart(4, "0")}`,
        customerId: o.customerId,
        currentId: versionId,
        versions: [d],
        orderChangeId: o.id,
        updatedAt: at,
      });
      o.openChangeId = id;
      event(
        o.id,
        "Propuesta de cambio abierta. Inicio/reanudación bloqueados.",
        true,
      );
      result = id;
      break;
    }
    case "order.keepAgreement": {
      admin();
      const o = getO(c.orderId);
      mutable(o.stage);
      assert(
        o.openChangeId && c.reason.trim(),
        "Indica el motivo y la propuesta a resolver.",
      );
      const q = getQ(o.openChangeId);
      assert(
        ["rejected", "cancelled"].includes(currentVersion(q).status) &&
          !draftVersion(q),
        "Rechaza o cancela la propuesta antes de conservar el acuerdo anterior.",
      );
      o.openChangeId = undefined;
      event(o.id, `Se conserva el acuerdo anterior: ${c.reason}`, true);
      break;
    }
    case "order.note": {
      staff();
      const o = getO(c.orderId);
      assert(
        c.text.trim() && c.text.length <= 2000,
        "Escribe un avance de hasta 2000 caracteres.",
      );
      assert(
        !["delivered", "cancelled"].includes(o.stage),
        "El pedido está cerrado.",
      );
      event(o.id, c.text.trim(), true);
      break;
    }
    case "design.add": {
      admin();
      const o = getO(c.orderId);
      mutable(o.stage);
      assert(
        o.stage !== "printing",
        "Detén la producción antes de incorporar otro diseño.",
      );
      const line = agreement(o).lines.find((l) => l.id === c.lineId);
      assert(line, "La partida ya no forma parte del acuerdo.");
      assert(
        o.designs.filter((d) => d.lineId === line.id).length < 10,
        "Máximo 10 versiones por partida.",
      );
      const img = c.image;
      assert(
        ["image/png", "image/jpeg", "image/webp"].includes(img.type),
        "Usa PNG, JPEG o WebP.",
      );
      integer(img.bytes, 1, 5 * 1024 * 1024, "Tamaño de imagen");
      integer(img.width, 1, 4096, "Ancho de imagen");
      integer(img.height, 1, 4096, "Alto de imagen");
      assert(
        s.images.length < 50 &&
          s.images.reduce((n, i) => n + i.bytes, 0) + img.bytes <=
            50 * 1024 * 1024,
        "Se alcanzó el límite local de imágenes: 50 archivos / 50 MiB.",
      );
      assert(
        !s.images.some((i) => i.id === img.id),
        "La imagen ya está registrada.",
      );
      s.images.push(img);
      o.designs.push({
        id: uid(),
        lineId: line.id,
        number: o.designs.filter((d) => d.lineId === line.id).length + 1,
        at,
        author: actor.name,
        imageId: img.id,
        comment: c.comment.slice(0, 2000),
        specKey: specKey(line),
        review: "pending",
      });
      event(
        o.id,
        `Nueva versión de diseño para ${line.productName}; requiere aprobación.`,
        true,
      );
      break;
    }
    case "design.respond": {
      const o = getO(c.orderId);
      customer(o.customerId);
      mutable(o.stage);
      assert(o.stage !== "printing", "El diseño ya está en producción.");
      const d = latestDesign(o, c.lineId),
        l = agreement(o).lines.find((l) => l.id === c.lineId);
      assert(
        d &&
          l &&
          d.id === c.designId &&
          d.specKey === specKey(l) &&
          d.review === "pending",
        "Solo puedes responder al diseño vigente pendiente de revisión.",
      );
      assert(
        c.approve || c.comment.trim(),
        "Describe los cambios que necesitas.",
      );
      d.review = c.approve ? "approved" : "changes";
      d.response = { at, comment: c.comment.slice(0, 2000), actor: actor.name };
      event(
        o.id,
        `Diseño v${d.number} de ${l.productName}: ${c.approve ? "aprobado" : "cambios solicitados"}. ${c.comment}`,
        true,
      );
      break;
    }
    case "payment.add": {
      admin();
      const o = getO(c.orderId);
      assert(
        !["delivered", "cancelled"].includes(o.stage),
        "El pedido está cerrado para pagos.",
      );
      integer(c.cents, 1, balance(s, o), "Pago en centavos");
      assert(
        ["Transferencia", "Efectivo", "Tarjeta"].includes(c.method),
        "Selecciona un método.",
      );
      const id = uid();
      s.payments.push({
        id,
        orderId: o.id,
        cents: c.cents,
        at,
        method: c.method,
        reference: c.reference.slice(0, 100),
      });
      event(o.id, "Pago ficticio registrado.", true);
      break;
    }
    case "payment.reverse": {
      admin();
      const p = s.payments.find((p) => p.id === c.paymentId);
      assert(
        p && !p.reversesId && !s.payments.some((x) => x.reversesId === p.id),
        "Este movimiento ya fue revertido o no existe.",
      );
      const o = getO(p.orderId);
      assert(
        o.stage !== "delivered",
        "No se corrigen pagos de pedidos entregados.",
      );
      assert(c.reason.trim(), "Escribe el motivo de la reversión.");
      s.payments.push({
        id: uid(),
        orderId: o.id,
        cents: p.cents,
        at,
        method: p.method,
        reference: p.reference,
        reversesId: p.id,
        reason: c.reason,
      });
      if (o.stage === "printing" && blockers(s, o).length) {
        o.stage = "stopped";
        event(o.id, "Trabajo detenido al corregir el anticipo.", true);
      }
      event(o.id, `Pago revertido: ${c.reason}`, true);
      break;
    }
  }
  s.revision++;
  return result;
}
