/**
 * Puente ligero para abrir la burbuja de chat en una conversación concreta desde
 * cualquier parte de la app (sin prop-drilling ni contexto global), vía un evento
 * de `window`. La burbuja (ConversationBubble) lo escucha.
 */
export const OPEN_CONVERSATION_EVENT = "ogm:open-conversation";

export interface OpenConversationDetail {
  conversationId: string;
}

/** Abre la burbuja en la conversación dada. */
export function openConversation(conversationId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<OpenConversationDetail>(OPEN_CONVERSATION_EVENT, {
      detail: { conversationId },
    }),
  );
}
