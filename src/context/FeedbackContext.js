import React, {
    createContext,
    useCallback,
    useContext,
    useRef,
    useState
} from 'react';
import './FeedbackHost.css';

let toastSeq = 0;

const FeedbackContext = createContext(null);

export function FeedbackProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const [confirmState, setConfirmState] = useState(null);
    const confirmResolverRef = useRef(null);

    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const toast = useCallback(
        (message, variant = 'info') => {
            const id = ++toastSeq;
            setToasts((prev) => [...prev, { id, message: String(message), variant }]);
            const ms = variant === 'error' ? 5200 : 3800;
            window.setTimeout(() => removeToast(id), ms);
        },
        [removeToast]
    );

    const confirm = useCallback((options) => {
        return new Promise((resolve) => {
            confirmResolverRef.current = resolve;
            setConfirmState({
                title: options.title ?? 'Confirm',
                message: options.message ?? '',
                confirmLabel: options.confirmLabel ?? 'OK',
                cancelLabel: options.cancelLabel ?? 'Cancel',
                danger: Boolean(options.danger)
            });
        });
    }, []);

    const resolveConfirm = useCallback((value) => {
        const fn = confirmResolverRef.current;
        confirmResolverRef.current = null;
        setConfirmState(null);
        fn?.(value);
    }, []);

    return (
        <FeedbackContext.Provider value={{ toast, confirm }}>
            {children}
            <div className="toast-stack" aria-live="polite">
                {toasts.map((t) => (
                    <div
                        key={t.id}
                        className={`toast toast-${t.variant}`}
                        role="status"
                    >
                        <span className="toast-text">{t.message}</span>
                        <button
                            type="button"
                            className="toast-dismiss"
                            onClick={() => removeToast(t.id)}
                            aria-label="Dismiss"
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>
            {confirmState && (
                <div
                    className="confirm-overlay"
                    role="presentation"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) resolveConfirm(false);
                    }}
                >
                    <div
                        className="confirm-dialog"
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="confirm-dialog-title"
                        aria-describedby="confirm-dialog-desc"
                    >
                        <h3 id="confirm-dialog-title">{confirmState.title}</h3>
                        <p id="confirm-dialog-desc">{confirmState.message}</p>
                        <div className="confirm-actions">
                            <button
                                type="button"
                                className="confirm-btn cancel"
                                onClick={() => resolveConfirm(false)}
                            >
                                {confirmState.cancelLabel}
                            </button>
                            <button
                                type="button"
                                className={`confirm-btn primary${confirmState.danger ? ' danger' : ''}`}
                                onClick={() => resolveConfirm(true)}
                            >
                                {confirmState.confirmLabel}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </FeedbackContext.Provider>
    );
}

export function useFeedback() {
    const ctx = useContext(FeedbackContext);
    if (!ctx) {
        throw new Error('useFeedback must be used within FeedbackProvider');
    }
    return ctx;
}
