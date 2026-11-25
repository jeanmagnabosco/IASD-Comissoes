import { getAccessToken } from './firebaseAuth';

export interface CalendarEventPayload {
  summary: string;
  description: string;
  location?: string;
  startDateTime: string; // ISO string
  endDateTime: string;   // ISO string
}

export async function createGoogleCalendarEvent(event: CalendarEventPayload): Promise<{ success: boolean; eventId?: string; htmlLink?: string; error?: string }> {
  try {
    const token = await getAccessToken();
    if (!token) {
      return { 
        success: false, 
        error: 'É necessário conectar com sua Conta Google para sincronizar no Google Calendar diretamente.' 
      };
    }

    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: event.summary,
        description: event.description,
        location: event.location || 'Igreja Central - Sala de Reuniões da Comissão',
        start: {
          dateTime: event.startDateTime,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo',
        },
        end: {
          dateTime: event.endDateTime,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo',
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 30 },
            { method: 'email', minutes: 120 },
          ],
        },
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Falha na API do Google Calendar (${response.status})`);
    }

    const data = await response.json();
    return {
      success: true,
      eventId: data.id,
      htmlLink: data.htmlLink,
    };
  } catch (err: any) {
    console.error('Erro ao adicionar evento no Google Calendar:', err);
    return {
      success: false,
      error: err.message || 'Erro inesperado ao sincronizar com Google Calendar.',
    };
  }
}

/**
 * Generate direct web link to Google Calendar create event (guaranteed to work in all environments)
 */
export function generateDirectGoogleCalendarUrl(event: CalendarEventPayload): string {
  const start = new Date(event.startDateTime).toISOString().replace(/-|:|\.\d\d\d/g, '');
  const end = new Date(event.endDateTime).toISOString().replace(/-|:|\.\d\d\d/g, '');
  
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.summary,
    details: event.description,
    location: event.location || 'Igreja - Sala da Comissão',
    dates: `${start}/${end}`,
  });
  
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
