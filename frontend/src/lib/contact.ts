export type ContactPayload = {
  name: string;
  email: string;
  message: string;
};

export async function sendContact(payload: ContactPayload): Promise<{ ok: boolean; error?: string }>{
  try {
    const endpoint = (import.meta as any).env?.VITE_CONTACT_ENDPOINT as string | undefined;
    if (!endpoint) {
      return { ok: false, error: "VITE_CONTACT_ENDPOINT no está configurado" };
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        subject: "Nuevo contacto desde landing AcidIA",
        ...payload,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: text || `Error HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Error de red" };
  }
}

