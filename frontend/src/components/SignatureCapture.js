import React, { useRef, useState, useEffect, useCallback } from 'react';

/**
 * SignatureCapture — reusable canvas signature pad.
 * Usage: <SignatureCapture onSave={(base64png) => ...} label="Customer Signature" />
 */
function SignatureCapture({ onSave, label = "Signature", width = 400, height = 180 }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = useCallback((e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
    setHasSignature(true);
    setSaved(false);
  }, []);

  const draw = useCallback((e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }, [isDrawing]);

  const endDraw = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    setSaved(false);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL('image/png');
    if (onSave) onSave(dataUrl);
    setSaved(true);
  };

  return (
    <div style={styles.container}>
      <label style={styles.label}>{label}</label>
      <div style={styles.canvasWrapper}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{ ...styles.canvas, width: '100%', height: 'auto', maxWidth: width }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {!hasSignature && (
          <div style={styles.placeholder}>✍️ Sign here</div>
        )}
      </div>
      <div style={styles.buttons}>
        <button onClick={clearSignature} style={styles.clearBtn}>Clear</button>
        <button onClick={saveSignature} disabled={!hasSignature || saved}
          style={{ ...styles.saveBtn, opacity: (hasSignature && !saved) ? 1 : 0.5 }}>
          {saved ? '✅ Saved' : '💾 Save Signature'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: { marginBottom: 16 },
  label: { display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 13, color: '#333' },
  canvasWrapper: {
    position: 'relative', border: '2px solid #ccc', borderRadius: 8,
    overflow: 'hidden', background: '#fff', touchAction: 'none',
  },
  canvas: { display: 'block', cursor: 'crosshair' },
  placeholder: {
    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
    color: '#ccc', fontSize: 18, pointerEvents: 'none', userSelect: 'none',
  },
  buttons: { display: 'flex', gap: 8, marginTop: 8 },
  clearBtn: {
    background: '#eee', color: '#555', border: 'none', padding: '7px 16px',
    borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
  },
  saveBtn: {
    background: '#0d7a3e', color: '#fff', border: 'none', padding: '7px 16px',
    borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
  },
};

export default SignatureCapture;
