const ALLOWED_HOSTS = new Set([
  'priscillaklein.com.br',
  'www.priscillaklein.com.br',
]);

const REQUIRED_FIELDS = ['nome', 'whatsapp', 'email', 'clinica', 'cidade', 'estado'];
const FORM_WEBHOOK_URL = 'https://n8nopen.openwave.online/webhook/previsa-formulario';

function clean(value, maxLength = 500) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const origin = request.headers.origin;
  if (origin) {
    try {
      const originHost = new URL(origin).hostname;
      const isPreview = originHost.endsWith('.vercel.app');
      if (!ALLOWED_HOSTS.has(originHost) && !isPreview) {
        return response.status(403).json({ ok: false, error: 'origin_not_allowed' });
      }
    } catch {
      return response.status(403).json({ ok: false, error: 'invalid_origin' });
    }
  }

  const input = request.body && typeof request.body === 'object' ? request.body : {};

  if (clean(input.website)) {
    return response.status(200).json({ ok: true });
  }

  const lead = {
    nome: clean(input.nome, 120),
    whatsapp: clean(input.whatsapp, 30),
    email: clean(input.email, 160),
    clinica: clean(input.clinica, 160),
    instagram: clean(input.instagram, 100),
    cidade: clean(input.cidade, 100),
    estado: clean(input.estado, 2),
    faturamento: clean(input.faturamento, 100),
    desafio: clean(input.desafio, 1000),
    origem: 'Landing Page PREVISA',
    data: clean(input.data, 100),
  };

  if (REQUIRED_FIELDS.some((field) => !lead[field])) {
    return response.status(400).json({ ok: false, error: 'required_fields_missing' });
  }

  try {
    const upstream = await fetch(FORM_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead),
      signal: AbortSignal.timeout(8000),
    });

    if (!upstream.ok) {
      console.error('PREVISA webhook failed', upstream.status);
      return response.status(502).json({ ok: false, error: 'lead_delivery_failed' });
    }

    return response.status(200).json({ ok: true });
  } catch (error) {
    console.error('PREVISA webhook unavailable', error instanceof Error ? error.message : error);
    return response.status(502).json({ ok: false, error: 'lead_delivery_failed' });
  }
}
