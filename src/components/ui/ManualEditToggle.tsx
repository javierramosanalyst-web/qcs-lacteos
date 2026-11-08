import React, { useEffect, useRef, useState } from 'react';
import { Button } from './Button';

export interface ManualEditToggleProps {
  manual: boolean;
  onChange: (value: boolean) => void;
}

export const ManualEditToggle: React.FC<ManualEditToggleProps> = ({ manual, onChange }) => {
  const [saved, setSaved] = useState(false);
  const cancelled = useRef(false);
  const prev = useRef(manual);

  useEffect(() => {
    if (prev.current && !manual) {
      setSaved(!cancelled.current);
      cancelled.current = false;
    }
    if (!prev.current && manual) {
      setSaved(false);
    }
    prev.current = manual;
  }, [manual]);

  if (manual) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        icon="close"
        onClick={() => {
          cancelled.current = true;
          onChange(false);
        }}
      >
        Cancelar edición
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {saved && (
        <Button
          type="button"
          variant="success"
          size="sm"
          icon="check_circle"
          disabled
          className="disabled:opacity-100"
        >
          Guardado
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        icon="edit"
        onClick={() => onChange(true)}
      >
        Editar
      </Button>
    </div>
  );
};
