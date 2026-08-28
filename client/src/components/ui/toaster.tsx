import { useToast } from "@/hooks/use-toast"
import { reportError } from "@/lib/error-report"
import { Button } from "@/components/ui/button"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, suppressReport, ...props }) {
        const isError = props.variant === "destructive"
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isError && !suppressReport && (
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  data-testid="button-report-error"
                  onClick={() => reportError({ title: coerce(title), description: coerce(description) })}
                >
                  Сообщить
                </Button>
              )}
              {action}
            </div>
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}

function coerce(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v)
}
