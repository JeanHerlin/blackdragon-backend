import env from '../../config/env';

const GRAPH_URL = 'https://graph.facebook.com/v21.0';

interface QuickReplyOption {
  title: string;
  payload: string;
}

interface GenericElement {
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  buttons: { title: string; payload: string }[];
}

async function callSendApi(body: any): Promise<void> {
  if (!env.messenger.pageAccessToken) {
    throw new Error('MESSENGER_PAGE_ACCESS_TOKEN is not configured');
  }

  console.log(`[messengerClient] -> ${body.recipient?.id}:`, JSON.stringify(body.message ?? { sender_action: body.sender_action }));

  const response = await fetch(`${GRAPH_URL}/me/messages?access_token=${env.messenger.pageAccessToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[messengerClient] Send API failed (${response.status}):`, errorBody);
    throw new Error(`Messenger Send API responded with HTTP ${response.status}`);
  }

  console.log(`[messengerClient] sent ok -> ${body.recipient?.id}`);
}

// Shows the 3-dot "typing..." indicator — expires after ~20s or as soon as the next
// message is sent, whichever comes first, so there's no need for a matching typing_off.
export async function sendTypingOn(psid: string): Promise<void> {
  await callSendApi({ recipient: { id: psid }, sender_action: 'typing_on' });
}

export async function sendText(psid: string, text: string): Promise<void> {
  await callSendApi({ recipient: { id: psid }, message: { text } });
}

export async function sendQuickReplies(psid: string, text: string, options: QuickReplyOption[]): Promise<void> {
  await callSendApi({
    recipient: { id: psid },
    message: {
      text,
      quick_replies: options.map((o) => ({ content_type: 'text', title: o.title, payload: o.payload })),
    },
  });
}

// One Generic Template per call, capped at 10 elements per Messenger's own limit — the
// bot flow paginates the catalogue into batches of 10 if a type ever has more than that.
// quickReplies is optional — Messenger allows quick replies alongside an attachment
// message, used here to keep a "Recommencer" escape hatch available on the carousel too.
export async function sendGenericTemplate(psid: string, elements: GenericElement[], quickReplies?: QuickReplyOption[]): Promise<void> {
  await callSendApi({
    recipient: { id: psid },
    message: {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements: elements.slice(0, 10).map((el) => ({
            title: el.title,
            subtitle: el.subtitle,
            image_url: el.imageUrl || undefined,
            buttons: el.buttons.map((b) => ({ type: 'postback', title: b.title, payload: b.payload })),
          })),
        },
      },
      ...(quickReplies ? { quick_replies: quickReplies.map((o) => ({ content_type: 'text', title: o.title, payload: o.payload })) } : {}),
    },
  });
}

// A tappable button that opens the link directly in Messenger's built-in webview —
// nicer UX than pasting a raw URL as plain text, which the customer has to tap-and-copy.
export async function sendButtonTemplate(psid: string, text: string, buttonTitle: string, url: string): Promise<void> {
  await callSendApi({
    recipient: { id: psid },
    message: {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'button',
          text,
          buttons: [{ type: 'web_url', title: buttonTitle, url }],
        },
      },
    },
  });
}

// First/last name only — Meta's platform policy never exposes a public profile link
// through the Messenger API, by design (see conversation: this is a hard limit, not a
// gap on our side). Falls back silently to the PSID if the call fails for any reason.
export async function getUserDisplayName(psid: string): Promise<string> {
  if (!env.messenger.pageAccessToken) return psid;

  try {
    const response = await fetch(`${GRAPH_URL}/${psid}?fields=first_name,last_name&access_token=${env.messenger.pageAccessToken}`);
    if (!response.ok) return psid;
    const data = (await response.json()) as { first_name?: string; last_name?: string };
    const name = [data.first_name, data.last_name].filter(Boolean).join(' ');
    return name || psid;
  } catch {
    return psid;
  }
}
