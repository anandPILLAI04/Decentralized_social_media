import React, { createContext, useContext, useState, useCallback } from 'react';
import { Snackbar, Alert, Slide } from '@mui/material';

/**
 * Global Toast Notification System
 *
 * Usage in any component:
 *   import { useToast } from '../hooks/useToast';
 *   const toast = useToast();
 *   toast.success('Post created!');
 *   toast.error('Something went wrong');
 *   toast.warning('Content flagged for review');
 *   toast.info('Notification sent');
 */

const ToastContext = createContext(null);

function SlideTransition(props) {
  return <Slide {...props} direction="up" />;
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState({
    open: false,
    message: '',
    severity: 'info', // 'success' | 'error' | 'warning' | 'info'
    duration: 4000,
  });

  const show = useCallback((message, severity = 'info', duration = 4000) => {
    setToast({ open: true, message, severity, duration });
  }, []);

  const success = useCallback((msg, duration) => show(msg, 'success', duration), [show]);
  const error = useCallback((msg, duration) => show(msg, 'error', duration ?? 5000), [show]);
  const warning = useCallback((msg, duration) => show(msg, 'warning', duration), [show]);
  const info = useCallback((msg, duration) => show(msg, 'info', duration), [show]);

  const handleClose = useCallback((_, reason) => {
    if (reason === 'clickaway') return;
    setToast((prev) => ({ ...prev, open: false }));
  }, []);

  const contextValue = { show, success, error, warning, info };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <Snackbar
        open={toast.open}
        autoHideDuration={toast.duration}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        TransitionComponent={SlideTransition}
      >
        <Alert
          onClose={handleClose}
          severity={toast.severity}
          variant="filled"
          elevation={6}
          sx={{ width: '100%', borderRadius: 3 }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback for components outside the provider — should never happen
    return {
      show: (msg) => console.warn('[Toast fallback]', msg),
      success: (msg) => console.log('[Toast]', msg),
      error: (msg) => console.error('[Toast]', msg),
      warning: (msg) => console.warn('[Toast]', msg),
      info: (msg) => console.info('[Toast]', msg),
    };
  }
  return ctx;
}

export default ToastContext;
