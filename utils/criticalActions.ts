export interface CriticalActionRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  warning?: string;
  reasonRequired?: boolean;
  reasonLabel?: string;
  reasonOptions?: string[];
  reasonPlaceholder?: string;
  requireFinalConfirmation?: boolean;
  confirmationLabel?: string;
}

export interface CriticalActionResult {
  confirmed: boolean;
  reason?: string;
}

const CRITICAL_ACTION_EVENT = "critical-action-request";

export const criticalActionEventName = CRITICAL_ACTION_EVENT;

export const requestCriticalAction = (request: CriticalActionRequest) => {
  if (typeof window === "undefined") {
    return Promise.resolve<CriticalActionResult | null>(null);
  }

  return new Promise<CriticalActionResult | null>((resolve) => {
    window.dispatchEvent(
      new CustomEvent(CRITICAL_ACTION_EVENT, {
        detail: { request, resolve },
      })
    );
  });
};
