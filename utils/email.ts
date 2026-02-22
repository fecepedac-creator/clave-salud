export function buildMailtoUrl(params: {
    to?: string;
    subject?: string;
    body?: string;
}): string {
    const to = (params.to || "").trim();
    const qs = new URLSearchParams();
    if (params.subject) qs.set("subject", params.subject);
    if (params.body) qs.set("body", params.body);
    const q = qs.toString();
    return `mailto:${encodeURIComponent(to)}${q ? `?${q}` : ""}`;
}

export function buildGmailComposeUrl(params: {
    to?: string;
    subject?: string;
    body?: string;
}): string {
    const qs = new URLSearchParams();
    // Gmail supports: view=cm, fs=1, to, su, body
    qs.set("view", "cm");
    qs.set("fs", "1");
    if (params.to) qs.set("to", params.to);
    if (params.subject) qs.set("su", params.subject);
    if (params.body) qs.set("body", params.body);
    return `https://mail.google.com/mail/?${qs.toString()}`;
}

/**
 * Tries to open Gmail compose in a new tab, with mailto fallback.
 * Returns true if it likely opened a new window/tab.
 */
export function openEmailCompose(params: {
    to?: string;
    subject?: string;
    body?: string;
}): boolean {
    try {
        const gmailUrl = buildGmailComposeUrl(params);
        const w = window.open(gmailUrl, "_blank", "noopener,noreferrer");
        if (w) return true;
    } catch {
        // ignore
    }

    try {
        window.location.href = buildMailtoUrl(params);
        return true;
    } catch {
        return false;
    }
}
