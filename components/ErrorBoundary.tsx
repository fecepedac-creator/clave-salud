import React, { Component, ReactNode, ErrorInfo } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  error?: Error;
  info?: ErrorInfo;
};

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log mínimo. Si luego agregas logging a Firestore/Functions, se integra aquí.
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught:", error, info);
    // @ts-expect-error - Fallo estático reportado en versiones cruzadas de tipos React
    this.setState({ info });
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      // @ts-expect-error - Fallo estático de typing
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
              <span className="text-red-300 font-bold">!</span>
            </div>
            <div>
              <h1 className="text-lg font-bold">Se produjo un error en la aplicación</h1>
              <p className="text-sm text-slate-400">
                Esto evita la pantalla en blanco y te deja un reporte para depurar.
              </p>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs overflow-auto">
            <div className="text-slate-300 font-semibold mb-2">Detalle:</div>
            <pre className="whitespace-pre-wrap break-words text-slate-400">
              {this.state.error?.message || "Error desconocido"}
              {"\n\n"}
              {this.state.error?.stack || ""}
            </pre>
          </div>

          <div className="flex gap-3 mt-5">
            <button
              onClick={this.handleReload}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-bold"
            >
              Recargar
            </button>
            <button
              onClick={() => {
                // @ts-expect-error - Fallo tipado react
                this.setState({ hasError: false, error: undefined, info: undefined });
              }}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold"
            >
              Intentar continuar
            </button>
          </div>

          <p className="text-[11px] text-slate-500 mt-4">
            Si esto ocurre tras “invitar administrador”, revisa también OAuth domains autorizados
            (Auth → Settings).
          </p>
        </div>
      </div>
    );
  }
}
