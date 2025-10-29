interface ToastMessage {
  id: string;
  kind: "info" | "success" | "error";
  title: string;
  description?: string;
}

interface ToastAreaProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const variantClasses: Record<"info" | "success" | "error", string> = {
  info: "border-sky-400/70 bg-sky-100/40 text-sky-900",
  success: "border-emerald-400/70 bg-emerald-100/40 text-emerald-900",
  error: "border-destructive/60 bg-destructive/10 text-destructive",
};

const ToastArea = ({ toasts, onDismiss }: ToastAreaProps) => {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-xl border px-4 py-3 text-sm shadow-lg transition ${variantClasses[toast.kind]}`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="font-semibold">{toast.title}</p>
              {toast.description ? <p className="text-xs opacity-90">{toast.description}</p> : null}
            </div>
            <button
              type="button"
              className="text-xs font-medium uppercase tracking-wide opacity-70 transition hover:opacity-100"
              onClick={() => {
                onDismiss(toast.id);
              }}
            >
              Close
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ToastArea;
